import {PILOT_SEAT_Z} from "./ship-interior.mjs?v=20261109-pilot-access";
/** Shared physical ship controls and XR ray picking (column-major metres).
 * Does not depend on WebXR globals; safe to test in Node.
 */
export const COCKPIT_SWITCHES=Object.freeze([
 {id:"scan",position:Object.freeze([-.65,1.05,PILOT_SEAT_Z-.25])},
 {id:"weapon",position:Object.freeze([-.65,1.05,PILOT_SEAT_Z+.15])},
 {id:"fire",position:Object.freeze([.65,1.05,PILOT_SEAT_Z-.25])},
 {id:"hatch",position:Object.freeze([.65,1.05,PILOT_SEAT_Z+.15])}
]);
export const COCKPIT_LEVER=Object.freeze([.65,1.3,PILOT_SEAT_Z+.45]);
export const EXTERIOR_HATCH_SWITCH=Object.freeze([1.77,3.18,12.78]);

export function xrRayPointDistance(matrix,stage,point,{radius=.34,maxDistance=2.5}={}){
 if(!Array.isArray(matrix)||matrix.length!==16||
    !Array.isArray(stage)||stage.length!==16||
    !Array.isArray(point)||point.length!==3)return null;
 if(![...matrix,...stage,...point,radius,maxDistance].every(Number.isFinite))return null;
 // Stage projects a world-space control point into the real XR tracking space.
 const xyz=[0,1,2].map(row=>stage[row]*point[0]+stage[4+row]*point[1]+
  stage[8+row]*point[2]+stage[12+row]);
 const origin=[matrix[12],matrix[13],matrix[14]];
 const dir=[-matrix[8],-matrix[9],-matrix[10]];
 const norm=Math.hypot(...dir);
 if(norm<1e-6)return null;
 const unit=dir.map(v=>v/norm);
 const relative=xyz.map((v,i)=>v-origin[i]);
 const t=relative.reduce((acc,v,i)=>acc+v*unit[i],0);
 if(t<.05||t>maxDistance)return null;
 const miss=Math.hypot(...relative.map((v,i)=>v-unit[i]*t));
 return miss<=radius?{distance:t,miss}:null;
}
export function xrCockpitControlHit(matrix,stage){
 let best=null;
 for(const button of [...COCKPIT_SWITCHES,{id:"throttle",position:COCKPIT_LEVER}]){
  const hit=xrRayPointDistance(matrix,stage,button.position,{radius:.28,maxDistance:2.8});
  if(hit&&(!best||hit.distance<best.distance))best={id:button.id,...hit};
 }
 return best;
}
/** Ground model uses local X/Z, rotated by the landed ship yaw. */
export function exteriorHatchWorldPoint(x,z,yaw,padElevation,cx=0,cz=0){
 if(![x,z,yaw,padElevation,cx,cz].every(Number.isFinite))return null;
 const [bx,by,bz]=EXTERIOR_HATCH_SWITCH,c=Math.cos(yaw),s=Math.sin(yaw);
 return [x-cx+c*bx+s*bz,padElevation+by,z-cz-s*bx+c*bz];
}
