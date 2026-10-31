/** Single mobile spacecraft: a parked geodetic footprint; only one planet can own it. */
import {geoLocal} from "./geo.mjs?v=0.8y-harbor";
const finite=n=>Number.isFinite(n);
export class SurfaceStarship{
 constructor(data=null){
  this.bodyId=typeof data?.bodyId==="string"?data.bodyId:null;
  this.lat=finite(data?.lat)?Math.max(-89,Math.min(89,data.lat)):null;
  this.lon=finite(data?.lon)?data.lon:null;
  this.yaw=finite(data?.yaw)?data.yaw:0;
  this.hatchOpen=Boolean(data?.hatchOpen);
  this.flight=["airborne","landing"].includes(data?.flight)?data.flight:"parked";
  this.landingProgress=finite(data?.landingProgress)?Math.max(0,Math.min(1,data.landingProgress)):1;
  this.padElevationM=finite(data?.padElevationM)?data.padElevationM:null;
 }
 place(bodyId,lat,lon,yaw=0,padElevationM=null){
  if(!bodyId||![lat,lon,yaw].every(finite)||Math.abs(lat)>89.9)throw Error("Invalid landing pose");
  this.bodyId=bodyId;this.lat=lat;this.lon=lon;this.yaw=yaw;
  this.flight="parked";this.hatchOpen=false;this.landingProgress=1;
  this.padElevationM=finite(padElevationM)?padElevationM:null;
 }
 beginLanding(bodyId,pad){
  if(!pad||!finite(pad.lat)||!finite(pad.lon)||!finite(pad.padElevationM))
   throw new Error("Invalid spacecraft landing pad");
  this.place(bodyId,pad.lat,pad.lon,pad.yaw||0,pad.padElevationM);
  this.flight="landing";this.landingProgress=0;
 }
 tick(dt){
  if(this.flight!=="landing")return false;
  if(!finite(dt)||dt<0)return false;
  this.landingProgress=Math.min(1,this.landingProgress+Math.min(dt,.16)/4.8);
  if(this.landingProgress>=1){this.flight="parked";return true;}
  return false;
 }
 takeOff(){this.flight="airborne";this.bodyId=null;this.hatchOpen=false;this.landingProgress=1;}
 landedOn(bodyId,lat,lon,yaw=0,padElevationM=null){this.place(bodyId,lat,lon,yaw,padElevationM);}
 visible(bodyId){return this.bodyId===bodyId&&this.flight!=="airborne"&&finite(this.lat)&&finite(this.lon);}
 present(bodyId){return this.visible(bodyId)&&this.flight==="parked";}
 // For local player and hatch checks, use the engine's existing spherical tangent mapping.
 offsetFrom(controller,radiusM){
  if(!this.present(controller?.terrain?.planet?.id)||!controller||!finite(radiusM))return null;
  return this.offsetFromCoords(controller.origin,controller.x,controller.z,radiusM);
 }
 offsetFromCoords(origin,x,z,radiusM){
  if(!origin||![origin.lat,origin.lon,x,z,radiusM].every(finite)||radiusM<=0)return null;
  // Exact spherical logarithmic map avoids a 360° jump at the longitude seam.
  const {northM,eastM}=geoLocal(origin.lat,origin.lon,this.lat,this.lon,radiusM);
  const dx=eastM-x,dz=northM-z;
  // Hatch is aft of the landed fuselage, where the ramp meets the terrain.
  const hx=eastM+Math.sin(this.yaw)*17.2;
  const hz=northM+Math.cos(this.yaw)*17.2;
  return {x:eastM,z:northM,hatchX:hx,hatchZ:hz,distanceM:Math.hypot(hx-x,hz-z),hullDistanceM:Math.hypot(dx,dz)};
 }
 snapshot(){return {schemaVersion:1,bodyId:this.bodyId,lat:this.lat,lon:this.lon,yaw:this.yaw,hatchOpen:this.hatchOpen,flight:this.flight,landingProgress:this.landingProgress,padElevationM:this.padElevationM};}
 static fromSnapshot(data){return new SurfaceStarship(data?.schemaVersion===1?data:null);}
}
