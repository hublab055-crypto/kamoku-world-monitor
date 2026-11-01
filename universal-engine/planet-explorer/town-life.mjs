/** Town social and economy state. Independent of DOM/WebGL; reproducible and saveable.
 * No generative-AI API dependency: dialogue is branching, location-aware dialogue.
 */
import {settlementLayout,destinationById} from "./settlements.mjs?v=0.9ap-music-hall";
import {hallRoom,nearestHallSeat,hallSeats} from "./music-hall.mjs?v=0.9aq";
import {hallDoor,hallDoorNear,hallExteriorStep} from "./music-hall-portal.mjs?v=0.9aq";

export const TOWN_NAMES=Object.freeze({
 lodge:"宿屋・集会所",cabin:"民家",barn:"納屋",workshop:"工房",
 watchtower:"見張り台",granary:"穀物倉庫",well:"共同井戸",market:"市場",stable:"厩舎",
 theater:"音楽劇場",school:"音楽教室"
});
export const TOWN_WARES=Object.freeze({
 market:[{item:"apple",name:"リンゴ",price:3,bag:"resources"},
   {item:"carrot",name:"ニンジン",price:2,bag:"resources"},
   {item:"water",name:"飲み水",price:2,bag:"life"},
   {item:"meal",name:"食事",price:8,bag:"life"}],
 workshop:[{item:"wood",name:"木材",price:4,bag:"resources"},
   {item:"stone",name:"石材",price:4,bag:"resources"},
   {item:"fiber",name:"繊維",price:3,bag:"resources"}],
 granary:[{item:"wheat",name:"小麦",price:3,bag:"resources"},
   {item:"carrot",name:"ニンジン",price:2,bag:"resources"}],
 stable:[{item:"wheat",name:"飼葉用小麦",price:3,bag:"resources"}],
 lodge:[{item:"meal",name:"宿の食事",price:8,bag:"life"},
   {item:"water",name:"飲み水",price:2,bag:"life"}]
});
const topics=Object.freeze(["greeting","work","rumor"]);
export const TOWN_TOPICS=Object.freeze([
 {id:"greeting",title:"挨拶する"},{id:"work",title:"仕事について聞く"},
 {id:"rumor",title:"街の噂を聞く"}
]);
const good=n=>Number.isSafeInteger(n)&&n>=0;
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
const result=(ok,message,extra={})=>({ok,message,...extra});
export class TownLife{
 constructor(saved=null){
  this.coins=good(saved?.coins)?limit(saved.coins,0,999999):40;
  this.friendship={};
  for(const [id,value]of Object.entries(saved?.friendship||{}))
   if(/^[a-z]+:resident-\d+$/.test(id)&&good(value))
    this.friendship[id]=limit(value,0,100);
  this.talked={};
  for(const [key,day] of Object.entries(saved?.talked||{}))
   if(/^[a-z]+:resident-\d+:(greeting|work|rumor)$/.test(key)&&good(day))
    this.talked[key]=day;
  this.inside=null;this.hallDoors={};this.portalExitRequested=false;this._hallSites={};
 }
 layout(townId){return settlementLayout(townId);}
 find(townId,id,category){
  if(!destinationById(townId)||townId==="pioneer")return null;
  const layout=this.layout(townId);
  if(category==="resident"){
   const actor=layout.residents.find(a=>a.id===id);
   return actor?{...actor,kind:"resident",title:"街の住人 "+(Number(id.split("-")[1])+1)}:null;
  }
  if(category==="village"){
   const match=/^village-(\d+)$/.exec(id);
   const site=match?layout.buildings[Number(match[1])]:null;
   return site?{...site,id,kind:"building",title:TOWN_NAMES[site.type]||"施設"}:null;
  }
  return null;
 }
 distance(actor,subject){return Math.hypot(actor.x-subject.x,actor.z-subject.z);}
 canInteract(townId,actor,subject,{radius=7}={}){
  if(!actor?.nearGround||actor?.travelMode!=="walk"||
    !destinationById(townId)||townId==="pioneer")
   return result(false,"街の地上で歩行中に操作してください");
  if(!subject)return result(false,"対象が見つかりません");
  if(this.inside){
   return this.inside.townId===townId&&this.inside.buildingId===subject.id?
    result(true,"屋内にいます"):result(false,"先に建物から外へ出てください");
  }
  const distance=this.distance(actor,subject);
  if(distance>radius)return result(false,"対象まで約"+Math.ceil(distance)+"mです。近づいてから操作してください");
  return result(true,"近くにいます");
 }
 dialogue(townId,residentId,topic,actor,day=0){
  if(!topics.includes(topic))return result(false,"会話の選択肢がありません");
  const resident=this.find(townId,residentId,"resident");
  const proximity=this.canInteract(townId,actor,resident,{radius:6});
  if(!proximity.ok)return proximity;
  const key=townId+":"+residentId,dayNumber=limit(Math.floor(Number(day)||0),0,999999);
  const place=destinationById(townId),relation=this.friendship[key]||0;
  const lines={
   greeting:["こんにちは。ここは"+place.name+"ですよ。","また会いましたね。今日はいい日ですね。"],
   work:["私は"+resident.activity+"をしています。暮らしは忙しいですが、楽しいですよ。","市場や工房を回っていると一日があっという間です。"],
   rumor:["最近は"+place.region+"を訪れる旅人が増えているそうです。","あそこの市場には、ときどき珍しい品物が並ぶんですよ。"]
  };
  const phrase=lines[topic][(Number(residentId.split("-")[1])+(relation>3?1:0))%2];
  const logKey=key+":"+topic;
  // Each topic grants friendship at most once per planetary day.
  if(this.talked[logKey]!==dayNumber){
   this.friendship[key]=limit(relation+1,0,100);
   this.talked[logKey]=dayNumber;
  }
  return result(true,"💬 "+resident.title+"：「"+phrase+"」",{friendship:this.friendship[key]});
 }
 hallDoorOpen(townId,buildingId){return Boolean(this.hallDoors[townId+":"+buildingId]);}
 toggleHallDoor(townId,buildingId,actor){
  const building=this.find(townId,buildingId,"village");
  if(!building||!hallRoom(building.type))return result(false,"開閉可能な音楽施設の扉ではありません");
  const inside=this.inside?.townId===townId&&this.inside.buildingId===buildingId;
  if(inside&&this.inside.seat)return result(false,"先に席を立ってから扉へ向かってください");
  if(!inside&&(!actor?.nearGround||actor.travelMode!=="walk"))
   return result(false,"地表で歩行中に扉を操作してください");
  if(!hallDoorNear(building,inside?this.inside.pose:actor,{inside}))
   return result(false,"入口の扉から約2.5m以内に近づいてください");
  const id=townId+":"+buildingId,open=!this.hallDoors[id];this.hallDoors[id]=open;
  return result(true,open?"🚪 扉を開けました。前進すると室内に入れます":"🚪 扉を閉じました",{open});
 }
 hallStep(townId,previous,controller){
  if(this.inside||!controller?.nearGround||controller.travelMode!=="walk")return {blocked:false};
  const sites=this._hallSites[townId]??=this.layout(townId).buildings
   .map((p,i)=>({...p,id:"village-"+i})).filter(p=>hallRoom(p.type));
  const step=hallExteriorStep(previous,controller,sites,site=>this.hallDoorOpen(townId,site.id));
  if(step.portal){
   const entered=this.enter(townId,step.portal.id,controller);
   if(entered.ok){
    this.inside.pose.z=hallRoom(step.portal.type).entranceZ-.7;
    return {blocked:false,entered:true,message:"🚪 扉を通って"+entered.building.title+"に入りました"};
   }
   return {blocked:true,message:entered.message};
  }
  return step;
 }
 portalExit(actor){
  if(!this.portalExitRequested||!this.inside)return result(false,"出口に到達していません");
  const inside=this.inside,building=this.find(inside.townId,inside.buildingId,"village");
  if(!building||!this.hallDoorOpen(inside.townId,inside.buildingId))
   return result(false,"扉が閉まっています");
  const door=hallDoor(building);
  if(!actor?.locationAt||!door)return result(false,"地表位置を復元できません");
  const x=door.x,z=door.z+1.05,point=actor.locationAt(x,z);
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon))
   return result(false,"入口の座標が不正です");
  actor.x=x;actor.z=z;actor.lat=point.lat;actor.lon=point.lon;
  actor.clearMoveTarget?.();actor.moving=false;
  this.portalExitRequested=false;this.inside=null;
  return result(true,"🚪 扉を通って建物の外へ出ました");
 }
 enter(townId,buildingId,actor){
  const building=this.find(townId,buildingId,"village");
  if(!building||["well","watchtower"].includes(building.type))
   return result(false,"この施設は屋内に入れません");
  const near=this.canInteract(townId,actor,building,{radius:hallRoom(building.type)?12:9});
  if(!near.ok)return near;
  const hall=hallRoom(building.type);
  if(hall&&!this.hallDoorOpen(townId,buildingId))
   return result(false,"まず入口で扉を開けてください");
  this.inside={townId,buildingId,pose:{x:0,z:hall?.entranceZ??2.4,yaw:0,moving:false},seat:null};
  actor.clearMoveTarget?.();
  return result(true,"🚪 "+building.title+"に入りました。室内を見学できます。",{building});
 }
 walk(dt,{forward=0,strafe=0,turn=0}={}){
  if(!this.inside)return false;
  const p=this.inside.pose;
  if(!p||!Number.isFinite(dt)||dt<0||this.inside.seat)return false;
  const step=limit(dt,0,.1),turnRate=1.75;
  const f=limit(Number(forward)||0,-1,1),side=limit(Number(strafe)||0,-1,1);
  p.yaw+=limit(Number(turn)||0,-1,1)*step*turnRate;
  const mag=Math.max(1,Math.hypot(f,side));
  const dx=(Math.sin(p.yaw)*f+Math.cos(p.yaw)*side)*2.5*step/mag;
  const dz=(Math.cos(p.yaw)*f-Math.sin(p.yaw)*side)*2.5*step/mag;
  const building=this.find(this.inside.townId,this.inside.buildingId,"village"),hall=hallRoom(building?.type);
  const nextX=limit(p.x+dx,hall?-hall.halfWidth+.35:-3.55,hall?hall.halfWidth-.35:3.55),
   nextZ=limit(p.z+dz,hall?hall.zMin+.35:-3,hall?hall.zMax-.30:3.5);
  if(hall&&nextZ>hall.zMax-.8&&Math.abs(nextX)<1.05&&
   this.hallDoorOpen(this.inside.townId,this.inside.buildingId)){
   this.portalExitRequested=true;this.inside.pose.z=hall.zMax-.75;
   return true;
  }
  if(hall){
   const seats=hallSeats(building.type);
   if(seats.some(seat=>Math.abs(nextX-seat.x)<.62&&Math.abs(nextZ-seat.z)<.64)&&
      !seats.some(seat=>Math.abs(p.x-seat.x)<.62&&Math.abs(p.z-seat.z)<.64))
    return false;
   if(nextZ<hall.stageZ+1.5&&Math.abs(nextX)<hall.halfWidth-1)return false;
  }
  p.moving=Math.hypot(nextX-p.x,nextZ-p.z)>.001;
  p.x=nextX;p.z=nextZ;
  return p.moving;
 }
 sitMusicSeat({admitted=true}={}){
  if(!this.inside)return result(false,"音楽施設の室内へ入ってください");
  if(this.inside.seat)return result(false,"すでに着席しています");
  const building=this.find(this.inside.townId,this.inside.buildingId,"village");
  if(building?.type==="theater"&&!admitted)return result(false,"公演中の客席はチケットの購入が必要です");
  const seat=nearestHallSeat(building?.type,this.inside.pose);
  if(!seat)return result(false,"客席・教室の椅子に近づいてください（約1.3m以内）");
  this.inside.seat=seat.id;
  this.inside.pose={...this.inside.pose,x:seat.x,z:seat.z,yaw:seat.yaw,moving:false};
  return result(true,"💺 着席しました。立ち上がるまで移動しません");
 }
 standMusicSeat(){
  if(!this.inside?.seat)return result(false,"現在着席していません");
  const building=this.find(this.inside.townId,this.inside.buildingId,"village");
  const seat=nearestHallSeat(building?.type,this.inside.pose,{reach:.25});
  this.inside.seat=null;
  if(seat)this.inside.pose.x=seat.x>0?seat.x-.45:seat.x+.45;
  return result(true,"🧍 立ち上がりました");
 }
 leave(){
  if(!this.inside)return result(false,"屋外にいます");
  this.inside=null;this.portalExitRequested=false;return result(true,"🚪 建物から外に出ました");
 }
 trade(townId,buildingId,item,direction,actor,actions,life){
  const shop=this.find(townId,buildingId,"village");
  if(!shop)return result(false,"お店が見つかりません");
  const near=this.canInteract(townId,actor,shop,{radius:9});
  if(!near.ok)return near;
  const wares=TOWN_WARES[shop.type]||[];
  const ware=wares.find(w=>w.item===item);
  if(!ware||!["buy","sell"].includes(direction))
   return result(false,"この店では扱っていない品物です");
  const store=ware.bag==="life"?life?.inventory:actions?.resources;
  if(!store)return result(false,"持ち物を参照できません");
  const count=store[item]||0;
  if(!good(count))return result(false,"所持数が不正です");
  if(direction==="buy"){
   if(this.coins<ware.price)return result(false,"コインが足りません（必要："+ware.price+"）");
   if(count>=99999)return result(false,"持ち物がいっぱいです");
   this.coins-=ware.price;store[item]=count+1;
   return result(true,"🛍️ "+ware.name+"を購入 −"+ware.price+" コイン",{delta:-ware.price});
  }
  if(count<1)return result(false,ware.name+"を持っていません");
  const offer=Math.max(1,Math.floor(ware.price*.6));
  if(this.coins>999999-offer)return result(false,"所持コインの上限です");
  store[item]=count-1;this.coins+=offer;
  return result(true,"🪙 "+ware.name+"を売却 ＋"+offer+" コイン",{delta:offer});
 }
 snapshot(){
  // The indoor session is deliberately transient: restore always begins outside.
  return {schemaVersion:1,coins:this.coins,friendship:{...this.friendship},talked:{...this.talked}};
 }
}
