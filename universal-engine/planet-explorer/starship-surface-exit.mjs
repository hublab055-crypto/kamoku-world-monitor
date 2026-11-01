import {geoOffset} from "./geo.mjs?v=0.8y-harbor";
import {shipLocalToWorld} from "./shipboard.mjs?v=0.8n-crew-walking";
import {surfaceLocalOffset} from "./reference-frames.mjs";
import {groundYawFromCabin,RAMP_END_Z} from "./starship-layout.mjs";

/** A landing changes the player's address within a region, not that region's
 * generator origin. The pad's geographic address remains authoritative. */
export function starshipSurfaceLanding(controller,pad){
 if(!pad||![pad.lat,pad.lon,pad.yaw].every(Number.isFinite)||
   (pad.bodyId&&pad.bodyId!==controller?.terrain?.planet?.id))throw Error("Invalid starship landing frame");
 const local=surfaceLocalOffset(controller.origin,pad.lat,pad.lon,controller.terrain.planet.radiusM);
 return {x:local.eastM,z:local.northM,lat:pad.lat,lon:pad.lon,yaw:pad.yaw};
}

/** Prepare an exit without changing the landing origin, world entities or ship.
 * Caller validates hatch/grounded state, then commits the returned player pose. */
export function starshipSurfaceExit(ship,controller,interior,{walkThrough=false}={}){
 const radiusM=controller?.terrain?.planet?.radiusM;
 const bodyId=controller?.terrain?.planet?.id;
 if(!ship?.present(bodyId)||![interior?.x,interior?.z,interior?.yaw].every(Number.isFinite))
  throw Error("Invalid grounded starship exit");
 const at=ship.offsetFromCoords(controller.origin,controller.x,controller.z,radiusM);
 if(!at)throw Error("Ship is outside the active surface frame");
 const point=shipLocalToWorld(at.x,at.z,ship.yaw,interior.x,walkThrough?interior.z:Math.max(RAMP_END_Z+.1,interior.z));
 const geo=geoOffset(controller.origin.lat,controller.origin.lon,point.x,point.z,radiusM);
 return {...point,...geo,yaw:groundYawFromCabin(interior.yaw,ship.yaw)};
}
