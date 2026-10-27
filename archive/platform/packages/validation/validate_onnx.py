#!/usr/bin/env python3
"""Offline policy inspection. Execute only in a resource-constrained private worker.

This does not establish robot stability or simulation safety. A successful result
still requires separate multi-scenario MuJoCo evaluation and moderation.
"""
import argparse
import hashlib
import json
import math
import os
import pathlib
import sys
import time

MAX_BYTES = 8 * 1024 * 1024
MAX_ELEMENTS = 2_000_000
MAX_NODES = 512
ALLOWED_OPERATORS = frozenset({
    "Add", "Sub", "Mul", "Div", "MatMul", "Gemm", "Relu", "Tanh", "Sigmoid",
    "Elu", "LeakyRelu", "Clip", "Constant", "Identity", "Cast", "Reshape",
    "Flatten", "Transpose", "Sqrt", "Pow", "ReduceMean", "Unsqueeze", "Squeeze",
})


def reject(message):
    raise ValueError(message)


def finite_tensor(tensor, numpy_helper, np):
    if tensor.external_data or tensor.data_location == 1:
        reject("External tensor data references are not permitted.")
    size = math.prod(tensor.dims)
    if size > MAX_ELEMENTS or any(d <= 0 or d > 8192 for d in tensor.dims):
        reject("Tensor exceeds element or dimension budget.")
    values = numpy_helper.to_array(tensor)
    if values.dtype.kind not in "fiu" or not np.isfinite(values).all():
        reject("Weights and constants must contain only finite numeric values.")
    return size


def validate(path, manifest_path):
    # These complement container cgroup/pid limits. Do not expose this process
    # as an unconstrained web handler. Keep native libraries to one CPU thread.
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    if sys.platform.startswith("linux"):
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
        resource.setrlimit(resource.RLIMIT_AS, (2 * 1024**3, 2 * 1024**3))
        resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    import numpy as np
    import onnx
    import onnxruntime as ort
    from onnx import numpy_helper, TensorProto, AttributeProto

    path = pathlib.Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
        reject("Model must be a regular file no larger than 8 MiB.")
    contents = path.read_bytes()
    manifest = json.loads(pathlib.Path(manifest_path).read_text())
    if manifest.get("observationSize") != 61 or manifest.get("actionSize") != 14 or len(manifest.get("jointNames", [])) != 14:
        reject("Unrecognized robot observation/action manifest.")
    model = onnx.load_model_from_string(contents)
    if model.functions or model.training_info:
        reject("Custom functions and training graphs are not permitted.")
    if any(op.domain not in ("", "ai.onnx") or op.version > 21 for op in model.opset_import):
        reject("Only audited standard ONNX operators through opset 21 are supported.")
    graph = model.graph
    if len(graph.node) > MAX_NODES:
        reject("Model exceeds the 512-operator budget.")
    if len(graph.sparse_initializer):
        reject("Sparse weights are not supported.")
    elements = 0
    for initializer in graph.initializer:
        elements += finite_tensor(initializer, numpy_helper, np)
    for node in graph.node:
        if node.domain not in ("", "ai.onnx") or node.op_type not in ALLOWED_OPERATORS:
            reject("Unsupported ONNX operator: " + node.op_type)
        for attribute in node.attribute:
            if attribute.type in (AttributeProto.GRAPH, AttributeProto.GRAPHS):
                reject("Nested executable graphs are not supported.")
            if attribute.type == AttributeProto.TENSOR:
                elements += finite_tensor(attribute.t, numpy_helper, np)
            if attribute.type == AttributeProto.TENSORS:
                for tensor in attribute.tensors:
                    elements += finite_tensor(tensor, numpy_helper, np)
    if elements > MAX_ELEMENTS:
        reject("Model exceeds the two-million-weight budget.")
    if len(graph.input) != 1 or len(graph.output) != 1:
        reject("Policy must expose exactly one observation input and one action output.")
    for info, width in ((graph.input[0], 61), (graph.output[0], 14)):
        tensor_type = info.type.tensor_type
        dimensions = tensor_type.shape.dim
        if tensor_type.elem_type != TensorProto.FLOAT or len(dimensions) != 2 or dimensions[1].dim_value != width or dimensions[0].dim_value not in (0, 1):
            reject("Policy tensors must be float32 [1,61] observations and [1,14] actions (symbolic batch is allowed).")
    onnx.checker.check_model(model, full_check=True)
    inferred = onnx.shape_inference.infer_shapes(model, strict_mode=True)
    for info in list(inferred.graph.value_info) + list(inferred.graph.output):
        dimensions = [d.dim_value for d in info.type.tensor_type.shape.dim]
        if any(d > 8192 for d in dimensions) or math.prod(d for d in dimensions if d > 0) > MAX_ELEMENTS:
            reject("An intermediate tensor exceeds the memory budget.")
    metadata = {entry.key: entry.value for entry in model.metadata_props}
    if "joint_names" in metadata:
        encoded = metadata["joint_names"]
        try:
            names = json.loads(encoded)
        except (ValueError, TypeError):
            names = encoded.replace(",", " ").split()
        if names != manifest["jointNames"]:
            reject("ONNX joint order does not match the pinned robot.")

    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.enable_cpu_mem_arena = False
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    session = ort.InferenceSession(contents, sess_options=options, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    rng = np.random.default_rng(42)
    default = np.asarray(manifest["defaultPose"], dtype=np.float32)
    target_limits = np.asarray(manifest["actuatorTargetLimits"], dtype=np.float32)
    joint_limits = np.asarray(manifest["jointLimits"], dtype=np.float32)
    inference_ms = []
    anatomical_excursions = 0
    for index in range(32):
        observation = np.zeros((1, 61), dtype=np.float32)
        # Exact upstream schema (game.js buildObs): angular velocity[3],
        # gravity[3], relative joint position[14], joint velocity[14],
        # previous action[14], then commands[13].
        observation[0, 5] = -1
        if index:
            observation[0, :3] = rng.uniform(-.1, .1, 3)
            gravity = np.asarray([rng.uniform(-.1, .1), rng.uniform(-.1, .1), -1], dtype=np.float32)
            observation[0, 3:6] = gravity / np.linalg.norm(gravity)
            observation[0, 48] = rng.uniform(-.2, .25)
            observation[0, 50] = rng.uniform(-1, 1)
            observation[0, 6:20] = rng.uniform(-.05, .05, 14)
            observation[0, 20:34] = rng.uniform(-.1, .1, 14)
        started = time.perf_counter()
        action = session.run([output_name], {input_name: observation})[0]
        elapsed = (time.perf_counter() - started) * 1000
        inference_ms.append(elapsed)
        if action.shape != (1, 14) or action.dtype != np.float32 or not np.isfinite(action).all():
            reject("Inference returned an invalid shape, non-float32 output, NaN or infinity.")
        targets = default + action[0] * float(manifest["actionScale"])
        if np.any(targets < target_limits[:, 0]) or np.any(targets > target_limits[:, 1]):
            reject("Policy commanded a target outside the upstream actuator control range.")
        anatomical_excursions += int(np.count_nonzero((targets < joint_limits[:, 0]) | (targets > joint_limits[:, 1])))
    # First run includes provider warmup; subsequent runs must fit the 20ms loop.
    if max(inference_ms[1:]) > 20:
        reject("Policy exceeds the 20ms CPU inference budget on this evaluation worker.")
    return {
        "accepted": True, "physicsValidated": False, "publicationStatus": "requires-simulation-review",
        "sha256": hashlib.sha256(contents).hexdigest(), "bytes": len(contents),
        "upstreamCommit": manifest["upstreamCommit"], "modelSha256": manifest["modelSha256"],
        "inputName": input_name, "outputName": output_name, "observationSize": 61, "actionSize": 14,
        "operators": sorted({node.op_type for node in graph.node}), "operatorCount": len(graph.node),
        "weightElements": elements, "samples": 32, "seed": 42,
        "inferenceMsMax": max(inference_ms[1:]), "inferenceMsMean": sum(inference_ms[1:]) / 31,
        "anatomicalTargetExcursions": anatomical_excursions,
        "notes": "Offline samples do not establish behavior or stability. Anatomical target excursions preserve upstream position-actuator semantics and require MuJoCo evaluation before publication.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()
    try:
        result = validate(args.model, args.manifest)
    except Exception as error:
        result = {"accepted": False, "physicsValidated": False, "error": str(error)}
    serialized = json.dumps(result, indent=2)
    if args.output:
        target = pathlib.Path(args.output)
        temporary = target.with_suffix(".tmp")
        temporary.write_text(serialized + "\n")
        temporary.replace(target)
    print(serialized)
    return 0 if result["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
