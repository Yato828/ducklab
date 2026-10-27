import importlib.util
import pathlib
import tempfile
import unittest

import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("validator", HERE / "validate_onnx.py")
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ModelValidationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="ducklab-policy-test-")
        self.path = pathlib.Path(self.directory.name) / "model.onnx"

    def tearDown(self):
        self.directory.cleanup()

    def model(self, bias=0, input_width=61, operator="Gemm"):
        weights = numpy_helper.from_array(np.zeros((input_width, 14), dtype=np.float32), "weight")
        biases = numpy_helper.from_array(np.full((14,), bias, dtype=np.float32), "bias")
        graph = helper.make_graph(
            [helper.make_node(operator, ["obs", "weight", "bias"], ["actions"])], "test-policy",
            [helper.make_tensor_value_info("obs", TensorProto.FLOAT, [1, input_width])],
            [helper.make_tensor_value_info("actions", TensorProto.FLOAT, [1, 14])],
            [weights, biases],
        )
        model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 19)])
        model.ir_version = 10
        return model

    def validate(self, model):
        onnx.save_model(model, self.path)
        return validator.validate(self.path, HERE / "policy-compatibility.json")

    def test_valid_61_to_14_model_runs_actual_cpu_inference(self):
        result = self.validate(self.model())
        self.assertTrue(result["accepted"])
        self.assertFalse(result["physicsValidated"])
        self.assertEqual(result["samples"], 32)
        self.assertEqual(result["publicationStatus"], "requires-simulation-review")

    def test_wrong_observation_dimension_rejected(self):
        with self.assertRaisesRegex(ValueError, "61"):
            self.validate(self.model(input_width=60))

    def test_nonfinite_weights_rejected_before_inference(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            self.validate(self.model(bias=float("nan")))

    def test_target_outside_actual_actuator_range_rejected(self):
        with self.assertRaisesRegex(ValueError, "actuator control range"):
            self.validate(self.model(bias=100))

    def test_unapproved_operator_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported ONNX operator"):
            self.validate(self.model(operator="Loop"))

    def test_external_data_reference_rejected_without_opening_external_file(self):
        model = self.model()
        tensor = model.graph.initializer[0]
        tensor.ClearField("raw_data")
        tensor.data_location = TensorProto.EXTERNAL
        tensor.external_data.add(key="location", value="../../secrets")
        # Serialize directly: onnx.save_model may attempt to resolve external data.
        self.path.write_bytes(model.SerializeToString())
        with self.assertRaisesRegex(ValueError, "External tensor data"):
            validator.validate(self.path, HERE / "policy-compatibility.json")

    def test_wrong_joint_order_rejected(self):
        model = self.model()
        model.metadata_props.add(key="joint_names", value='["fake"]')
        with self.assertRaisesRegex(ValueError, "joint order"):
            self.validate(model)


if __name__ == "__main__":
    unittest.main()
