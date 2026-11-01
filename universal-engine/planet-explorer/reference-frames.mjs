/** CPU-only metre/second reference frames. Never mutate a controller or a save. */
import {rotateX,rotateY,TAU} from "../planet/planet-core.mjs";
import {AU_M,bodyById,orbitalPosition} from "./solar-system.mjs";
import {eastNorthUp,geoNormal,geoOffset,geoToWorld} from "./geo.mjs?v=0.8y-harbor";

const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,k)=>a.map(v=>v*k);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const IDENTITY=[[1,0,0],[0,1,0],[0,0,1]];
const vector=v=>{
 if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw TypeError("Expected a finite 3-vector");
 return [...v];
};
const objectVector=v=>[v.x,v.y,v.z];
const rotate=(axes,p)=>axes[0].map((_,i)=>axes.reduce((v,a,j)=>v+a[i]*p[j],0));
const inverseRotate=(axes,p)=>axes.map(a=>dot(a,p));
const positive=v=>{if(!Number.isFinite(v)||v<=0)throw RangeError("Expected a positive scale");return v;};

/** Axes are columns, expressed in the parent frame. Velocity is the origin's
 * parent-frame velocity; angularVelocity is radians/s in the parent frame. */
export function rigidFrame({id,origin=[0,0,0],axes=IDENTITY,velocity=[0,0,0],angularVelocity=[0,0,0]}={}){
 if(typeof id!=="string"||!id)throw TypeError("Frame ID required");
 if(!Array.isArray(axes)||axes.length!==3)throw TypeError("Three frame axes required");
 const basis=axes.map(vector);
 if(basis.some(a=>Math.abs(norm(a)-1)>1e-10)||
    Math.abs(dot(basis[0],basis[1]))>1e-10||Math.abs(dot(basis[1],basis[2]))>1e-10||
    Math.abs(dot(basis[2],basis[0]))>1e-10||dot(cross(basis[0],basis[1]),basis[2])<1-1e-10)
  throw RangeError("Frame axes must be a right-handed orthonormal basis");
 return Object.freeze({id,origin:Object.freeze(vector(origin)),
  axes:Object.freeze(basis.map(Object.freeze)),velocity:Object.freeze(vector(velocity)),
  angularVelocity:Object.freeze(vector(angularVelocity))});
}
export function toParent(frame,position,velocity=[0,0,0]){
 const offset=rotate(frame.axes,vector(position));
 return {position:add(frame.origin,offset),
  velocity:add(add(frame.velocity,cross(frame.angularVelocity,offset)),rotate(frame.axes,vector(velocity)))};
}
export function fromParent(frame,position,velocity=[0,0,0]){
 const offset=sub(vector(position),frame.origin);
 return {position:inverseRotate(frame.axes,offset),
  velocity:inverseRotate(frame.axes,sub(sub(vector(velocity),frame.velocity),cross(frame.angularVelocity,offset)))};
}
/** Subtract origins in Number precision BEFORE projecting/uploading Float32.
 * This also avoids adding AU-sized centres to small same-body offsets. */
export function relativePoint(source,position,target){
 return inverseRotate(target.axes,add(sub(source.origin,target.origin),rotate(source.axes,vector(position))));
}

export function orbitalVelocityMps(id,days){
 if(!Number.isFinite(days))throw RangeError("Invalid stellar time");
 if(id==="helios")return [0,0,0];
 const body=bodyById(id);
 if(!body||body.kind==="asteroid-belt")throw RangeError("Body has no moving reference frame");
 if(body.parent){
  const angle=TAU*days/body.moonOrbitDays+body.phase,rate=TAU/body.moonOrbitDays/86400;
  return add(orbitalVelocityMps(body.parent,days),scale([
   -body.moonAU*Math.sin(angle)*rate,
   body.moonAU*.04*Math.cos(angle*.41)*.41*rate,
   body.moonAU*Math.cos(angle)*rate],AU_M));
 }
 const angle=TAU*days/body.orbitDays+body.phase,rate=TAU/body.orbitDays/86400;
 return scale([-body.au*Math.sin(angle)*rate,0,body.au*Math.cos(angle)*rate],AU_M);
}
/** Rotation order exactly matches Planet.surfaceNormal(): Ry * Rx. */
export function bodyFrame(planet,days=planet?.timeDays){
 if(!bodyById(planet?.id)||!Number.isFinite(days)||days<0||!Number.isFinite(planet.axialTiltDeg))
  throw RangeError("Invalid body frame");
 const period=positive(planet.rotationHours)*3600;
 const spin=(days*86400/period*TAU)%TAU,tilt=planet.axialTiltDeg*Math.PI/180;
 const axes=IDENTITY.map(a=>objectVector(rotateY(rotateX({x:a[0],y:a[1],z:a[2]},tilt),spin)));
 return rigidFrame({id:"body:"+planet.id,origin:scale(objectVector(orbitalPosition(planet.id,days)),AU_M),
  axes,velocity:orbitalVelocityMps(planet.id,days),angularVelocity:[0,TAU/period,0]});
}
export function tangentFrame({id,lat,lon,elevationM=0,radiusM}){
 positive(radiusM);
 const origin=geoToWorld(lat,lon,elevationM,radiusM),basis=eastNorthUp(lat,lon);
 // Existing local convention: X=east, Y=up, Z=north.
 return rigidFrame({id,origin,axes:[basis.east,basis.up,basis.north]});
}

/** Stable logarithmic map even at millimetre range or across +/-180 degrees.
 * Antipodes have no unique local heading and require another region frame. */
export function surfaceLocalOffset(origin,lat,lon,radiusM){
 positive(radiusM);
 if(![origin?.lat,origin?.lon,lat,lon].every(Number.isFinite)||Math.abs(origin.lat)>90||Math.abs(lat)>90)
  throw RangeError("Invalid surface coordinate");
 const a=geoNormal(origin.lat,origin.lon),b=geoNormal(lat,lon),basis=eastNorthUp(origin.lat,origin.lon);
 const cosine=Math.max(-1,Math.min(1,dot(a,b))),sine=norm(cross(a,b));
 if(sine<1e-12){
  if(cosine<0)throw RangeError("Antipodal point requires another region");
  return {eastM:0,northM:0};
 }
 const distance=radiusM*Math.atan2(sine,cosine);
 return {eastM:distance*dot(b,basis.east)/sine,northM:distance*dot(b,basis.north)/sine};
}
/** Legacy x/z are a spherical exponential chart, not a rigid global plane. */
export function legacySurfacePoint(anchor,x,z,radiusM,elevationM=0){
 const geo=geoOffset(anchor.lat,anchor.lon,x,z,radiusM);
 return {geo,position:geoToWorld(geo.lat,geo.lon,elevationM,radiusM)};
}
