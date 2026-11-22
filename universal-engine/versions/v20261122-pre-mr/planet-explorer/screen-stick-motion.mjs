/**
 * Virtual touch stick: +x points to the right of the SCREEN, +y points down.
 * A third-person camera looking toward the avatar's front has world-right on
 * the -X side when heading north. Do not treat touch X as actor-local strafe.
 * Pure geometry so Safari, desktop pointer and tests use the same mapping.
 */
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const wrapAngle=(a)=>Math.atan2(Math.sin(a),Math.cos(a));
const FOLLOW_MODES=new Set(["follow","shoulder","orbitTarget","tactical"]);

export function screenHeadingForStick(camera,avatarYaw){
 if(!Number.isFinite(avatarYaw))throw new TypeError("Invalid avatar yaw");
 const mode=camera?.mode;
 const offset=Number.isFinite(camera?.config?.yawOffset)?camera.config.yawOffset:0;
 // In a top-down tactical view the camera sits in front of the actor,
 // unlike the follow/shoulder cameras behind the actor.
 return wrapAngle(avatarYaw+offset+(mode==="tactical"?Math.PI:0));
}

/** Convert screen-space movement into avatar-local axes AFTER a smooth turn.
 * Forward+strafe preserve screen-space travel even before the turn completes.
 * The caller applies turn directly and must keep the camera world heading fixed.
 */
export function screenStickFacing(stick,avatarYaw,screenYaw,dt,{deadzone=.12,turnRate=9}={}){
 const x=clamp(Number(stick?.x)||0,-1,1),y=clamp(Number(stick?.y)||0,-1,1);
 const magnitude=clamp(Math.hypot(x,y),0,1);
 if(magnitude<=deadzone||![avatarYaw,screenYaw,dt].every(Number.isFinite))
  return {active:false,turn:0,forward:0,strafe:0};
 const desiredYaw=wrapAngle(screenYaw-Math.atan2(x,-y));
 const delta=wrapAngle(desiredYaw-avatarYaw);
 const maxTurn=clamp(dt,0,.1)*Math.max(0,turnRate);
 const turn=clamp(delta,-maxTurn,maxTurn);
 const remaining=wrapAngle(desiredYaw-avatarYaw-turn);
 return {active:true,turn,
  forward:magnitude*Math.cos(remaining),
  strafe:magnitude*Math.sin(remaining),desiredYaw};
}

/** Compensate third-person camera orbit when the avatar rotates via the stick.
 * No adjustment is made to unrelated VR, free-camera, or legacy camera modes.
 */
export function keepStickCameraHeading(camera,turn){
 if(!camera||!FOLLOW_MODES.has(camera.mode)||!Number.isFinite(turn)||turn===0)return;
 const offset=Number.isFinite(camera.config?.yawOffset)?camera.config.yawOffset:0;
 camera.config.yawOffset=wrapAngle(offset-turn);
}
