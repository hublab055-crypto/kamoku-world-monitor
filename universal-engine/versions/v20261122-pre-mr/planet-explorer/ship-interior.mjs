import {CREW_REACH,ShipCrewGreetings} from "./ship-crew-greetings.mjs?v=20261117-family-gestures";
import {ShipCrewSocial} from "./ship-crew-social.mjs?v=20261117-oasis-consent";
import {ShipCrewAutonomy} from "./ship-crew-autonomy.mjs?v=20261117-crew-life";

/** Local ship coordinates: forward -Z; floor Y=0; dimensions 8m x 26m. */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const valid=v=>Number.isFinite(v);
export const PILOT_SEAT_Z=-11.25;
export const PILOT_ACCESS_Z=-9.7;
export const SHIP_CREW=Object.freeze([
 {id:"navigator",name:"航法士",title:"副官",role:"航法・通信",x:-2.3,z:-10.8,yaw:0,seated:true},
 {id:"engineer",name:"機関士",role:"機関・整備",x:1.6,z:7.2,yaw:-Math.PI/2,seated:true},
 {id:"companion",name:"同行者",role:"探索・支援",x:-2.5,z:3.0,yaw:Math.PI/2,seated:true}
]);
export const SHIP_STATIONS=Object.freeze([
 {id:"helm",name:"操縦席",x:0,z:PILOT_ACCESS_Z,radius:2.3},
 {id:"navigation",name:"航法コンソール",x:-2.3,z:-10.6,radius:1.8},
 {id:"cargo",name:"船倉マニフェスト",x:0,z:10.2,radius:2.9},
 {id:"engine",name:"エンジン監視盤",x:2.8,z:10.8,radius:1.7},
 {id:"hatch",name:"船尾ハッチ",x:0,z:12.0,radius:3.0}
]);
const blockers=[
 {x1:-3.95,x2:-2.35,z1:5,z2:11.0}, // cargo storage banks
 {x1:2.35,x2:3.95,z1:5,z2:11.0},
 {x1:-1.0,x2:1.0,z1:PILOT_SEAT_Z-.65,z2:PILOT_SEAT_Z+.8}, // captain chair
 {x1:1.18,x2:2.08,z1:10.9,z2:12.2}
];
export class ShipInterior{
 constructor(data={}){
  this.x=valid(data.x)?clamp(data.x,-3.45,3.45):0;
  this.z=valid(data.z)?clamp(data.z,-12.4,18.7):-8.2;
  this.yaw=valid(data.yaw)?data.yaw:0;
  this.pitch=valid(data.pitch)?clamp(data.pitch,-.8,.8):0;
  this.mode=["interior","cockpit"].includes(data.mode)?data.mode:"interior";
  this.lastCrewId=typeof data.lastCrewId==="string"?data.lastCrewId:null;
  this.seated=Boolean(data.seated);
  this.hatchPassable=Boolean(data.hatchPassable);
  this.suitOn=Boolean(data.suitOn);
  this.crew=SHIP_CREW.map(c=>{
    const prior=Array.isArray(data.crew)?data.crew.find(v=>v?.id===c.id):null;
    const x=valid(prior?.x)?clamp(prior.x,-3.45,3.45):c.x;
    const z=valid(prior?.z)?clamp(prior.z,-12.4,12.7):c.z;
    return {...c,x,z,yaw:valid(prior?.yaw)?prior.yaw:c.yaw,
     following:Boolean(prior?.following),
     seated:prior?.seated===undefined?Boolean(c.seated)&&!prior?.following:Boolean(prior.seated),
     returning:Boolean(prior?.returning),seatLocked:Boolean(prior?.seatLocked),
     routineTarget:valid(prior?.routineTarget?.x)&&valid(prior?.routineTarget?.z)?
      {x:clamp(prior.routineTarget.x,-3.4,3.4),z:clamp(prior.routineTarget.z,-12.4,12.7)}:null,
     moving:false};
   });
   this.social=new ShipCrewSocial(data.social);
   this.routine=new ShipCrewAutonomy(data.routine);
   this.greetings=new ShipCrewGreetings(this.crew);
  if(!this.canOccupy(this.x,this.z,{ignoreCrew:true})){this.x=0;this.z=-8.2;}
 }
 canOccupy(x,z,{ignoreCrew=false}={}){
  if(!valid(x)||!valid(z)||Math.abs(x)>3.48||z< -12.75||z>18.7)return false;
  if(z>12.7&&(!this.hatchPassable||Math.abs(x)>1.05))return false;
  if(!ignoreCrew&&this.crew.some(c=>Math.hypot(x-c.x,z-c.z)<.48))return false;
  const r=.27;
  return !blockers.some(b=>x+r>b.x1&&x-r<b.x2&&z+r>b.z1&&z-r<b.z2);
 }
 walk(forward=0,sideways=0,dt=1){
  if(this.seated||this.greetings.pair||!valid(forward)||!valid(sideways)||!valid(dt)||dt<=0)return false;
  const magnitude=Math.hypot(forward,sideways);
  if(magnitude===0)return false;
  const speed=2.6*Math.min(dt,.16)/Math.max(1,magnitude);
  // Player forward points toward -Z at yaw=0.
  const dx=(Math.sin(this.yaw)*forward+Math.cos(this.yaw)*sideways)*speed;
  const dz=(-Math.cos(this.yaw)*forward+Math.sin(this.yaw)*sideways)*speed;
  let moved=false;
  if(this.canOccupy(this.x+dx,this.z)){this.x+=dx;moved=true;}
  if(this.canOccupy(this.x,this.z+dz)){this.z+=dz;moved=true;}
  return moved;
 }
 turn(dx,dy=0){
  if(!valid(dx)||!valid(dy))return;
  this.yaw=((this.yaw+dx+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  this.pitch=clamp(this.pitch+dy,-.78,.78);
 }
 distance(point){return Math.hypot(this.x-point.x,this.z-point.z);}
 get nearHatch(){return Math.hypot(this.x,this.z-11.55)<2.0;}
 get nearHelm(){return Math.min(Math.hypot(this.x,this.z-PILOT_ACCESS_Z),Math.hypot(this.x,this.z-PILOT_SEAT_Z))<=2.3;}
 sit(){
  if(this.seated)return {ok:false,message:"すでに操縦席に着席中です"};
  if(this.greetings.pair)return {ok:false,message:"乗員とのモーションが終わってから着席してください"};
  if(!this.nearHelm)return {ok:false,message:"操縦席の前後か横まで近づいてください"};
  this.seated=true;this.x=0;this.z=PILOT_SEAT_Z;this.yaw=0;this.pitch=0;this.mode="interior";
  return {ok:true,message:"🪑 操縦席に着席しました。航行操作が使用できます"};
 }
 stand(){
  if(!this.seated)return {ok:false,message:"操縦席に座っていません"};
  this.seated=false;this.x=0;this.z=PILOT_ACCESS_Z;this.mode="interior";
  return {ok:true,message:"🚶 操縦席から立ち上がりました"};
 }
 canReachCrew(crew){
  return [-4.8,4.5].every(wall=>{
   if((this.z-wall)*(crew.z-wall)>=0)return true;
   const x=this.x+(crew.x-this.x)*(wall-this.z)/(crew.z-this.z);
   return Math.abs(x)<1.15;
  });
 }
 nearCrew(radius=CREW_REACH){
  return this.crew.filter(c=>this.distance(c)<=radius&&this.canReachCrew(c))
   .sort((a,b)=>this.distance(a)-this.distance(b));
 }
 nearStations(radius=2.8){return SHIP_STATIONS.filter(c=>c.id==="helm"?this.nearHelm:this.distance(c)<=Math.min(radius,c.radius)).sort((a,b)=>this.distance(a)-this.distance(b));}
 talk(id,voyage){
  const crew=this.crew.find(c=>c.id===id);
  if(!crew)return {ok:false,message:"乗員が見つかりません"};
  if(this.distance(crew)>CREW_REACH||!this.canReachCrew(crew))return {ok:false,message:crew.name+"には近づいてから話しかけてください"};
  this.lastCrewId=crew.id;
  const status=voyage?.status;
  const responses={
   navigator:status==="orbit"?"目的天体の周回軌道に入りました。操縦席から着陸できます。":
    status==="preflight"?"航路を確認しました。操縦席から離陸できます。":
    "目的地への航路は順調です。進路がずれたら自動航行を使ってください。",
   engineer:voyage?.fuel<18?"推進剤が少なくなっています。操縦盤の「整備・補給」から予備燃料や救援補給を利用できます。":
    "推進系は正常です。燃料は現在"+Math.round(voyage?.fuel??100)+"%。船倉の積荷も確認してください。",
   companion:status==="orbit"?"着陸後は現地を探索しましょう。":
    "船内の移動ができるようになりましたね。窓から見える星が少しずつ動いています。"
  };
  return {ok:true,name:crew.name,message:responses[crew.id]};
 }

 /** Move followers on the real walkable deck, with a central passage at each bulkhead. */
 advanceCrew(dt,context={}){
  this.social.advance(dt);
  if(!valid(dt)||dt<=0)return;
  this.routine.advance(this,dt,context);
  for(const [i,member] of this.crew.entries()){
   member.moving=false;
   if((!member.following&&!member.returning&&!member.routineTarget)||member.seated)continue;
   const home=SHIP_CREW.find(c=>c.id===member.id);
   let target=member.returning?{x:home.x,z:home.z}:
    member.routineTarget??{x:this.x+(i-1)*.65,z:this.z+1.25};
   const crossing=[-4.8,4.5].find(w=>(member.z-w)*(target.z-w)<0);
   if(crossing!==undefined)target={x:0,z:crossing+(member.z<crossing?1:-1)};
   const distance=Math.hypot(target.x-member.x,target.z-member.z);
   if(distance<.35){
    if(member.returning){member.returning=false;member.seated=true;member.yaw=home.yaw;}
    continue;
   }
   const step=Math.min(distance,Math.min(.16,dt)*1.9);
   const dx=(target.x-member.x)/distance*step,dz=(target.z-member.z)/distance*step;
   const nextX=member.x+dx,nextZ=member.z+dz;
   const clearCrew=(x,z)=>this.crew.every(other=>other===member||
    Math.hypot(x-other.x,z-other.z)>.59);
   if(this.canOccupy(nextX,nextZ,{ignoreCrew:true})&&clearCrew(nextX,nextZ)&&Math.hypot(nextX-this.x,nextZ-this.z)>.60){
    member.x=nextX;member.z=nextZ;member.moving=true;member.yaw=Math.atan2(dx,dz);
   }else{
    if(this.canOccupy(nextX,member.z,{ignoreCrew:true})&&clearCrew(nextX,member.z)&&Math.hypot(nextX-this.x,member.z-this.z)>.60){member.x=nextX;member.moving=true;}
    if(this.canOccupy(member.x,nextZ,{ignoreCrew:true})&&clearCrew(member.x,nextZ)&&Math.hypot(member.x-this.x,nextZ-this.z)>.60){member.z=nextZ;member.moving=true;}
   }
  }
 }
 setFollowing(id){
  const member=this.crew.find(m=>m.id===id);
  if(!member)return {ok:false,message:"乗員が見つかりません"};
  if(!member.following&&(this.seated||this.distance(member)>CREW_REACH||!this.canReachCrew(member)))
   return {ok:false,message:member.name+"の近くで追従を頼んでください"};
  member.following=!member.following;
  if(member.following){member.seated=false;member.seatLocked=false;this.routine.endIfParticipant?.(this,member.id);}
  member.returning=false;member.routineTarget=null;
  return {ok:true,message:member.name+(member.following?"が席を立ってついてきます":"はここで待機します"),following:member.following};
 }
 setCrewSeated(id,seated){
  const member=this.crew.find(c=>c.id===id);
  if(!member)return {ok:false,message:"乗員が見つかりません"};
  if(this.seated||this.distance(member)>CREW_REACH||!this.canReachCrew(member))
   return {ok:false,message:"乗員の近くで着席を指示してください"};
  if(!seated){
   this.routine.endIfParticipant?.(this,id);
   member.seated=false;member.returning=false;member.seatLocked=false;
   member.routineTarget=null;
   return {ok:true,message:member.name+"が席を立ちました"};
  }
  const home=SHIP_CREW.find(c=>c.id===id);
  member.following=false;member.seatLocked=true;
  member.routineTarget=null;this.routine.endIfParticipant?.(this,id);
  if(Math.hypot(member.x-home.x,member.z-home.z)>.42){
   member.seated=false;member.returning=true;
   return {ok:true,message:member.name+"が持ち場へ戻って着席します"};
  }
  member.x=home.x;member.z=home.z;member.yaw=home.yaw;
  member.seated=true;member.returning=false;
  return {ok:true,message:member.name+"が持ち場の席に座りました"};
 }
 socialAction(id,action,options={}){
  const member=this.crew.find(m=>m.id===id);
  if(!member)return {ok:false,message:"乗員が見つかりません"};
  if(this.seated||this.distance(member)>CREW_REACH||!this.canReachCrew(member))
   return {ok:false,message:member.name+"に近づいてください"};
  this.lastCrewId=id;
  return this.social.interact(id,action,options);
 }
 deepenRelationship(id,kind){
  const member=this.crew.find(m=>m.id===id);
  if(!member||this.seated||this.distance(member)>CREW_REACH||!this.canReachCrew(member))
   return {ok:false,message:"乗員に近づいてください"};
  return this.social.deepen(id,kind);
 }
 snapshot(){return {schemaVersion:2,x:this.x,z:this.z,yaw:this.yaw,pitch:this.pitch,mode:this.mode,
   lastCrewId:this.lastCrewId,seated:this.seated,suitOn:this.suitOn,hatchPassable:this.hatchPassable,
   crew:this.crew.map(c=>({id:c.id,x:c.x,z:c.z,yaw:c.yaw,following:c.following,seated:c.seated,returning:c.returning,seatLocked:c.seatLocked,
    routineTarget:c.routineTarget?{...c.routineTarget}:null})),social:this.social.snapshot(),routine:this.routine.snapshot()};}
 static fromSnapshot(data){return new ShipInterior([1,2].includes(data?.schemaVersion)?data:{});}
}
