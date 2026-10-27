/** Metres, +Z up. Geometry is consumed by both MuJoCo and Three.js. */
const box=(id,x,y,sx,sy,h=.13,color='#343434')=>({id,type:'box',position:[x,y,h],size:[sx,sy,h],color});
export const COURSE=Object.freeze({
 id:'chaos-lab-v2',name:'The Chaos Circuit',subtitle:'Six rooms. One very determined duck.',spawn:[0,0,.12],
 stages:[
  {id:'slalom',name:'Thread the slalom',objective:'CLEAR THE SLALOM',hint:'Follow the arrows around both barriers. W to walk · A / D to steer.',center:[.9,0],start:[0,0,.12]},
  {id:'football',name:'Duck football',objective:'SCORE A GOAL',hint:'Line up a foot with the ball. Q / E to kick. Score inside the yellow goal.',center:[2.9,0],start:[2.1,0,.12]},
  {id:'box',name:'Heavy lifting',objective:'MOVE THE BOX INTO THE TARGET',hint:'Walk into the cube. Keep it inside the yellow square until it settles.',center:[4.9,0],start:[4.15,0,.12]},
  {id:'sit',name:'Take a seat',objective:'SIT ON THE PLATFORM',hint:'Stop on the circle. R to sit and hold the pose, then R again to stand.',center:[6.6,0],start:[6.1,0,.12]},
  {id:'roll',name:'Controlled chaos',objective:'ROLL INSIDE THE ZONE',hint:'Enter the marked zone. F to roll. Land upright to open the exit.',center:[8.3,0],start:[7.65,0,.12]},
  {id:'final',name:'Bring it home',objective:'REACH THE FINISH',hint:'Thread the corridor, turn left at the arrow and cross the finish.',center:[10.8,.4],start:[9.5,0,.12]}
 ],
 checkpoints:[
  {id:'slalom',label:'Slalom exit',center:[1.95,0],normal:[1,0],width:1.6},
  {id:'football',label:'Football exit',center:[3.95,0],normal:[1,0],width:1.6},
  {id:'box',label:'Box exit',center:[5.95,0],normal:[1,0],width:1.6},
  {id:'sit',label:'Platform exit',center:[7.45,0],normal:[1,0],width:1.6},
  {id:'roll',label:'Roll exit',center:[9.35,0],normal:[1,0],width:1.6},
  {id:'final',label:'Final checkpoint',center:[11.15,.72],normal:[0,1],width:.65}
 ],
 finish:{id:'finish',label:'Finish',center:[11.15,1.5],normal:[0,1],width:.65},
 locks:[{id:'football',x:3.9},{id:'box',x:5.9},{id:'sit',x:7.4},{id:'roll',x:9.3}],
 football:{ball:[2.77,.055,.041],goal:{center:[3.3,.055],normal:[1,0],width:.78},radius:.04,height:.3},
 box:{spawn:[4.65,0,.046],target:[5.15,0],half:.045,targetHalf:.24,holdTicks:35},
 sit:{center:[6.65,0],radius:.34,holdTicks:35,maxHeight:.092},
 roll:{center:[8.3,0],half:[.64,.60],holdTicks:20},
 props:{ball:[2.77,.055,.041],block:[4.65,0,.046]},
 assistance:{ball:10,block:10,rescue:30},
 obstacles:[
  box('south-wall',5.4,-.92,6.1,.035),box('north-wall',5.1,.92,5.8,.035),box('start-wall',-.55,0,.035,.92),
  box('slalom-a',.7,-.43,.045,.38),box('slalom-b',1.32,.43,.045,.38),
  box('goal-left',3.44,.48,.18,.018,.15,'#F5D65B'),box('goal-right',3.44,-.37,.18,.018,.15,'#F5D65B'),box('goal-back',3.62,.055,.018,.44,.15),
  box('corridor-left',10.05,.29,.38,.035),box('corridor-right',10.05,-.29,.38,.035),
  box('final-pylon',10.65,-.22,.06,.12),box('final-outside',11.62,.4,.035,1.2),box('final-inside',10.69,1.16,.035,.53),
  box('finish-end',11.15,1.9,.49,.035)
 ],
 road:[[5.2,0,11.5,1.82],[11.15,1, .85,1.75]],bounds:[-.6,11.7,-.96,1.95]
});
export function courseGeometries(course=COURSE){
 const gates=[...course.checkpoints,course.finish];
 return [...course.obstacles,...gates.flatMap(g=>{const [x,y]=g.center,[nx,ny]=g.normal,t=[-ny,nx],half=g.width/2+.025;return [
  ...[-1,1].map((sign,i)=>({...box(`${g.id}-post-${i}`,x+t[0]*half*sign,y+t[1]*half*sign,.014,.014,.24,'#F5D65B'),gate:g.id})),
  {...box(`${g.id}-beam`,x,y,nx?.014:half+.014,nx?half+.014:.014,.014,'#F5D65B'),position:[x,y,.48],gate:g.id}
 ];})];
}
export function courseGeometryXml(course=COURSE){return courseGeometries(course).map(o=>`<geom name="course_${o.id}" type="${o.type}" pos="${o.position.join(' ')}" size="${o.size.join(' ')}" friction="1 0.005 0.0001"/>`).join('\n')+course.locks.map(g=>`<body name="lock_${g.id}" mocap="true" pos="${g.x} 0 .19"><geom name="lock_${g.id}_geom" type="box" size=".025 .89 .19" friction="1 .005 .0001"/></body>`).join('\n');}
export function withCourse(xml,course=COURSE){
 if(!xml.includes('</worldbody>'))throw new Error('Robot scene has no world body.');
 // Course-only prop contact tuning; the original robot/policies and playground remain intact.
 return xml.replace(/(<geom name="ducklab_ball_geom"[^>]*mass=")[^"]+/, '$1'+'0.018').replace(/(<geom name="ducklab_ball_geom"[^>]*friction=")[^"]+/, '$1'+'0.45 0.001 0.00008')
 .replace(/(<geom name="ducklab_block_geom"[^>]*mass=")[^"]+/, '$1'+'0.025').replace(/(<geom name="ducklab_block_geom"[^>]*friction=")[^"]+/, '$1'+'0.28 0.002 0.0001')
 .replace('</worldbody>',courseGeometryXml(course)+'\n</worldbody>');
}
