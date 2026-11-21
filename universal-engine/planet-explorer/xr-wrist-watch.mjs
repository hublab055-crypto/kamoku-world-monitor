/**
 * Real wrist-mounted WebXR watch. The dial sits above the tracked left
 * controller; no synthetic controller pose or headset-only phantom wrist.
 * The right-hand target ray selects the front surface of the dial/buttons.
 */
import {xrForward} from "./xr-spatial.mjs";
export const XR_WATCH_KEYS=Object.freeze([
 {id:"menu",label:"MENU",x:-.063,y:-.131},
 {id:"settings",label:"SET",x:0,y:-.131},
 {id:"view",label:"VIEW",x:.063,y:-.131},
 {id:"xr",label:"XR",x:-.063,y:-.189},
 {id:"tablet",label:"TAB",x:0,y:-.189},
 {id:"time",label:"TIME",x:.063,y:-.189},
 {id:"pause",label:"PAUSE",x:-.063,y:-.247},
 {id:"speed",label:"SPEED",x:0,y:-.247},
 {id:"rewind",label:"BACK",x:.063,y:-.247}
]);
const finite=m=>Boolean(m&&m.length>=16&&[0,1,2,4,5,6,8,9,10,12,13,14].every(i=>Number.isFinite(m[i])));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=v=>{const m=Math.hypot(...v);return m>1e-6?v.map(a=>a/m):null;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function xrWristPose(head,left){
 if(!finite(head)||!finite(left))return null;
 const center=[left[12]+left[4]*.035,left[13]+left[5]*.035,left[14]+left[6]*.035];
 const eye=[head[12],head[13],head[14]];
 const z=unit(eye.map((v,i)=>v-center[i]));if(!z)return null;
 const guide=Math.abs(z[1])>.98?[0,0,-1]:[0,1,0];
 const x=unit(cross(guide,z));if(!x)return null;
 const y=cross(z,x);
 return [x[0],x[1],x[2],0,y[0],y[1],y[2],0,
  z[0],z[1],z[2],0,center[0],center[1],center[2],1];
}
export function xrWristHit(ray,model,{open=false,maxDistance=.9}={}){
 if(!finite(ray)||!finite(model))return null;
 const dir=xrForward(ray),front=[model[8],model[9],model[10]];
 const towards=dot(dir,front);
 if(towards>=-.001)return null;
 const origin=[ray[12],ray[13],ray[14]],center=[model[12],model[13],model[14]];
 const t=dot(center.map((v,i)=>v-origin[i]),front)/towards;
 if(t<.035||t>maxDistance)return null;
 const point=origin.map((v,i)=>v+dir[i]*t-center[i]);
 const x=dot(point,[model[0],model[1],model[2]]);
 const y=dot(point,[model[4],model[5],model[6]]);
 if(Math.abs(x)<=.094&&y>=-.081&&y<=.082)return {action:"face",x,y,distanceM:t};
 if(open){
  const button=XR_WATCH_KEYS.find(k=>Math.abs(x-k.x)<=.029&&Math.abs(y-k.y)<=.025);
  if(button)return {action:button.id,x,y,distanceM:t};
 }
 return null;
}
export class XRWristWatch{
 constructor(){this.model=null;this.open=false;}
 update(head,left){this.model=xrWristPose(head,left);return this.model;}
 press(ray){
  const hit=xrWristHit(ray,this.model,{open:this.open});
  if(!hit)return null;
  if(hit.action==="face")this.open=!this.open;
  return hit.action;
 }
 reset(){this.model=null;this.open=false;}
}
