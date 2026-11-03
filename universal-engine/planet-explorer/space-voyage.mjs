import {bodyById} from "./solar-system.mjs";
import {ShipInterior} from "./ship-interior.mjs?v=6";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const valid=n=>Number.isFinite(n);
/** Ground -> airlock -> ascent -> origin orbit -> transfer -> destination orbit -> descent -> surface. */
export class SpaceVoyage{
 constructor(data){
  if(!bodyById(data?.originId)?.landable||
     (data.destinationId!=null&&(!bodyById(data.destinationId)?.landable||data.originId===data.destinationId))||
     !valid(data?.flightDays??1)|| (data.flightDays??1)<0)
   throw new Error("Invalid interplanetary route");
  this.originId=data.originId;this.destinationId=data.destinationId||null;
  this.flightDays=Math.max(0,data.flightDays??0);
  this.progress=clamp(data.progress||0,0,1);
  this.elapsedSeconds=Math.max(0,data.elapsedSeconds||0);
  this.throttle=clamp(data.throttle??.72,0,1);
  this.fuel=clamp(data.fuel??100,0,100);
  this.heading=clamp(data.heading??0,-60,60);
  // Visual attitude is separate from the legacy ±60° course-error value.
  // Missing fields in old saves default to a level ship facing forward.
  this.attitudeYawDeg=Number.isFinite(data.attitudeYawDeg)?
   ((data.attitudeYawDeg+180)%360+360)%360-180:0;
  this.pitchDeg=Number.isFinite(data.pitchDeg)?clamp(data.pitchDeg,-65,65):0;
  this.autopilot=data.autopilot!==false;
  // Normalized transfer coordinates: z=distance along route, x/y=cross-track.
  this.transferX=Number.isFinite(data.transferX)?data.transferX:0;
  this.transferY=Number.isFinite(data.transferY)?data.transferY:0;
  this.transferVX=Number.isFinite(data.transferVX)?data.transferVX:0;
  this.transferVY=Number.isFinite(data.transferVY)?data.transferVY:0;
  this.transferVZ=Number.isFinite(data.transferVZ)?data.transferVZ:.0067;
  const states=["preflight","ascent","parking-orbit","launch","cruise","approach","flyby","orbit","descent","landed"];
  this.status=states.includes(data.status)?data.status:"preflight";
  this.launchDay=valid(data.launchDay)?data.launchDay:0;
  this.ascentSeconds=clamp(data.ascentSeconds||0,0,10);
  this.descentSeconds=clamp(data.descentSeconds||0,0,10);
  this.interior=ShipInterior.fromSnapshot(data.interior);
 }
 get active(){return this.status!=="cancelled";}
 get readyToLand(){return this.status==="orbit"&&Math.abs(this.heading)<=12;}
 get readyForCourse(){return this.status==="parking-orbit";}
 get phase(){
  return ({
   preflight:"地表に停泊・離陸準備",ascent:"垂直離陸・大気圏上昇",
   "parking-orbit":"出発惑星の周回軌道・行き先選択",
   launch:"大気圏離脱",cruise:"惑星間巡航",
   approach:"目的天体へ接近",orbit:"目的天体の周回軌道",
   flyby:"目的天体を通過・航路修正待ち",
   descent:"大気圏突入・減速・着陸",landed:"地表に着陸・下船準備"
  })[this.status]||"航行中";
 }
 launch(){
  if(this.status!=="preflight")return {ok:false,message:"現在は離陸準備段階ではありません"};
  if(this.destinationId){this.status="launch";}
  else{this.status="ascent";this.ascentSeconds=0;}
  return {ok:true,message:"🚀 離陸！大気圏を上昇して周回軌道へ向かいます"};
 }
 setCourse(destinationId,flightDays){
  if(this.status!=="parking-orbit")return {ok:false,message:"出発惑星の周回軌道から航路を設定してください"};
  if(!bodyById(destinationId)?.landable||destinationId===this.originId||!valid(flightDays)||flightDays<=0)
   return {ok:false,message:"有効な目的天体と航行時間を選択してください"};
  this.destinationId=destinationId;this.flightDays=flightDays;this.progress=0;
  this.transferX=0;this.transferY=0;this.transferVX=0;this.transferVY=0;this.transferVZ=.0067;
  this.status="cruise";
  return {ok:true,message:"🧭 "+bodyById(destinationId).name+"への航路を設定しました。自動航行／手動操舵を選べます"};
 }
 beginDescent(){
  if(!this.readyToLand)return {ok:false,message:"目的天体の周回軌道で進路を±12°以内に整えてください"};
  this.status="descent";this.descentSeconds=0;
  return {ok:true,message:"🔥 大気圏突入。船体を減速し着陸シーケンスに移行します"};
 }
 steer(delta){
  if(!valid(delta))throw new TypeError("Invalid steering");
  this.heading=clamp(this.heading+delta,-60,60);
  this.attitudeYawDeg=((this.attitudeYawDeg+delta+180)%360+360)%360-180;
  return this.heading;
 }
 pitch(delta){
  if(!valid(delta))throw new TypeError("Invalid pitch");
  this.pitchDeg=clamp(this.pitchDeg+delta,-65,65);return this.pitchDeg;
 }
 setThrottle(value){if(!valid(value))throw new TypeError("Invalid throttle");this.throttle=clamp(value,0,1);}
 setAutopilot(on){this.autopilot=Boolean(on);}
 cancel(){
  if(this.status!=="preflight")return {ok:false,message:"離陸後は航行を中断できません"};
  this.status="cancelled";return {ok:true,message:"発進を取り消しました"};
 }
 tick(dt){
  if(!valid(dt)||dt<0)throw new RangeError("Invalid simulation step");
  const step=clamp(dt,0,.12);
  if(this.status==="preflight"||this.status==="parking-orbit"||this.status==="orbit"||this.status==="landed"||this.status==="cancelled")
   return {days:0,advanced:0,status:this.status};
  this.elapsedSeconds+=step;
  if(this.autopilot)this.heading*=Math.exp(-step*2);
  if(this.status==="ascent"){
   this.ascentSeconds+=step;
   const thrust=this.fuel>0?Math.max(.2,this.throttle):0;
   this.fuel=Math.max(0,this.fuel-step*thrust*.30);
   if(this.ascentSeconds>=8)this.status="parking-orbit";
   return {days:0,advanced:0,status:this.status,ascent:clamp(this.ascentSeconds/8,0,1)};
  }
  if(this.status==="descent"){
   this.descentSeconds+=step;
   if(this.descentSeconds>=9)this.status="landed";
   return {days:0,advanced:0,status:this.status,descent:clamp(this.descentSeconds/9,0,1)};
  }
  const thrust=this.fuel>0?this.throttle:0;
  this.fuel=Math.max(0,this.fuel-step*thrust*.62);
  const before=this.progress;
  // A compact inertial transfer model. Turning changes acceleration, not velocity.
  // The target is at (0,0,1); passing its z coordinate off-axis is a flyby.
  if(this.autopilot){
   const aimYaw=clamp(Math.atan2(-this.transferX,Math.max(.05,1-this.progress))*180/Math.PI,-60,60);
   const aimPitch=clamp(Math.atan2(-this.transferY,Math.max(.05,1-this.progress))*180/Math.PI,-45,45);
   this.attitudeYawDeg+=clamp(aimYaw-this.attitudeYawDeg,-24*step,24*step);
   this.pitchDeg+=clamp(aimPitch-this.pitchDeg,-24*step,24*step);
  }
  const yaw=this.attitudeYawDeg*Math.PI/180,pitch=this.pitchDeg*Math.PI/180;
  const acceleration=thrust*.00022;
  this.transferVX+=Math.sin(yaw)*Math.cos(pitch)*acceleration*step;
  this.transferVY+=Math.sin(pitch)*acceleration*step;
  this.transferVZ+=Math.cos(yaw)*Math.cos(pitch)*acceleration*step;
  this.transferX+=this.transferVX*step;
  this.transferY+=this.transferVY*step;
  this.progress=Math.max(0,this.progress+this.transferVZ*step);
  const remaining=Math.hypot(this.transferX,this.transferY,1-this.progress);
  const arrivalRadius=.045;
  if(remaining<=arrivalRadius&&this.progress>=.94)this.status="orbit";
  else if(this.progress>=1)this.status="flyby";
  else this.status=this.progress<.11?"launch":this.progress<.82?"cruise":"approach";
  const advanced=Math.max(0,this.progress-before);
  return {days:advanced*this.flightDays,advanced,status:this.status,
   crossTrack:Math.hypot(this.transferX,this.transferY),remaining};

 }
 snapshot(){
  return {schemaVersion:1,originId:this.originId,destinationId:this.destinationId,
   launchDay:this.launchDay,flightDays:this.flightDays,progress:this.progress,
   elapsedSeconds:this.elapsedSeconds,throttle:this.throttle,fuel:this.fuel,
   heading:this.heading,attitudeYawDeg:this.attitudeYawDeg,pitchDeg:this.pitchDeg,
   autopilot:this.autopilot,status:this.status,
   transferX:this.transferX,transferY:this.transferY,
   transferVX:this.transferVX,transferVY:this.transferVY,transferVZ:this.transferVZ,
   ascentSeconds:this.ascentSeconds,descentSeconds:this.descentSeconds,
   interior:this.interior.snapshot()};
 }
 static fromSnapshot(data){
  if(!data||data.schemaVersion!==1)return null;
  try{return new SpaceVoyage(data);}catch{return null;}
 }
}
