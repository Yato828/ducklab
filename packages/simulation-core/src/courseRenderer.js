import * as THREE from 'three';
import {COURSE,courseGeometries} from '../../game-core/src/course.js';
export function buildCourse(scene){
 const root=new THREE.Group(),gateMeshes=new Map(),locks=new Map(),targets=new Map();scene.add(root);
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.88});
 function ground(w,h,x,y,color,z=.002){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,z,-y);root.add(m);return m;}
 function label(text,x,y,scale=.7,color='#F5D65B',angle=0){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='600 54px monospace';ctx.textAlign='center';ctx.fillText(text,512,83);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(scale,scale/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.set(-Math.PI/2,0,angle);mesh.position.set(x,.007,-y);root.add(mesh);return mesh;}
 function outline(x,y,w,h,color='#F5D65B'){ground(w,.014,x,y-h/2,color);ground(w,.014,x,y+h/2,color);ground(.014,h,x-w/2,y,color);ground(.014,h,x+w/2,y,color);}
 function mesh(o){const geom=o.type==='cylinder'?new THREE.CylinderGeometry(o.size[0],o.size[0],o.size[1]*2,24):new THREE.BoxGeometry(o.size[0]*2,o.size[2]*2,o.size[1]*2);const m=new THREE.Mesh(geom,material(o.color));m.position.set(o.position[0],o.position[2],-o.position[1]);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
 for(const [x,y,w,h] of COURSE.road)ground(w,h,x,y,'#262626');
 for(const o of courseGeometries()){const m=mesh(o);if(o.gate){if(!gateMeshes.has(o.gate))gateMeshes.set(o.gate,[]);gateMeshes.get(o.gate).push(m);}}
 for(const g of COURSE.locks){const m=mesh({type:'box',position:[g.x,0,.19],size:[.025,.89,.19],color:'#655B34'});locks.set(g.id,m);label('EXIT LOCKED',g.x-.12,0,.66);}
 ground(.025,1.7,-.2,0,'#F5D65B');label('START',-.35,0,.35);
 for(let i=0;i<COURSE.stages.length;i++){const s=COURSE.stages[i];label(String(i+1).padStart(2,'0')+' / '+s.name.toUpperCase(),s.center[0],-.73,1.4,'#B7B7AE');}
 for(const g of COURSE.checkpoints){const n=g.normal;ground(n[0]?.025:g.width,n[0]?g.width:.025,g.center[0],g.center[1],'#F5D65B',.004);}
 // Route arrows follow the tested path around the mandatory physical obstacles.
 for(const [x,y,a] of [[.25,.26,0],[.88,.28,0],[1.02,-.3,-Math.PI/2],[1.65,-.3,0],[2.15,0,0],[3.02,-.62,0],[3.8,-.62,0],[4.2,0,0],[5.5,-.42,0],[6.1,0,0],[7.65,0,0],[9.65,0,0],[10.5,0,0],[11.15,.45,Math.PI/2],[11.15,1.1,Math.PI/2]])label('➜',x,y,.36,'#F5D65B',a);
 const f=COURSE.football;outline(2.68,.055,.68,.7);label('SHOOT',2.35,.055,.32);ground(.025,f.goal.width,f.goal.center[0],f.goal.center[1],'#F5D65B',.005);label('GOAL',3.45,.055,.42);
 const b=COURSE.box;targets.set('box',ground(b.targetHalf*2,b.targetHalf*2,...b.target,'#544C29'));outline(...b.target,b.targetHalf*2,b.targetHalf*2);label('PUSH',4.42,0,.32);
 const s=COURSE.sit;const disc=new THREE.Mesh(new THREE.CircleGeometry(s.radius,48),material('#544C29'));disc.rotation.x=-Math.PI/2;disc.position.set(s.center[0],.003,-s.center[1]);root.add(disc);targets.set('sit',disc);label('SIT HERE',...s.center,.4);
 const r=COURSE.roll;targets.set('roll',ground(r.half[0]*2,r.half[1]*2,...r.center,'#303331'));outline(...r.center,r.half[0]*2,r.half[1]*2);label('ROLL ZONE',r.center[0],-.44,.65);
 const finish=COURSE.finish;for(let row=0;row<2;row++)for(let col=0;col<10;col++)ground(.065,.065,finish.center[0]+(col-4.5)*.065,finish.center[1]+(row-.5)*.065,(row+col)%2?'#F5D65B':'#121212',.005);label('FINISH',finish.center[0],1.72,.6);
 return {update(trial){for(let i=0;i<COURSE.checkpoints.length;i++){const id=COURSE.checkpoints[i].id,color=i<trial.checkpoint?'#79D8A5':i===trial.checkpoint?'#F5D65B':'#706745';for(const m of gateMeshes.get(id)||[])m.material.color.set(color);}for(const [id,m] of locks){const done=!!trial.completed?.[id];m.position.y=done?1:.19;m.material.color.set(done?'#79D8A5':'#655B34');}for(const [id,m] of targets)m.material.color.set(trial.completed?.[id]?'#39654F':'#544C29');}};
}
