/**
 * Ship-relative walkable deck + accommodation.
 * Ocean controller is the HULL; these local poses are independent of ship movement.
 * +Z bow, -Z stern. X starboard, rotated by vessel yaw for rendering.
 */
export const SHIP_HELM=Object.freeze({x:0,z:-6.18});
export const SHIP_DOOR=Object.freeze({deck:{x:0,z:-2.75},cabin:{x:0,z:1.93}});
export const SHIP_CABIN_BOUNDS=Object.freeze({x:1.64,z:2.08});
export const SHIP_DECK_LENGTH=Object.freeze({stern:-7.30,bow:7.45});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const good=(v)=>Number.isFinite(v);
const result=(ok,message,extra={})=>({ok,message,...extra});
const samples=[[-8.2,.75],[-6.3,1.80],[-3.5,2.25],[1.6,2.28],[5.7,1.56],[8.15,.30]];
export function deckHalfWidth(z){
 z=clamp(z,samples[0][0],samples.at(-1)[0]);
 for(let i=1;i<samples.length;i++)if(z<=samples[i][0]){
  const [z0,w0]=samples[i-1],[z1,w1]=samples[i];
  return w0+(w1-w0)*(z-z0)/(z1-z0);
 }
 return .3;
}
export function isShipWalkable(x,z,zone="deck"){
 if(!good(x)||!good(z))return false;
 if(zone==="cabin")return Math.abs(x)<=SHIP_CABIN_BOUNDS.x&&Math.abs(z)<=SHIP_CABIN_BOUNDS.z;
 if(zone!=="deck"||z<SHIP_DECK_LENGTH.stern||z>SHIP_DECK_LENGTH.bow)return false;
 return Math.abs(x)<=deckHalfWidth(z)-.24;
}
export function shipLocalToWorld(boatX,boatZ,yaw,x,z){
 return {x:boatX+Math.cos(yaw)*x+Math.sin(yaw)*z,
  z:boatZ-Math.sin(yaw)*x+Math.cos(yaw)*z};
}
export function shipWorldToLocal(boatX,boatZ,yaw,x,z){
 const east=x-boatX,north=z-boatZ;
 return {x:Math.cos(yaw)*east-Math.sin(yaw)*north,
  z:Math.sin(yaw)*east+Math.cos(yaw)*north};
}
export const SHIP_CREW_LINES=Object.freeze([
 "海が広いですね。次の港には何があるでしょう。",
 "帆と潮の様子を見ています。穏やかな航海になるといいですね。",
 "船室のベッドなら航海中でも休めますよ。",
 "釣り糸を垂らすには、甲板の手すり近くがよさそうです。",
 "今度の旅では、どんな土地に辿り着くのでしょう。",
 "お腹が空いたら、船室で魚を料理してみましょう。"
]);
const pose=(value,defaultValue)=>({
 x:good(value?.x)?value.x:defaultValue.x,z:good(value?.z)?value.z:defaultValue.z,
 zone:value?.zone==="cabin"?"cabin":"deck",
 yaw:good(value?.yaw)?value.yaw:0,
 moving:false,task:typeof value?.task==="string"?value.task:"idle",goal:null,
 activity:typeof value?.activity==="string"?value.activity:"idle"
});
export class ShipboardWorld{
 constructor(saved=null){
  this.version=1;
  this.shipId=typeof saved?.shipId==="string"?saved.shipId:null;
  this.player=pose(saved?.player,{x:-.55,z:-4.20});
  this.crew=Array.isArray(saved?.crew)?saved.crew.filter(c=>typeof c?.id==="string"&&c.id!=="player")
   .slice(0,24).map(c=>({id:c.id,...pose(c,{x:0,z:-1})})): [];
  this.helmId=typeof saved?.helmId==="string"?saved.helmId:null;
  this.doorOpen=Boolean(saved?.doorOpen);
  this.doorProgress=this.doorOpen?1:0;
  this.elapsed=good(saved?.elapsed)?clamp(saved.elapsed,0,1e6):0;
  this.lines=good(saved?.lines)?Math.max(0,Math.floor(saved.lines)):0;
 }
 get active(){return Boolean(this.shipId);}
 get helm(){return this.helmId;}
 member(id){return id==="player"?this.player:this.crew.find(c=>c.id===id)||null;}
 init(shipId,ids=["scout","artisan"]){
  if(!shipId||typeof shipId!=="string")throw TypeError("Missing ship");
  const initial=this.shipId!==shipId;
  if(initial){
   this.shipId=shipId;
   this.player=pose(null,{x:-.55,z:-4.20});
   this.helmId=null;this.doorOpen=false;this.doorProgress=0;
   this.crew=[];
  }
  const people=[...new Set(ids.filter(id=>id!=="player"&&typeof id==="string"))].slice(0,24);
  for(const id of people){
   if(this.crew.some(c=>c.id===id))continue;
   const i=this.crew.length;
   const aboard=i===0?{x:0,z:-6.18,zone:"deck"}:
    i%3===1?{x:1.1,z:.3,zone:"deck"}:i%3===2?
    {x:-.85,z:-1.12,zone:"cabin"}:{x:0,z:3.3,zone:"deck"};
   this.crew.push({id,...pose(aboard,aboard),task:"idle"});
  }
  if(!this.helmId||!this.member(this.helmId))this.helmId=this.crew[0]?.id||"player";
  this.normalize();
  return {ok:true,created:initial,crew:this.crew.length,helmId:this.helmId};
 }
 normalize(){
  for(const p of [this.player,...this.crew]){
   if(!isShipWalkable(p.x,p.z,p.zone)){
    p.x=p.zone==="cabin"?0:0;p.z=p.zone==="cabin"?0:-3.5;
   }
  }
  const helmsman=this.member(this.helmId);
  if(helmsman&&helmsman.zone==="deck"&&this.helmId!=="player"){
   helmsman.x=SHIP_HELM.x;helmsman.z=SHIP_HELM.z;helmsman.yaw=0;
  }
 }
 embark(){
  this.player=pose({zone:"deck",x:-.55,z:-4.20},{x:-.55,z:-4.20});
  this.doorOpen=false;this.doorProgress=0;
  return result(true,"⛵ 甲板に乗り込みました");
 }
 leave(){this.player.goal=null;this.player.moving=false;return result(true,"下船しました");}
 toggleDoor(){
  const p=this.player;
  const entrance=SHIP_DOOR[p.zone];
  if(Math.hypot(p.x-entrance.x,p.z-entrance.z)>2.1)
   return result(false,"🚪 扉の近く（2.1m以内）まで歩いてください");
  this.doorOpen=!this.doorOpen;
  return result(true,this.doorOpen?"🚪 船室の扉を開けました":"🚪 船室の扉を閉めました");
 }
 passage(){
  const p=this.player,from=p.zone,to=from==="deck"?"cabin":"deck";
  if(!this.doorOpen)return result(false,"🚪 扉を開いてから通ってください");
  const entrance=SHIP_DOOR[from];
  if(Math.hypot(p.x-entrance.x,p.z-entrance.z)>2.1)return result(false,"🚪 扉まで近づいてください");
  const exit=SHIP_DOOR[to];p.zone=to;p.x=exit.x;p.z=exit.z;p.goal=null;p.moving=false;
  p.yaw=to==="deck"?Math.PI:0;
  return result(true,to==="cabin"?"🛏️ 扉を通り船室へ入りました":"⛵ 扉から甲板に出ました",{zone:to});
 }
 canHelm(id=this.helmId){
  const p=this.member(id);
  return Boolean(p&&p.zone==="deck"&&Math.hypot(p.x-SHIP_HELM.x,p.z-SHIP_HELM.z)<=1.3);
 }
 assignHelm(id){
  const next=this.member(id);
  if(!next)return result(false,"船にいる仲間を選択してください");
  if(id==="player"&&!this.canHelm("player")){
   if(this.player.zone==="cabin")return result(false,"甲板へ出てから舵輪に向かってください");
   this.player.goal={...SHIP_HELM,zone:"deck",action:"helm"};
   return result(true,"🧭 舵輪に向かっています。到着すると操舵を交代します",{walking:true});
  }
  if(id!=="player"){
   if(this.helmId==="player")this.player.goal=null;
   next.zone="deck";next.x=SHIP_HELM.x;next.z=SHIP_HELM.z;next.yaw=0;next.goal=null;
  }
  this.helmId=id;
  return result(true,id==="player"?"🧭 舵輪を握りました。スティックで操船できます":
   "🧭 "+id+"に舵を任せました。プレイヤーは甲板・船室を自由に歩けます");
 }
 setDestination(x,z){
  const p=this.player;
  if(this.helmId==="player")return result(false,"舵輪から離れてから歩いてください");
  if(!isShipWalkable(x,z,p.zone))return result(false,"船内・甲板の歩ける範囲を選んでください");
  p.goal={x,z,zone:p.zone};return result(true,"📍 船内の目的地へ歩きます");
 }
 advance(dt,input={}){
  if(!Number.isFinite(dt)||dt<0)throw RangeError("Invalid shipboard delta");
  const delta=clamp(dt,0,.1);if(!delta)return [];
  this.elapsed+=delta;
  this.doorProgress=clamp(this.doorProgress+(this.doorOpen?delta*3:-delta*3),0,1);
  const p=this.player,events=[];
  if(this.helmId==="player"){
   p.zone="deck";p.x=SHIP_HELM.x;p.z=SHIP_HELM.z;p.moving=false;p.goal=null;
  }else if(p.goal){
   const dx=p.goal.x-p.x,dz=p.goal.z-p.z,d=Math.hypot(dx,dz);
   if(d<.24){
    const next=p.goal;p.goal=null;p.moving=false;
    if(next.action==="helm"){
     this.helmId="player";p.x=SHIP_HELM.x;p.z=SHIP_HELM.z;
     events.push("🧭 舵輪に到着しました。操舵できます");
    }
   }else this.move(p,{forward:1,strafe:0,turn:0},delta,{dx:dx/d,dz:dz/d});
  }else this.move(p,input,delta);
  for(let i=0;i<this.crew.length;i++){
   const c=this.crew[i];c.moving=false;
   if(c.id===this.helmId){
    c.zone="deck";c.x=SHIP_HELM.x;c.z=SHIP_HELM.z;
    c.yaw=0;c.task="steer";c.goal=null;c.nextZone=null;continue;
   }
   const period=5.5+i%4*1.7,epoch=Math.floor(this.elapsed/period);
   if((c.phase!==epoch||!c.goal)&&!c.nextZone){
    c.phase=epoch;
    const destination=i%3===1?epoch%3===1?"cabin":"deck":
     i%3===2?epoch%4!==0?"cabin":"deck":epoch%6===2?"cabin":"deck";
    const target=destination==="cabin"?
     {x:.95*Math.sin(epoch+i*2),z:1.55*Math.cos(epoch+i)}:
     {x:Math.sin(epoch+i*1.9)*1.35,z:Math.cos(epoch*.9+i)*3.4};
    if(c.zone!==destination){
     c.nextZone=destination;c.afterDoor=target;
     c.goal={...SHIP_DOOR[c.zone]};
    }else c.goal=target;
    c.task=epoch%4===0?"fish":epoch%4===1?"talk":epoch%4===2?"rest":"walk";
   }
   if(!c.goal)continue;
   const dx=c.goal.x-c.x,dz=c.goal.z-c.z,d=Math.hypot(dx,dz);
   if(d>.17){
    this.move(c,{forward:1,strafe:0,turn:0},delta,{dx:dx/d,dz:dz/d},1.15);
    continue;
   }
   c.moving=false;
   if(c.nextZone){
    this.doorOpen=true;
    const next=c.nextZone,exit=SHIP_DOOR[next];
    c.zone=next;c.x=exit.x;c.z=exit.z;
    c.nextZone=null;c.goal=c.afterDoor||null;c.afterDoor=null;
   }else c.goal=null;
  }
  return events;
 }
 move(p,input,dt,vector=null,speed=2.65){
  const turn=clamp(input.turn||0,-1,1);
  p.yaw=(p.yaw+turn*dt*2.3)%(2*Math.PI);
  let dx=vector?.dx??(Math.sin(p.yaw)*(input.forward||0)+Math.cos(p.yaw)*(input.strafe||0));
  let dz=vector?.dz??(Math.cos(p.yaw)*(input.forward||0)-Math.sin(p.yaw)*(input.strafe||0));
  const length=Math.hypot(dx,dz);if(length>.999){dx/=length;dz/=length;}
  const x=p.x+dx*speed*dt,z=p.z+dz*speed*dt;
  const valid=isShipWalkable(x,z,p.zone);
  if(valid){p.x=x;p.z=z;}else{
   if(isShipWalkable(x,p.z,p.zone))p.x=x;
   if(isShipWalkable(p.x,z,p.zone))p.z=z;
  }
  if(length>.1)p.yaw=Math.atan2(dx,dz);
  p.moving=(Math.abs(p.x-(x-dx*speed*dt))+Math.abs(p.z-(z-dz*speed*dt)))>.003;
 }
 nearbyCrew(radius=3.5){
  return this.crew.filter(c=>c.zone===this.player.zone&&
   Math.hypot(c.x-this.player.x,c.z-this.player.z)<=radius);
 }
 talk(id,name="仲間"){
  const c=this.member(id);
  if(!c||id==="player")return result(false,"船内の仲間を選んでください");
  if(c.zone!==this.player.zone||Math.hypot(c.x-this.player.x,c.z-this.player.z)>3.5)
   return result(false,"会話するには同じ甲板・船室で3.5m以内に近づいてください");
  this.lines++;
  const message=SHIP_CREW_LINES[(this.lines+this.crew.indexOf(c))%SHIP_CREW_LINES.length];
  c.activity="talk";
  return result(true,"💬 "+name+"「"+message+"」",{speech:message,id});
 }
 snapshot(){
  const copy=p=>({x:p.x,z:p.z,zone:p.zone,yaw:p.yaw,activity:p.activity,task:p.task});
  return {version:1,shipId:this.shipId,player:copy(this.player),
   crew:this.crew.map(c=>({id:c.id,...copy(c)})),helmId:this.helmId,
   doorOpen:this.doorOpen,elapsed:this.elapsed,lines:this.lines};
 }
}
