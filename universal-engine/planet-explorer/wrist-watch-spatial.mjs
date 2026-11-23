/**
 * Quest wrist terminal: a real wrist-local watch, not a head-facing floating tablet.
 * Coordinate convention: XR column-major metres, grip local +Z points toward the
 * forearm, +Y points to the back of the wrist, -Z points towards the fingers.
 * The gaze/menu state is independent of world simulation speed.
 */
import {xrForward,xrMul,xrRotateY,xrTranslate} from "./xr-spatial.mjs";
import {vrTabletRayHit} from "./world-tablet-spatial.mjs";

const valid=m=>m&&m.length>=16&&[0,1,2,4,5,6,8,9,10,12,13,14].every(i=>Number.isFinite(m[i]));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const pos=m=>[m[12],m[13],m[14]];
const axis=(m,c)=>[m[c*4],m[c*4+1],m[c*4+2]];
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const magnitude=v=>Math.hypot(...v);
const normalize=v=>v.map(x=>x/(magnitude(v)||1));
const matrix=(x,y,z,p)=>[...x,0,...y,0,...z,0,...p,1];
const scale=s=>[s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1];
const FACE_SCALE=.14;
function faceToViewer(center,head,size=1.17){
 const yaw=Math.atan2(head[12]-center[0],head[14]-center[2]);
 return xrMul(xrTranslate(...center),xrMul(xrRotateY(yaw),scale(size)));
}
export const WATCH_MENU=Object.freeze(["main-menu","settings","camera","xr-mode","tablet","ship"]);
export const WATCH_MAIN_MENU=Object.freeze(["back","settings","camera","tablet","time","close"]);
export const WATCH_SETTINGS_MENU=Object.freeze(["back","watch-style","watch-hand","watch-creative","watch-universe","close"]);
export const WATCH_XR_MENU=Object.freeze(["back","xr-third","xr-rts","tablet","xr-exit","close"]);
export const WATCH_TIME_MENU=Object.freeze(["pause","quarter","normal","double","fast","rewind"]);
export const WATCH_SHIP_MENU=Object.freeze(["ship-hatch","ship-crew","ship-engine","ship-rollcall","ship-launch","ship-combat"]);
export const WATCH_MENU_LABELS=Object.freeze(["MENU","SET","VIEW","XR","TAB","SHIP"]);
export const WATCH_MAIN_LABELS=Object.freeze(["BACK","SET","VIEW","TAB","TIME","CLOSE"]);
export const WATCH_SETTINGS_LABELS=Object.freeze(["BACK","STYLE","HAND","CREAT","UNIV","CLOSE"]);
export const WATCH_XR_LABELS=Object.freeze(["BACK","3RD","RTS","TAB","EXIT","CLOSE"]);
export const WATCH_TIME_LABELS=Object.freeze(["PAUSE",".25","1X","2X","5X","REW"]);
export const WATCH_SHIP_LABELS=Object.freeze(["HATCH","CREW","START","REPORT","LIFT","FIRE"]);
const GRID=Object.freeze([
 {x:-.15,y:.13},{x:0,y:.13},{x:.15,y:.13},
 {x:-.15,y:-.13},{x:0,y:-.13},{x:.15,y:-.13}
]);
export function watchButtonAt(x,y){
 return GRID.findIndex(p=>Math.abs(x-p.x)<.069&&Math.abs(y-p.y)<.092);
}
export function watchWristFrame(grip){
 if(!valid(grip))return null;
 const x=axis(grip,0),y=axis(grip,2).map(v=>-v),z=axis(grip,1);
 const wrist=add(pos(grip),axis(grip,2),.10);
 return matrix(x,y,z,wrist);
}
export function watchGlance(head,watchModel){
 if(!valid(head)||!valid(watchModel))return false;
 const eye=pos(head),dial=pos(watchModel),toWrist=sub(dial,eye);
 const d=magnitude(toWrist);
 if(d<.17||d>.77||toWrist[1]<-.59||toWrist[1]>.24)return false;
 const view=dot(normalize(toWrist),xrForward(head));
 const face=dot(normalize(sub(eye,dial)),normalize(axis(watchModel,2)));
 return view>.75&&face>.18;
}
export class XRWristWatch{
 constructor(){
  this.model=null;this.wristFrame=null;this.menuModel=null;
  this.display=null;this.page="menu";this.open=false;this.mode="universe";
  this.hand="left";this.awake=false;this.gazeSeconds=0;this.gazeLocked=false;
  this.lastTimeMs=null;this.lastGlanceMs=-Infinity;this.lastHead=null;
 }
 reset(){
  this.model=null;this.wristFrame=null;this.menuModel=null;
  this.display=null;this.page="menu";this.open=false;this.awake=false;
  this.gazeSeconds=0;this.gazeLocked=false;this.lastTimeMs=null;this.lastGlanceMs=-Infinity;
 }
 openMenu(head=this.lastHead){
  if(!valid(head))return false;
  const f=xrForward(head),side=axis(head,0);
  const at=add(add(add(pos(head),f,.73),side,this.hand==="left"?.075:-.075),[0,-1,0],.15);
  this.menuModel=faceToViewer(at,head);
  this.open=true;this.page="menu";this.gazeLocked=true;
  return true;
 }
 closeMenu(){
  this.open=false;this.menuModel=null;this.page="menu";this.gazeLocked=true;
 }
 update(head,left,right,{hand="left",display=null,mode="universe"}={},timeMs=null){
  this.display=display;this.mode=mode;
  this.hand=hand==="right"?"right":"left";
  this.lastHead=valid(head)?Array.from(head):null;
  const grip=this.hand==="right"?right:left;
  const wrist=watchWristFrame(grip);
  if(!valid(head)||!wrist){
   this.model=null;this.wristFrame=null;this.awake=false;this.gazeSeconds=0;
   this.lastTimeMs=Number.isFinite(timeMs)?timeMs:null;
   return;
  }
  this.wristFrame=wrist;
  // Dial sits over the dorsal surface of the tracked wrist.
  const back=axis(wrist,2);
  const dial=add(pos(wrist),back,.045);
  this.model=matrix(axis(wrist,0).map(n=>n*FACE_SCALE),
   axis(wrist,1).map(n=>n*FACE_SCALE),
   axis(wrist,2).map(n=>n*FACE_SCALE),dial);
  const dt=Number.isFinite(timeMs)&&Number.isFinite(this.lastTimeMs)?
   Math.max(0,Math.min(.08,(timeMs-this.lastTimeMs)/1000)):0;
  if(Number.isFinite(timeMs))this.lastTimeMs=timeMs;
  if(watchGlance(head,this.model)){
   this.gazeSeconds=Math.min(2.2,this.gazeSeconds+dt);
   if(Number.isFinite(timeMs))this.lastGlanceMs=timeMs;
   if(!this.open&&!this.gazeLocked&&this.gazeSeconds>=1.05)this.openMenu(head);
  }else{
   this.gazeSeconds=Math.max(0,this.gazeSeconds-dt*2.2);
   if(this.gazeSeconds<.09)this.gazeLocked=false;
  }
  this.awake=this.gazeSeconds>.17||this.open||
   Number.isFinite(timeMs)&&timeMs-this.lastGlanceMs<2400;
 }
 menuActions(){
  return this.page==="main"?WATCH_MAIN_MENU:this.page==="settings"?WATCH_SETTINGS_MENU:
   this.page==="xr"?WATCH_XR_MENU:this.page==="time"?WATCH_TIME_MENU:this.page==="ship"?WATCH_SHIP_MENU:WATCH_MENU;
 }
 menuLabels(){
  return this.page==="main"?WATCH_MAIN_LABELS:this.page==="settings"?WATCH_SETTINGS_LABELS:
   this.page==="xr"?WATCH_XR_LABELS:this.page==="time"?WATCH_TIME_LABELS:this.page==="ship"?WATCH_SHIP_LABELS:WATCH_MENU_LABELS;
 }
 press(ray,{sourceHand=null,grip=null}={}){
  const hasRay=valid(ray);
  if(this.menuModel&&hasRay){
   const hit=vrTabletRayHit(ray,this.menuModel,{maxDistance:2});
   if(hit){
    const index=watchButtonAt(hit.x,hit.y);
    if(index<0)return null;
    const action=this.menuActions()[index];
    if(this.page==="time"){
     if(this.mode==="multiverse"||this.mode==="universe"&&action!=="pause")return {action:"blocked"};
     return {action:"time-"+action};
    }
    if(action==="ship"){this.page="ship";return {action:"ship-page"};}
    if(action==="time"&&this.mode==="multiverse")return {action:"blocked"};
    if(action==="time"){this.page="time";return {action:"time-page"};}
    if(action==="main-menu"){this.page="main";return {action:"main-page"};}
    if(action==="settings"){this.page="settings";return {action:"settings-page"};}
    if(action==="xr-mode"){this.page="xr";return {action:"xr-page"};}
    if(action==="back"){this.page="menu";return {action:"back-page"};}
    if(action==="close"){this.closeMenu();return {action:"close"};}
    return {action};
   }
  }
  const rayHit=this.model&&hasRay&&vrTabletRayHit(ray,this.model,{maxDistance:1.25});
  // Optional tactile fallback: touch the watch with the opposite controller
  // while intentionally looking at it. Never hijack same-hand combat input.
  const touch=sourceHand&&sourceHand!==this.hand&&valid(grip)&&this.awake&&
   this.model&&magnitude(sub(pos(grip),pos(this.model)))<.085;
  if(rayHit||touch){
   if(this.open){this.closeMenu();return {action:"toggle",open:false};}
   if(this.openMenu())return {action:"toggle",open:true};
  }
  return null;
 }
}
