import {PILOT_SEAT_Z} from "./ship-interior.mjs?v=20261114-crew-social-2";

/** Real-world reach targets for Quest 3S grip-operated HOTAS, ship-local metres. */
export const XR_HOTAS=Object.freeze({
 left:Object.freeze({x:-.42,y:1.08,z:PILOT_SEAT_Z-.22}),
 right:Object.freeze({x:.42,y:1.08,z:PILOT_SEAT_Z-.22})
});
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const snap=(v)=>Math.abs(v)<.04?0:Math.abs(v)> .96?Math.sign(v):v;

/** Inverse of an XR rigid stage matrix, handling the view-independent tracking space. */
export function xrShipLocalPoint(pose,stage){
 if(!pose||!stage||pose.length!==16||stage.length!==16)return null;
 const dx=pose[12]-stage[12],dy=pose[13]-stage[13],dz=pose[14]-stage[14];
 const scale=Math.hypot(stage[0],stage[1],stage[2]);
 if(!Number.isFinite(scale)||scale<.0001)return null;
 const result={
  x:(stage[0]*dx+stage[1]*dy+stage[2]*dz)/(scale*scale),
  y:(stage[4]*dx+stage[5]*dy+stage[6]*dz)/(scale*scale),
  z:(stage[8]*dx+stage[9]*dy+stage[10]*dz)/(scale*scale)
 };
 return Object.values(result).every(Number.isFinite)?result:null;
}

/** Grip latch never uses cached/tracked-only hand poses to start a grab. */
export class VRShipHotas{
 constructor(){this.held={left:null,right:null};this.pitch=0;this.yaw=0;this.throttle=0;}
 reset(){this.held.left=this.held.right=null;this.pitch=this.yaw=0;}
 isHeld(hand){return Boolean(this.held[hand]);}
 grab(hand,pose,stage,voyage){
  if(!voyage?.seated||!Object.hasOwn(XR_HOTAS,hand)||this.held[hand])return false;
  const point=xrShipLocalPoint(pose,stage),base=XR_HOTAS[hand];
  if(!point||Math.hypot(point.x-base.x,point.y-base.y,point.z-base.z)>.24)return false;
  this.held[hand]={start:point,throttle:Number.isFinite(voyage.throttle)?voyage.throttle:0};
  return true;
 }
 release(hand){
  if(!Object.hasOwn(this.held,hand))return;
  this.held[hand]=null;
  if(hand==="right"){this.pitch=0;this.yaw=0;}
 }
 update(poses,stage,dt,voyage){
  if(!voyage?.seated){this.reset();return this.snapshot();}
  for(const hand of ["left","right"]){
   const held=this.held[hand];if(!held)continue;
   const point=xrShipLocalPoint(poses?.[hand],stage);
   if(!point){this.release(hand);continue;} // tracking lost: fail closed
   if(hand==="left"){
    this.throttle=snap(clamp(held.throttle+(held.start.z-point.z)/.28,-1,1));
    if(Math.abs(this.throttle-(voyage.throttle||0))>.001){
     voyage.setThrottle(this.throttle);
     voyage.setAutopilot(false);
    }
   }else{
    this.yaw=clamp((point.x-held.start.x)/.18,-1,1);
    this.pitch=clamp((held.start.z-point.z)/.18,-1,1);
    if(Number.isFinite(dt)&&dt>0&&(Math.abs(this.yaw)>.08||Math.abs(this.pitch)>.08)){
     voyage.setAutopilot(false);
     if(!voyage.inWarp){
      voyage.steer(this.yaw*45*Math.min(dt,.08));
      voyage.pitch(this.pitch*45*Math.min(dt,.08));
     }
    }
   }
  }
  if(!this.held.left)this.throttle=voyage.throttle||0;
  return this.snapshot();
 }
 snapshot(){return {leftHeld:this.isHeld("left"),rightHeld:this.isHeld("right"),
  throttle:this.throttle,pitch:this.pitch,yaw:this.yaw};}
}
