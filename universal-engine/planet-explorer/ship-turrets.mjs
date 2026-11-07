/** Editable ship-local hardpoints (metres); -Z is the bow. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const DEFAULT_TURRETS=Object.freeze([
 {id:"port",weapon:"pulse",x:-9,y:3,z:-3,enabled:true},
 {id:"starboard",weapon:"pulse",x:9,y:3,z:-3,enabled:true},
 {id:"launcher",weapon:"missile",x:0,y:4,z:5,enabled:true}
]);
export function normalizeTurrets(data){
 return DEFAULT_TURRETS.map((base,i)=>{
  const input=Array.isArray(data)?data[i]:null;
  const coord=(key,min,max)=>Number.isFinite(input?.[key])?clamp(input[key],min,max):base[key];
  return {...base,x:coord("x",-15,15),y:coord("y",2,8),z:coord("z",-12,12),
   enabled:input?.enabled!==false};
 });
}
const wrap=n=>((n+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
export function aimTurret(mount,target,dt){
 const delta=[target[0]-mount.x,target[1]-mount.y,target[2]-mount.z];
 const yaw=Math.atan2(-delta[0],-delta[2]);
 const pitch=Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
 const rate=(mount.weapon==="missile"?120:180)*Math.PI/180*Math.max(0,Math.min(.12,dt||0));
 mount.yaw=(mount.yaw||0)+clamp(wrap(yaw-(mount.yaw||0)),-rate,rate);
 mount.pitch=(mount.pitch||0)+clamp(pitch-(mount.pitch||0),-rate,rate);
 mount.aligned=Math.abs(wrap(yaw-mount.yaw))<.06&&Math.abs(pitch-mount.pitch)<.06;
 return mount;
}
