import {bodyById} from "./solar-system.mjs";
import {ShipInterior} from "./ship-interior.mjs?v=20261108-flight-service";
import {normalizeTurrets} from "./ship-turrets.mjs?v=20261108-vtol";
import {advanceRouteMotion,routeIntercept,remainingRouteFraction} from "./ship-route-motion.mjs?v=1";
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
  this.status=["docked","ascent","origin-orbit","cruise","approach","flyby","orbit","entry","atmosphere","vtol","touchdown","landed"].includes(data.status)?data.status:"docked";
  this.flightDays=finite(data.flightDays)&&data.flightDays>0?data.flightDays:1;
  this.launchDay=finite(data.launchDay)?data.launchDay:0;
  this.launchSite=data.launchSite&&finite(data.launchSite.lat)&&finite(data.launchSite.lon)?
   {bodyId:data.launchSite.bodyId||this.originId,lat:data.launchSite.lat,lon:data.launchSite.lon,yaw:finite(data.launchSite.yaw)?data.launchSite.yaw:0}:null;
  // Pre-selected safe touchdown site stays fixed through atmospheric entry.
  const pad=data.landingSite;
  this.landingSite=pad&&pad.bodyId===this.destinationId&&
   [pad.lat,pad.lon,pad.yaw,pad.padElevationM].every(finite)?
   {bodyId:pad.bodyId,lat:pad.lat,lon:pad.lon,yaw:pad.yaw,padElevationM:pad.padElevationM}:null;
  this.airAltitude=finite(data.airAltitude)?clamp(data.airAltitude,0,7000):700;
  this.airEast=finite(data.airEast)?data.airEast:0;this.airNorth=finite(data.airNorth)?data.airNorth:0;
  this.airSpeed=finite(data.airSpeed)?data.airSpeed:0;
  this.turrets=normalizeTurrets(data.turrets);
  this.autoFire=Boolean(data.autoFire);
  this.shipSystems=data.shipSystems||null;
  this.navigationTarget=data.navigationTarget?.position?.length===3?data.navigationTarget:null;
  this.routeVertical=finite(data.routeVertical)?data.routeVertical:0;
  this.verticalVelocity=finite(data.verticalVelocity)?data.verticalVelocity:0;
  this.progress=clamp(data.progress??0,0,1);
  // Route-frame position/velocity are persisted independently from thrust.
  // Older saves remain loadable; cruising ships retain a modest prior speed.
  this.routeAlong=finite(data.routeAlong)?data.routeAlong:this.progress;
  this.crossTrack=finite(data.crossTrack)?data.crossTrack:0;
  this.routeVelocity={along:finite(data.routeVelocity?.along)?data.routeVelocity.along:
   (["cruise","approach"].includes(this.status)?this.progress>0?.018:0:0),
   cross:finite(data.routeVelocity?.cross)?data.routeVelocity.cross:0};
  this.stageProgress=clamp(data.stageProgress??0,0,1);
  this.touchdownElapsed=finite(data.touchdownElapsed)?clamp(data.touchdownElapsed,0,1.7):0;
  this.elapsedSeconds=Math.max(0,finite(data.elapsedSeconds)?data.elapsedSeconds:0);
  this.heading=clamp(data.heading??0,-60,60);
  // Visual attitude is separate from the legacy ±60° course-error value.
  // Missing fields in old saves default to a level ship facing forward.
  this.attitudeYawDeg=Number.isFinite(data.attitudeYawDeg)?
   ((data.attitudeYawDeg+180)%360+360)%360-180:0;
  this.pitchDeg=Number.isFinite(data.pitchDeg)?((data.pitchDeg+180)%360+360)%360-180:0;
  this.fuel=clamp(data.fuel??100,0,100);
  this.throttle=clamp(data.throttle??.72,-1,1);
  this.autopilot=data.autopilot!==false;
  this.hatchOpen=data.hatchOpen??(this.status==="docked"||this.status==="landed");
  this.seated=Boolean(data.seated);
  this.interior=ShipInterior.fromSnapshot({...data.interior,
   schemaVersion:1,hatchPassable:this.hatchOpen&&["docked","landed"].includes(this.status)});
  this.interior.mode=this.seated?"cockpit":"interior";
  this.interior.seated=this.seated;
  if(this.seated)this.interior.z=-12.1;
  if(!["docked","landed"].includes(this.status))this.hatchOpen=false;
 }
 get active(){return true;}
 get canDirectEntry(){
  return this.seated&&!this.hatchOpen&&this.destinationId&&(!this.navigationTarget||this.navigationTarget.id==="planet")&&
   ["approach","flyby","origin-orbit","orbit"].includes(this.status)&&
   Math.hypot(1-this.routeAlong,this.crossTrack,this.routeVertical)<=.03;
 }
 get readyToLand(){return this.seated&&((this.status==="orbit"&&Math.abs(this.heading)<=12)||this.canDirectEntry);}
 get phase(){
  return {docked:"地表・停泊中",ascent:"離陸・大気圏上昇","origin-orbit":"出発惑星の周回軌道",
   cruise:"惑星間巡航",approach:"目的惑星へ接近",flyby:"目標軌道を通過・再接近中",orbit:"目的惑星の周回軌道",
   entry:"大気圏突入",atmosphere:"大気圏内航行",vtol:"VTOL垂直着陸",touchdown:"接地・エンジン停止",landed:"地表・着陸完了"}[this.status]||"航行中";
 }
 isNearHatch(){return this.interior.distance({x:0,z:12.0})<=2.9;}
 isNearSeat(){return this.interior.distance({x:0,z:-10})<=2.5;}
 isGrounded(){return ["docked","landed"].includes(this.status);}
 toggleHatch({remote=false}={}){
  // Landing and docking are the ONLY states in which the airlock can move.
  if(!this.isGrounded())return {ok:false,message:"飛行中は気密ハッチを操作できません。着陸してから操作してください"};
  if(remote){
   if(!this.seated)return {ok:false,message:"遠隔ハッチ操作は操縦席への着席が必要です"};
  }else{
   if(this.seated)return {ok:false,message:"立ち上がってハッチに近づいてください"};
   if(!this.isNearHatch())return {ok:false,message:"船尾のハッチまで歩いてください"};
  }
  if(this.hatchOpen&&this.interior.z>12.8)return {ok:false,message:"ランプ上にいるためハッチを閉じられません"};
  this.hatchOpen=!this.hatchOpen;
  this.interior.hatchPassable=this.hatchOpen&&this.isGrounded();
  return {ok:true,message:(remote?"🕹️ 操縦席から遠隔操作：":"")+
   (this.hatchOpen?"🚪 ハッチを開きランプを展開しました":"🔒 ハッチを閉じ気密を確認しました")};
 }
 toggleCockpitHatch(){return this.toggleHatch({remote:true});}
 sit(){
  if(this.seated)return {ok:false,message:"すでに着席しています"};
  if(!this.isNearSeat())return {ok:false,message:"操縦席まで歩いてください"};
  this.seated=true;this.interior.seated=true;this.interior.mode="cockpit";
  // Snap to the actual chair so both WebGL and Quest physical buttons sit
  // within arm's reach; an arbitrary nearby walking position is not a seat.
  this.interior.x=0;this.interior.z=-12.1;this.interior.yaw=0;this.interior.pitch=0;
  return {ok:true,message:"🪑 操縦席に着席しました。航行システムを操作できます"};
 }
 stand(){
  if(!this.seated)return {ok:false,message:"すでに立っています"};
  this.seated=false;this.interior.seated=false;this.interior.mode="interior";
  this.interior.x=0;this.interior.z=-10.5;
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
  this.routeAlong=0;this.crossTrack=0;this.routeVelocity={along:0,cross:0};
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
 beginVTOL(){
  if(this.status!=="atmosphere"||!this.seated)return {ok:false,message:"大気圏内で操縦席に着席してください"};
  this.status="vtol";this.airSpeed=0;
  return {ok:true,message:"🛬 垂直着陸開始。降下用スラスターで減速します"};
 }
 setLandingSite(site){
  if(!this.canDirectEntry&&!["orbit","entry","atmosphere","vtol","touchdown","landed"].includes(this.status))return false;
  if(!site||site.bodyId!==this.destinationId||
     ![site.lat,site.lon,site.yaw,site.padElevationM].every(finite))return false;
  this.landingSite={bodyId:site.bodyId,lat:site.lat,lon:site.lon,
   yaw:site.yaw,padElevationM:site.padElevationM};
  return true;
 }
 selectNavigationTarget(target){
  if(!target||!Array.isArray(target.position)||target.position.length!==3||!target.position.every(finite))return false;
  this.navigationTarget={id:target.id,name:target.name,position:[...target.position],kind:target.kind||"contact"};
  return true;
 }
 guideToTarget(step){
  const target=this.navigationTarget||{id:"planet",position:[0,0,12000]};
  const delta=[target.position[0]/12000-this.crossTrack,target.position[1]/12000-this.routeVertical,target.position[2]/12000-this.routeAlong];
  const distance=Math.hypot(...delta),stop=target.id==="planet"?0:80/12000;
  const speed=Math.min(.035,Math.max(0,distance-stop)*.35);
  const desired=delta.map(n=>n/(distance||1)*speed);
  const velocity=[this.routeVelocity.cross,this.verticalVelocity,this.routeVelocity.along];
  const change=desired.map((n,i)=>n-velocity[i]),magnitude=Math.hypot(...change);
  if(this.fuel>0){
   const factor=Math.min(1,.006*step/(magnitude||1));
   velocity.forEach((n,i)=>velocity[i]=n+change[i]*factor);
   const yaw=Math.atan2(delta[0],delta[2])*180/Math.PI;
   const pitch=Math.atan2(delta[1],Math.hypot(delta[0],delta[2]))*180/Math.PI;
   const turn=((yaw-this.attitudeYawDeg+540)%360)-180;
   this.attitudeYawDeg+=clamp(turn,-60*step,60*step);
   this.pitchDeg+=clamp(pitch-this.pitchDeg,-60*step,60*step);
   this.fuel=Math.max(0,this.fuel-step*.2);
  }
  const before=this.routeAlong;
  this.crossTrack+=velocity[0]*step;this.routeVertical+=velocity[1]*step;this.routeAlong+=velocity[2]*step;
  this.routeVelocity={cross:velocity[0],along:velocity[2]};this.verticalVelocity=velocity[1];
  this.progress=clamp(this.routeAlong,0,1);this.elapsedSeconds+=step;
  this.status=target.id==="planet"&&this.routeAlong>.82?"approach":"cruise";
  return {days:Math.abs(this.routeAlong-before)*this.flightDays,advanced:this.routeAlong-before,status:this.status};
 }
 setAutopilot(on){this.autopilot=Boolean(on);}
 setThrottle(n){if(!finite(n))throw Error("Invalid throttle");this.throttle=clamp(n,-1,1);}
 steer(n){
  if(!finite(n))throw Error("Invalid heading");
  this.heading=clamp(this.heading+n,-60,60);
  this.attitudeYawDeg=((this.attitudeYawDeg+n+180)%360+360)%360-180;
 }
 pitch(n){
  if(!finite(n))throw Error("Invalid pitch");
  this.pitchDeg=((this.pitchDeg+n+180)%360+360)%360-180;
  return this.pitchDeg;
 }
 tick(dt){
  if(!finite(dt)||dt<0)throw Error("Invalid clock");
  const step=clamp(dt,0,.12);
  if(this.status==="atmosphere"){
   const desired=this.fuel>0?Math.max(0,this.throttle)*180*(this.shipSystems?.parts?.engine??100)/100:0;
   this.airSpeed+=(desired-this.airSpeed)*Math.min(1,step*.6);
   const yaw=this.attitudeYawDeg*Math.PI/180,pitch=this.pitchDeg*Math.PI/180;
   this.airEast+=Math.sin(yaw)*Math.cos(pitch)*this.airSpeed*step;
   this.airNorth+=Math.cos(yaw)*Math.cos(pitch)*this.airSpeed*step;
   this.airAltitude=clamp(this.airAltitude+Math.sin(pitch)*this.airSpeed*step,2,7000);
   this.fuel=Math.max(0,this.fuel-step*(.03+Math.abs(this.throttle)*.12));
   this.elapsedSeconds+=step;
   return {days:0,advanced:0,status:this.status};
  }
  if(this.status==="vtol"){
   this.airAltitude=Math.max(0,this.airAltitude-step*Math.max(1.5,Math.min(65,this.airAltitude*.3)));
   this.elapsedSeconds+=step;
   if(this.airAltitude===0){this.status="touchdown";this.touchdownElapsed=0;}
   return {days:0,advanced:0,status:this.status};
  }
  if(this.status==="touchdown"){
   this.touchdownElapsed=clamp(this.touchdownElapsed+step,0,1.7);
   if(this.touchdownElapsed>=1.7)this.status="landed";
   return {days:0,advanced:0,status:this.status};
  }
  if(this.autopilot&&(["cruise","approach","flyby"].includes(this.status)&&this.destinationId||
     ["origin-orbit","orbit"].includes(this.status)&&this.navigationTarget))return this.guideToTarget(step);
  // Manual flight remains available for a dogfight while holding an orbit.
  if(!this.autopilot&&["origin-orbit","orbit"].includes(this.status)){
   const motion=advanceRouteMotion({position:{along:this.routeAlong,cross:this.crossTrack},
    velocity:this.routeVelocity,throttle:this.fuel>0?this.throttle*Math.cos(this.pitchDeg*Math.PI/180):0,
    yawDeg:this.attitudeYawDeg,autopilot:false,fuelAvailable:this.fuel>0},step);
   this.routeAlong=motion.position.along;this.crossTrack=motion.position.cross;this.routeVelocity=motion.velocity;
   this.verticalVelocity+=this.fuel>0?Math.sin(this.pitchDeg*Math.PI/180)*this.throttle*.006*step:0;
   this.routeVertical+=this.verticalVelocity*step;
   this.fuel=Math.max(0,this.fuel-Math.abs(this.throttle)*.28*step);
   this.elapsedSeconds+=step;
  }
  if(!["ascent","cruise","approach","flyby","entry"].includes(this.status))return {days:0,advanced:0,status:this.status};
  this.elapsedSeconds+=step;
  if(this.autopilot)this.heading*=Math.exp(-step*2);
  const thr=this.fuel>0?this.throttle:0;
  let days=0,advanced=0;
  if(this.status==="ascent"){
   this.fuel=Math.max(0,this.fuel-step*Math.abs(thr)*.28);
   // Atmospheric launch still uses the earlier simplified ascent sequence.
   this.stageProgress=clamp(this.stageProgress+step*(.07+Math.max(0,thr)*.10),0,1);
   if(this.stageProgress>=1){this.status="origin-orbit";this.stageProgress=0;}
  }else if(this.status==="entry"){
   this.fuel=Math.max(0,this.fuel-step*Math.abs(thr)*.28);
   this.stageProgress=clamp(this.stageProgress+step*(.055+Math.max(0,thr)*.12),0,1);
   if(this.stageProgress>=1){this.status="atmosphere";this.stageProgress=1;this.airAltitude=700;this.airEast=0;this.airNorth=0;this.airSpeed=0;}
  }else{
   const before=this.routeAlong;
   const motion=advanceRouteMotion({
    position:{along:this.routeAlong,cross:this.crossTrack},velocity:this.routeVelocity,
    throttle:thr*Math.cos(this.pitchDeg*Math.PI/180),yawDeg:this.attitudeYawDeg,autopilot:this.autopilot,fuelAvailable:this.fuel>0
   },step);
   this.routeAlong=motion.position.along;this.crossTrack=motion.position.cross;
   this.routeVelocity=motion.velocity;
   this.verticalVelocity+=this.autopilot?
    clamp(-this.routeVertical*.15-this.verticalVelocity*.5,-.006,.006)*step:
    Math.sin(this.pitchDeg*Math.PI/180)*thr*.006*step;
   this.routeVertical+=this.verticalVelocity*step;
   this.progress=clamp(this.routeAlong,0,1);
   // Crossing backwards never rewinds the solar clock.
   advanced=this.routeAlong-before;
   days=Math.abs(advanced)*this.flightDays;
   this.fuel=Math.max(0,this.fuel-step*(this.autopilot?motion.thrustMagnitude:Math.abs(thr))*.28);
   if(this.autopilot&&routeIntercept(motion.position,motion.velocity)&&Math.abs(this.routeVertical)<.012&&Math.abs(this.heading)<=12){
    this.status="orbit";this.stageProgress=0;this.routeVelocity={along:0,cross:0};
   }else if(this.routeAlong>1.03||Math.abs(this.crossTrack)>.22&&this.progress>.70){
    this.status="flyby"; // no forced capture at high velocity
   }else this.status=this.routeAlong<.82?"cruise":"approach";
  }
  return {days,advanced,status:this.status};
 }
 snapshot(){
  return {schemaVersion:2,kind:this.kind,originId:this.originId,destinationId:this.destinationId,
   status:this.status,flightDays:this.flightDays,launchDay:this.launchDay,launchSite:this.launchSite,landingSite:this.landingSite,progress:this.progress,
   stageProgress:this.stageProgress,touchdownElapsed:this.touchdownElapsed,elapsedSeconds:this.elapsedSeconds,heading:this.heading,
   attitudeYawDeg:this.attitudeYawDeg,pitchDeg:this.pitchDeg,
   fuel:this.fuel,throttle:this.throttle,autopilot:this.autopilot,hatchOpen:this.hatchOpen,
   navigationTarget:this.navigationTarget,shipSystems:this.shipSystems,airAltitude:this.airAltitude,airEast:this.airEast,airNorth:this.airNorth,airSpeed:this.airSpeed,
   turrets:normalizeTurrets(this.turrets),autoFire:this.autoFire,routeVertical:this.routeVertical,verticalVelocity:this.verticalVelocity,
   routeAlong:this.routeAlong,crossTrack:this.crossTrack,routeVelocity:{...this.routeVelocity},
   seated:this.seated,interior:this.interior.snapshot()};
 }
 static fromSnapshot(data){
  if(data?.kind!=="surface-to-surface"||data.schemaVersion!==2)return null;
  try{return new ShipJourney(data);}catch{return null;}
 }
}
