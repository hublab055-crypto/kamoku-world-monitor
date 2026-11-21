/**
 * Universal Engine wrist watch clock / single-player time gates.
 * World speed applies to non-player simulation only. XR pose, local player
 * movement, watch and menus must always use the unscaled frame delta.
 * Multiplayer MUST additionally reject time commands on the server.
 */
export const WATCH_STYLES=Object.freeze(["mechanical","smart"]);
export const WATCH_HANDS=Object.freeze(["left","right"]);
export const CREATIVE_SPEEDS=Object.freeze([0,.25,.5,1,2,5]);
const SPEEDS=new Set(CREATIVE_SPEEDS);
const pad=n=>String(Math.floor(n)).padStart(2,"0");
const mod=(n,m)=>(n%m+m)%m;
const hands=(hour,minute,second=0)=>({
 hour:((hour%12)+minute/60+second/3600)*30,
 minute:(minute+second/60)*6,
 second:second*6
});
export function watchClockDisplay({timeDays=0,longitude=0,realNow=new Date(),timeZone,style="smart",scale=1}={}){
 const zone=timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
 const fraction=mod((Number.isFinite(timeDays)?timeDays:0)+(Number.isFinite(longitude)?longitude:0)/360,1);
 const total=Math.floor(fraction*86400+1e-6);
 const local=[Math.floor(total/3600),Math.floor(total/60)%60,total%60];
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",
  {timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"})
  .formatToParts(realNow).map(part=>[part.type,part.value]));
 const real=[Number(parts.hour),Number(parts.minute),Number(parts.second)];
 return {
  style,local:local.map(pad).join(":"),real:real.map(pad).join(":"),
  worldDay:Math.floor(timeDays+longitude/360)+1,timezone:zone,scale,paused:scale===0,
  gameHands:hands(...local),realHands:hands(...real)
 };
}
export class WristWatchTime{
 constructor({captureWorld=()=>null,restoreWorld=()=>{},getTimeDays=()=>0,getLongitude=()=>0,
  storage=typeof localStorage==="undefined"?null:localStorage}={}){
  this.captureWorld=captureWorld;this.restoreWorld=restoreWorld;
  this.getTimeDays=getTimeDays;this.getLongitude=getLongitude;
  this.storage=storage;this.mode="universe";this.speed=1;this.history=[];
  this.elapsed=0;this.recordedAt=-1;this.maxSnapshots=60;
  let prefs={};
  try{prefs=JSON.parse(storage?.getItem("ue:watch:prefs:v1")||"{}");}catch(_){}
  this.style=WATCH_STYLES.includes(prefs.style)?prefs.style:"smart";
  this.hand=WATCH_HANDS.includes(prefs.hand)?prefs.hand:"left";
  if(prefs.creative===true)this.mode="creative";
 }
 persist(){
  try{this.storage?.setItem("ue:watch:prefs:v1",JSON.stringify({
   style:this.style,hand:this.hand,creative:this.mode==="creative"
  }));}catch(_){}
 }
 setStyle(style){if(!WATCH_STYLES.includes(style))return false;this.style=style;this.persist();return true;}
 setHand(hand){if(!WATCH_HANDS.includes(hand))return false;this.hand=hand;this.persist();return true;}
 setMode(mode,{trusted=false}={}){
  if(!["universe","creative","multiverse"].includes(mode))return false;
  if(mode==="multiverse"&&!trusted)return false;
  if(this.mode==="multiverse"&&!trusted)return false;
  this.mode=mode;this.speed=1;this.clearHistory();this.persist();return true;
 }
 worldDelta(dt){return this.mode==="multiverse"?dt:Math.max(0,dt)*this.speed;}
 command(action,value){
  if(this.mode==="multiverse")return {ok:false,message:"マルチバースでは時間操作できません"};
  if(action==="pause"){this.speed=this.speed===0?1:0;return {ok:true,scale:this.speed};}
  if(action==="speed"){
   if(this.mode!=="creative"&&!([0,1].includes(value)))return {ok:false,message:"ユニバースでは停止と再開のみ可能です"};
   if(!SPEEDS.has(value))return {ok:false,message:"対応していない速度です"};
   this.speed=value;return {ok:true,scale:this.speed};
  }
  if(action==="rewind"){
   if(this.mode!=="creative")return {ok:false,message:"巻き戻しはクリエイティブ専用です"};
   const seconds=Number(value);
   if(!(seconds>0&&seconds<=30))return {ok:false,message:"巻き戻しは最大30秒です"};
   const target=this.elapsed-seconds;
   const snap=[...this.history].reverse().find(item=>item.at<=target);
   if(!snap)return {ok:false,message:"巻き戻せる記録がありません"};
   try{this.restoreWorld(snap.state);}catch(err){return {ok:false,message:"復元失敗: "+err.message};}
   this.elapsed=snap.at;this.speed=0;
   this.history=this.history.filter(item=>item.at<=snap.at);this.recordedAt=snap.at;
   return {ok:true,scale:0,message:"惑星時間・NPC・敵の状態を復元しました（プレイヤーはそのまま）"};
  }
  return {ok:false,message:"不明な時間操作です"};
 }
 afterWorldFrame(worldDt){
  if(this.mode!=="creative"||!(worldDt>0))return;
  this.elapsed+=worldDt;
  if(this.elapsed-this.recordedAt<.5)return;
  const state=this.captureWorld();
  if(state==null)return;
  this.history.push({at:this.elapsed,state});
  this.recordedAt=this.elapsed;
  while(this.history.length>this.maxSnapshots||this.history.length>1&&this.elapsed-this.history[0].at>30)
   this.history.shift();
 }
 clearHistory(){this.history.length=0;this.elapsed=0;this.recordedAt=-1;}
 display(realNow=new Date()){
  return watchClockDisplay({timeDays:this.getTimeDays(),longitude:this.getLongitude(),realNow,
   style:this.style,scale:this.speed});
 }
}
