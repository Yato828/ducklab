import { DEFAULT_POSE } from '../upstream/constants.js';
/** Inverse trunk quaternion applied to world -Z. MuJoCo quaternion order w,x,y,z. */
export function projectedGravity(q) {
  const w=q[0],x=q[1],y=q[2],z=q[3];
  return [2*(w*y-x*z),-2*(y*z+w*x),-1+2*(x*x+y*y)];
}
/** Verified upstream 61-vector: gyro3, gravity3, q14, qdot14, previousAction14, command13. */
export function buildObservation({gyro,quaternion,positions,velocities,lastAction,command},out=new Float32Array(61)) {
  if(positions.length!==14||velocities.length!==14||lastAction.length!==14||command.length!==13)throw new Error('Microduck policy requires 14 servo joints and 13 command values.');
  out.set(gyro,0);out.set(projectedGravity(quaternion),3);
  for(let i=0;i<14;i++)out[6+i]=positions[i]-DEFAULT_POSE[i];
  out.set(velocities,20);out.set(lastAction,34);out.set(command,48);
  if(!out.every(Number.isFinite))throw new Error('Non-finite policy observation.');
  return out;
}
