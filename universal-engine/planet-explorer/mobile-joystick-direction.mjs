/** Camera-relative, eight-direction mobile movement without touching XR or keyboard input. */
export const wrapAngle=value=>Math.atan2(Math.sin(value),Math.cos(value));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function mobileJoystickMotion({stick,cameraYaw,actorYaw,dt,turnSpeed=9,deadZone=.12}){
 const right=clamp(Number(stick?.x)||0,-1,1);
 const forward=clamp(-(Number(stick?.y)||0),-1,1);
 const strength=Math.min(1,Math.hypot(right,forward));
 if(strength<deadZone||![cameraYaw,actorYaw,dt].every(Number.isFinite))return null;
 const targetYaw=wrapAngle(cameraYaw+Math.atan2(right,forward));
 const turn=clamp(wrapAngle(targetYaw-actorYaw),-turnSpeed*Math.max(0,dt),turnSpeed*Math.max(0,dt));
 const newYaw=wrapAngle(actorYaw+turn);
 const remaining=wrapAngle(targetYaw-newYaw);
 // A small residual strafe preserves the exact thumb direction while the body turns.
 return {targetYaw,turn,forward:Math.cos(remaining)*strength,strafe:Math.sin(remaining)*strength};
}
