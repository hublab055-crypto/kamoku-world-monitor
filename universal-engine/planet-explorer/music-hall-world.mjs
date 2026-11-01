/**
 * Planet-origin-neutral transforms between a walkable town music hall and
 * settlement-local ground metres. No global origin reset, no WebGL dependency.
 */
import {hallRoom} from "./music-hall.mjs?v=0.9ar";
export function hallWorldPoint(site,pose){
 if(!site||!pose||!hallRoom(site.type)||
  ![site.x,site.z,pose.x,pose.z].every(Number.isFinite))return null;
 const a=Number(site.angle)||0,c=Math.cos(a),s=Math.sin(a);
 return {x:site.x+c*pose.x+s*pose.z,z:site.z-s*pose.x+c*pose.z,
  yaw:(Number(pose.yaw)||0)+a};
}
export function hallLocalPoint(site,world){
 if(!site||!world||!hallRoom(site.type)||
  ![site.x,site.z,world.x,world.z].every(Number.isFinite))return null;
 const dx=world.x-site.x,dz=world.z-site.z,a=Number(site.angle)||0,c=Math.cos(a),s=Math.sin(a);
 return {x:c*dx-s*dz,z:s*dx+c*dz,yaw:(Number(world.yaw)||0)-a};
}
/** Synchronize only the avatar's actual world pose; preserve the geographic
 * landing origin and use the controller's existing geodesic converter. */
export function syncHallActorWorld(town,actor){
 const room=town?.inside,site=room&&town.find(room.townId,room.buildingId,"village");
 if(!site||!hallRoom(site.type)||!actor?.locationAt)return false;
 const p=hallWorldPoint(site,room.pose);if(!p)return false;
 const geo=actor.locationAt(p.x,p.z);
 if(!Number.isFinite(geo?.lat)||!Number.isFinite(geo?.lon))return false;
 actor.x=p.x;actor.z=p.z;actor.lat=geo.lat;actor.lon=geo.lon;
 actor.yaw=p.yaw;actor.moving=Boolean(room.pose.moving);
 actor.blocked=Boolean(room.pose.blocked);
 actor.clearMoveTarget?.();
 return true;
}
export function isSharedHallRoom(room){
 return Boolean(room&&hallRoom(room.type));
}
