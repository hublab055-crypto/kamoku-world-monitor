/** WebXR four-command watch, attached only to a tracked left Touch controller. */
import {xrMul,xrRotateY,xrTranslate} from "./xr-spatial.mjs";
import {vrTabletRayHit} from "./world-tablet-spatial.mjs";
export const VR_WRIST_KEYS=Object.freeze([
 {id:"tablet",label:"TAB",x:-.050,y:.052},
 {id:"ship",label:"SHIP",x:.050,y:.052},
 {id:"avatar",label:"AVTR",x:-.050,y:-.052},
 {id:"record",label:"REC",x:.050,y:-.052}
]);
const valid=m=>m&&m.length>=16&&[0,1,2,4,5,6,8,9,10,12,13,14].every(i=>Number.isFinite(m[i]));
export function xrWristPose(head,left){
 if(!valid(head)||!valid(left))return null;
 // Quest 3S has no direct forearm/wrist position tracking.
 const center=[left[12],left[13]+.075,left[14]-.025];
 const yaw=Math.atan2(head[12]-center[0],head[14]-center[2]);
 return xrMul(xrTranslate(...center),xrRotateY(yaw));
}
export function xrWristButtonAt(x,y){
 return VR_WRIST_KEYS.find(k=>Math.abs(k.x-x)<=.047&&Math.abs(k.y-y)<=.047)?.id||null;
}
export function xrWristRayHit(ray,model){
 const hit=vrTabletRayHit(ray,model,{maxDistance:1.5});
 if(!hit||Math.abs(hit.x)>.104||Math.abs(hit.y)>.108)return null;
 const action=xrWristButtonAt(hit.x,hit.y);
 return action?{action,hit}:null;
}
export class XRWristWatch{
 constructor(){this.model=null;}
 update(head,left){this.model=xrWristPose(head,left);return this.model;}
 press(ray){return xrWristRayHit(ray,this.model);}
 resetSession(){this.model=null;}
}