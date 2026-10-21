/** A shipboard-like walk grid for railway carriages; no world-coordinate teleport. */
export const RAIL_CAR_ORDER=Object.freeze(["freight","passenger","tender","locomotive"]);
export const RAIL_CAMERA_MODES=Object.freeze(["interior","follow","fixed","rts"]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function carPose(saved){
 const s=saved||{};
 return {x:clamp(Number(s.x)||0,-2.3,2.3),z:clamp(Number(s.z)||0,-4.9,4.9),
  yaw:Number.isFinite(s.yaw)?s.yaw:0,moving:false};
}
export function railwayPassengers(carriage,companions=[]){
 const passengers=carriage==="passenger"?[
  {id:"rider-merchant",name:"旅商人",x:-1.65,z:-4.1,kind:"passenger"},
  {id:"rider-scholar",name:"旅の学者",x:1.65,z:-1.4,kind:"passenger"},
  {id:"rider-farmer",name:"農夫",x:-1.65,z:1.4,kind:"passenger"},
  {id:"rider-guard",name:"旅の衛兵",x:1.65,z:4.2,kind:"passenger"}]:
  carriage==="locomotive"?[{id:"driver",name:"機関士",x:0,z:-2.8,kind:"crew"}]:
  carriage==="freight"?[{id:"conductor",name:"車掌",x:1.9,z:1.5,kind:"crew"}]:[];
 const allies=companions.slice(0,6).map((name,i)=>({
  id:"ally-"+i,name:String(name||"仲間"),x:i%2===0?-1.8:1.8,
  z:-3.7+Math.floor(i/2)*3.6,kind:"companion"
 }));
 return [...passengers,...allies];
}
export function railTalk(carriage,actorId,pose,companions=[],progress=0){
 const who=railwayPassengers(carriage,companions).find(x=>x.id===actorId);
 if(!who)return {ok:false,message:"相手が見つかりません"};
 if(Math.hypot(who.x-pose.x,who.z-pose.z)>3.8)
  return {ok:false,message:who.name+"の近くへ移動してください"};
 const phrase=who.kind==="companion"?"景色がきれいですね。一緒に旅ができてうれしいです。":
  actorId==="driver"?"機関車の圧力は良好です。次の駅まで慎重に走ります。":
  actorId==="conductor"?"切符を拝見します。次の駅ではホームへ停車します。":
  actorId==="rider-merchant"?"次の街の市場には珍しい品があるそうですよ。":
  actorId==="rider-scholar"?"この車窓から、惑星の山並みや地形がよくわかります。":
  actorId==="rider-farmer"?"故郷の草原では今年も豊作になりそうです。":
  "列車旅は気持ちがいいですね。";
 return {ok:true,message:"💬 "+who.name+"：「"+phrase+"」",speaker:who.id};
}
export function railWalk(pose,dt,input,carriage){
 const next=carPose(pose),a=clamp(dt||0,0,.12);
 if(a<=0)return {pose:next,transition:null};
 const f=clamp(Number(input?.forward)||0,-1,1),s=clamp(Number(input?.strafe)||0,-1,1);
 next.yaw+=clamp(Number(input?.turn)||0,-1,1)*a*1.7;
 const length=Math.max(1,Math.hypot(f,s));
 const dx=(Math.sin(next.yaw)*f+Math.cos(next.yaw)*s)*a*2.6/length;
 const dz=(Math.cos(next.yaw)*f-Math.sin(next.yaw)*s)*a*2.6/length;
 const limit=carriage==="passenger"?.77:carriage==="tender"?.68:1.65;
 const x=clamp(next.x+dx,-limit,limit),z=clamp(next.z+dz,-4.95,4.95);
 next.moving=Math.hypot(x-next.x,z-next.z)>.0001;
 next.x=x;next.z=z;
 return {pose:next,transition:null};
}
