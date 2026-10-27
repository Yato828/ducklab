import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { buildRig,setJoint } from '../upstream/duck.js';
import { JOINT_NAMES,DEFAULT_POSE } from '../upstream/constants.js';
const path=new URL('../../../apps/web/public/robot/mjlab/',import.meta.url);
const raw=await fs.readFile(new URL('microduck.glb',path));
const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const geometries=new Map();gltf.scene.traverse(o=>{if(o.isMesh)geometries.set(o.userData.meshFile||o.name||o.geometry.name,{display:o.geometry,welded:o.geometry});});
const k=JSON.parse(await fs.readFile(new URL('kinematics.json',path),'utf8'));
globalThis.location={search:''};
const rig=await buildRig(k,{geometryMap:geometries});
for(let i=0;i<14;i++)setJoint(rig,JOINT_NAMES[i],DEFAULT_POSE[i]);
rig.placer.updateMatrixWorld(true);
test('GPU model contains every referenced authentic visual mesh',()=>{
 const refs=new Set(k.bodies.flatMap(b=>b.geoms.map(g=>g.mesh).filter(Boolean)));for(const name of refs)assert.ok(geometries.has(name),`missing ${name}`);assert.ok(refs.size>30);
});
test('imported reference standing pose has physical quarter-metre scale',()=>{
 const box=new THREE.Box3().setFromObject(rig.placer),size=box.getSize(new THREE.Vector3());console.log('Reference standing dimensions (m)',size.toArray());assert.ok(size.y>.23&&size.y<.30);assert.ok(size.x>.1&&size.x<.25);assert.ok(Math.abs(box.min.y)<.015);
});
test('kinematic parent hierarchy and hinge ranges map all 14 policy joints',()=>{
 assert.equal(rig.joints.size,14);for(const b of k.bodies){const node=rig.bodies.get(b.name);assert.ok(node);if(b.parent)assert.equal(node.parent,rig.bodies.get(b.parent));}
 for(const name of JOINT_NAMES){const j=rig.joints.get(name);assert.ok(j);assert.ok(j.range[0]<j.range[1]);}
});
test('rendered joint rotation is constrained by original MJCF range',()=>{
 const j=rig.joints.get('head_yaw');setJoint(rig,'head_yaw',100);const expected=j.baseQuat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(j.axis,j.range[1]));assert.ok(j.body.quaternion.angleTo(expected)<1e-6);
});
