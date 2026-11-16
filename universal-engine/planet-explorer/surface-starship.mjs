/** Single mobile spacecraft: a parked geodetic footprint; only one planet can own it. */
const finite=n=>Number.isFinite(n);
const radians=Math.PI/180;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{const x=Math.min(1,Math.max(0,t));return x*x*(3-2*x);};
const wrap=n=>((n+180)%360+360)%360-180;
const headingDelta=(a,b)=>wrap(b-a);
export class SurfaceStarship{
 constructor(data=null){
  this.shipSystems=data?.shipSystems||null;this.fuel=finite(data?.fuel)?data.fuel:100;
  this.bodyId=typeof data?.bodyId==="string"?data.bodyId:null;
  this.lat=finite(data?.lat)?Math.max(-89,Math.min(89,data.lat)):null;
  this.lon=finite(data?.lon)?data.lon:null;
  this.yaw=finite(data?.yaw)?data.yaw:0;
  this.hatchOpen=Boolean(data?.hatchOpen);
  this.flight=["airborne","landing","recall"].includes(data?.flight)?data.flight:"parked";
  this.landingProgress=finite(data?.landingProgress)?Math.max(0,Math.min(1,data.landingProgress)):1;
  this.padElevationM=finite(data?.padElevationM)?data.padElevationM:null;
  this.recallProgress=finite(data?.recallProgress)?Math.max(0,Math.min(1,data.recallProgress)):0;
  this.recallFrom=data?.recallFrom||null;
  this.recallTo=data?.recallTo||null;
  this.recallDuration=finite(data?.recallDuration)?Math.max(8,data.recallDuration):12;
  this.remotePilotId=data?.remotePilotId==="navigator"?"navigator":null;
 }
 place(bodyId,lat,lon,yaw=0,padElevationM=null){
  if(!bodyId||![lat,lon,yaw].every(finite)||Math.abs(lat)>89.9)throw Error("Invalid landing pose");
  this.bodyId=bodyId;this.lat=lat;this.lon=lon;this.yaw=yaw;
  this.flight="parked";this.hatchOpen=false;this.landingProgress=1;
  this.recallProgress=1;this.recallFrom=null;this.recallTo=null;this.remotePilotId=null;
  this.padElevationM=finite(padElevationM)?padElevationM:null;
 }
 beginLanding(bodyId,pad){
  if(!pad||!finite(pad.lat)||!finite(pad.lon)||!finite(pad.padElevationM))
   throw new Error("Invalid spacecraft landing pad");
  this.place(bodyId,pad.lat,pad.lon,pad.yaw||0,pad.padElevationM);
  this.flight="landing";this.landingProgress=0;
 }
 /** Deputy-operated physical approach: lift from the old pad, transit, and land.
  * An airborne/unknown-origin craft appears on a distant approach corridor.
  * Movement is continuous in geodetic space; no instantaneous relocation.
  */
 beginRecall(bodyId,pad,{pilotId="navigator"}={}){
  if(!pad||![pad.lat,pad.lon,pad.padElevationM].every(finite)||!bodyId||
   Math.abs(pad.lat)>89.9)throw Error("Invalid recall destination");
  if(this.flight==="recall"||this.flight==="landing")return false;
  const fromHere=this.bodyId===bodyId&&finite(this.lat)&&finite(this.lon)&&this.flight==="parked";
  const fallbackLat=Math.max(-89,Math.min(89,pad.lat+.002));
  const from=fromHere?{lat:this.lat,lon:this.lon,yaw:this.yaw,
   padElevationM:finite(this.padElevationM)?this.padElevationM:pad.padElevationM}:
   {lat:fallbackLat,lon:wrap(pad.lon+.002),yaw:pad.yaw||0,padElevationM:pad.padElevationM};
  const distanceM=Math.hypot((from.lat-pad.lat)*radians*6371000,
   wrap(from.lon-pad.lon)*radians*6371000*Math.cos(pad.lat*radians));
  this.bodyId=bodyId;this.flight="recall";this.hatchOpen=false;
  this.recallFrom=from;this.recallTo={lat:pad.lat,lon:pad.lon,yaw:pad.yaw||0,
   padElevationM:pad.padElevationM};
  this.recallProgress=0;this.landingProgress=0;
  this.recallDuration=Math.max(12,Math.min(90,12+distanceM/220));
  this.remotePilotId=pilotId==="navigator"?"navigator":null;
  this.lat=from.lat;this.lon=from.lon;this.yaw=from.yaw;
  return true;
 }
 /** World-space position during approach, with visible nose/wing bank. */
 renderPose(){
  if(this.flight!=="recall"||!this.recallFrom||!this.recallTo)
   return {lat:this.lat,lon:this.lon,yaw:this.yaw,altitudeM:0,bankDeg:0};
  const p=this.recallProgress,from=this.recallFrom,to=this.recallTo;
  const t=smooth(Math.max(0,Math.min(1,(p-.19)/.60)));
  const cruise=150,departure=Math.min(1,p/.19),arrival=Math.max(0,Math.min(1,(1-p)/.21));
  const altitudeM=cruise*smooth(departure)*smooth(arrival);
  const yaw=from.yaw+headingDelta(from.yaw,to.yaw)*smooth(p);
  return {lat:lerp(from.lat,to.lat,t),lon:wrap(from.lon+wrap(to.lon-from.lon)*t),
   yaw,altitudeM,bankDeg:Math.sin(p*Math.PI*2)*12};
 }
 get recallPhase(){
  if(this.flight!=="recall")return null;
  return this.recallProgress<.19?"離陸":this.recallProgress<.79?"接近飛行":"減速・着陸";
 }
 tick(dt){
  if(!finite(dt)||dt<0)return false;
  if(this.flight==="recall"){
   this.recallProgress=Math.min(1,this.recallProgress+Math.min(dt,.16)/this.recallDuration);
   const pose=this.renderPose();
   this.lat=pose.lat;this.lon=pose.lon;this.yaw=pose.yaw;
   this.landingProgress=Math.max(0,Math.min(1,(this.recallProgress-.79)/.21));
   if(this.recallProgress>=1){
    const dest=this.recallTo;this.place(this.bodyId,dest.lat,dest.lon,dest.yaw,dest.padElevationM);
    return true;
   }
   return false;
  }
  if(this.flight!=="landing")return false;
  this.landingProgress=Math.min(1,this.landingProgress+Math.min(dt,.16)/4.8);
  if(this.landingProgress>=1){this.flight="parked";return true;}
  return false;
 }
 takeOff(){this.flight="airborne";this.bodyId=null;this.hatchOpen=false;this.landingProgress=1;this.recallFrom=null;this.recallTo=null;this.remotePilotId=null;}
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
  const northM=(this.lat-origin.lat)*radians*radiusM;
  const eastM=(this.lon-origin.lon)*radians*radiusM*Math.cos(origin.lat*radians);
  const dx=eastM-x,dz=northM-z;
  // Hatch is aft of the landed fuselage, where the ramp meets the terrain.
  const hx=eastM+Math.sin(this.yaw)*17.2;
  const hz=northM+Math.cos(this.yaw)*17.2;
  return {x:eastM,z:northM,hatchX:hx,hatchZ:hz,distanceM:Math.hypot(hx-x,hz-z),hullDistanceM:Math.hypot(dx,dz)};
 }
 snapshot(){return {schemaVersion:2,shipSystems:this.shipSystems,fuel:this.fuel,bodyId:this.bodyId,lat:this.lat,lon:this.lon,yaw:this.yaw,hatchOpen:this.hatchOpen,flight:this.flight,landingProgress:this.landingProgress,padElevationM:this.padElevationM,recallProgress:this.recallProgress,recallFrom:this.recallFrom,recallTo:this.recallTo,recallDuration:this.recallDuration,remotePilotId:this.remotePilotId};}
 static fromSnapshot(data){return new SurfaceStarship([1,2].includes(data?.schemaVersion)?data:null);}
}
