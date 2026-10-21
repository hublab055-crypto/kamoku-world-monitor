/** In-world, planet-time continuous passenger ship service for the coastal city.
 * 20 min boarding at each wharf; 40 min sailing each way; 120 min round trip.
 */
import {WHARVES} from "./harbor-geometry.mjs";
export const FERRY_PERIOD_MINUTES=120;
export const FERRY_FARE=25;
const dock=id=>WHARVES.find(w=>w.id===id)||null;
const fail=message=>({ok:false,message});
const minute=timeDays=>timeDays*1440;
const phase=t=>((t%FERRY_PERIOD_MINUTES)+FERRY_PERIOD_MINUTES)%FERRY_PERIOD_MINUTES;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function ferryLocation(timeDays){
 const t=minute(timeDays),p=phase(t);
 let origin,destination,progress,mode,departureMinute,arrivalMinute;
 const cycle=t-p;
 if(p<20){origin=dock("central");destination=dock("cape");progress=0;mode="stopped";
  departureMinute=cycle+20;arrivalMinute=cycle;}
 else if(p<60){origin=dock("central");destination=dock("cape");progress=(p-20)/40;mode="travel";
  departureMinute=cycle+20;arrivalMinute=cycle+60;}
 else if(p<80){origin=dock("cape");destination=dock("central");progress=0;mode="stopped";
  departureMinute=cycle+80;arrivalMinute=cycle+60;}
 else{origin=dock("cape");destination=dock("central");progress=(p-80)/40;mode="travel";
  departureMinute=cycle+80;arrivalMinute=cycle+120;}
 const ease=progress*progress*(3-2*progress),dx=destination.x-origin.x,dz=destination.z-origin.z;
 return {mode,dockId:mode==="stopped"?origin.id:null,fromId:origin.id,toId:destination.id,
  x:origin.x+dx*ease,z:origin.z+dz*ease+Math.sin(progress*Math.PI)*36,
  yaw:Math.atan2(dx,dz),progress,departureMinute,arrivalMinute,timeMinute:t};
}
export function ferryDepartures(terminalId,timeDays,count=3){
 if(!dock(terminalId))return [];
 const offset=terminalId==="central"?20:80,now=minute(timeDays);
 const first=offset+FERRY_PERIOD_MINUTES*Math.ceil((now-offset)/FERRY_PERIOD_MINUTES);
 return Array.from({length:Math.min(8,Math.max(0,count))},(_,i)=>{
  const dep=first+i*FERRY_PERIOD_MINUTES,destination=dock(terminalId==="central"?"cape":"central");
  return {departureMinute:dep,arrivalMinute:dep+40,destinationId:destination.id,
   destinationName:destination.name,countdownMinutes:dep-now};
 });
}
export function ferryDockArrival(terminalId,timeDays){
 if(!dock(terminalId))return null;
 const offset=terminalId==="central"?0:60,now=minute(timeDays);
 const next=offset+FERRY_PERIOD_MINUTES*Math.ceil((now-offset)/FERRY_PERIOD_MINUTES);
 return next;
}
export class PassengerFerry{
 constructor(saved=null){
  this.ticket=null;this.terminalId=null;this.checkedIn=false;this.boarded=null;
  this.pose={x:0,z:0,yaw:0};
  if(saved?.version===1){
   this.ticket=saved.ticket&&dock(saved.ticket.originId)&&dock(saved.ticket.destinationId)&&
    saved.ticket.originId!==saved.ticket.destinationId?{...saved.ticket}:null;
   this.terminalId=dock(saved.terminalId)?.id||null;
   this.checkedIn=Boolean(saved.checkedIn&&this.ticket&&this.terminalId===this.ticket.originId);
   this.boarded=saved.boarded&&dock(saved.boarded.destinationId)&&dock(saved.boarded.originId)?{...saved.boarded}:null;
   if(saved.pose&&[saved.pose.x,saved.pose.z,saved.pose.yaw].every(Number.isFinite))
    this.pose={x:clamp(saved.pose.x,-3.8,3.8),z:clamp(saved.pose.z,-9,9),yaw:saved.pose.yaw};
  }
 }
 enterTerminal(id){
  if(!dock(id))return fail("桟橋が見つかりません");
  if(this.boarded)return fail("乗船中は港の切符売場に入れません");
  this.terminalId=id;this.checkedIn=false;
  return {ok:true,message:"⚓ "+dock(id).name+"の旅客ターミナルへ入りました。窓口で行先の切符を買えます"};
 }
 purchase(timeDays,charge=()=>({ok:true})){
  if(!dock(this.terminalId)||this.boarded)return fail("旅客ターミナルの窓口へお進みください");
  const payment=charge(FERRY_FARE);
  if(!payment.ok)return payment;
  this.ticket={id:this.terminalId+":"+Math.floor(minute(timeDays)*1000),
   originId:this.terminalId,destinationId:this.terminalId==="central"?"cape":"central",fare:FERRY_FARE};
  this.checkedIn=false;
  return {ok:true,message:"🎫 "+dock(this.ticket.destinationId).name+"行き客船の切符を"+FERRY_FARE+"Gで購入しました"};
 }
 passGate(){
  if(!this.ticket||this.terminalId!==this.ticket.originId)return fail("駅と同様に切符を購入してから改札へ進んでください");
  this.checkedIn=true;return {ok:true,message:"🎫 乗船券を確認しました。桟橋の待合所から客船に乗れます"};
 }
 board(timeDays){
  if(this.boarded)return fail("すでに乗船中です");
  if(!this.ticket||!this.checkedIn)return fail("窓口で切符を買い、改札を通過してください");
  const p=ferryLocation(timeDays);
  if(p.mode!=="stopped"||p.dockId!==this.ticket.originId)return fail("客船はまだ入港していません。待合室でお待ちください");
  this.boarded={originId:this.ticket.originId,destinationId:this.ticket.destinationId,
   boardedAt:minute(timeDays)};
  this.ticket=null;this.checkedIn=false;this.terminalId=null;this.pose={x:0,z:6,yaw:0};
  return {ok:true,message:"🚢 客船に乗りました。デッキと客室を歩き、乗客や船員と話せます"};
 }
 alight(timeDays){
  if(!this.boarded)return fail("客船に乗っていません");
  const p=ferryLocation(timeDays);
  if(p.mode!=="stopped"||p.dockId!==this.boarded.destinationId)return fail("到着するまで下船できません");
  const terminalId=p.dockId;this.boarded=null;this.pose={x:0,z:0,yaw:0};
  return {ok:true,terminalId,message:"⚓ "+dock(terminalId).name+"に到着しました。桟橋へ降りました"};
 }
 walk(dt,input={}){
  if(!this.boarded)return false;
  const speed=2.5*Math.max(0,Math.min(dt,.08)),fw=Number(input.forward)||0,
   side=Number(input.strafe)||0;
  const x=clamp(this.pose.x+side*speed,-3.6,3.6),
   z=clamp(this.pose.z+fw*speed,-9,9);
  this.pose={x,z,yaw:this.pose.yaw+(Number(input.turn)||0)*dt};
  return Math.hypot(side,fw)>.04;
 }
 talk(person="steward"){
  if(!this.boarded)return fail("客船に乗ってから話しかけてください");
  const dialogue=person==="steward"?"船員「次の寄港地まで、どうぞ甲板や客室でおくつろぎください。」":
   person==="passenger"?"旅客「この湾は灯台と街並みが美しいですね。」":
   "船長「潮と風を読みながら航路を守ります。」";
  return {ok:true,message:dialogue};
 }
 snapshot(){return {version:1,ticket:this.ticket?{...this.ticket}:null,terminalId:this.terminalId,
  checkedIn:this.checkedIn,boarded:this.boarded?{...this.boarded}:null,pose:{...this.pose}};}
}
