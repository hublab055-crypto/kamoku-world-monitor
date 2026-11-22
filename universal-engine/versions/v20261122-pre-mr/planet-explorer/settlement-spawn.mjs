/** Safe local spawn selection for named settlements.
 * Settlement coordinates remain the geographic origin; only the avatar is moved
 * away from the centre-line railway so scenery and saved edits keep their frame.
 */
import {geoOffset,terrainSurface} from "./geo.mjs?v=0.8y-harbor";
import {stationById} from "./railway.mjs?v=0.8z-crossing";
import {isRailRestricted} from "./railway-security.mjs?v=0.8z-crossing";

export function settlementSpawnCandidates(stationId){
 const crossing=stationById(stationId)?.crossing||{x:0,z:0};
 return [
  {x:crossing.x+18,z:crossing.z+14,yaw:-Math.PI/2},
  {x:crossing.x-18,z:crossing.z+14,yaw:Math.PI/2},
  {x:crossing.x+18,z:crossing.z-14,yaw:-Math.PI/2},
  {x:crossing.x-18,z:crossing.z-14,yaw:Math.PI/2},
  {x:crossing.x+26,z:crossing.z,yaw:-Math.PI/2},
  {x:crossing.x-26,z:crossing.z,yaw:Math.PI/2},
  {x:crossing.x+32,z:crossing.z+24,yaw:-Math.PI/2},
  {x:crossing.x-32,z:crossing.z+24,yaw:Math.PI/2}
 ];
}

export function chooseSettlementSpawn(terrain,origin,stationId,{sample=terrainSurface}={}){
 if(!terrain||!origin||![origin.lat,origin.lon].every(Number.isFinite))return null;
 for(const candidate of settlementSpawnCandidates(stationId)){
  const geo=geoOffset(origin.lat,origin.lon,candidate.x,candidate.z,terrain.planet.radiusM);
  const surface=sample(terrain,geo.lat,geo.lon);
  if(!surface||surface.water||surface.river||surface.elevationM>=2800||
   isRailRestricted(stationId,candidate.x,candidate.z,{margin:3}))continue;
  return {...candidate,lat:geo.lat,lon:geo.lon,elevationM:surface.elevationM};
 }
 return null;
}
