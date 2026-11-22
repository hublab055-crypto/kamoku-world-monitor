/**
 * Meta Quest Touch positional interactions for first-person VR.
 * All coordinates use the XR reference space (meters); no WebXR globals.
 * Saves and character combat state are managed by the existing game.
 */
const delta=(a,b)=>a.map((x,i)=>x-b[i]);
const distance=(a,b)=>Math.hypot(...delta(a,b));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const normalized=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);};
const pos=m=>m&&m.length>=16?[m[12],m[13],m[14]]:null;
export const clamp01=n=>Math.max(0,Math.min(1,n));
export const XR_GRAB_RADIUS_M=.34;
export const XR_SWORD_SWING_MPS=1.55;

export function xrBodyAnchors(headMatrix,{floorY=null}={}){
 const h=pos(headMatrix);
 if(!h)return null;
 const right=normalized([headMatrix[0],0,headMatrix[2]]);
 const forward=normalized([-headMatrix[8],0,-headMatrix[10]]);
 const at=(lateral,down,front=0)=>[
  h[0]+right[0]*lateral+forward[0]*front,
  h[1]-down,
  h[2]+right[2]*lateral+forward[2]*front
 ];
 const ground=Number.isFinite(floorY)?floorY:h[1]-1.65;
 return {
  head:h,forward,right,shoulderLeft:at(-.26,.30,-.05),
  shoulderRight:at(.26,.30,-.08),leftHip:at(-.20,.78,.02),
  rightHip:at(.20,.78,.02),chest:at(0,.48,.09),
  leftPocket:at(-.17,.80,.14),rightPocket:at(.17,.80,.14),
  leftCoat:at(-.16,.49,.17),rightCoat:at(.16,.49,.17),
  rodCarry:at(-.28,.64,-.20),toolBeltRight:at(.27,.78,.04),
  toolBeltLeft:at(-.29,.83,.03),pickShoulder:at(.29,.41,-.19),
  pelvis:at(0,.90,0),leftElbow:at(-.32,.45,.06),
  rightElbow:at(.32,.45,.06),
  leftKnee:at(-.13,Math.min(1.30,h[1]-ground-.36),.13),
  rightKnee:at(.13,Math.min(1.30,h[1]-ground-.36),.13),
  leftFoot:[h[0]-right[0]*.14+forward[0]*.10,ground+.09,
   h[2]-right[2]*.14+forward[2]*.10],
  rightFoot:[h[0]+right[0]*.14+forward[0]*.10,ground+.09,
   h[2]+right[2]*.14+forward[2]*.10]
 };
}
export function xrDirection(rayMatrix){
 return rayMatrix?normalized([-rayMatrix[8],-rayMatrix[9],-rayMatrix[10]]):[0,0,-1];
}
export function xrDrawLength(bowHand,arrowHand,bowRay){
 if(!bowHand||!arrowHand)return 0;
 const forward=xrDirection(bowRay);
 // Pulling the right hand back, opposite to the bow's aim vector.
 return Math.max(0,-dot(delta(arrowHand,bowHand),forward));
}
export class VRPhysicalControls{
 constructor(){
  this.bowHeld=false;this.arrowHeld=false;this.swordHeld=false;
  this.toolHeld={left:null,right:null};this.heldDrop=null;
  this.nocked=false;this.triggerDown=false;this.pull=0;
  this.pose=null;this.anchors=null;this.lastRight=null;
  this.lastTime=null;this.lastSwingAt=-Infinity;this.suppressRightSelect=false;
 }
 setPose(pose,time,{floorY=null}={}){
  this.pose=pose;
  this.anchors=xrBodyAnchors(pose?.head,{floorY});
  const left=pos(pose?.left),right=pos(pose?.right);
  const events=[];
  if(this.bowHeld&&this.arrowHeld&&!this.nocked&&left&&right&&distance(left,right)<.31){
   this.nocked=true;events.push("nock");
  }
  if(this.nocked&&this.triggerDown)
   this.pull=clamp01((xrDrawLength(left,right,pose?.leftRay)-.04)/.55);
  else if(!this.triggerDown)this.pull=0;
  if(this.swordHeld&&right&&this.lastRight&&Number.isFinite(time)&&Number.isFinite(this.lastTime)){
   const elapsed=(time-this.lastTime)/1000;
   const travel=distance(right,this.lastRight);
   const speed=elapsed>.008&&elapsed<.16?travel/elapsed:0;
   if(travel>=.11&&speed>=XR_SWORD_SWING_MPS&&time-this.lastSwingAt>=650){
    this.lastSwingAt=time;events.push("swordSwing");
   }
  }
  this.lastRight=right;
  this.lastTime=time;
  return events;
 }
 grab(hand,authorize=()=>true){
  const h=this.anchors,p=pos(this.pose?.[hand]);
  if(!h||!p)return {kind:"none"};
  if(hand==="left"&&distance(p,h.shoulderLeft)<XR_GRAB_RADIUS_M){
   if(this.bowHeld)return {kind:"bow",already:true};
   if(!authorize("bow","left"))return {kind:"unavailable",item:"bow"};
   this.bowHeld=true;this.toolHeld.left=null;
   return {kind:"bow"};
  }
  if(hand==="right"){
   if(distance(p,h.leftHip)<XR_GRAB_RADIUS_M){
    if(this.swordHeld){
     this.swordHeld=false;return {kind:"sheathe"};
    }
    if(!authorize("sword","right"))return {kind:"unavailable",item:"sword"};
    this.swordHeld=true;this.toolHeld.right=null;
    this.arrowHeld=false;this.nocked=false;this.pull=0;
    return {kind:"sword"};
   }
   if(this.bowHeld&&distance(p,h.shoulderRight)<XR_GRAB_RADIUS_M){
    if(this.arrowHeld)return {kind:"arrow",already:true};
    if(!authorize("arrow","right"))return {kind:"unavailable",item:"arrow"};
    this.swordHeld=false;this.arrowHeld=true;this.nocked=false;
    return {kind:"arrow"};
   }
  }
  // Each VR physical holster uses the existing inventory's permission check.
  // A second grip on the same slot puts that item away.
  const slots=hand==="right"?
   [["axe",h.toolBeltRight],["pickaxe",h.pickShoulder]]:
   [["hammer",h.toolBeltLeft],["fishingRod",h.rodCarry]];
  for(const [item,point] of slots){
   if(distance(p,point)>=.28)continue;
   if(this.toolHeld[hand]===item){
    this.toolHeld[hand]=null;return {kind:"stowTool",item,hand};
   }
   if(!authorize(item,hand))return {kind:"unavailable",item};
   this.toolHeld[hand]=item;
   if(hand==="right"){this.swordHeld=false;this.arrowHeld=false;this.nocked=false;}
   if(hand==="left"){this.bowHeld=false;this.nocked=false;this.arrowHeld=false;}
   return {kind:"tool",item,hand};
  }
  return {kind:"none"};
 }
 triggerStart(hand){
  if(hand==="right"&&this.bowHeld&&this.nocked){
   this.triggerDown=true;this.pull=0;this.suppressRightSelect=true;
   return "draw";
  }
  return null;
 }
 triggerEnd(hand){
  if(hand!=="right"||!this.triggerDown)return null;
  this.triggerDown=false;
  const fired=this.nocked&&this.pull>=.18;
  const result={kind:fired?"shoot":"cancelDraw",power:this.pull};
  this.pull=0;
  if(fired){this.arrowHeld=false;this.nocked=false;}
  return result;
 }
 suppressSelect(hand){
  if(hand!=="right"||!this.suppressRightSelect)return false;
  this.suppressRightSelect=false;return true;
 }
 snapshot(){
  return {
   head:this.pose?.head||null,left:this.pose?.left||null,right:this.pose?.right||null,
   leftRay:this.pose?.leftRay||null,rightRay:this.pose?.rightRay||null,
   anchors:this.anchors,bowHeld:this.bowHeld,arrowHeld:this.arrowHeld,
   swordHeld:this.swordHeld,toolHeld:{...this.toolHeld},heldDrop:this.heldDrop,
   nocked:this.nocked,drawing:this.triggerDown,pull:this.pull
  };
 }
}
