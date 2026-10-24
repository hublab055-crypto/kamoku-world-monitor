import {stationById} from "./railway.mjs?v=0.8z-crossing";

export const RAIL_CORRIDOR_HALF_WIDTH=2.65;
export const RAIL_CORRIDOR_HALF_LENGTH=380;
export const RAIL_CROSSING_HALF_LENGTH=4.8;
export const RAIL_WARNING_WINDOW_SECONDS=30;
export const RAIL_WARNING_INTERVAL_SECONDS=4;
export const RAIL_WARNING_LIMIT=3;
export const RAIL_BAIL_FINE=120;
export const RAIL_CHALLENGE_SECONDS=4.8;
export const RAIL_LOSE_PURSUIT_SECONDS=12;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

function localAt(station,x,z){
 const yaw=station.site.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
 const dx=x-station.site.x,dz=z-station.site.z;
 return {x:c*dx-s*dz,z:s*dx+c*dz,c,s};
}
function worldAt(station,local){
 const yaw=station.site.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:station.site.x+c*local.x+s*local.z,
  z:station.site.z-s*local.x+c*local.z};
}

/** The signed crossing strip is public roadway, so walking straight across it is legal. */
export function isRailwayCrossing(stationId,x,z,{margin=0}={}){
 const station=stationById(stationId);
 if(!station?.crossing||![x,z,margin].every(Number.isFinite))return false;
 const local=localAt(station,x,z),crossing=localAt(station,station.crossing.x,station.crossing.z);
 return Math.abs(local.x-crossing.x)<=RAIL_CORRIDOR_HALF_WIDTH+1.4+margin&&
  Math.abs(local.z-crossing.z)<=RAIL_CROSSING_HALF_LENGTH+margin;
}

/** True only between the two safety fences, excluding the public level crossing. */
export function isRailRestricted(stationId,x,z,{margin=0}={}){
 const station=stationById(stationId);
 if(!station||![x,z,margin].every(Number.isFinite))return false;
 const local=localAt(station,x,z);
 return Math.abs(local.x)<RAIL_CORRIDOR_HALF_WIDTH+margin&&
  Math.abs(local.z)<RAIL_CORRIDOR_HALF_LENGTH+margin&&!isRailwayCrossing(stationId,x,z,{margin});
}

/** Find a safe point outside the railway fence; host walks rather than teleporting. */
export function railwaySafeExit(stationId,x,z){
 const station=stationById(stationId);
 if(!station||![x,z].every(Number.isFinite))return null;
 const local=localAt(station,x,z);
 return worldAt(station,{x:(local.x<0?-1:1)*(RAIL_CORRIDOR_HALF_WIDTH+5),z:local.z});
}
/** Move ambient residents to the town side of the fence without moving the player. */
export function keepResidentOffRail(stationId,x,z,clearance=2.2){
 const station=stationById(stationId);
 if(!station||![x,z,clearance].every(Number.isFinite))return {x,z};
 const local=localAt(station,x,z);
 if(Math.abs(local.z)>=RAIL_CORRIDOR_HALF_LENGTH+4||
  Math.abs(local.x)>=RAIL_CORRIDOR_HALF_WIDTH+clearance)return {x,z};
 local.x=(local.x<0?-1:1)*(RAIL_CORRIDOR_HALF_WIDTH+clearance);
 return worldAt(station,local);
}

/** Warnings and pursuit use real elapsed seconds, independent of planet fast-forward. */
export class RailwaySecurity{
 constructor(snapshot=null){
  const saved=snapshot?.schemaVersion===1?snapshot:null;
  this.elapsed=Number.isFinite(saved?.elapsed)?Math.max(0,saved.elapsed):0;
  this.warningTimes=Array.isArray(saved?.warningAges)?saved.warningAges
   .filter(Number.isFinite).map(age=>this.elapsed-Math.max(0,age)).slice(-RAIL_WARNING_LIMIT):[];
  this.nextWarningAt=this.elapsed;
  this.wasRestricted=false;
  this.wanted=Boolean(saved?.wanted);
  this.guard=saved?.guard&&[saved.guard.x,saved.guard.z].every(Number.isFinite)?
   {...saved.guard,hp:clamp(Number(saved.guard.hp)||100,0,100)}:null;
  // Legacy saves could be detained without dialogue. Release these automatically.
  this.jailed=saved?.interactionVersion===2&&saved?.jailed&&stationById(saved.jailed.stationId)?
   {stationId:saved.jailed.stationId,fine:Math.max(RAIL_BAIL_FINE,Number(saved.jailed.fine)||RAIL_BAIL_FINE)}:null;
   this.challenged=Boolean(saved?.challenged);
   this.challengeRemaining=clamp(Number(saved?.challengeRemaining)||0,0,RAIL_CHALLENGE_SECONDS);
   this.fleeing=Boolean(saved?.fleeing);this.resisting=Boolean(saved?.resisting);
   this.lostSeconds=Math.max(0,Number(saved?.lostSeconds)||0);
   this.attackSeconds=Math.max(0,Number(saved?.attackSeconds)||0);
  this.caseReported=Boolean(saved?.caseReported);
  this.warningAcknowledged=Boolean(saved?.warningAcknowledged);
  this.sentry=saved?.sentry&&[saved.sentry.x,saved.sentry.z].every(Number.isFinite)?{...saved.sentry}:null;
  this.sentryUntil=Math.max(0,Number(saved?.sentryUntil)||0);
  if(saved?.jailed&&saved?.interactionVersion!==2){this.wanted=false;this.guard=null;this.warningTimes=[];}
 }
 get warningCount(){return this.warningTimes.length;}
 get state(){return this.jailed?"jailed":this.wanted?(this.challenged&&!this.fleeing&&!this.resisting?"challenged":"wanted"):
   this.warningCount?"warned":"clear";}
  _clear(){
   this.jailed=null;this.wanted=false;this.guard=null;this.warningTimes=[];
   this.wasRestricted=false;this.nextWarningAt=this.elapsed;
   this.challenged=false;this.challengeRemaining=0;this.fleeing=false;this.resisting=false;
   this.lostSeconds=0;this.attackSeconds=0;this.caseReported=false;this.warningAcknowledged=false;
  }
  _detain(stationId){
   const fine=RAIL_BAIL_FINE+(this.resisting?60:0);
   // Retain the actual arresting guard during the stun scene; jail rendering has its own guard.
  this.jailed={stationId,fine};this.wanted=false;
   this.challenged=false;this.challengeRemaining=0;this.wasRestricted=false;
   this.fleeing=false;this.resisting=false;
   return {type:"jailed",stationId,fine,
    message:"保安員に確保され駅留置所へ勾留されました。罰金か服役を選べます。"};
  }
 advance(dt,{stationId,x,z,eligible=true,stamina=100}={}){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError("Invalid security time delta");
  this.elapsed+=Math.min(dt,.25);
  this.warningTimes=this.warningTimes.filter(t=>this.elapsed-t<=RAIL_WARNING_WINDOW_SECONDS);
  const events=[];
  if(this.jailed)return events;
  const station=stationById(stationId);
  const restricted=Boolean(eligible&&station&&isRailRestricted(stationId,x,z));
  if(station&&restricted&&(!this.sentry||this.sentry.stationId!==stationId||
   this.state==="clear")){
   const side=x<station.site.x?-1:1;
   // Officer stands outside the fence, near enough to speak visibly.
   this.sentry={stationId,x:x+side*(RAIL_CORRIDOR_HALF_WIDTH+2),z};
  }
  if(this.wanted&&station&&this.guard&&eligible){
   if(this.guard.stationId!==stationId)this.lostSeconds+=Math.min(dt,.25);
   let dx=x-this.guard.x,dz=z-this.guard.z,distance=Math.hypot(dx,dz);
   if(distance>85)this.lostSeconds+=Math.min(dt,.25);
   else if(this.guard.stationId===stationId)this.lostSeconds=Math.max(0,this.lostSeconds-Math.min(dt,.25));
   if(this.lostSeconds>=RAIL_LOSE_PURSUIT_SECONDS){
    this._clear();events.push({type:"evaded",stationId,message:"保安員の追跡を振り切りました。地域の手配記録は残ります。"});return events;
   }
   if(this.guard.stationId!==stationId)return events; // No cross-town teleport
   const stop=this.fleeing?.9:this.resisting?1.8:3;
   const speed=this.fleeing||this.resisting?6.5:5.4;
   const step=Math.min(Math.max(0,distance-stop),speed*Math.min(dt,.25));
   if(distance>.00001&&step>0){
    this.guard.x+=dx/distance*step;this.guard.z+=dz/distance*step;
    dx=x-this.guard.x;dz=z-this.guard.z;distance=Math.hypot(dx,dz);
   }
   if(distance<=4.3&&!this.challenged&&!this.fleeing&&!this.resisting){
    this.challenged=true;this.challengeRemaining=RAIL_CHALLENGE_SECONDS;
    events.push({type:"challenge",stationId,speakerId:"railway-security:"+stationId,
     speech:"あなたには逮捕状が出ている。武器をしまい、投降しなさい。",
     message:"🛡️ 保安員「あなたには逮捕状が出ている。武器をしまい、投降しなさい。」"});return events;
   }
   if(this.fleeing&&distance<=1.55){events.push(this._detain(stationId));return events;}
   if(this.resisting&&distance<=3.4){
    this.attackSeconds+=Math.min(dt,.25);
    if(this.attackSeconds>=1.35){
     this.attackSeconds=0;events.push({type:"securityHit",stationId,staminaDamage:16,hpDamage:4,
      message:"🛡️ 保安員から制圧攻撃を受けた"});
    }
    if(stamina<=0)events.push(this._detain(stationId));
    return events;
   }
   if(this.challenged&&!this.fleeing&&!this.resisting){
    // An unanswered dialog is never automatic consent to arrest.
    this.challengeRemaining=RAIL_CHALLENGE_SECONDS;
   }
   return events;
  }
  if(restricted&&(!this.wasRestricted||this.elapsed>=this.nextWarningAt)){
   this.warningTimes.push(this.elapsed);
   this.warningTimes=this.warningTimes.slice(-RAIL_WARNING_LIMIT);
   this.nextWarningAt=this.elapsed+RAIL_WARNING_INTERVAL_SECONDS;
   if(this.warningCount>=RAIL_WARNING_LIMIT){
    this.wanted=true;this.challenged=false;this.fleeing=false;this.resisting=false;this.caseReported=true;
    this.guard={stationId,x:this.sentry?.x??station.site.x+10,
      z:this.sentry?.z??station.site.z-7,hp:100};
    events.push({type:"pursuit",stationId,count:this.warningCount,
     message:"3回の警告を無視したため保安員が追跡します。接近すると投降を求められます。"});
   }else events.push({type:"warning",stationId,count:this.warningCount,
    speakerId:"railway-security:"+stationId,speech:"線路内は立入禁止だ。柵の外へ出なさい。",
    message:"保安員：線路内は立入禁止です。柵の外へ出てください（警告 "+this.warningCount+"/"+RAIL_WARNING_LIMIT+"）。"});
  }
  if(!restricted){
   if(this.warningCount&&!this.wanted){
    this.warningTimes=[];this.wasRestricted=false;this.warningAcknowledged=true;
    this.sentryUntil=this.elapsed+5;
    events.push({type:"complied",stationId,speakerId:"railway-security:"+stationId,
     speech:"それでいい。",message:"保安員「それでいい。」監視が解除されました。"});
   }
   this.nextWarningAt=this.elapsed;
   if(!this.warningCount)this.wasRestricted=false;
  }
  this.wasRestricted=restricted;
  return events;
 }
 /** Response to an actual railway guard. No instant teleport or auto-capture on sight. */
 respond(choice){
  if(this.jailed)return {ok:false,message:"勾留中は保釈または服役を選んでください"};
  if(choice==="comply"){
   if(this.wanted)return {ok:false,message:"既に手配されています。投降するか逃走してください"};
   return {ok:true,action:"exit",message:"柵の外の安全な位置へ移動します"};
  }
  if(!this.wanted||!this.guard)return {ok:false,message:"追跡中の保安員はいません"};
  if(choice==="surrender"){return {ok:true,...this._detain(this.guard.stationId)};}
  if(choice==="flee"){
   this.challenged=true;this.fleeing=true;this.resisting=false;
   this.challengeRemaining=0;
   return {ok:true,action:"flee",message:"🏃 保安員から逃走。距離を取れば追跡を振り切れます"};
  }
  if(choice==="resist"){
   this.challenged=true;this.resisting=true;this.fleeing=false;this.challengeRemaining=0;
   return {ok:true,action:"resist",message:"⚔️ 保安員が制圧行動へ移りました"};
  }
  return {ok:false,message:"操作できません"};
 }
 /** A weapon hit on the real 3D station guard (never a button-only instant defeat).
  * The caller records the assault in the territory law system separately. */
 damageGuard(damage,{attackerX=null,attackerZ=null}={}){
  const guard=this.guard;
  if(!this.wanted||!guard||!Number.isFinite(damage)||damage<=0)
   return {ok:false,message:"攻撃できる保安員がいません"};
  if(Number.isFinite(attackerX)&&Number.isFinite(attackerZ)&&
    Math.hypot(guard.x-attackerX,guard.z-attackerZ)>4.7)
   return {ok:false,message:"保安員から離れすぎています"};
  guard.hp=Math.max(0,guard.hp-damage);
  this.resisting=true;this.challenged=true;this.challengeRemaining=0;
  const defeated=guard.hp===0,id="railway-security:"+guard.stationId;
  const result={ok:true,id,damage,hp:guard.hp,defeated,
   message:"鉄道保安員に "+damage+" ダメージ"+(defeated?"（戦闘不能）":"")};
  if(defeated)this._clear(); // The regional town warrant persists and takes over pursuit.
  return result;
 }
 /** Bail is optional; serve time if the player cannot or does not want to pay. */
 serveSentence(){
  if(!this.jailed)return {ok:false,message:"勾留中ではありません"};
  const stationId=this.jailed.stationId,days=clamp(Math.ceil(this.jailed.fine/60),1,14),settleReport=this.caseReported;
  this._clear();
  return {ok:true,stationId,days,settleReport,message:days+"日間の服役を終えて釈放されました"};
 }
 payFine(pay){
  if(!this.jailed)return {ok:false,message:"勾留されていません"};
  const amount=this.jailed.fine;
  const result=typeof pay==="function"?pay(amount):{ok:false};
  if(result===false||result?.ok===false)return {ok:false,message:result?.message||"罰金を支払えません"};
  const stationId=this.jailed.stationId,settleReport=this.caseReported;
  this._clear();
  return {ok:true,stationId,settleReport,message:"罰金 "+amount+"G を支払い、保釈されました。"};
 }
 snapshot(){
  return {schemaVersion:1,elapsed:this.elapsed,
   warningAges:this.warningTimes.map(t=>Math.max(0,this.elapsed-t)),wanted:this.wanted,
   guard:this.guard?{...this.guard}:null,jailed:this.jailed?{...this.jailed}:null,
   challenged:this.challenged,challengeRemaining:this.challengeRemaining,
   fleeing:this.fleeing,resisting:this.resisting,lostSeconds:this.lostSeconds,attackSeconds:this.attackSeconds,caseReported:this.caseReported,
   warningAcknowledged:this.warningAcknowledged,sentry:this.sentry?{...this.sentry}:null,
   sentryUntil:this.sentryUntil,interactionVersion:2};
 }
}
