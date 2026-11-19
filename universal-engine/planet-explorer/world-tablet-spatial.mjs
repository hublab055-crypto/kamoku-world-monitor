/**
 * Head/Touch-controller-attached tablet for the WebXR stereo renderer.
 * Geometry is an original low-poly terminal. Remote video/browser iframe
 * pixels are never sampled or presented as WebGL textures.
 *
 * The wall position is an XR-session-local floating screen, not an AR plane
 * anchor or an automatic attachment to collision geometry.
 */
import {xrForward,xrMul,xrRotateY,xrTranslate} from "./xr-spatial.mjs?v=20261119-tablet-3d";

export const VR_TABLET_KEYS=Object.freeze([
 {id:"video",label:"VIDEO",x:-.18,y:.14},{id:"web",label:"WEB",x:-.06,y:.14},
 {id:"chat",label:"CHAT",x:.06,y:.14},{id:"avatar",label:"AVTR",x:.18,y:.14},
 {id:"settings",label:"SET",x:-.18,y:0},{id:"motion",label:"MOTION",x:-.06,y:0},
 {id:"rts",label:"RTS",x:.06,y:0},{id:"ship",label:"SHIP",x:.18,y:0},
 {id:"wall",label:"WALL",x:-.18,y:-.14},{id:"hand",label:"HAND",x:-.06,y:-.14},
 {id:"rec",label:"REC",x:.06,y:-.14},{id:"hide",label:"OFF",x:.18,y:-.14}
]);
export const VR_AVATAR_KEYS=Object.freeze([
 {id:"eye-less",label:"EYE-",x:-.18,y:.14},{id:"eye-more",label:"EYE+",x:-.06,y:.14},
 {id:"brow-less",label:"BROW-",x:.06,y:.14},{id:"brow-more",label:"BROW+",x:.18,y:.14},
 {id:"mouth-less",label:"LIP-",x:-.18,y:0},{id:"mouth-more",label:"LIP+",x:-.06,y:0},
 {id:"torso-less",label:"BODY-",x:.06,y:0},{id:"torso-more",label:"BODY+",x:.18,y:0},
 {id:"leg-less",label:"LEG-",x:-.18,y:-.14},{id:"leg-more",label:"LEG+",x:-.06,y:-.14},
 {id:"save",label:"SAVE",x:.06,y:-.14},{id:"back",label:"BACK",x:.18,y:-.14}
]);
export const VR_MOTION_KEYS=Object.freeze([
 {id:"record",label:"REC",x:-.18,y:.14},{id:"stop",label:"STOP",x:-.06,y:.14},
 {id:"play",label:"PLAY",x:.06,y:.14},{id:"clear",label:"CLEAR",x:.18,y:.14},
 {id:"back",label:"BACK",x:.18,y:-.14}
]);
export const VR_AVATAR_ADJUSTMENTS=Object.freeze({
 "eye-less":["eyeSize",-3],"eye-more":["eyeSize",3],
 "brow-less":["browSize",-3],"brow-more":["browSize",3],
 "mouth-less":["mouthSize",-3],"mouth-more":["mouthSize",3],
 "torso-less":["torsoWidth",-3],"torso-more":["torsoWidth",3],
 "leg-less":["legLength",-3],"leg-more":["legLength",3]
});
export const VR_TABLET_WIDTH=.56,VR_TABLET_HEIGHT=.51;
export const VR_TABLET_WALL_SCALE=2.25;
const finiteMatrix=m=>m&&m.length>=16&&[0,1,2,4,5,6,8,9,10,12,13,14].every(i=>Number.isFinite(m[i]));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

function facingMatrix(center,eye,scale=1){
 const dx=eye[0]-center[0],dz=eye[2]-center[2];
 const yaw=Math.atan2(dx,dz);
 const size=[scale,0,0,0, 0,scale,0,0, 0,0,scale,0, 0,0,0,1];
 return xrMul(xrTranslate(...center),xrMul(xrRotateY(yaw),size));
}

export function vrTabletHandPose(head,hand){
 if(!finiteMatrix(head))return null;
 const front=xrForward(head);
 const origin=[head[12],head[13],head[14]];
 let center;
 if(finiteMatrix(hand)){
  // The visible panel follows the actual left Touch controller in metres.
  // Slight vertical offset prevents collision with the modelled controller.
  center=[hand[12],hand[13]+.15,hand[14]-.035];
 }else{
  // Explicit fallback when the left controller is untracked: a head-relative
  // terminal, NOT a fabricated controller pose or captured hand motion.
  const side=[head[0],head[1],head[2]];
  center=[
   origin[0]+front[0]*.72-side[0]*.20,
   origin[1]-.22,
   origin[2]+front[2]*.72-side[2]*.20
  ];
 }
 return facingMatrix(center,origin);
}

export function vrTabletWallPose(head){
 if(!finiteMatrix(head))return null;
 const f=xrForward(head);
 const length=Math.hypot(f[0],f[2])||1;
 const origin=[head[12],head[13],head[14]];
 const center=[origin[0]+f[0]/length*1.65,
  origin[1]-.08,
  origin[2]+f[2]/length*1.65];
 return facingMatrix(center,origin,VR_TABLET_WALL_SCALE);
}

/** Forward-facing ray-plane hit in tablet-local metres, no far-side clicks. */
export function vrTabletRayHit(ray,model,{maxDistance=3.5}={}){
 if(!finiteMatrix(ray)||!finiteMatrix(model))return null;
 const dir=xrForward(ray),from=[ray[12],ray[13],ray[14]],
  at=[model[12],model[13],model[14]];
 const normal=[model[8],model[9],model[10]],nLen=Math.hypot(...normal);
 if(!(nLen>0))return null;
 const unitNormal=normal.map(v=>v/nLen);
 const denom=dot(dir,unitNormal);
 if(denom>=-1e-5)return null;
 const t=dot(at.map((v,i)=>v-from[i]),unitNormal)/denom;
 if(!Number.isFinite(t)||t<.02||t>maxDistance)return null;
 const d=from.map((v,i)=>v+dir[i]*t-at[i]);
 const colX=[model[0],model[1],model[2]],colY=[model[4],model[5],model[6]];
 const llX=dot(colX,colX),llY=dot(colY,colY);
 if(!(llX>1e-8&&llY>1e-8))return null;
 const x=dot(d,colX)/llX,y=dot(d,colY)/llY;
 if(Math.abs(x)>VR_TABLET_WIDTH/2||Math.abs(y)>VR_TABLET_HEIGHT/2)return null;
 return {x,y,distanceM:t};
}

export function vrTabletButtonAt(x,y){
 return VR_TABLET_KEYS.find(k=>Math.abs(x-k.x)<=.052&&Math.abs(y-k.y)<=.052)?.id||null;
}

export class XRWorldTablet{
 constructor(){
  this.enabled=false;this.position="hand";this.model=null;this.page="main";
  this.head=null;this.left=null;this.wall=null;
 }
 setEnabled(enabled){
  this.enabled=Boolean(enabled);
  if(!this.enabled)this.model=null;
  return this.enabled;
 }
 update(head,left){
  if(!this.enabled||!finiteMatrix(head)){this.model=null;return null;}
  this.head=Array.from(head);
  this.left=finiteMatrix(left)?Array.from(left):null;
  this.model=this.position==="wall"&&this.wall?
   this.wall:vrTabletHandPose(this.head,this.left);
  return this.model;
 }
 setPage(page){
  if(!["main","avatar","motion"].includes(page))return false;
  this.page=page;return true;
 }
 press(ray){
  if(!this.enabled||!this.model)return null;
  const hit=vrTabletRayHit(ray,this.model);
  if(!hit)return null;
  const keys=this.page==="avatar"?VR_AVATAR_KEYS:this.page==="motion"?VR_MOTION_KEYS:VR_TABLET_KEYS;
  const action=keys.find(k=>Math.abs(hit.x-k.x)<=.052&&Math.abs(hit.y-k.y)<=.052)?.id;
  if(!action)return null;
  if(action==="avatar"||action==="motion")this.setPage(action);
  else if(action==="back")this.setPage("main");
  if(action==="wall"){
   const placed=vrTabletWallPose(this.head);
   if(!placed)return null;
   this.wall=placed;this.position="wall";this.model=placed;
  }else if(action==="hand"){
   this.position="hand";this.model=vrTabletHandPose(this.head,this.left);
  }else if(action==="hide"){
   this.setEnabled(false);
  }
  return {action,hit};
 }
 resetSession(){
  this.head=null;this.left=null;this.wall=null;this.position="hand";this.page="main";this.model=null;
 }
 get scale(){return this.position==="wall"?VR_TABLET_WALL_SCALE:1;}
}
