import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import {POLICIES} from '../upstream/constants.js';
import {withCourse} from '../../game-core/src/course.js';
import {PhysicsEngine} from '../src/engine.js';
const publicRoot=new URL('../../../apps/web/public/',import.meta.url);
export async function createHeadless({course=true,record=true}={}){
 ort.env.wasm.numThreads=1;const mj=await loadMujoco(),vfs=new mj.MjVFS();
 const robot=new URL('robot/mjlab/',publicRoot),meta=JSON.parse(await fs.readFile(new URL('physics-assets.json',robot),'utf8'));
 for(const file of meta.meshFiles)vfs.addBuffer('assets/'+file,new Uint8Array(await fs.readFile(new URL((meta.meshDir||'meshes')+'/'+file,robot))));
 const xml=await fs.readFile(new URL('scene_ducklab.xml',robot),'utf8');const model=mj.MjModel.from_xml_string(course?withCourse(xml):xml,vfs),sessions={};
 const ensure=async key=>sessions[key]??(sessions[key]=await ort.InferenceSession.create(new Uint8Array(await fs.readFile(new URL(POLICIES[key].slice(1),publicRoot))),{executionProviders:['wasm']}));
 await ensure('walk');await ensure('stand');const engine=new PhysicsEngine(mj,model,ort,ensure,{course,record});
 return {engine,mj,model,async dispose(){engine.dispose();model.delete();vfs.delete();for(const s of Object.values(sessions))await s.release();}};
}
