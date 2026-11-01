/**
 * Music venue doorway & collision, in settlement-local metres. Pure geometry:
 * keeps existing ExplorerController's planetary origin and movement authoritative.
 */
import {hallRoom,hallSeats} from "./music-hall.mjs?v=0.9aq";
export const HALL_EXTERIOR=Object.freeze({
 theater:{halfX:8.25,halfZ:9.1},school:{halfX:5.7,halfZ:6.2}
});
export function hallDoor(site){
 const footprint=HALL_EXTERIOR[site?.type];if(!footprint)return null;
 return {x:site.x,z:site.z+footprint.halfZ+.25,front:site.z+footprint.halfZ,halfX:1.1};
}
export function hallDoorNear(site,position,{inside=false,radius=2.5}={}){
 if(!site||!position)return false;
 const door=hallDoor(site),room=hallRoom(site.type);if(!door||!room)return false;
 const x=inside?position.x:position.x-door.x;
 const z=inside?position.z-(room.zMax-.65):position.z-door.z;
 return Math.hypot(x,z)<=radius;
}
/** Block entry from all walls except a confirmed open front-door crossing.
 * Caller must test only grounded foot travel in the active settlement.
 */
export function hallExteriorStep(before,after,sites,isDoorOpen,{radius=.32}={}){
 if(!before||!after)return {blocked:false,portal:null};
 for(const site of sites||[]){
  const size=HALL_EXTERIOR[site.type],door=hallDoor(site);
  if(!size)continue;
  const wasInside=Math.abs(before.x-site.x)<size.halfX+radius&&
    Math.abs(before.z-site.z)<size.halfZ+radius;
  const isInside=Math.abs(after.x-site.x)<size.halfX+radius&&
    Math.abs(after.z-site.z)<size.halfZ+radius;
  if(!isInside||wasInside)continue;
  const crossedFront=before.z>=door.front+radius&&after.z<door.front+radius;
  if(crossedFront&&Math.abs(after.x-door.x)<=door.halfX&&isDoorOpen(site)){
   return {blocked:false,portal:site};
  }
  return {blocked:true,portal:null,site};
 }
 return {blocked:false,portal:null};
}
/** A deterministic crowd arrives through the center aisle then turns into a row.
 * The positions are computed, never saved or simulated per-frame for distant halls.
 */
export function hallAudiencePose(kind,seatIndex,day,shows){
 const seats=hallSeats(kind),seat=seats[seatIndex],room=hallRoom(kind);
 if(!seat||!room||!Array.isArray(shows))return null;
 const minutes=(((Number(day)||0)%1+1)%1)*1440;
 let state=null;
 for(const show of shows){
  const t=show*60,offset=minutes-t;
  if(offset>=-18&&offset<52){state=offset;break;}
 }
 if(state===null)return null;
 const approach=Math.max(0,Math.min(1,(state+18-seatIndex*.35)/12));
 const leaving=Math.max(0,Math.min(1,(state-45-seatIndex*.18)/7));
 if(approach<=0||leaving>=1)return null;
 const f=leaving>0?1-leaving:approach;
 const aisleZ=room.zMax-.65;
 if(f<.45)return {x:0,z:aisleZ+(seat.z-aisleZ)*(f/.45),seated:false,phase:"walking"};
 const sideways=Math.max(0,Math.min(1,(f-.45)/.55));
 return {x:seat.x*sideways,z:seat.z,seated:sideways>=.97,phase:sideways>=.97?"seated":"walking"};
}
