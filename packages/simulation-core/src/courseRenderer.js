import * as THREE from 'three';
import {COURSE,courseGeometries} from '../../game-core/src/course.js';
export function buildCourse(scene){
  const root=new THREE.Group(),gateMeshes=new Map();scene.add(root);
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.85});
  function ground(w,h,x,y,color,z=.001){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,z,-y);root.add(m);return m;}
  for(const [x,y,w,h] of COURSE.road)ground(w,h,x,y,'#E6E8DC');
  // Road paint has no collision. Every raised obstacle and gate uses the shared MJCF dimensions.
  for(const o of courseGeometries()){
    const geom=o.type==='cylinder'?new THREE.CylinderGeometry(o.size[0],o.size[0],o.size[1]*2,24):new THREE.BoxGeometry(o.size[0]*2,o.size[2]*2,o.size[1]*2);
    const mesh=new THREE.Mesh(geom,material(o.color));mesh.position.set(o.position[0],o.position[2],-o.position[1]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    if(o.gate){if(!gateMeshes.has(o.gate))gateMeshes.set(o.gate,[]);gateMeshes.get(o.gate).push(mesh);}
  }
  function label(text,x,y,scale=.36){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#343B31';ctx.font='600 26px Arial';ctx.textAlign='center';ctx.fillText(text,128,42);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(scale,scale/4),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.004,-y);root.add(mesh);}
  label('START',-.16,0,.32);
  for(let i=0;i<COURSE.checkpoints.length;i++){const g=COURSE.checkpoints[i],n=g.normal;ground(n[0]?.025:g.width,n[0]?g.width:.025,g.center[0],g.center[1],'#B5B18D',.003);label(String(i+1).padStart(2,'0'),g.center[0]-n[0]*.13,g.center[1]-n[1]*.13,.13);}
  for(let row=0;row<2;row++)for(let col=0;col<12;col++)ground(.071,.071,2.6+(col-5.5)*.071,1.45+(row-.5)*.071,(row+col)%2?'#343B31':'#FAFAF3',.004);
  label('FINISH',2.6,1.67,.45);
  for(let x=.15;x<2.3;x+=.24)ground(.04,.008,x,-.42,'#B8BCAA',.003);
  return {update(trial){for(let i=0;i<COURSE.checkpoints.length;i++){const color=i<trial.checkpoint?'#8DAA83':i===trial.checkpoint?'#E3BE52':'#D2C9A4';for(const mesh of gateMeshes.get(COURSE.checkpoints[i].id)||[])mesh.material.color.set(color);}for(const mesh of gateMeshes.get('finish')||[])mesh.material.color.set(trial.status==='finished'?'#8DAA83':'#E0CD88');}};
}
