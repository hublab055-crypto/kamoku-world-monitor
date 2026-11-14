import {xrHeading,xrMul,xrRotateY,xrScale,xrTranslate} from "./xr-spatial.mjs?v=0.9r-vr-controls";
import {xrBodyAnchors} from "./xr-physical-controls.mjs?v=0.9z-pockets";

const poseKeys=["head","left","right"];
const validMatrix=m=>Array.isArray(m)&&m.length===16&&m.every(Number.isFinite)&&
 m.slice(0,12).every(x=>Math.abs(x)<=1.001)&&m.slice(12,15).every(x=>Math.abs(x)<=25)&&
 Math.abs(m[3])+Math.abs(m[7])+Math.abs(m[11])+Math.abs(m[15]-1)<.001;
const validColor=color=>typeof color==="string"&&/^#[\da-f]{6}$/i.test(color);

export function decodeSocialPose(data){
 if(typeof data!=="string"||data.length>2200)return null;
 try{
  const pose=JSON.parse(data);
  if(pose?.v!==1||!validMatrix(pose.head)||
   !["left","right"].every(side=>pose[side]===null||validMatrix(pose[side])))return null;
  const appearance=Object.fromEntries(["outer","legs","feet"]
   .filter(key=>validColor(pose.appearance?.[key])).map(key=>[key,pose.appearance[key]]));
  return {head:pose.head,left:pose.left,right:pose.right,appearance};
 }catch{return null;}
}

export function socialOrigin(head){
 // Reject a nearly vertical gaze, which has no stable horizontal heading.
 if(Math.hypot(head[8],head[10])<.35)return null;
 const yaw=xrHeading(head),x=head[12],z=head[14];
 return {toRoom:xrMul(xrRotateY(-yaw),xrTranslate(-x,0,-z)),
  toXR:xrMul(xrTranslate(x,0,z),xrRotateY(yaw))};
}

function transformPose(pose,transform){
 return {...pose,...Object.fromEntries(poseKeys.map(key=>[key,
  pose[key]?xrMul(transform,pose[key]):null]))};
}

export function sampleSocialPose(frame,space,head,sources,appearance){
 const pose={head:Array.from(head),left:null,right:null,appearance};
 for(const source of sources){
  const side=source.handedness;
  if(side!=="left"&&side!=="right")continue;
  const wrist=source.hand?.get("wrist");
  try{
   const tracked=wrist?frame.getJointPose?.(wrist,space):
    source.gripSpace?frame.getPose(source.gripSpace,space):null;
   if(tracked)pose[side]=Array.from(tracked.transform.matrix);
  }catch{ /* The input source can disappear during a tracking transition. */ }
 }
 return pose;
}

export function socialRig(pose,phase,stride){
 const anchors=xrBodyAnchors(pose.head,{floorY:0});
 // Feet follow the estimated stride. Head and hands always come from tracking.
 for(const [i,side] of ["left","right"].entries()){
  const step=Math.sin(phase+i*Math.PI)*stride;
  const lift=Math.max(0,step)*.40;
  for(const [joint,weight] of [["Foot",1],["Knee",.44]]){
   const p=anchors[side+joint];
   p[0]+=anchors.forward[0]*step*weight;
   p[1]+=lift*weight;
   p[2]+=anchors.forward[2]*step*weight;
  }
 }
 return {...pose,anchors,leftRay:pose.left,rightRay:pose.right,social:true};
}

function gatherIce(peer){
 if(peer.iceGatheringState==="complete")return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const finish=error=>{
   clearTimeout(timer);
   peer.removeEventListener("icegatheringstatechange",check);
   if(error)reject(error);else resolve();
  };
  const check=()=>{if(peer.iceGatheringState==="complete")finish();};
  const timer=setTimeout(()=>finish(Error("接続情報の作成が時間切れになりました")),8000);
  peer.addEventListener("icegatheringstatechange",check);
  check();
 });
}

export class SocialLink{
 constructor(onStatus,createPeer=()=>new RTCPeerConnection({iceServers:[]})){
  this.onStatus=onStatus;
  this.createPeer=createPeer;
 }
 get connected(){return this.channel?.readyState==="open";}
 disconnect(){
  const peer=this.peer;
  this.peer=null;this.remote=null;this.channel?.close();this.channel=null;peer?.close();
  this.onStatus("未接続");
 }
 openPeer(){
  this.disconnect();
  const peer=this.createPeer();
  this.peer=peer;
  peer.onconnectionstatechange=()=>{
   if(this.peer!==peer)return;
   const state=peer.connectionState;
   if(state==="failed"||state==="closed"){this.disconnect();this.onStatus("接続が終了しました");}
   else if(state==="disconnected"){this.remote=null;this.onStatus("再接続を待機中");}
   else if(state==="connected"&&this.connected)this.onStatus("接続済み");
   else if(state==="connecting")this.onStatus("接続中…");
  };
  return peer;
 }
 attach(peer,channel){
  if(this.peer!==peer||this.channel||channel.label!=="ue-mr-pose-v1"){channel.close();return;}
  this.channel=channel;
  channel.onopen=()=>{if(this.channel===channel)this.onStatus("接続済み");};
  channel.onclose=()=>{if(this.channel===channel)this.disconnect();};
  channel.onmessage=event=>{
   if(this.channel!==channel)return;
   const pose=decodeSocialPose(event.data);
   if(pose)this.remote={pose,time:performance.now()};
  };
 }
 async offer(){
  const peer=this.openPeer();
  this.attach(peer,peer.createDataChannel("ue-mr-pose-v1",{ordered:false,maxRetransmits:0}));
  return this.localCode(peer,await peer.createOffer());
 }
 async answer(code){
  const offer=this.readCode(code,"offer");
  const peer=this.openPeer();
  peer.ondatachannel=event=>this.attach(peer,event.channel);
  await peer.setRemoteDescription(offer);
  return this.localCode(peer,await peer.createAnswer());
 }
 async accept(code){
  const answer=this.readCode(code,"answer");
  if(this.peer?.signalingState!=="have-local-offer")throw Error("先に招待を作成してください");
  await this.peer.setRemoteDescription(answer);
 }
 readCode(code,type){
  if(code.length>24000)throw Error("接続情報が長すぎます");
  let value;
  try{value=JSON.parse(code);}catch{throw Error("接続情報をすべて貼り付けてください");}
  if(value?.type!==type||typeof value.sdp!=="string"||!value.sdp.startsWith("v=0"))
   throw Error(type==="offer"?"招待を貼り付けてください":"応答を貼り付けてください");
  return {type,sdp:value.sdp};
 }
 async localCode(peer,description){
  await peer.setLocalDescription(description);
  await gatherIce(peer);
  if(peer!==this.peer)throw Error("接続が取り消されました");
  const {type,sdp}=peer.localDescription;
  if(!sdp.includes("a=candidate:"))throw Error("ローカル接続情報を取得できませんでした");
  return JSON.stringify({type,sdp});
 }
 send(pose){
  if(this.connected&&this.channel.bufferedAmount<4096){
   try{this.channel.send(JSON.stringify({v:1,...pose}));}
   catch(error){if(error.name!=="InvalidStateError")throw error;}
  }
 }
}

export class SocialStage{
 constructor(link){this.link=link;this.reset();}
 reset(){
  this.origin=null;this.miniature=null;this.lastSend=-Infinity;
  this.previous=new Map();this.smoothed=null;this.remoteSample=null;
 }
 calibrate(head){
  const origin=socialOrigin(head);
  if(!origin)return false;
  this.origin=origin;this.miniature=null;this.previous.clear();
  this.smoothed=null;this.remoteSample=null;
  return true;
 }
 toggleView(head){
  if(this.miniature){this.miniature=null;return true;}
  const viewOrigin=head&&socialOrigin(head);
  if(!viewOrigin)return false;
  // Keep the miniature in the room after placing it in front of the viewer.
  const table=xrMul(xrTranslate(0,Math.max(.45,head[13]-.95),-1.65),xrScale(.40));
  this.miniature={stage:xrMul(viewOrigin.toXR,table)};
  return true;
 }
 rig(id,pose,time){
  const {head}=pose,prev=this.previous.get(id);
  const gap=prev?(time-prev.time)/1000:0;
  const travel=gap>0&&gap<.3?Math.hypot(head[12]-prev.x,head[14]-prev.z):0;
  const target=travel<.35&&gap>0?Math.min(.23,travel/gap*.18):0;
  const stride=(prev?.stride??0)*.80+target*.20;
  const phase=(prev?.phase??0)+Math.min(travel,.25)*11;
  this.previous.set(id,{x:head[12],z:head[14],time,stride,phase});
  return socialRig(pose,phase,stride);
 }
 update(pose,time,now=performance.now()){
  if(!this.origin)return null;
  const mine=pose&&transformPose(pose,this.origin.toRoom);
  if(mine&&time-this.lastSend>=1000/24){
   this.lastSend=time;
   if(validMatrix(mine.head))this.link.send(mine);
  }
  const remote=this.link.remote;
  const actors=[];
  if(this.miniature&&mine)actors.push(this.rig("self",mine,time));
  if(remote&&now-remote.time<650){
   if(this.remoteSample!==remote){
    this.remoteSample=remote;
    this.remoteRig=this.rig("peer",remote.pose,remote.time);
   }
   const target=this.remoteRig;
   const last=this.smoothed;
   const blend=last?1-Math.exp(-Math.max(0,Math.min(100,time-last.time))/45):1;
   const lerp=(a,b)=>a&&b?b.map((value,index)=>a[index]+(value-a[index])*blend):b;
   // Smooth positions independently of the tracked rotation, which remains rigid.
   const smoothMatrix=(a,b)=>b&&[...b.slice(0,12),...lerp(a?.slice(12,15),b.slice(12,15)),1];
   const head=smoothMatrix(last?.rig.head,target.head);
   const left=smoothMatrix(last?.rig.left,target.left);
   const right=smoothMatrix(last?.rig.right,target.right);
   const anchors=Object.fromEntries(Object.entries(target.anchors).map(([key,point])=>
    [key,lerp(last?.rig.anchors[key],point)]));
   const rig={...target,head,left,right,leftRay:left,rightRay:right,anchors};
   this.smoothed={rig,time};
   actors.push(rig);
  }else{
   this.smoothed=null;this.remoteSample=null;this.previous.delete("peer");
  }
  return {actors,stage:this.miniature?.stage??this.origin.toXR};
 }
}
