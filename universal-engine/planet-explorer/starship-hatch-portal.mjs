import {geoOffset} from "./geo.mjs?v=0.8y-harbor";
import {shipLocalToWorld,shipWorldToLocal} from "./shipboard.mjs?v=0.8n-crew-walking";
import {RAMP_END_Z,RAMP_START_Z,RAMP_WALK_HALF_WIDTH,starshipFloorHeight,cabinYawFromGround,groundYawFromCabin} from "./starship-layout.mjs";

export function shipSurfaceFrame(ship,controller,radiusM=controller?.terrain?.planet?.radiusM){
 const bodyId=controller?.terrain?.planet?.id;
 if(!ship?.present(bodyId))return null;
 const at=ship.offsetFromCoords(controller.origin,controller.x,controller.z,radiusM);
 return at?{x:at.x,z:at.z,yaw:ship.yaw}:null;
}
export function cabinSurfacePose(ship,controller,interior,{radiusM=controller?.terrain?.planet?.radiusM,elevationM=0}={}){
 const frame=shipSurfaceFrame(ship,controller,radiusM);
 if(!frame||![interior?.x,interior?.z,interior?.yaw].every(Number.isFinite))return null;
 const p=shipLocalToWorld(frame.x,frame.z,frame.yaw,interior.x,interior.z);
 const geo=geoOffset(controller.origin.lat,controller.origin.lon,p.x,p.z,radiusM);
 return {...p,...geo,yaw:groundYawFromCabin(interior.yaw,frame.yaw),
  feetM:(Number.isFinite(ship.padElevationM)?ship.padElevationM:elevationM)+starshipFloorHeight(interior.z)};
}
/** A swept inward crossing, rather than proximity auto-boarding. Returning the
 * actual endpoint preserves the movement remainder and prevents a cabin snap. */
export function crossingIntoStarship(ship,controller,previous){
 const frame=shipSurfaceFrame(ship,controller);
 if(!frame||!ship.hatchOpen||![previous?.x,previous?.z].every(Number.isFinite))return null;
 const a=shipWorldToLocal(frame.x,frame.z,frame.yaw,previous.x,previous.z);
 const b=shipWorldToLocal(frame.x,frame.z,frame.yaw,controller.x,controller.z);
 if(!(a.z>RAMP_END_Z&&b.z<=RAMP_END_Z&&b.z>=RAMP_START_Z)||
   Math.abs(b.x)>RAMP_WALK_HALF_WIDTH)return null;
 const t=(a.z-RAMP_END_Z)/(a.z-b.z),crossX=a.x+(b.x-a.x)*t;
 if(Math.abs(crossX)>RAMP_WALK_HALF_WIDTH)return null;
 return {...b,yaw:cabinYawFromGround(controller.yaw,frame.yaw)};
}
export function starshipRampSupport(ship,controller,radiusM=controller?.terrain?.planet?.radiusM){
 const frame=shipSurfaceFrame(ship,controller,radiusM);
 if(!frame||!ship.hatchOpen)return null;
 const p=shipWorldToLocal(frame.x,frame.z,frame.yaw,controller.x,controller.z);
 if(Math.abs(p.x)>RAMP_WALK_HALF_WIDTH||p.z<RAMP_START_Z||p.z>RAMP_END_Z+.2)return null;
 return starshipFloorHeight(p.z);
}
/** Reuse held ground/mobile controls without doubling keyboard input. Cabin
 * yaw/strafe have opposite signs to the existing planetary controller. */
export function cabinMovement(held,external={}){
 const n=k=>Number(held.has(k));
 const axis=(a,b,key)=>n(a)-n(b)||(Number.isFinite(external[key])?external[key]:0);
 return {forward:axis("forward","back","forward"),
  strafe:-axis("right","left","strafe")||0,turn:-axis("rightTurn","leftTurn","turn")||0};
}

/** A short camera transition in fixed regional coordinates. Render-origin
 * changes cannot affect its history; region changes discard that history. */
export class DockedShipCamera{
 constructor(){this.last=null;this.inside=false;this.regionKey=null;this.transition=null;}
 view(base,{cabin=null,cx,cz,regionKey,dt}){
  const inside=Boolean(cabin);
  if(this.regionKey!==regionKey){this.last=null;this.transition=null;this.regionKey=regionKey;}
  if(inside!==this.inside&&this.last)this.transition={from:this.last,elapsed:0};
  this.inside=inside;
  const chosen=cabin||base;
  let world={eye:[chosen.eye[0]+cx,chosen.eye[1],chosen.eye[2]+cz],
   target:[chosen.target[0]+cx,chosen.target[1],chosen.target[2]+cz],fovDeg:chosen.fovDeg};
  if(this.transition){
   this.transition.elapsed+=Math.max(0,Math.min(.1,dt||0));
   const t=Math.min(1,this.transition.elapsed/.22),a=t*t*(3-2*t),from=this.transition.from;
   world={eye:world.eye.map((v,i)=>from.eye[i]+(v-from.eye[i])*a),
    target:world.target.map((v,i)=>from.target[i]+(v-from.target[i])*a),fovDeg:from.fovDeg+(world.fovDeg-from.fovDeg)*a};
   if(t>=1)this.transition=null;
  }
  this.last=world;
  return {...base,...(cabin?{marker:false}:{}),fovDeg:world.fovDeg,
   eye:[world.eye[0]-cx,world.eye[1],world.eye[2]-cz],target:[world.target[0]-cx,world.target[1],world.target[2]-cz]};
 }
}
