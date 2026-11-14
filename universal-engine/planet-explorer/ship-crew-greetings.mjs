export const CREW_GESTURES = Object.freeze({
 salute:{label:"敬礼",seconds:2.2},
 handshake:{label:"握手",seconds:2.65,distance:1.85,gap:.84},
 thumbsUp:{label:"グッドサイン",seconds:2.0},
 doubleThumbs:{label:"両手グッド",seconds:2.15},
 hug:{label:"ハグ",seconds:2.85,distance:1.45,gap:.54}
});

export const CREW_REACH = 2.6;
export const CREW_GREET_RADIUS = 2.35;
const REARM_RADIUS = 3.1;
const REARM_SECONDS = 5;

export function smoothStep(value) {
 const t = Math.min(1,Math.max(0,value));
 return t*t*(3-2*t);
}

export function crewPhase(time, start, end) {
 return smoothStep((time-start)/(end-start));
}

function face(from,to) {
 return Math.atan2(to.x-from.x,to.z-from.z);
}

export class ShipCrewGreetings {
 constructor(crew) {
  this.crew = crew;
  this.nearby = new Map();
  this.formal = null;
  this.pair = null;
  this.playerYaw = null;
  this.playerMoving = false;
  this.lastPosition = null;
 }

 advance(interior, dt, isReady=()=>true) {
  if(this.lastPosition){
   const {x,z}=this.lastPosition;
   this.playerMoving=Math.hypot(interior.x-x,interior.z-z)>.001;
   if(this.playerMoving)this.playerYaw=face(this.lastPosition,interior);
  }
  this.lastPosition={x:interior.x,z:interior.z};
  if(interior.seated||interior.z>13){
   this.formal=null;
   this.pair=null;
   return;
  }
  if(this.pair){
   this.pair.time+=dt;
   if(this.pair.time>=CREW_GESTURES[this.pair.action].seconds)this.pair=null;
  }
  if(this.formal){
   this.formal.time+=dt;
   if(this.formal.time>=CREW_GESTURES.salute.seconds||interior.distance(this.formal.member)>REARM_RADIUS)
    this.formal=null;
  }
  for(const member of this.crew){
   const state=this.nearby.get(member.id);
   if(!state)continue;
   state.cooldown=Math.max(0,state.cooldown-dt);
   if(interior.distance(member)>REARM_RADIUS)state.left=true;
   if(state.left&&state.cooldown===0)this.nearby.delete(member.id);
  }
   if(this.pair||this.formal)return;
  const member=interior.nearCrew(CREW_GREET_RADIUS).find(actor=>
   isReady(actor)&&!this.nearby.has(actor.id));
  if(!member)return;
  this.nearby.set(member.id,{cooldown:REARM_SECONDS,left:false});
  this.formal={member,time:0};
 }

 start(interior, id, action) {
  const move = Object.hasOwn(CREW_GESTURES,action)?CREW_GESTURES[action]:null;
  const member=this.crew.find(actor=>actor.id===id);
  if(!move||!member)return {ok:false,message:"乗員またはモーションを確認できません"};
  if(interior.seated||interior.mode!=="interior")
   return {ok:false,message:"操縦席から立って乗員に近づいてください"};
  if(this.pair)return {ok:false,message:"モーションの終了を待ってください"};
  const distance = interior.distance(member);
  if(!interior.canReachCrew(member))return {ok:false,message:"通路を回って"+member.name+"に近づいてください"};
  if(distance>(move.distance??CREW_REACH))
   return {ok:false,message:member.name+"に"+(move.distance?"もう少し":"")+"近づいてください"};
  const origin={x:interior.x,z:interior.z};
  const dx=(member.x-origin.x)/Math.max(.001,distance),dz=(member.z-origin.z)/Math.max(.001,distance);
  const step=move.gap?Math.max(0,(distance-move.gap)/2):0;
  // The pair closes evenly from both sides. Use the same cabin obstacles as walking.
  const position=(start,sign)=>({x:start.x+sign*dx*step,z:start.z+sign*dz*step});
  if(step>0){
   const a=position(origin,1),b=position(member,-1);
   if(!interior.canOccupy(a.x,a.z,{ignoreCrew:true})||!interior.canOccupy(b.x,b.z,{ignoreCrew:true}))
    return {ok:false,message:"通路の広い側で乗員に近づいてください"};
  }
  this.formal=null;
  this.nearby.set(id,{cooldown:REARM_SECONDS,left:false});
  this.playerYaw=face(origin,member);
  this.pair={member,action,time:0,origin,pad:{x:dx*step,z:dz*step}};
  return {ok:true,message:member.name+"と"+move.label};
 }

 actors(interior) {
  const pair=this.pair;
  const player={id:"player",x:interior.x,z:interior.z,yaw:this.pair?this.playerYaw:(Math.PI-interior.yaw),
   motion:interior.seated?"Seated":this.playerMoving?"walk":"idle",time:null};
  const crew=this.crew.map(member=>({
   id:member.id,x:member.x,z:member.z,
   yaw:interior.distance(member)<3.4?face(member,interior):member.yaw,
   motion:this.formal?.member===member?"salute":"idle",time:this.formal?.member===member?this.formal.time:null
  }));
  if(!pair)return [player,...crew];
  const mate=crew.find(actor=>actor.id===pair.member.id);
  const {action,time,pad,origin}=pair;
  const contact=CREW_GESTURES[action].gap;
  const blend=contact?crewPhase(time,0,.45)*(1-crewPhase(time,2.1,CREW_GESTURES[action].seconds)):0;
  for(const [actor,sign] of [[player,1],[mate,-1]]){
   actor.x+=sign*pad.x*blend;
   actor.z+=sign*pad.z*blend;
   actor.yaw=sign===1?face(origin,pair.member):face(pair.member,origin);
   actor.motion=action;
   actor.time=time;
  }
  if(action==="handshake"){
   const grip=[(player.x+mate.x)/2,1.11+.037*Math.sin((time-.8)*16)*crewPhase(time,.58,.83)*(1-crewPhase(time,1.65,1.95)),(player.z+mate.z)/2];
   player.grip=mate.grip=grip;
  }
  return [player,...crew];
 }
}
