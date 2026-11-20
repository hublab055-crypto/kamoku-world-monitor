/** Quest XR two-hand joint posing in a dedicated editor-only mode.
 * Controller grips move a second, isolated V10 preview; never the live NPC,
 * ship HOTAS, inventory, or combat rig. Scene coordinates are WebXR metres.
 */
import {xrForward,xrMul,xrRotateY,xrTranslate} from "./xr-spatial.mjs";
export const POSE_EDITOR_SCHEMA="universal-engine.xr-joint-pose.v1";
export const POSE_EDITOR_MAX_FRAMES=500;
export const POSE_EDITOR_INTERVAL_MS=50;
export const POSE_EDITOR_TARGETS=Object.freeze(["navigator","engineer","companion"]);
export const POSE_EDITOR_JOINTS=Object.freeze({
 head:[0,1.66,0],
 leftElbow:[-.38,1.18,.08],leftHand:[-.52,.98,.13],
 rightElbow:[.38,1.18,.08],rightHand:[.52,.98,.13],
 leftKnee:[-.14,.51,.10],leftFoot:[-.14,.095,.15],
 rightKnee:[.14,.51,.10],rightFoot:[.14,.095,.15]
});
export const POSE_EDITOR_LINKS=Object.freeze([
 ["leftElbow","leftHand"],["rightElbow","rightHand"],
 ["leftKnee","leftFoot"],["rightKnee","rightFoot"]
]);
const finite=v=>Array.isArray(v)||ArrayBuffer.isView(v);
const poseMatrix=m=>finite(m)&&m.length>=16&&[0,1,2,4,5,6,8,9,10,12,13,14].every(i=>Number.isFinite(m[i]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]);
const round=n=>Math.round(n*10000)/10000;
const copyJoints=j=>Object.fromEntries(Object.entries(j).map(([id,v])=>[id,[...v]]));
const pos=m=>[m[12],m[13],m[14]];
const rotateLocal=(m,v)=>[
  m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
  m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
  m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
const inversePoint=(m,world)=>{
 const v=sub(world,pos(m));
 return [v[0]*m[0]+v[1]*m[1]+v[2]*m[2],
  v[0]*m[4]+v[1]*m[5]+v[2]*m[6],
  v[0]*m[8]+v[1]*m[9]+v[2]*m[10]];
};
export function xrPoseEditorAnchor(head,{floorTracked=true}={}){
 if(!poseMatrix(head))return null;
 const f=xrForward(head),length=Math.hypot(f[0],f[2])||1;
 const forward=[f[0]/length,f[2]/length],center=[
  head[12]+forward[0]*1.05,
  floorTracked?0:head[13]-1.64,
  head[14]+forward[1]*1.05];
 const yaw=Math.atan2(head[12]-center[0],head[14]-center[2]);
 return xrMul(xrTranslate(...center),xrRotateY(yaw));
}
export function xrJointHit(joints,anchor,grip,{maxDistance=.19,held={}}={}){
 if(!poseMatrix(anchor)||!poseMatrix(grip))return null;
 const hand=pos(grip);
 let best=null;
 for(const [id,point]of Object.entries(joints||{})){
  if(Object.values(held).some(h=>h?.joint===id))continue;
  const d=dist(hand,rotateLocal(anchor,point));
  if(d<=maxDistance&&(!best||d<best.distance))best={joint:id,distance:d};
 }
 return best;
}
export function validPoseEditorTrack(track){
 return track?.schema===POSE_EDITOR_SCHEMA&&POSE_EDITOR_TARGETS.includes(track?.target)&&
  Array.isArray(track?.frames)&&track.frames.length>0&&track.frames.length<=POSE_EDITOR_MAX_FRAMES&&
  track.frames.every(f=>Number.isFinite(f?.t)&&f.t>=0&&
   Object.entries(POSE_EDITOR_JOINTS).every(([id])=>
    Array.isArray(f.joints?.[id])&&f.joints[id].length===3&&
    f.joints[id].every(n=>Number.isFinite(n)&&Math.abs(n)<4)));
}
export function samplePoseEditorTrack(track,elapsedMs){
 if(!validPoseEditorTrack(track))return null;
 const frames=track.frames,duration=frames.at(-1).t;
 const t=duration>0?clamp(elapsedMs,0,duration):0;
 let i=0;while(i<frames.length-2&&frames[i+1].t<t)i++;
 const a=frames[i],b=frames[Math.min(i+1,frames.length-1)],s=b.t>a.t?(t-a.t)/(b.t-a.t):0;
 const joints=Object.fromEntries(Object.keys(POSE_EDITOR_JOINTS).map(id=>
  [id,a.joints[id].map((v,k)=>v+(b.joints[id][k]-v)*s)]));
 return {joints,t,duration};
}
export class XRAvatarPoseEditor{
 constructor(){
  this.active=false;this.anchor=null;this.target="navigator";this.joints=copyJoints(POSE_EDITOR_JOINTS);
  this.held={left:null,right:null};this.recording=false;this.track=null;
  this.startedAt=null;this.lastSample=-Infinity;this.playing=false;this.playbackAt=null;
  this.status="編集停止";
 }
 enter(head,{floorTracked=true}={}){
  const anchor=xrPoseEditorAnchor(head,{floorTracked});
  if(!anchor)return false;
  this.active=true;this.anchor=anchor;this.held={left:null,right:null};
  this.stop();this.playing=false;this.status="関節に手を近づけ、グリップでつかみます";return true;
 }
 exit(){this.active=false;this.held={left:null,right:null};this.stop();this.playing=false;this.anchor=null;}
 cycleTarget(){
  if(!this.active)return this.target;
  const i=POSE_EDITOR_TARGETS.indexOf(this.target);
  this.target=POSE_EDITOR_TARGETS[(i+1)%POSE_EDITOR_TARGETS.length];
  this.resetPose();this.clear();return this.target;
 }
 resetPose(){this.joints=copyJoints(POSE_EDITOR_JOINTS);this.held={left:null,right:null};this.playing=false;}
 grab(hand,matrix){
  if(!this.active||this.playing||!["left","right"].includes(hand)||!poseMatrix(matrix))return null;
  if(this.held[hand])return null;
  const candidate=xrJointHit(this.joints,this.anchor,matrix,{held:this.held});
  if(!candidate)return null;
  const local=inversePoint(this.anchor,pos(matrix));
  this.held[hand]={joint:candidate.joint,offset:sub(this.joints[candidate.joint],local)};
  this.status=hand+" grip: "+candidate.joint;return candidate.joint;
 }
 release(hand){
  if(!this.active||!["left","right"].includes(hand))return false;
  const had=Boolean(this.held[hand]);this.held[hand]=null;return had;
 }
 update(timeMs,poses={}){
  if(!this.active)return;
  if(this.playing&&this.track){
   const frame=samplePoseEditorTrack(this.track,timeMs-this.playbackAt);
   if(frame)this.joints=frame.joints;
   if(!frame||frame.t>=frame.duration)this.playing=false;
   return;
  }
  for(const hand of ["left","right"]){
   const held=this.held[hand],p=poses[hand];
   if(!held||!poseMatrix(p))continue; // tracking loss: freeze joint, do not teleport
   const wanted=add(inversePoint(this.anchor,pos(p)),held.offset);
   const original=POSE_EDITOR_JOINTS[held.joint];
   // Keep anatomical limb targets within a reachable edit area; IK enforces segment length.
   const limit=held.joint==="head"?.25:.62;
   const delta=sub(wanted,original),radius=Math.hypot(...delta)||1;
   const clipped=radius>limit?add(original,delta.map(x=>x*limit/radius)):wanted;
   clipped[1]=clamp(clipped[1],held.joint==="head"?1.35:.045,2.0);
   this.joints[held.joint]=clipped.map(round);
  }
  if(this.recording){
   if(this.startedAt===null)this.startedAt=timeMs;
   const elapsed=timeMs-this.startedAt;
   if(elapsed>=25000||this.track.frames.length>=POSE_EDITOR_MAX_FRAMES){this.stop();return;}
   if(elapsed-this.lastSample>=POSE_EDITOR_INTERVAL_MS)this.keyframe(timeMs);
  }
 }
 keyframe(timeMs){
  if(!this.active||!Number.isFinite(timeMs))return false;
  if(!this.track||!this.recording)return false;
  const elapsed=Math.round(Math.max(0,timeMs-(this.startedAt??timeMs)));
  this.track.frames.push({t:elapsed,joints:copyJoints(this.joints)});
  this.lastSample=elapsed;return true;
 }
 start(timeMs){
  if(!this.active||!Number.isFinite(timeMs))return false;
  this.playing=false;this.recording=true;this.startedAt=timeMs;this.lastSample=-Infinity;
  this.track={schema:POSE_EDITOR_SCHEMA,target:this.target,units:"metres",kind:"two-grip-joint-ik",
   notes:"VR-local editor pose; explicit recording, no audio or feet tracking",frames:[]};
  this.keyframe(timeMs);this.status="REC "+this.target;return true;
 }
 stop(){
  if(!this.recording)return false;
  this.recording=false;this.held={left:null,right:null};
  this.status="保存可能: "+(this.track?.frames.length||0)+" frames";return true;
 }
 togglePlayback(timeMs){
  if(!this.active||!Number.isFinite(timeMs))return false;
  if(this.playing){this.playing=false;return true;}
  if(!validPoseEditorTrack(this.track)||this.recording)return false;
  this.playing=true;this.playbackAt=timeMs;this.held={left:null,right:null};return true;
 }
 clear(){this.track=null;this.recording=false;this.playing=false;this.startedAt=null;this.lastSample=-Infinity;}
 renderState(){return this.active&&this.anchor?{target:this.target,anchor:this.anchor,
  joints:copyJoints(this.joints),held:{left:this.held.left?.joint||null,right:this.held.right?.joint||null}}:null;}
 exportJSON(){return validPoseEditorTrack(this.track)?JSON.stringify(this.track,null,2):null;}
}
