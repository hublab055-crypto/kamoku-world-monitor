import {geoOffset,terrainSurface} from "./geo.mjs?v=0.8y-harbor";
const finite=Number.isFinite;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const FOOTPRINT=Object.freeze([
 [0,0],[-2.65,-9],[2.65,-9],[-2.65,8],[2.65,8],[-7,4],[7,4],
 [0,12],[0,-13]
]);
/** Evaluate all feet, wings and fuselage rather than testing only the center. */
export function evaluateStarshipPad(terrain,lat,lon,yaw=0){
 if(!terrain?.planet?.radiusM||![lat,lon,yaw].every(finite)||Math.abs(lat)>=89)return null;
 const radius=terrain.planet.radiusM,co=Math.cos(yaw),si=Math.sin(yaw);
 let min=Infinity,max=-Infinity;
 for(const [x,z] of FOOTPRINT){
  const geo=geoOffset(lat,lon,x*co+z*si,-x*si+z*co,radius);
  const s=terrainSurface(terrain,geo.lat,geo.lon);
  if(!s||s.water||s.river||s.lake||!finite(s.elevationM)||s.elevationM>=2800)return null;
  min=Math.min(min,s.elevationM);max=Math.max(max,s.elevationM);
 }
 return {lat,lon,yaw,padElevationM:max+.12,reliefM:max-min,
  safe:max-min<=5.5};
}
/** Try pads ahead of the explorer; the ramp (+Z) should face the player's landing point.
 * This never moves the avatar or modifies the planetary landscape. */
export function findStarshipPad(terrain,point,{yaw=0,distanceM=30}={}){
 if(!point||![point.lat,point.lon,yaw,distanceM].every(finite))return null;
 const dirs=[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI,3*Math.PI/4,-3*Math.PI/4];
 const distances=[distanceM,distanceM+14,distanceM+30,distanceM+55,distanceM+85];
 let best=null;
 for(const dist of distances)for(const offset of dirs){
  const candidateYaw=yaw+offset;
  const geo=geoOffset(point.lat,point.lon,
   -Math.sin(candidateYaw)*dist,-Math.cos(candidateYaw)*dist,terrain.planet.radiusM);
  const pad=evaluateStarshipPad(terrain,geo.lat,geo.lon,candidateYaw);
  if(!pad?.safe)continue;
  const score=pad.reliefM*8+dist*.16+Math.abs(offset)*5;
  if(!best||score<best.score)best={...pad,distanceM:dist,score};
 }
 return best?.safe?best:null;
}
export function starshipDescentHeight(progress){
 const p=clamp(finite(progress)?progress:0,0,1);
 return 85*(1-p)*(1-p);
}
