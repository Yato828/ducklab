/** Reproduce official simulator's GLB→binary STL VFS conversion; retain source STL untouched. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { geometryToBinaryStl } from '../packages/simulation-core/upstream/duck.js';
const root=path.resolve('apps/web/public/robot/mjlab'),buf=await fs.readFile(path.join(root,'microduck.glb'));
const gltf=await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'');
const meshes=new Map();gltf.scene.traverse(o=>{if(o.isMesh){meshes.set(o.userData.meshFile||o.name||o.geometry.name,o.geometry);}});
const metaFile=process.argv.includes('--rollers')?'physics-assets_rollers.json':'physics-assets.json';
const meta=JSON.parse(await fs.readFile(path.join(root,metaFile),'utf8'));await fs.mkdir(path.join(root,'collision'),{recursive:true});
for(const f of meta.meshFiles){let geom=meshes.get(f);if(!geom){const source=await fs.readFile(path.join(root,'meshes',f));geom=new STLLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));}await fs.writeFile(path.join(root,'collision',f),new Uint8Array(geometryToBinaryStl(geom)));}
meta.meshDir='collision';await fs.writeFile(path.join(root,metaFile),JSON.stringify(meta,null,2));console.log('Rebuilt '+meta.meshFiles.length+' collision meshes exactly as the official browser simulator.');
