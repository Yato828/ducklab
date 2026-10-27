import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildRig, loadKinematics, loadGlbGeometries, setJoint, MODEL_DIR } from '../upstream/duck.js';
import { materialHookFor, VARIANTS, meshMaterialsFor } from '../upstream/variants.js';
import { JOINT_NAMES, DEFAULT_POSE } from '../upstream/constants.js';
import {buildCourse} from './courseRenderer.js';

const initialDiagnostics = () => ({simTime:0,simulationHz:0,rendererFps:0,inferenceMs:0,physicsMs:0,mode:'loading',paused:false,contacts:0,jointNames:JOINT_NAMES,jointPositions:Array.from(DEFAULT_POSE),jointLimits:[],position:[0,0,.12],yaw:0,robotVersion:'ad9d41a / allcollisions',policyVersion:'official / 61 → 14 / 50 Hz'});
export async function createSimulation(container, options={}) {
  let disposed=false, worker, raf, rig, follow=options.mode!=='course', state=initialDiagnostics(),nextId=1;
  const pending=new Map(), total=options.preview?3:16;let completed=0;
  const progress=label=>{options.onProgress?.({completed:++completed,total,label});};
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xf1f1eb);scene.fog=new THREE.Fog(0xf1f1eb,options.mode==='course'?8:3,options.mode==='course'?25:9);
  const camera=new THREE.PerspectiveCamera(34,1,.005,30);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','Interactive original Microduck 3D robot');renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none';container.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.25;controls.maxDistance=4;controls.maxPolarAngle=Math.PI/2-.025;
  scene.add(new THREE.HemisphereLight(0xffffff,0xc5c0ae,2.4));
  const key=new THREE.DirectionalLight(0xfffbef,3.5);key.position.set(.6,1.5,.8);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1;key.shadow.camera.right=1;key.shadow.camera.top=1;key.shadow.camera.bottom=-1;key.shadow.camera.near=.01;key.shadow.camera.far=5;key.shadow.bias=-.00025;key.shadow.normalBias=.001;scene.add(key);scene.add(key.target);
  const fill=new THREE.DirectionalLight(0xffffff,1.8);fill.position.set(-1,.5,-.8);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xecece5,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(20,200,0xd4d7ce,0xdfe1d8);grid.position.y=.0005;grid.material.transparent=true;grid.material.opacity=.55;scene.add(grid);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.34,.341,128),new THREE.MeshBasicMaterial({color:0xc8cbbf,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.0008;scene.add(ring);
  const origin=new THREE.Mesh(new THREE.CircleGeometry(.006,16),new THREE.MeshBasicMaterial({color:0xb9bead}));origin.rotation.x=-Math.PI/2;origin.position.y=.001;scene.add(origin);
  const course=options.mode==='course'?buildCourse(scene):null;if(course){ring.visible=false;origin.visible=false;}
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.04,32,24),new THREE.MeshStandardMaterial({color:0xf2ce60,roughness:.55}));ball.castShadow=true;
  const block=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.09),new THREE.MeshStandardMaterial({color:0x8dada1,roughness:.7}));block.castShadow=true;
  // Same convex wedge vertex positions as scene_ducklab.xml, converted from MJCF +Z-up.
  const rv=[-.16,-.12,0,.16,-.12,0,.16,.12,0,-.16,.12,0,.16,-.12,.08,.16,.12,.08],rp=[];
  for(let i=0;i<rv.length;i+=3)rp.push(rv[i],rv[i+2],-rv[i+1]);
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));rg.setIndex([0,1,2,0,2,3,0,4,1,3,2,5,0,3,5,0,5,4,1,4,5,1,5,2]);rg.computeVertexNormals();
  const ramp=new THREE.Mesh(rg,new THREE.MeshStandardMaterial({color:0xd6c7ad,roughness:.9,side:THREE.DoubleSide}));ramp.castShadow=true;
  const objects=[ball,block,ramp];for(const o of objects){o.visible=false;scene.add(o);}
  const cvt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),objectQuat=new THREE.Quaternion();
  function resetCamera(){const p=state.position;if(course&&!follow){controls.target.set(1.4,0,-.5);camera.position.set(3.8,3.8,3.9);controls.maxDistance=8;}else{controls.target.set(p[0],.13,-p[1]);camera.position.set(p[0]+(course?1.05:.54),course?1.05:.34,-p[1]+(course?1.1:.65));}controls.update();}
  resetCamera();
  const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(container);
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();worker?.terminate();
    for(const {reject} of pending.values())reject(new Error('Simulation disposed.'));pending.clear();
    scene.traverse(o=>{if(o.isMesh){if(!o.userData.meshName)o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose();}});
    renderer.dispose();renderer.domElement.remove();options.signal?.removeEventListener('abort',dispose);
  }
  options.signal?.addEventListener('abort',dispose,{once:true});
  if(options.signal?.aborted){dispose();throw new DOMException('Simulation cancelled','AbortError');}
  function request(type,extra={}){
    if(disposed)return Promise.reject(new Error('Simulation disposed.'));
    if(!worker)return Promise.reject(new Error('Open Playground to load the physics engine.'));
    const id=nextId++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({type,id,...extra});});
  }
  let quality=options.quality||'auto',qualitySample=performance.now(),autoRatio=Math.min(window.devicePixelRatio,1.5);
  function setQuality(value){quality=value;const low=value==='low';renderer.setPixelRatio(low?1:value==='high'?Math.min(window.devicePixelRatio,2):autoRatio);renderer.shadowMap.enabled=!low;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}
  function setCosmetic(name){if(!VARIANTS[name]||!rig) return;const map=meshMaterialsFor(VARIANTS[name]);rig.root.traverse(o=>{if(!o.isMesh||!o.userData.meshName)return;const spec=map[o.userData.meshName]||VARIANTS[name].mechGray;o.material.color.setRGB(...spec.color);o.material.roughness=spec.roughness??.5;o.material.metalness=spec.metalness??0;});}
  setQuality(quality);
  let lastFrame=performance.now(),frameMeasureStart=lastFrame,frames=0,gamepadActive=false;
  const followTarget=new THREE.Vector3(), delta=new THREE.Vector3();
  function frame(now){
    if(disposed)return;
    const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;frames++;
    if(now-frameMeasureStart>=500){state.rendererFps=frames*1000/(now-frameMeasureStart);frames=0;frameMeasureStart=now;}
    if(follow&&rig){followTarget.set(state.position[0],.13,-state.position[1]);delta.copy(followTarget).sub(controls.target).multiplyScalar(1-Math.exp(-dt*5));controls.target.add(delta);camera.position.add(delta);}
    if(follow){key.position.set(state.position[0]+.6,1.5,-state.position[1]+.8);key.target.position.set(state.position[0],0,-state.position[1]);}
    if(quality==='auto'&&now-qualitySample>3000&&frames>0&&!document.hidden){qualitySample=now;if(state.rendererFps>0&&state.rendererFps<35&&autoRatio>1){autoRatio=1;renderer.setPixelRatio(autoRatio);renderer.shadowMap.enabled=false;}}
    controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  try{
    const k=await loadKinematics(`${MODEL_DIR}/kinematics.json`);progress('Robot kinematic hierarchy');
    await loadGlbGeometries();progress('Original GPU geometry');
    rig=await buildRig(k,{materialForMesh:materialHookFor(VARIANTS[options.cosmetic]||VARIANTS.classic)});progress('Original Microduck assembled');
    if(disposed)throw new DOMException('Simulation cancelled','AbortError');
    rig.placer.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(rig.placer);
    for(let j=0;j<14;j++)setJoint(rig,JOINT_NAMES[j],DEFAULT_POSE[j]);
    if(options.preview){state.mode='standing preview';state.paused=true;state.jointLimits=JOINT_NAMES.map(n=>rig.joints.get(n).range);options.onDiagnostics?.({...state});}
    else{
      worker=new Worker(new URL('./physics.worker.js',import.meta.url),{type:'module',name:'ducklab-physics'});
      await new Promise((resolve,reject)=>{
        const onAbort=()=>reject(new DOMException('Simulation cancelled','AbortError'));options.signal?.addEventListener('abort',onAbort,{once:true});
        worker.onerror=e=>{state.error=e.message||'Physics worker failed.';state.paused=true;options.onDiagnostics?.({...state});reject(new Error(state.error));};
        worker.onmessage=({data:m})=>{
          if(disposed)return;
          if(m.type==='progress')progress(m.label);
          else if(m.type==='ready'){options.signal?.removeEventListener('abort',onAbort);resolve();}
          else if(m.type==='error'){state.error=m.error;state.paused=true;options.onDiagnostics?.({...state});reject(new Error(m.error));}
          else if(m.type==='warning'){state.error=m.error;options.onDiagnostics?.({...state});}
          else if(m.type==='reply'){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve();}}
          else if(m.type==='state'){
            const q=m.state,trunk=rig.bodies.get('trunk_base');trunk.position.set(q[0],q[1],q[2]);trunk.quaternion.set(q[4],q[5],q[6],q[3]);
            for(let j=0;j<14;j++)setJoint(rig,JOINT_NAMES[j],q[7+j]);
            state.position=[q[0],q[1],q[2]];
            for(let j=0;j<3;j++){const at=21+j*7,o=objects[j];o.visible=Math.abs(q[at])<5&&Math.abs(q[at+1])<5;o.position.set(q[at],q[at+2],-q[at+1]);objectQuat.set(q[at+4],q[at+5],q[at+6],q[at+3]);o.quaternion.copy(cvt).multiply(objectQuat).multiply(cvt.clone().invert());}
            if(m.trial){course?.update(m.trial);options.onTrial?.(m.trial);}
            if(m.diagnostics){state={...state,...m.diagnostics,rendererFps:state.rendererFps};const heap=performance.memory?.usedJSHeapSize;if(heap)state.memoryBytes=heap;options.onDiagnostics?.({...state});}
          }
        };
        worker.postMessage({type:'init',mode:options.mode});
      });
    }
    return {
      setCommand(vx,wz){if(!Number.isFinite(vx)||!Number.isFinite(wz))throw new Error('Velocity must be finite.');worker?.postMessage({type:'command',vx,wz});},
      action:action=>request('action',{action}),pause(paused){state.paused=!!paused;worker?.postMessage({type:'pause',paused:!!paused});},
      reset:()=>{state.error=undefined;return request('reset');},startTrial:async()=>{state.error=undefined;await request('startTrial');follow=true;resetCamera();},setCosmetic,setQuality,step:()=>request('step'),getState:()=>({...state,position:[...state.position],jointPositions:[...state.jointPositions]}),
      screenshot:()=>new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('Screenshot encoding failed.')),'image/png')),
      captureStream:(fps=30)=>renderer.domElement.captureStream(fps),setFollowCamera:v=>{follow=!!v;resetCamera();},resetCamera,
      addObject:kind=>request('object',{kind}),perturb:()=>request('perturb'),dispose
    };
  }catch(e){dispose();throw e;}
}
