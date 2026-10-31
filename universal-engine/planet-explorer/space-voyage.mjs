import {bodyById} from "./solar-system.mjs";
import {ShipInterior} from "./ship-interior.mjs?v=3";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const valid=n=>Number.isFinite(n);
export class SpaceVoyage{
 constructor(data){
  if(!bodyById(data?.originId)?.landable||!bodyById(data?.destinationId)?.landable||
    data.originId===data.destinationId||!valid(data?.flightDays)||data.flightDays<=0)
   throw new Error("Invalid interplanetary route");
  this.originId=data.originId;
  this.destinationId=data.destinationId;
  this.flightDays=data.flightDays;
  this.progress=clamp(data.progress||0,0,1);
  this.elapsedSeconds=Math.max(0,data.elapsedSeconds||0);
  this.throttle=clamp(data.throttle??.72,0,1);
  this.fuel=clamp(data.fuel??100,0,100);
  this.heading=clamp(data.heading??0,-60,60);
  this.autopilot=data.autopilot!==false;
  this.status=["preflight","launch","cruise","approach","orbit"].includes(data.status)?data.status:"preflight";
  this.launchDay=valid(data.launchDay)?data.launchDay:0;
  this.interior=ShipInterior.fromSnapshot(data.interior);
 }
 get active(){return this.status!=="landed"&&this.status!=="cancelled";}
 get readyToLand(){return this.status==="orbit"&&Math.abs(this.heading)<=12;}
 get phase(){
  return this.status==="preflight"?"離陸準備":
   this.status==="launch"?"大気圏離脱":this.status==="cruise"?"惑星間巡航":
   this.status==="approach"?"目的天体へ接近":"周回軌道・着陸待機";
 }
 launch(){
  if(this.status!=="preflight")return {ok:false,message:"すでに航行中です"};
  this.status="launch";return {ok:true,message:"🚀 離陸開始。スロットルと進路を操作してください"};
 }
 steer(delta){
  if(!valid(delta))throw new TypeError("Invalid steering");
  this.heading=clamp(this.heading+delta,-60,60);return this.heading;
 }
 setThrottle(value){
  if(!valid(value))throw new TypeError("Invalid throttle");
  this.throttle=clamp(value,0,1);
 }
 setAutopilot(on){this.autopilot=Boolean(on);}
 cancel(){
  if(this.status!=="preflight")return {ok:false,message:"離陸後は航行を中断できません"};
  this.status="cancelled";return {ok:true,message:"発進を取り消しました"};
 }
 tick(dt){
  if(!valid(dt)||dt<0)throw new RangeError("Invalid simulation step");
  if(["preflight","orbit","cancelled","landed"].includes(this.status))return {days:0,advanced:0,status:this.status};
  const step=clamp(dt,0,.12);
  this.elapsedSeconds+=step;
  if(this.autopilot)this.heading*=Math.exp(-step*2);
  const efficiency=clamp(1-Math.abs(this.heading)/120,.5,1);
  const thrust=this.fuel>0?this.throttle:0;
  const consumption=step*thrust*.62;
  this.fuel=Math.max(0,this.fuel-consumption);
  const rate=(.24+thrust*1.16)*efficiency/36;
  const before=this.progress;
  this.progress=clamp(before+rate*step,0,1);
  this.status=this.progress>=1?"orbit":this.progress<.11?"launch":this.progress<.82?"cruise":"approach";
  const advanced=this.progress-before;
  return {days:advanced*this.flightDays,advanced,status:this.status};
 }
 snapshot(){
  return {schemaVersion:1,originId:this.originId,destinationId:this.destinationId,
   launchDay:this.launchDay,flightDays:this.flightDays,progress:this.progress,
   elapsedSeconds:this.elapsedSeconds,throttle:this.throttle,fuel:this.fuel,
   heading:this.heading,autopilot:this.autopilot,status:this.status,
   interior:this.interior.snapshot()};
 }
 static fromSnapshot(data){
  if(!data||data.schemaVersion!==1)return null;
  try{return new SpaceVoyage(data);}catch{return null;}
 }
}
