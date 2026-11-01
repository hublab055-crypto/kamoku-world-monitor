/** A shared, deterministic display Transform for the one player spacecraft.
 * Motion follows the existing game journey, not a gravity/flight solver. */
import {Planet} from "../planet/planet-core.mjs";
import {bodyById,createCelestialPlanet,orbitalPosition,AU_M} from "./solar-system.mjs";
import {bodyFrame,tangentFrame,rigidFrame,toParent,relativePoint} from "./reference-frames.mjs";
import {CABIN_FLOOR_M} from "./starship-layout.mjs";
const copy=v=>JSON.parse(JSON.stringify(v));
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export const FLIGHT_MODEL_HEIGHT_M=7000;
export const needsStarshipArrival=(journey,currentBodyId)=>Boolean(journey?.kind==="surface-to-surface"&&
 journey.status==="landed"&&bodyById(journey.destinationId)?.landable&&journey.destinationId!==currentBodyId);
export const flightEase=v=>{const p=clamp(v);return p*p*p*(10+p*(-15+6*p));};
export function journeyLift(v){
 const p=flightEase(v?.stageProgress);
 return v?.status==="ascent"?FLIGHT_MODEL_HEIGHT_M*p:
  v?.status==="entry"?FLIGHT_MODEL_HEIGHT_M*(1-p):
  ["origin-orbit","cruise","approach","orbit"].includes(v?.status)?FLIGHT_MODEL_HEIGHT_M:0;
}
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,n)=>a.map(v=>v*n),dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);if(d<1e-12)throw Error("Degenerate flight basis");return scale(a,1/d);};
const rotate=(axes,p)=>[0,1,2].map(i=>axes.reduce((v,a,j)=>v+a[i]*p[j],0));
const yawAxes=y=>[[Math.cos(y),0,-Math.sin(y)],[0,1,0],[Math.sin(y),0,Math.cos(y)]];
const multiplyAxes=(a,b)=>b.map(v=>rotate(a,v));
const lerp=(a,b,p)=>a.map((v,i)=>v+(b[i]-v)*p);

// Quaternions avoid a singular linear-basis blend at opposite headings.
function quaternion(a){
 const m=(r,c)=>a[c][r],t=m(0,0)+m(1,1)+m(2,2);let q,s;
 if(t>0){s=Math.sqrt(t+1)*2;q=[(m(2,1)-m(1,2))/s,(m(0,2)-m(2,0))/s,(m(1,0)-m(0,1))/s,s/4];}
 else if(m(0,0)>m(1,1)&&m(0,0)>m(2,2)){s=Math.sqrt(1+m(0,0)-m(1,1)-m(2,2))*2;q=[s/4,(m(0,1)+m(1,0))/s,(m(0,2)+m(2,0))/s,(m(2,1)-m(1,2))/s];}
 else if(m(1,1)>m(2,2)){s=Math.sqrt(1+m(1,1)-m(0,0)-m(2,2))*2;q=[(m(0,1)+m(1,0))/s,s/4,(m(1,2)+m(2,1))/s,(m(0,2)-m(2,0))/s];}
 else{s=Math.sqrt(1+m(2,2)-m(0,0)-m(1,1))*2;q=[(m(0,2)+m(2,0))/s,(m(1,2)+m(2,1))/s,s/4,(m(1,0)-m(0,1))/s];}
 return unit(q);
}
function axesFromQuaternion([x,y,z,w]){
 return [[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w)],
  [2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)],
  [2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)]];
}
function blendAxes(a,b,p){
 let q=quaternion(a),r=quaternion(b),d=dot(q,r);
 if(d<0){r=scale(r,-1);d=-d;}
 if(d>.9995)return axesFromQuaternion(unit(lerp(q,r,p)));
 const angle=Math.acos(Math.min(1,d)),sin=Math.sin(angle);
 return axesFromQuaternion(add(scale(q,Math.sin((1-p)*angle)/sin),scale(r,Math.sin(p*angle)/sin)));
}
const siteFor=(site,id)=>{
 const p=site||{lat:28,lon:42,yaw:0,padElevationM:0};
 if(!bodyById(id)?.landable||![p.lat,p.lon,p.yaw??0,p.padElevationM??0].every(Number.isFinite)||Math.abs(p.lat)>90)
  throw Error("Invalid starship site");
 return {bodyId:id,lat:p.lat,lon:p.lon,yaw:p.yaw??0,padElevationM:p.padElevationM??0};
};

export class StarshipEntity{
 constructor(data=null){
  if(data&&(data.format!=="ue/starship-entity"||data.version!==1||data.motionModelVersion!==1))
   throw Error("Unsupported starship coordinate model");
  this.id=data?data.id:"player-starship";
  if(typeof this.id!=="string"||!this.id||this.id.length>120)throw Error("Invalid ship identity");
  this.models={};this.pose=null;
  for(const [id,snapshot] of Object.entries(data?.bodyModels||{})){
   const planet=Planet.fromSnapshot(snapshot);
   if(planet.id!==id||!bodyById(id)?.landable)throw Error("Invalid starship body model");
   this.models[id]=planet.snapshot();
  }
  if(data?.pose){
   const p=data.pose;
   if(!Number.isFinite(p.epochDays)||p.epochDays<0||
     ![p.positionM,p.stellarPositionM].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||
     ![p.axes,p.stellarAxes].every(v=>Array.isArray(v)&&v.length===3)||
     !(p.frameId==="system:helios"||p.frameId==="body:"+p.bodyId&&bodyById(p.bodyId)?.landable))
    throw Error("Invalid pose checkpoint");
   rigidFrame({id:p.frameId,origin:p.positionM,axes:p.axes});
   rigidFrame({id:"system:helios",origin:p.stellarPositionM,axes:p.stellarAxes});
   this.pose=copy(p);
  }
 }
 model(id){return this.models[id]?Planet.fromSnapshot(this.models[id]):createCelestialPlanet(id,0);}
 remember(planet){if(planet&&bodyById(planet.id)?.landable)this.models[planet.id]=planet.snapshot();}
 nearPose(id,site,liftM,days,yaw=site.yaw){
  const planet=this.model(id),tangent=tangentFrame({id:"site:"+id,lat:site.lat,lon:site.lon,
   radiusM:planet.radiusM,elevationM:site.padElevationM+liftM});
  const axes=multiplyAxes(tangent.axes,yawAxes(yaw));
  const body=bodyFrame(planet,days),stellar=toParent(body,tangent.origin).position;
  return {frameId:"body:"+id,bodyId:id,site:copy(site),liftM,yaw,epochDays:days,
   positionM:[...tangent.origin],axes,stellarPositionM:stellar,stellarAxes:multiplyAxes(body.axes,axes)};
 }
 sync({journey=null,surfaceShip=null,planet=null,arrivalPlanet=null,days=planet?.timeDays??0}={}){
  if(!Number.isFinite(days)||days<0)throw Error("Invalid ship clock");
  this.remember(planet);this.remember(arrivalPlanet);
  if(journey?.kind!=="surface-to-surface"){
   this.pose=surfaceShip?.visible(surfaceShip.bodyId)?this.nearPose(surfaceShip.bodyId,
    siteFor(surfaceShip,surfaceShip.bodyId),surfaceShip.flight==="landing"?85*(1-clamp(surfaceShip.landingProgress))**2:0,days):null;
   return this.pose;
  }
  const v=journey,origin=siteFor(v.launchSite,v.originId),target=siteFor(v.landingSite,v.destinationId||v.originId);
  const angle=(v.heading||0)*Math.PI/180,p=clamp(v.progress);
  let pose;
  if(["cruise","approach"].includes(v.status)){
   // Moving endpoints use one shared ephemeris epoch. Tangential Bézier
   // controls avoid a straight segment initially cutting through its planet.
   // This remains a game route, not an all-body collision-avoidance planner.
   const start=this.nearPose(v.originId,origin,FLIGHT_MODEL_HEIGHT_M,days,origin.yaw+angle);
   const end=this.nearPose(v.destinationId,target,FLIGHT_MODEL_HEIGHT_M,days,target.yaw+angle);
   const delta=sub(end.stellarPositionM,start.stellarPositionM),distance=Math.hypot(...delta),direction=unit(delta);
   const tangent=up=>{
    let side=cross(up,direction);
    if(Math.hypot(...side)<1e-8)side=cross(up,Math.abs(up[1])<.9?[0,1,0]:[1,0,0]);
    return unit(side);
   };
   const a=tangent(start.stellarAxes[1]);let b=tangent(end.stellarAxes[1]);
   if(dot(a,b)<0)b=scale(b,-1);
   const c1=add(start.stellarPositionM,scale(a,distance*.35));
   const c2=sub(end.stellarPositionM,scale(b,distance*.35));
   const u=flightEase(p),q=1-u;
   const position=add(add(scale(start.stellarPositionM,q*q*q),scale(c1,3*q*q*u)),
    add(scale(c2,3*q*u*u),scale(end.stellarPositionM,u*u*u)));
   const derivative=add(add(scale(sub(c1,start.stellarPositionM),3*q*q),scale(sub(c2,c1),6*q*u)),
    scale(sub(end.stellarPositionM,c2),3*u*u));
   const z=scale(unit(derivative),-1);
   let up=unit(add(start.stellarAxes[1],scale(end.stellarAxes[1],.5)));
   if(Math.abs(dot(up,z))>.98)up=Math.abs(z[1])<.9?[0,1,0]:[1,0,0];
   const x=unit(cross(up,z)),course=multiplyAxes([x,unit(cross(z,x)),z],yawAxes(angle));
   const axes=p<.25?blendAxes(start.stellarAxes,course,flightEase(p/.25)):
    p>.75?blendAxes(course,end.stellarAxes,flightEase((p-.75)/.25)):course;
   pose={frameId:"system:helios",bodyId:null,site:null,liftM:null,yaw:null,epochDays:days,
    positionM:position,axes,stellarPositionM:[...position],stellarAxes:axes.map(a=>[...a])};
  }else{
   const arriving=["orbit","entry","touchdown","landed"].includes(v.status),site=arriving?target:origin;
   const weight=v.status==="ascent"?flightEase(v.stageProgress):
    v.status==="entry"?1-flightEase(v.stageProgress):["origin-orbit","orbit"].includes(v.status)?1:0;
   pose=this.nearPose(site.bodyId,site,journeyLift(v),days,site.yaw+angle*weight);
  }
  pose.phase=v.status;pose.legacyDerived=!v.launchSite||Boolean(v.destinationId&&!v.landingSite);
  this.pose=pose;return pose;
 }
 cabinFrame({stellar=false}={}){
  const p=this.pose;if(!p)return null;
  const axes=stellar?p.stellarAxes:p.axes,origin=stellar?p.stellarPositionM:p.positionM;
  return rigidFrame({id:"ship:"+this.id,origin:add(origin,rotate(axes,[0,CABIN_FLOOR_M,0])),axes});
 }
 /** Transform a sampled geographic terrain patch into cabin-local metres. */
 groundToCabinMatrix(site,id=this.pose?.bodyId){
  if(!this.pose||this.pose.frameId!=="body:"+id)return null;
  const source=tangentFrame({id:"terrain:"+id,lat:site.lat,lon:site.lon,radiusM:this.model(id).radiusM});
  const cabin=this.cabinFrame(),origin=relativePoint(source,[0,0,0],cabin);
  const axes=source.axes.map(a=>cabin.axes.map(b=>dot(a,b)));
  return [...axes[0],0,...axes[1],0,...axes[2],0,...origin,1];
 }
 /** Sky pass: camera-relative angular size/direction, not AU-sized Float32.
  * Painter ordering and depthMask(false) are handled by the renderer. */
 celestialView(body,eye=[0,0,0],rangeM=24000){
  if(!this.pose||!body?.radiusM)return null;
  const physicalRadiusM=this.models[body.id]?.radiusM??body.radiusM;
  let centre;
  if(body.id===this.pose.bodyId)centre=relativePoint(rigidFrame({id:"body-centre"}),[0,0,0],this.cabinFrame());
  else{
   const at=orbitalPosition(body.id,this.pose.epochDays);
   if(!at)return null;
   centre=relativePoint(rigidFrame({id:"celestial:"+body.id,origin:[at.x*AU_M,at.y*AU_M,at.z*AU_M]}),[0,0,0],this.cabinFrame({stellar:true}));
  }
  const delta=sub(centre,eye),distanceM=Math.hypot(...delta);
  if(distanceM<=physicalRadiusM)return null;
  return {id:body.id,distanceM,position:add(eye,scale(delta,rangeM/distanceM)),radiusM:physicalRadiusM*rangeM/distanceM,color:body.color};
 }
 snapshot(){return {format:"ue/starship-entity",version:1,motionModelVersion:1,id:this.id,
  bodyModels:copy(this.models),pose:copy(this.pose)};}
 static fromSnapshot(data){return new StarshipEntity(data||null);}
}
