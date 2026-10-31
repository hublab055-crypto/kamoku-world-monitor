/** Single mobile spacecraft: a parked geodetic footprint; only one planet can own it. */
const finite=n=>Number.isFinite(n);
const radians=Math.PI/180;
export class SurfaceStarship{
 constructor(data=null){
  this.bodyId=typeof data?.bodyId==="string"?data.bodyId:null;
  this.lat=finite(data?.lat)?Math.max(-89,Math.min(89,data.lat)):null;
  this.lon=finite(data?.lon)?data.lon:null;
  this.yaw=finite(data?.yaw)?data.yaw:0;
  this.hatchOpen=Boolean(data?.hatchOpen);
  this.flight=data?.flight==="airborne"?"airborne":"parked";
 }
 place(bodyId,lat,lon,yaw=0){
  if(!bodyId||![lat,lon,yaw].every(finite)||Math.abs(lat)>89.9)throw Error("Invalid landing pose");
  this.bodyId=bodyId;this.lat=lat;this.lon=lon;this.yaw=yaw;
  this.flight="parked";this.hatchOpen=false;
 }
 takeOff(){this.flight="airborne";this.bodyId=null;this.hatchOpen=false;}
 landedOn(bodyId,lat,lon,yaw=0){this.place(bodyId,lat,lon,yaw);}
 present(bodyId){return this.bodyId===bodyId&&this.flight==="parked"&&finite(this.lat)&&finite(this.lon);}
 // For local player and hatch checks, use the engine's existing spherical tangent mapping.
 offsetFrom(controller,radiusM){
  if(!this.present(controller?.terrain?.planet?.id)||!controller||!finite(radiusM))return null;
  return this.offsetFromCoords(controller.origin,controller.x,controller.z,radiusM);
 }
 offsetFromCoords(origin,x,z,radiusM){
  if(!origin||![origin.lat,origin.lon,x,z,radiusM].every(finite)||radiusM<=0)return null;
  const northM=(this.lat-origin.lat)*radians*radiusM;
  const eastM=(this.lon-origin.lon)*radians*radiusM*Math.cos(origin.lat*radians);
  const dx=eastM-x,dz=northM-z;
  // Hatch is aft of the landed fuselage, where the ramp meets the terrain.
  const hx=eastM+Math.sin(this.yaw)*14;
  const hz=northM+Math.cos(this.yaw)*14;
  return {x:eastM,z:northM,hatchX:hx,hatchZ:hz,distanceM:Math.hypot(hx-x,hz-z),hullDistanceM:Math.hypot(dx,dz)};
 }
 snapshot(){return {schemaVersion:1,bodyId:this.bodyId,lat:this.lat,lon:this.lon,yaw:this.yaw,hatchOpen:this.hatchOpen,flight:this.flight};}
 static fromSnapshot(data){return new SurfaceStarship(data?.schemaVersion===1?data:null);}
}
