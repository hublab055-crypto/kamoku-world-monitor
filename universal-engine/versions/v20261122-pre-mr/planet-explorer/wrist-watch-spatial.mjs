/** Quest wristwatch spatial placement and controller-trigger hit targets. */
import {xrForward,xrMul,xrRotateY,xrTranslate} from "./xr-spatial.mjs";
import {vrTabletRayHit} from "./world-tablet-spatial.mjs";

const valid=m=>m&&m.length>=16&&[0,1,2,4,5,6,8,9,10,12,13,14].every(i=>Number.isFinite(m[i]));
const scale=n=>[n,0,0,0,0,n,0,0,0,0,n,0,0,0,0,1];
function face(center,head,s){
 const yaw=Math.atan2(head[12]-center[0],head[14]-center[2]);
 return xrMul(xrTranslate(...center),xrMul(xrRotateY(yaw),scale(s)));
}
const GRID=Object.freeze([
 {x:-.15,y:.13},{x:0,y:.13},{x:.15,y:.13},
 {x:-.15,y:-.13},{x:0,y:-.13},{x:.15,y:-.13}
]);
export const WATCH_MENU=Object.freeze(["main-menu","settings","camera","xr-mode","tablet","time"]);
export const WATCH_TIME_MENU=Object.freeze(["pause","quarter","normal","double","fast","rewind"]);
export const WATCH_MENU_LABELS=Object.freeze(["MENU","SET","VIEW","XR","TAB","TIME"]);
export const WATCH_TIME_LABELS=Object.freeze(["PAUSE","025","1X","2X","5X","BACK"]);
export function watchButtonAt(x,y){
 return GRID.findIndex(p=>Math.abs(x-p.x)<.064&&Math.abs(y-p.y)<.082);
}
export class XRWristWatch{
 constructor(){this.model=null;this.menuModel=null;this.display=null;this.page="menu";this.open=false;this.mode="universe";}
 reset(){this.model=null;this.menuModel=null;this.display=null;this.page="menu";this.open=false;}
 update(head,left,right,{hand="left",display=null,mode="universe"}={}){
  this.display=display;this.mode=mode;
  const grip=hand==="right"?right:left;
  if(!valid(head)||!valid(grip)){this.model=null;this.menuModel=null;return;}
  const wrist=[grip[12],grip[13]+.095,grip[14]];
  this.model=face(wrist,head,.26);
  const side=[head[0],head[1],head[2]],factor=hand==="left"?1:-1;
  const center=[wrist[0]+side[0]*.30*factor,wrist[1]+.05+side[1]*.30*factor,
   wrist[2]+side[2]*.30*factor];
  this.menuModel=this.open?face(center,head,.96):null;
 }
 press(ray){
  if(!valid(ray))return null;
  if(this.menuModel){
   const hit=vrTabletRayHit(ray,this.menuModel,{maxDistance:1.8});
   if(hit){
    const index=watchButtonAt(hit.x,hit.y);
    if(index<0)return null;
    if(this.page==="time"){
     if(this.mode==="multiverse")return {action:"blocked"};
     const action=WATCH_TIME_MENU[index];
     if(this.mode==="universe"&&action!=="pause")return {action:"blocked"};
     return {action:"time-"+action};
    }
    const action=WATCH_MENU[index];
    if(action==="time"&&this.mode==="multiverse")return {action:"blocked"};
    if(action==="time"){this.page="time";return {action:"time-page"};}
    return {action};
   }
  }
  if(this.model&&vrTabletRayHit(ray,this.model,{maxDistance:1.0})){
   this.open=!this.open;this.page="menu";this.menuModel=null;
   return {action:"toggle",open:this.open};
  }
  return null;
 }
}
