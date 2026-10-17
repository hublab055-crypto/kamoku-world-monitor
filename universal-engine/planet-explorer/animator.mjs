/**
 * Universal Engine v0.7a transition animator: deterministic, frame-time
 * independent smoothing of 60-joint-compatible poses.
 *
 * Semantics are intentionally small; rig-v2 maps pose values to joint matrices.
 * Moving arms and locomotion do not reset when a tool animation starts.
 */
import {samplePose} from "./rig.mjs";
const alpha=(dt,tau)=>1-Math.exp(-Math.max(0,dt)/Math.max(.001,tau));
const smooth=(a,b,t)=>a+(b-a)*t;
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const range=(v,min,max)=>Math.min(max,Math.max(min,v));
export const ANIMATION_STATES=Object.freeze([
 "idle","walk","run","jump","sword","spear","greatsword","axe","mine","bow","guard","hit","build",
 "sit","stand","sleep","rest","read","eat","serve","cook","wash","warm"
]);
export function blendPose(from,to,weight){
 if(!Number.isFinite(weight))throw TypeError("Invalid blend weight");
 const t=range(weight,0,1),result={};
 for(const k of new Set([...Object.keys(from),...Object.keys(to)])){
  const a=from[k],b=to[k];
  if(typeof a==="number"||typeof b==="number"){
   const x=Number.isFinite(a)?a:0,y=Number.isFinite(b)?b:0;
   result[k]=k.endsWith("Y")||k.endsWith("Z")?x+angle(x,y)*t:smooth(x,y,t);
  }else result[k]=t>=.5?(b??a):(a??b);
 }
 return result;
}
export class SmoothAnimator {
 constructor({walkTau=.17,actionTau=.105}={}){
  if(![walkTau,actionTau].every(x=>Number.isFinite(x)&&x>0&&x<5))
    throw TypeError("Invalid animator transition");
  this.walkTau=walkTau;this.actionTau=actionTau;
  this.pose=samplePose();this.state="idle";this.elapsed=0;
  this.lastPhase=0;this.movementIntensity=0;
 }
 reset(){this.pose=samplePose();this.state="idle";this.elapsed=0;this.movementIntensity=0;}
 update(dt,{
   moving=false,phase=0,speedMps=moving?5:0,jumpHeight=0,action="idle",progress=0,
   emotion="neutral",faceDirection=0,hand="right",variant="overhead",equipped={}
 }={}){
  if(![dt,phase,speedMps,jumpHeight,progress,faceDirection].every(Number.isFinite)||dt<0)
    throw TypeError("Invalid animation update");
  const elapsed=Math.min(dt,.25),flight=jumpHeight>.01||action==="jump";
  const toolAction=["sword","spear","greatsword","axe","mine","bow","guard","hit","build"].includes(action);
  const lifeAction=["sit","sleep","rest","read","eat","serve","cook","wash","warm"].includes(action);
  const speed=Math.min(1,Math.abs(speedMps)/5);
  const move=moving&&speed>.01&&!flight;
  this.state=flight?"jump":toolAction||lifeAction?action:move?(speedMps>6.4?"run":"walk"):"idle";
  const locomotion=samplePose({moving:move,phase,jumpHeight:0,action:"idle"});
  let target={...locomotion};
  if(!flight&&!toolAction&&!lifeAction){
   // Resting guard pose keeps armed hands slightly forward, without freezing the walk cycle.
   for(const side of ["left","right"]){
    if(["sword","spear","greatsword","axe","pickaxe","bow"].includes(equipped?.[side])){
     const key=side+"ShoulderX";
     target[key]=target[key]*.35-.48;
     target[side+"ElbowX"]=-.23;
    }
   }
   const paired=equipped.right===equipped.left&&
    ["spear","greatsword"].includes(equipped.right);
   if(paired){
    target.leftShoulderX=-.89;target.rightShoulderX=-.99;
    target.leftShoulderZ=-.27;target.rightShoulderZ=.22;
    target.leftElbowX=-.84;target.rightElbowX=-.72;
    target.torsoY=.06;
   }
  }
  if(flight)target=samplePose({jumpHeight:Math.max(.02,jumpHeight),action:"jump"});
  else if(toolAction){
    const tool=samplePose({action,progress,variant});
    // Keep legs locomoting and smoothly blend only upper body for work.
    for(const key of Object.keys(tool)){
      if(["torsoX","torsoY","leftShoulderX","rightShoulderX",
          "leftShoulderZ","rightShoulderZ","leftElbowX","rightElbowX",
          "leftWristX","rightWristX"].includes(key))target[key]=tool[key];
    }
    if(hand==="left"&&!["spear","greatsword"].includes(action)){
      // Mirror the tool gesture at the shoulder / elbow / wrist. Leg locomotion
      // and other life poses are unaffected by the wielding hand.
      for(const segment of ["ShoulderX","ShoulderZ","ElbowX","WristX"]){
       const lk="left"+segment,rk="right"+segment;
       const left=tool[lk],right=tool[rk];
       if(Number.isFinite(left)&&Number.isFinite(right)){
        target[lk]=segment==="ShoulderZ"?-right:right;
        target[rk]=segment==="ShoulderZ"?-left:left;
       }
      }
    }
    if(hand==="left"&&!["spear","greatsword"].includes(action))target.torsoY=-(target.torsoY||0);
    target.tool=tool.tool;
  }
  if(lifeAction&&!flight){
   const sitting=["sit","read","eat"].includes(action),lying=["sleep","rest"].includes(action);
   if(sitting||lying){
    target.rootY=lying?-.62:-.37;
    target.leftHipX=lying?-.20:-1.15;target.rightHipX=lying?-.20:-1.15;
    target.leftKneeX=lying?.32:1.34;target.rightKneeX=lying?.32:1.34;
    target.leftAnkleX=lying?0:-.28;target.rightAnkleX=lying?0:-.28;
    target.torsoX=lying?-1.22:sitting?-.06:0;
   }
   if(action==="read"){
    target.leftShoulderX=-.65;target.rightShoulderX=-.65;
    target.leftElbowX=-.85;target.rightElbowX=-.85;target.headY=.09;
   }else if(action==="eat"){
    target.rightShoulderX=-.92;target.rightElbowX=-1.25;
    target.leftShoulderX=-.45;target.leftElbowX=-.7;
   }else if(action==="cook"||action==="wash"||action==="serve"){
    target.torsoX=.13;target.leftShoulderX=-.82;target.rightShoulderX=-.91;
    target.leftElbowX=-.68;target.rightElbowX=-.73;
   }else if(action==="warm"){
    target.leftShoulderX=-.38;target.rightShoulderX=-.38;
    target.leftElbowX=-.75;target.rightElbowX=-.75;
   }
  }
  const gaze=range(faceDirection,-.48,.48);
  target.headY=gaze+(action==="read"?.12:0);
  target.chestX=Math.sin(this.elapsed*2.4)*.012;
  // Tiny weight shifts through shoulders and pelvis; no world-space displacement.
  target.leftClavicleZ=move?Math.sin(phase+.65)*.055:.015;
  target.rightClavicleZ=move?Math.sin(phase+Math.PI+.65)*.055:-.015;
  target.leftUpperArmTwistX=move?Math.sin(phase)*.06:0;
  target.rightUpperArmTwistX=move?-Math.sin(phase)*.06:0;
  target.leftThighTwistX=move?Math.sin(phase)*.035:0;
  target.rightThighTwistX=move?-Math.sin(phase)*.035:0;
  target.jawX=emotion==="joy"?-.065:emotion==="surprise"?-.23:0;
  target.leftEyeY=gaze*.12;target.rightEyeY=gaze*.12;
  for(const side of ["left","right"]){
    const fingers=["Thumb","Index","Middle","Ring","Little"];
    for(const finger of fingers){
      target[side+finger+"1X"]=toolAction?-.66:move?-.25:-.12;
      target[side+finger+"2X"]=toolAction?-.52:-.12;
    }
  }
  // Fast cuts need low latency so the head-height windup and impact remain visible.
  const tau=action==="greatsword"?Math.max(.115,this.actionTau):
    toolAction&&["sword","spear","axe"].includes(action)?Math.min(.045,this.actionTau):this.actionTau;
  const a=alpha(elapsed,flight?this.actionTau:this.state==="idle"?.24:toolAction?tau:this.walkTau);
  this.pose=blendPose(this.pose,target,a);
  // Tool attachment switches on immediately at action start and detaches at finish.
  this.pose.tool=toolAction?target.tool:null;
  this.elapsed+=elapsed;
  this.movementIntensity=smooth(this.movementIntensity,move?1:0,a);
  this.lastPhase=phase;
  return {...this.pose};
 }
 snapshot(){
  // Intentional ephemeral animation state: no GPU resources or joints to save.
  return {version:1,state:this.state,elapsed:this.elapsed,pose:{...this.pose},
          movementIntensity:this.movementIntensity,lastPhase:this.lastPhase};
 }
 static fromSnapshot(data){
  if(data?.version!==1||typeof data.pose!=="object"||Array.isArray(data.pose))
    throw Error("Invalid Animator snapshot");
  if(!Object.values(data.pose).every(v=>v===null||typeof v==="string"||(typeof v==="number"&&Number.isFinite(v))))
    throw Error("Animator contains invalid pose values");
  const x=new SmoothAnimator();
  x.pose={...data.pose};
  x.state=ANIMATION_STATES.includes(data.state)?data.state:"idle";
  x.elapsed=Number.isFinite(data.elapsed)?data.elapsed:0;
  x.movementIntensity=Number.isFinite(data.movementIntensity)?data.movementIntensity:0;
  x.lastPhase=Number.isFinite(data.lastPhase)?data.lastPhase:0;
  return x;
 }
}
