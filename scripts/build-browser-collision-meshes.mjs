/** Reproduce official simulator's GLB→binary STL VFS conversion; retain source STL untouched. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { geometryToBinaryStl } from '../packages/simulation-core/upstream/duck.js';
const root=path.resolve('apps/web/public/robot/mjlab'),buf=await fs.readFile(path.join(root,'microduck.glb'));
const gltf=await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'');
const meshes=new Map();gltf.scene.traverse(o=>{if(o.isMesh){meshes.set(o.userData.meshFile||o.name||o.geometry.name,o.geometry);}});
const meta=JSON.parse(await fs.readFile(path.join(root,'physics-assets.json'),'utf8'));await fs.mkdir(path.join(root,'collision'),{recursive:true});
for(const f of meta.meshFiles){const geom=meshes.get(f);if(!geom)throw new Error('Missing essential collision geometry: '+f);await fs.writeFile(path.join(root,'collision',f),new Uint8Array(geometryToBinaryStl(geom)));}
meta.meshDir='collision';await fs.writeFile(path.join(root,'physics-assets.json'),JSON.stringify(meta,null,2));console.log('Rebuilt '+meta.meshFiles.length+' collision meshes exactly as the official browser simulator.');
