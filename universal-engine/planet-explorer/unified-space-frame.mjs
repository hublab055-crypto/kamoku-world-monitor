/**
 * Universal Engine: one double-precision solar-system / planet / ship / avatar frame.
 * Inertial values are SI metres in JS Number; GPU positions must be camera-relative.
 * Body-fixed latitude and longitude use the same basis as geo.mjs.
 */
import {AU_M, bodyById, orbitalPosition} from "./solar-system.mjs";
import {eastNorthUp, geoLocal, geoOffset, geoToWorld} from "./geo.mjs?v=0.8y-harbor";

export const PARKING_ORBIT_ALTITUDE_M = 120000;
export const SHIP_FLOOR_CLEARANCE_M = 2;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const add = (a,b)=>a.map((v,i)=>v+b[i]);
const sub = (a,b)=>a.map((v,i)=>v-b[i]);
const mul = (v,s)=>v.map(x=>x*s);
const dot = (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm = v=>{const l=Math.hypot(...v);if(l<1e-12)throw new RangeError("Degenerate frame vector");return mul(v,1/l);};
const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const lerp = (a,b,t)=>add(mul(a,1-t),mul(b,t));
const easing = x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const requireFinite = (...numbers)=>{if(!numbers.every(Number.isFinite))throw new RangeError("Invalid space-frame coordinate");};
const rotatedY = (v,angle)=>{
 const c=Math.cos(angle),s=Math.sin(angle);
 return [v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c];
};
export function bodyCenterM(bodyId,days){
 requireFinite(days);
 const au=orbitalPosition(bodyId,days);
 if(!au)throw new RangeError("Unknown celestial body");
 return mul([au.x,au.y,au.z],AU_M);
}
export function bodySpinRadians(bodyId,days){
 const body=bodyById(bodyId);
 if(!body?.rotationHours||body.rotationHours<=0)throw new RangeError("Body has no solid surface frame");
 requireFinite(days);
 return (days*24/body.rotationHours%1)*2*Math.PI;
}
/**
 * Body-fixed ENU -> inertial metres; x is starship starboard, z is aft.
 * The ship centre sits 2m above its landing pad so the cabin floor and ramp align.
 */
export function surfaceShipFrame(bodyId,days,lat,lon,altitudeM=0,yaw=0){
 const body=bodyById(bodyId);
 if(!body?.landable||!(body.radiusM>0))throw new RangeError("Non-landable body");
 requireFinite(days,lat,lon,altitudeM,yaw);
 if(Math.abs(lat)>90||altitudeM < -body.radiusM)throw new RangeError("Invalid surface pose");
 const center=bodyCenterM(bodyId,days),spin=bodySpinRadians(bodyId,days);
 const basis=eastNorthUp(lat,lon);
 const east=rotatedY(basis.east,spin),north=rotatedY(basis.north,spin),
  up=rotatedY(basis.up,spin);
 const right=add(mul(east,Math.cos(yaw)),mul(north,-Math.sin(yaw)));
 const back=add(mul(east,Math.sin(yaw)),mul(north,Math.cos(yaw)));
 const fixed=geoToWorld(lat,lon,altitudeM,body.radiusM);
 return {frame:"body",bodyId,days,lat,lon,yaw,altitudeM,
  position:add(center,rotatedY(fixed,spin)),
  right,up,back};
}
export function shipLocalToInertial(frame,local){
 if(!frame?.position||!local)throw new TypeError("Ship frame and local position required");
 const {x=0,y=0,z=0}=local;requireFinite(x,y,z);
 return add(frame.position,add(mul(frame.right,x),add(mul(frame.up,y),mul(frame.back,z))));
}
export function inertialToShipLocal(frame,world){
 if(!frame?.position||!Array.isArray(world)||world.length!==3)throw new TypeError("Ship frame and inertial position required");
 requireFinite(...world);
 const d=sub(world,frame.position);
 return {x:dot(d,frame.right),y:dot(d,frame.up),z:dot(d,frame.back)};
}
/** Rebase in float64 BEFORE casting to GPU float32, even at AU distances. */
export function cameraRelativeMeters(world,cameraWorld){
 if(!Array.isArray(world)||!Array.isArray(cameraWorld)||world.length!==3||cameraWorld.length!==3)
  throw new TypeError("Inertial world and camera vectors required");
 requireFinite(...world,...cameraWorld);
 return sub(world,cameraWorld);
}
/** Conversion at any latitude, including poles and the +/-180 degree seam. */
export function geodeticToShipLocal(site,radiusM,lat,lon){
 if(!site||![site.lat,site.lon,site.yaw,lat,lon,radiusM].every(Number.isFinite)||radiusM<=0)
  throw new RangeError("Invalid ship footprint");
 const {eastM,northM}=geoLocal(site.lat,site.lon,lat,lon,radiusM);
 const c=Math.cos(site.yaw),s=Math.sin(site.yaw);
 return {x:eastM*c-northM*s,z:eastM*s+northM*c};
}
export function shipLocalToGeodetic(site,radiusM,x,z){
 if(!site||![site.lat,site.lon,site.yaw,radiusM,x,z].every(Number.isFinite)||radiusM<=0)
  throw new RangeError("Invalid ship footprint");
 const c=Math.cos(site.yaw),s=Math.sin(site.yaw);
 return geoOffset(site.lat,site.lon,x*c+z*s,-x*s+z*c,radiusM);
}
function blendedBasis(a,b,t){
 const up=norm(lerp(a.up,b.up,t));
 const tentative=lerp(a.right,b.right,t);
 let projected=sub(tentative,mul(up,dot(tentative,up)));
 if(Math.hypot(...projected)<1e-8)projected=sub(a.right,mul(up,dot(a.right,up)));
 const right=norm(projected),back=norm(cross(right,up));
 return {right,up,back};
}
function slerpUnit(a,b,t){
 const cosine=clamp(dot(a,b),-1,1);
 if(cosine>.999999)return norm(lerp(a,b,t));
 if(cosine<-.999999){
  const side=norm(cross(a,Math.abs(a[1])<.9?[0,1,0]:[1,0,0]));
  return norm(add(mul(a,Math.cos(Math.PI*t)),mul(side,Math.sin(Math.PI*t))));
 }
 const angle=Math.acos(cosine),s=Math.sin(angle);
 return add(mul(a,Math.sin((1-t)*angle)/s),mul(b,Math.sin(t*angle)/s));
}
/**
 * Continuous position across dock -> ascent -> origin orbit -> transfer -> target
 * orbit -> entry -> touchdown. Route timing remains the existing game simulation;
 * this layer is deliberately NOT a Newtonian orbital integrator.
 */
export function shipJourneyFrame(v,days){
 if(v?.kind!=="surface-to-surface")throw new TypeError("Unsupported voyage");
 requireFinite(days);
 const o=v.launchSite?.bodyId===v.originId?v.launchSite:{lat:0,lon:0,yaw:0,padElevationM:0};
 const originHeight=(Number.isFinite(o.padElevationM)?o.padElevationM:0)+SHIP_FLOOR_CLEARANCE_M;
 const originNow=h=>surfaceShipFrame(v.originId,days,o.lat,o.lon,h,o.yaw||0);
 const departure=surfaceShipFrame(v.originId,v.launchDay,o.lat,o.lon,
  PARKING_ORBIT_ALTITUDE_M,o.yaw||0);
 const status=v.status,stage=easing(v.stageProgress||0);
 if(status==="docked")return {...originNow(originHeight),status};
 if(status==="ascent")return {...originNow(originHeight+
  (PARKING_ORBIT_ALTITUDE_M-originHeight)*stage),status};
 if(status==="origin-orbit")return {...originNow(PARKING_ORBIT_ALTITUDE_M),status};
 const targetId=v.destinationId;
 if(!bodyById(targetId)?.landable)return {...departure,status};
 const flightDays=Number.isFinite(v.flightDays)?v.flightDays:0;
 const arrivalDay=v.launchDay+flightDays;
 const destinationAt=(at,h= PARKING_ORBIT_ALTITUDE_M)=>surfaceShipFrame(targetId,at,0,0,h);
 const arrival=destinationAt(arrivalDay);
 if(["cruise","approach"].includes(status)){
  const t=clamp(v.progress||0,0,1);
  return {frame:"inertial",bodyId:null,days,status,altitudeM:null,
   position:lerp(departure.position,arrival.position,t),...blendedBasis(departure,arrival,t)};
 }
 if(status==="orbit")return {...destinationAt(days),status};
 const land=v.landingSite?.bodyId===targetId?v.landingSite:{lat:0,lon:0,yaw:0,padElevationM:0};
 const padHeight=(Number.isFinite(land.padElevationM)?land.padElevationM:0)+SHIP_FLOOR_CLEARANCE_M;
 const landed=surfaceShipFrame(targetId,days,land.lat,land.lon,padHeight,land.yaw||0);
 if(status==="entry"){
  const orbit=destinationAt(days);
  const t=stage,body=bodyById(targetId),center=bodyCenterM(targetId,days);
  const alt=PARKING_ORBIT_ALTITUDE_M*(1-t)+padHeight*t;
  const radial=slerpUnit(orbit.up,landed.up,t);
  return {frame:"body",bodyId:targetId,days,status,altitudeM:alt,
   position:add(center,mul(radial,body.radiusM+alt)),...blendedBasis(orbit,landed,t)};
 }
 return {...landed,status};
}
