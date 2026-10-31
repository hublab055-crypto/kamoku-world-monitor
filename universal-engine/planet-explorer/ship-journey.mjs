import {bodyById} from "./solar-system.mjs";
import {ShipInterior} from "./ship-interior.mjs?v=6";
import {shipJourneyFrame} from "./unified-space-frame.mjs?v=1";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(n);

/** Shared 3D cabin and flight state. Landed => player stays inside until hatch egress. */
export class ShipJourney{
 constructor(data={}){
  if(!bodyById(data.originId)?.landable)throw Error("出発惑星を確認できません");
  this.schemaVersion=2;
  this.kind="surface-to-surface";
  this.originId=data.originId;
  this.destinationId=bodyById(data.destinationId)?.landable?data.destinationId:null;
  this.status=["docked","ascent","origin-orbit","cruise","approach","orbit","entry","touchdown","landed"].includes(data.status)?data.status:"docked";
  this.flightDays=finite(data.flightDays)&&data.flightDays>0?data.flightDays:1;
  this.launchDay=finite(data.launchDay)?data.launchDay:0;
  this.launchSite=data.launchSite&&finite(data.launchSite.lat)&&finite(data.launchSite.lon)?
   {bodyId:data.launchSite.bodyId||this.originId,lat:data.launchSite.lat,lon:data.launchSite.lon,yaw:finite(data.launchSite.yaw)?data.launchSite.yaw:0}:null;
  // Pre-selected safe touchdown site stays fixed through atmospheric entry.
  const pad=data.landingSite;
  this.landingSite=pad&&pad.bodyId===this.destinationId&&
   [pad.lat,pad.lon,pad.yaw,pad.padElevationM].every(finite)?
   {bodyId:pad.bodyId,lat:pad.lat,lon:pad.lon,yaw:pad.yaw,padElevationM:pad.padElevationM}:null;
  this.progress=clamp(data.progress??0,0,1);
  this.stageProgress=clamp(data.stageProgress??0,0,1);
  this.touchdownElapsed=finite(data.touchdownElapsed)?clamp(data.touchdownElapsed,0,1.7):0;
  this.elapsedSeconds=Math.max(0,finite(data.elapsedSeconds)?data.elapsedSeconds:0);
  this.heading=clamp(data.heading??0,-60,60);
  this.fuel=clamp(data.fuel??100,0,100);
  this.throttle=clamp(data.throttle??.72,0,1);
  this.autopilot=data.autopilot!==false;
  this.hatchOpen=data.hatchOpen??(this.status==="docked"||this.status==="landed");
  this.seated=Boolean(data.seated);
  this.interior=ShipInterior.fromSnapshot({...data.interior,
   schemaVersion:1,hatchPassable:this.hatchOpen&&["docked","landed"].includes(this.status)});
  this.interior.mode=this.seated?"cockpit":"interior";
  this.interior.seated=this.seated;
  if(!["docked","landed"].includes(this.status))this.hatchOpen=false;
 }
 /** Authoritative SI-metre star / body / ship transform at the current simulation day. */
 framePose(days){return shipJourneyFrame(this,days);}
 get active(){return true;}
 get readyToLand(){return this.status==="orbit"&&this.seated&&Math.abs(this.heading)<=12;}
 get phase(){
  return {docked:"地表・停泊中",ascent:"離陸・大気圏上昇","origin-orbit":"出発惑星の周回軌道",
   cruise:"惑星間巡航",approach:"目的惑星へ接近",orbit:"目的惑星の周回軌道",
   entry:"大気圏突入・着陸降下",touchdown:"接地・エンジン停止",landed:"地表・着陸完了"}[this.status]||"航行中";
 }
 isNearHatch(){return this.interior.distance({x:0,z:12.0})<=2.9;}
 isNearSeat(){return this.interior.distance({x:0,z:-10})<=2.5;}
 isGrounded(){return ["docked","landed"].includes(this.status);}
 toggleHatch(){
  if(!this.isGrounded())return {ok:false,message:"飛行中はハッチを操作できません"};
  if(this.seated)return {ok:false,message:"立ち上がってハッチに近づいてください"};
  if(!this.isNearHatch())return {ok:false,message:"船尾のハッチまで歩いてください"};
  if(this.hatchOpen&&this.interior.z>12.8)return {ok:false,message:"ランプから船内に戻ってからハッチを閉めてください"};
  this.hatchOpen=!this.hatchOpen;
  this.interior.hatchPassable=this.hatchOpen&&this.isGrounded();
  return {ok:true,message:this.hatchOpen?"🚪 ハッチを開けました。外へ出られます":"🔒 ハッチを閉じました。気密を確認しました"};
 }
 sit(){
  if(this.seated)return {ok:false,message:"すでに着席しています"};
  if(!this.isNearSeat())return {ok:false,message:"操縦席まで歩いてください"};
  this.seated=true;this.interior.seated=true;this.interior.mode="cockpit";
  return {ok:true,message:"🪑 操縦席に着席しました。航行システムを操作できます"};
 }
 stand(){
  if(!this.seated)return {ok:false,message:"すでに立っています"};
  this.seated=false;this.interior.seated=false;this.interior.mode="interior";
  this.interior.x=0;this.interior.z=-8.8;
  return {ok:true,message:"🚶 操縦席から立ち上がりました"};
 }
 canDisembark(){return this.isGrounded()&&!this.seated&&this.hatchOpen&&
  (this.isNearHatch()||this.interior.z>=17.8);}
 launch(){
  if(this.status!=="docked")return {ok:false,message:"現在は地表から離陸できません"};
  if(this.hatchOpen)return {ok:false,message:"ハッチを閉めてから離陸してください"};
  if(!this.seated)return {ok:false,message:"操縦席に着席してください"};
  if(this.fuel<3)return {ok:false,message:"燃料が不足しています"};
  this.stageProgress=0;this.status="ascent";this.interior.hatchPassable=false;
  return {ok:true,message:"🚀 エンジン始動。地表を離れ、大気圏上昇を開始しました"};
 }
 chooseDestination(id,flightDays){
  if(this.status!=="origin-orbit")return {ok:false,message:"目的地は出発惑星の軌道上で設定してください"};
  if(!this.seated)return {ok:false,message:"航法設定には操縦席に着席してください"};
  if(!bodyById(id)?.landable||id===this.originId||!finite(flightDays)||flightDays<=0)
   return {ok:false,message:"航行先を指定できません"};
  this.destinationId=id;this.flightDays=flightDays;this.progress=0;
  return {ok:true,message:"🧭 航路設定完了："+bodyById(id).name+"／推定"+flightDays.toFixed(1)+"ゲーム日"};
 }
 startTransfer(){
  if(this.status!=="origin-orbit")return {ok:false,message:"出発惑星の軌道から開始してください"};
  if(!this.destinationId)return {ok:false,message:"先に目的惑星を選択してください"};
  if(!this.seated)return {ok:false,message:"操縦席に着席してください"};
  if(this.fuel<2)return {ok:false,message:"燃料が不足しています"};
  this.status="cruise";
  return {ok:true,message:"🛰️ "+bodyById(this.destinationId).name+"への惑星間巡航を開始"};
 }
 enterAtmosphere(){
  if(!this.readyToLand)return {ok:false,message:"目標の周回軌道上で着席し、進路偏差を±12°以内にしてください"};
  if(this.hatchOpen)return {ok:false,message:"ハッチを閉じてください"};
  this.status="entry";this.stageProgress=0;this.interior.hatchPassable=false;
  return {ok:true,message:"🔥 大気圏突入開始。着陸姿勢を保持してください"};
 }
 setLandingSite(site){
  if(!["orbit","entry","touchdown","landed"].includes(this.status))return false;
  if(!site||site.bodyId!==this.destinationId||
     ![site.lat,site.lon,site.yaw,site.padElevationM].every(finite))return false;
  this.landingSite={bodyId:site.bodyId,lat:site.lat,lon:site.lon,
   yaw:site.yaw,padElevationM:site.padElevationM};
  return true;
 }
 setAutopilot(on){this.autopilot=Boolean(on);}
 setThrottle(n){if(!finite(n))throw Error("Invalid throttle");this.throttle=clamp(n,0,1);}
 steer(n){if(!finite(n))throw Error("Invalid heading");this.heading=clamp(this.heading+n,-60,60);}
 tick(dt){
  if(!finite(dt)||dt<0)throw Error("Invalid clock");
  const step=clamp(dt,0,.12);
  if(this.status==="touchdown"){
   this.touchdownElapsed=clamp(this.touchdownElapsed+step,0,1.7);
   if(this.touchdownElapsed>=1.7)this.status="landed";
   return {days:0,advanced:0,status:this.status};
  }
  if(!["ascent","cruise","approach","entry"].includes(this.status))return {days:0,advanced:0,status:this.status};
  this.elapsedSeconds+=step;
  if(this.autopilot)this.heading*=Math.exp(-step*2);
  const thr=this.fuel>0?this.throttle:0;
  this.fuel=Math.max(0,this.fuel-step*thr*.28);
  const align=clamp(1-Math.abs(this.heading)/110,.5,1);
  const rate=(.30+thr*1.2)*align;
  let days=0,advanced=0;
  if(this.status==="ascent"){
   this.stageProgress=clamp(this.stageProgress+step*(.07+thr*.10),0,1);
   if(this.stageProgress>=1){this.status="origin-orbit";this.stageProgress=0;}
  }else if(this.status==="entry"){
   this.stageProgress=clamp(this.stageProgress+step*(.055+thr*.12),0,1);
   if(this.stageProgress>=1){this.status="touchdown";this.stageProgress=1;this.touchdownElapsed=0;}
  }else{
   const before=this.progress;
   this.progress=clamp(this.progress+step*rate/38,0,1);
   advanced=this.progress-before;days=advanced*this.flightDays;
   if(this.progress>=1){this.status="orbit";this.stageProgress=0;}
   else this.status=this.progress<.82?"cruise":"approach";
  }
  return {days,advanced,status:this.status};
 }
 snapshot(){
  return {schemaVersion:2,kind:this.kind,originId:this.originId,destinationId:this.destinationId,
   status:this.status,flightDays:this.flightDays,launchDay:this.launchDay,launchSite:this.launchSite,landingSite:this.landingSite,progress:this.progress,
   stageProgress:this.stageProgress,touchdownElapsed:this.touchdownElapsed,elapsedSeconds:this.elapsedSeconds,heading:this.heading,
   fuel:this.fuel,throttle:this.throttle,autopilot:this.autopilot,hatchOpen:this.hatchOpen,
   seated:this.seated,interior:this.interior.snapshot()};
 }
 static fromSnapshot(data){
  if(data?.kind!=="surface-to-surface"||data.schemaVersion!==2)return null;
  try{return new ShipJourney(data);}catch{return null;}
 }
}
