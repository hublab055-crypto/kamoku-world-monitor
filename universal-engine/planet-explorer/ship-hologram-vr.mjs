import {PILOT_SEAT_Z} from "./ship-interior.mjs?v=20261114-crew-social-2";
import {snapHologramLever} from "./ship-cockpit-hologram.mjs?v=20261115-hologram";

/** Pilot-relative metres. Both panels stay out of the central windscreen. */
export const XR_HOLO_Z=PILOT_SEAT_Z-1.12;
export const XR_HOLO_PANELS=Object.freeze([
 Object.freeze({side:"left",x:-1.55,y:1.54,z:XR_HOLO_Z,width:1.19,height:1.78}),
 Object.freeze({side:"right",x:1.55,y:1.54,z:XR_HOLO_Z,width:1.19,height:1.78})
]);
export const XR_HOLO_SLIDERS=Object.freeze([
 Object.freeze({id:"main",x:-1.82,minY:1.04,maxY:1.70,z:XR_HOLO_Z,vol:false}),
 Object.freeze({id:"vol",x:-1.27,minY:1.04,maxY:1.70,z:XR_HOLO_Z,vol:true})
]);
export const XR_HOLO_BUTTONS=Object.freeze([
 Object.freeze({id:"gear",x:-1.84,y:1.93,z:XR_HOLO_Z,label:"GEAR"}),
 Object.freeze({id:"hatch",x:-1.27,y:1.93,z:XR_HOLO_Z,label:"HATCH"}),
 Object.freeze({id:"primary",x:-1.84,y:.88,z:XR_HOLO_Z,label:"GO"}),
 Object.freeze({id:"autopilot",x:-1.27,y:.88,z:XR_HOLO_Z,label:"AUTO"}),
 Object.freeze({id:"weapon",x:1.18,y:1.88,z:XR_HOLO_Z,label:"WPN"}),
 Object.freeze({id:"lock",x:1.55,y:1.88,z:XR_HOLO_Z,label:"LOCK"}),
 Object.freeze({id:"autoFire",x:1.91,y:1.88,z:XR_HOLO_Z,label:"FIRE"}),
 Object.freeze({id:"ciws",x:1.18,y:1.47,z:XR_HOLO_Z,label:"CIWS"}),
 Object.freeze({id:"refuel",x:1.55,y:1.47,z:XR_HOLO_Z,label:"FUEL"}),
 Object.freeze({id:"repair-shield",x:1.91,y:1.47,z:XR_HOLO_Z,label:"SHLD"}),
 Object.freeze({id:"repair-engine",x:1.18,y:1.06,z:XR_HOLO_Z,label:"ENG"}),
 Object.freeze({id:"repair-hull",x:1.55,y:1.06,z:XR_HOLO_Z,label:"HULL"}),
 Object.freeze({id:"repair-weapons",x:1.91,y:1.06,z:XR_HOLO_Z,label:"RPR"})
]);

function xyz(matrix,point){
 return [0,1,2].map(row=>matrix[row]*point[0]+matrix[4+row]*point[1]+
  matrix[8+row]*point[2]+matrix[12+row]);
}
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
/** Intersect the tracked trigger ray with the ship-local hologram plane.
 * Works for translated or yaw-rotated WebXR tracking origins.
 * Rejects untracked poses, rear-side rays and excessively distant pointers.
 */
export function xrHologramPlaneHit(ray,stage,{maxDistance=2.8}={}){
 if(!Array.isArray(ray)||!Array.isArray(stage)||ray.length!==16||stage.length!==16||
  ![...ray,...stage,maxDistance].every(Number.isFinite)||maxDistance<=0)return null;
 const origin=[ray[12],ray[13],ray[14]],d=[-ray[8],-ray[9],-ray[10]];
 const normal=[stage[8],stage[9],stage[10]];
 const magnitude=Math.hypot(...d),normalSize=Math.hypot(...normal);
 if(magnitude<.00001||normalSize<.00001)return null;
 const direction=d.map(n=>n/magnitude);
 const denominator=dot(direction,normal);
 // Front-face access: a seated pilot points forward, not through the panel from behind.
 if(denominator>=-.01*normalSize)return null;
 const center=xyz(stage,[0,0,XR_HOLO_Z]);
 const distance=dot(sub(center,origin),normal)/denominator;
 if(distance<=.08||distance>maxDistance)return null;
 const hit=origin.map((n,i)=>n+distance*direction[i]);
 const relative=sub(hit,center);
 const xAxis=[stage[0],stage[1],stage[2]],yAxis=[stage[4],stage[5],stage[6]];
 const xx=dot(xAxis,xAxis),yy=dot(yAxis,yAxis);
 if(xx<.00001||yy<.00001)return null;
 return {x:dot(relative,xAxis)/xx,y:dot(relative,yAxis)/yy,distance};
}
/** Called at Quest trigger press edge, never every animation frame. */
export function xrHologramControlHit(ray,stage){
 const hit=xrHologramPlaneHit(ray,stage);
 if(!hit)return null;
 for(const slider of XR_HOLO_SLIDERS){
  if(Math.abs(hit.x-slider.x)>.16||hit.y<slider.minY-.06||hit.y>slider.maxY+.06)continue;
  const portion=Math.max(0,Math.min(1,(hit.y-slider.minY)/(slider.maxY-slider.minY)));
  const value=snapHologramLever(-100+portion*(slider.vol?200:225),{vol:slider.vol});
  return {id:slider.id,value,distance:hit.distance};
 }
 for(const button of XR_HOLO_BUTTONS){
  if(Math.abs(hit.x-button.x)<=.165&&Math.abs(hit.y-button.y)<=.125)
   return {id:button.id,distance:hit.distance};
 }
 return null;
}

/** Quantized, cockpit-labelled VR readouts. Altitude/velocity are never
 * presented as real-world m/s in the normalized interplanetary route frame.
 */
export function xrHologramReadouts(v,{height=null,gravity=null}={}){
 const atmosphere=["docked","landed","atmosphere","ascent","entry","vtol","touchdown"].includes(v?.status);
 const landed=["docked","landed","touchdown"].includes(v?.status);
 const speed=atmosphere?Math.max(0,v?.airSpeed||0):
  Math.hypot(v?.routeVelocity?.along||0,v?.routeVelocity?.cross||0,v?.verticalVelocity||0)*100;
 const alt=landed?0:Number.isFinite(height)?height:Number.isFinite(v?.airAltitude)?v.airAltitude:0;
 return [
  {label:atmosphere?"SPD":"RT%",text:atmosphere?String(Math.round(speed)):speed.toFixed(1)},
  {label:"ALT",text:atmosphere?String(Math.round(Math.max(0,alt)/10)*10):"----"},
  {label:"GRV",text:atmosphere&&Number.isFinite(gravity)?gravity.toFixed(1):"----"},
  {label:"FUEL",text:String(Math.round(Math.max(0,Math.min(100,v?.fuel??0))))}
 ];
}
