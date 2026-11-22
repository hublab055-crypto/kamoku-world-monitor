/** Explicit opt-in WebXR three-point mocap. Memory-only; no uploads.
 * Quest 3/3S normally tracks HMD + controllers, NOT hips, knees or feet.
 * Coordinates are metres in local-floor (or local when unavailable).
 * Rotation is [x,y,z,w]; WebXR -Z is forward.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(n)?Number(n):0;
const round=(n,d=4)=>+finite(n).toFixed(d);
export const MOTION_ACTOR_SCHEMA="universal-engine.xr-motion-actor.v1";
export const MOTION_ACTOR_LIMIT=600;
export const MOTION_ACTOR_INTERVAL_MS=50;
function quatFromMatrix(m){
 if(!m||m.length<16)return [0,0,0,1];
 const m00=m[0],m11=m[5],m22=m[10],trace=m00+m11+m22;
 let x,y,z,w;
 if(trace>0){const s=Math.sqrt(trace+1)*2;w=s*.25;x=(m[6]-m[9])/s;y=(m[8]-m[2])/s;z=(m[1]-m[4])/s;}
 else if(m00>m11&&m00>m22){const s=Math.sqrt(1+m00-m11-m22)*2;w=(m[6]-m[9])/s;x=s*.25;y=(m[4]+m[1])/s;z=(m[8]+m[2])/s;}
 else if(m11>m22){const s=Math.sqrt(1+m11-m00-m22)*2;w=(m[8]-m[2])/s;x=(m[4]+m[1])/s;y=s*.25;z=(m[9]+m[6])/s;}
 else{const s=Math.sqrt(1+m22-m00-m11)*2;w=(m[1]-m[4])/s;x=(m[8]+m[2])/s;y=(m[9]+m[6])/s;z=s*.25;}
 const len=Math.hypot(x,y,z,w)||1;
 return [x/len,y/len,z/len,w/len].map(v=>round(v,5));
}
export function motionPoseFromMatrix(m){
 if(!m||m.length<16||![m[12],m[13],m[14]].every(Number.isFinite))return null;
 return {p:[m[12],m[13],m[14]].map(v=>round(v,4)),q:quatFromMatrix(m)};
}
const cleanControls=source=>source?.gamepad?{
 axes:[...(source.gamepad.axes||[])].slice(0,4).map(x=>round(x,3)),
 buttons:[...(source.gamepad.buttons||[])].slice(0,8).map(b=>round(b?.value??0,3))
}:null;
const safeTrack=track=>track?.schema===MOTION_ACTOR_SCHEMA&&Array.isArray(track.frames)
 &&track.frames.length>0&&track.frames.length<=MOTION_ACTOR_LIMIT
 &&track.frames.every(f=>Number.isFinite(f?.t)&&f.head?.p?.length===3);
export class XRMotionActorRecorder{
 constructor(){this.recording=false;this.track=null;this.startedAt=null;this.lastAt=-Infinity;}
 start({floorTracked=false,maxSeconds=25}={}){
  this.track={schema:MOTION_ACTOR_SCHEMA,kind:"three-point-controller-mocap",
   units:"metres",referenceSpace:floorTracked?"local-floor":"local",
   floorY:floorTracked?0:null,
   trackers:["head","left-controller","right-controller"],
   inferred:["pelvis","knees","feet"],
   device:"WebXR immersive-vr",maxSeconds:clamp(maxSeconds,1,30),frames:[]};
  this.recording=true;this.startedAt=null;this.lastAt=-Infinity;
  return this.track;
 }
 capture(timeMs,{head,left=null,right=null,leftSource=null,rightSource=null}={}){
  if(!this.recording||!Number.isFinite(timeMs))return false;
  if(this.startedAt===null)this.startedAt=timeMs;
  const elapsed=timeMs-this.startedAt;
  if(elapsed-this.lastAt<MOTION_ACTOR_INTERVAL_MS)return false;
  if(elapsed>this.track.maxSeconds*1000||this.track.frames.length>=MOTION_ACTOR_LIMIT){
   this.stop();return false;
  }
  const h=motionPoseFromMatrix(head);
  if(!h)return false;
  this.track.frames.push({
   t:Math.round(elapsed),
   head:h,
   left:motionPoseFromMatrix(left),right:motionPoseFromMatrix(right),
   controls:{left:cleanControls(leftSource),right:cleanControls(rightSource)}
  });
  this.lastAt=elapsed;
  return true;
 }
 stop(){this.recording=false;return this.track;}
 clear(){this.recording=false;this.track=null;this.startedAt=null;}
 exportJSON(){return this.track?JSON.stringify(this.track,null,2):"";}
 summary(){
  const data=this.track,frames=data?.frames||[];
  if(!data)return "記録なし";
  const first=frames[0],last=frames[frames.length-1];
  return `記録 ${frames.length}フレーム / ${last?+(last.t/1000).toFixed(2):0}秒 / ${data.referenceSpace}。頭・左右コントローラーを実測、下半身は推定のみ。`;
 }
}
let playback=null;
export function setXRMotionPlayback(track,nowMs=0){
 if(track===null){playback=null;return true;}
 if(!safeTrack(track))return false;
 const origin=track.frames[0].head?.p;
 if(!origin||!origin.every(Number.isFinite))return false;
 playback={track,start:nowMs};return true;
}
export function getXRMotionPlayback(){return playback?.track||null;}
const lerp=(a,b,t)=>a+(b-a)*t;
function interpPose(a,b,t){
 if(!a||!b)return a||b||null;
 const q=a.q.map((v,i)=>lerp(v,b.q[i],t));
 const n=Math.hypot(...q)||1;
 return {p:a.p.map((v,i)=>lerp(v,b.p[i],t)),q:q.map(v=>v/n)};
}
export function sampleXRMotionTrack(track,elapsedMs){
 if(!safeTrack(track))return null;
 const frames=track.frames,duration=frames.at(-1).t;
 const time=duration>0?((elapsedMs%duration)+duration)%duration:0;
 let lo=0,hi=frames.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(frames[mid].t<=time)lo=mid;else hi=mid;}
 const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)];
 const t=a===b?0:clamp((time-a.t)/(b.t-a.t||1),0,1);
 return {head:interpPose(a.head,b.head,t),left:interpPose(a.left,b.left,t),
  right:interpPose(a.right,b.right,t),first:frames[0].head,
  floorTracked:track.referenceSpace==="local-floor",time};
}
export function currentXRMotionActorPose(nowMs=0){
 return playback?sampleXRMotionTrack(playback.track,nowMs-playback.start):null;
}
export function getXRMotionTextSummary(track){
 if(!safeTrack(track))return "記録なし";
 const first=track.frames[0],last=track.frames.at(-1);
 const fmt=p=>p?"("+p.p.map(v=>v.toFixed(3)).join(", ")+")m":"未追跡";
 return ["XR Motion Actor v1", "基準座標="+track.referenceSpace,
  "床面="+(track.floorY===0?"Y=0m (local-floor)":"不明 (local)"),
  "時刻=相対ミリ秒, 右手系; 前方=-Z; 回転=[x,y,z,w]",
  "frames="+track.frames.length+", duration="+(last.t/1000).toFixed(2)+"s",
  "最初 HMD="+fmt(first.head)+" 左="+fmt(first.left)+" 右="+fmt(first.right),
  "最後 HMD="+fmt(last.head)+" 左="+fmt(last.left)+" 右="+fmt(last.right),
  "膝・足は実測していません。共有はコピーまたはファイル添付による手動操作のみ。"].join("\n");
}
