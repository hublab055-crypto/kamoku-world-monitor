/**
 * MR actors in WebXR local coordinates. Up to 8 independently moving display
 * slots; guests reference one of the four existing saved V10 appearances.
 */
import {MR_STAND_POSES,MR_SEAT_POSES} from "./mr-room-layout.mjs";
export const MR_AVATAR_IDS=Object.freeze(["navigator","engineer","companion","player","guest1","guest2","guest3","guest4"]);
export const MR_AVATAR_NAMES=Object.freeze({navigator:"副官",engineer:"機関士",companion:"同行者",player:"自分のアバター",guest1:"招待枠 1",guest2:"招待枠 2",guest3:"招待枠 3",guest4:"招待枠 4"});
export const MR_AVATAR_SOURCE_IDS=Object.freeze({navigator:"navigator",engineer:"engineer",companion:"companion",player:"player",guest1:"navigator",guest2:"engineer",guest3:"companion",guest4:"player"});
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const safeHead=head=>head&&head.length===16&&[8,10,12,13,14].every(i=>finite(head[i]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function mrAvatarPlacement(head,{floorY=0,hit=null,distance=1.8,lateral=0}={}){
 if(!safeHead(head))return null;
 const size=Math.hypot(head[8],head[10])||1;
 const fx=-head[8]/size,fz=-head[10]/size;
 let x=head[12]+fx*distance-fz*lateral,z=head[14]+fz*distance+fx*lateral;
 if(hit?.length===16&&finite(hit[12])&&finite(hit[13])&&finite(hit[14])&&
  Math.abs(hit[13]-floorY)<.30&&Math.hypot(hit[12]-head[12],hit[14]-head[14])>.65&&
  Math.hypot(hit[12]-head[12],hit[14]-head[14])<4.5){
  x=hit[12];z=hit[14];
 }
 return {x,z,y:floorY,yaw:Math.atan2(head[12]-x,head[14]-z)};
}
export class MRAvatarPresence {
 constructor(maxActors=8){this.actors=[];this.maxActors=Math.max(1,Math.min(8,maxActors));this.elapsed=0;}
 reset(){this.actors.length=0;this.elapsed=0;}
 get(id){return this.actors.find(actor=>actor.id===id)||null;}
 place(id,head,{floorY=0,hit=null,size=1,room=null}={}){
  if(!MR_AVATAR_IDS.includes(id))return {ok:false,message:"この人物は選べません"};
  if(!finite(size)||size<.25||size>2)return {ok:false,message:"大きさが正しくありません"};
  const placement=mrAvatarPlacement(head,{floorY,hit});
  if(!placement)return {ok:false,message:"頭部位置を取得できません"};
  if(room?.ready&&!room.free(placement.x,placement.z,.23))
   return {ok:false,message:"壁や家具に近すぎます。空いた床を指定してください"};
  let actor=this.get(id);
  if(!actor){
   if(this.actors.length>=this.maxActors)return {ok:false,message:"同時表示は最大"+this.maxActors+"人です"};
   actor={id,sourceId:MR_AVATAR_SOURCE_IDS[id],x:0,z:0,y:0,yaw:0,size,follow:false,roam:false,
    motion:"idle",time:null,gestureDuration:0,goal:null,seatId:null,invited:false,
    seatSurface:null,seatPose:null,standingPose:"stand_neutral",affinity:0};
   this.actors.push(actor);
  }
  Object.assign(actor,placement,{size,follow:false,roam:false,motion:"idle",time:null,gestureDuration:0,goal:null,seatId:null,seatPose:null,seatSurface:null});
  return {ok:true,actor,message:MR_AVATAR_NAMES[id]+"を床に配置しました"};
 }
 remove(id){const i=this.actors.findIndex(a=>a.id===id);if(i<0)return false;this.actors.splice(i,1);return true;}
 setPose(id,pose){
  const a=this.get(id);if(!a)return {ok:false,message:"アバターがいません"};
  if(a.seatId){
   if(!MR_SEAT_POSES[a.seatSurface]?.includes(pose))return {ok:false,message:"この座布団に対応しない姿勢です"};
   a.seatPose=pose;return {ok:true,message:"座りポーズを "+pose+" に変更"};
  }
  if(!MR_STAND_POSES.includes(pose))return {ok:false,message:"この立ちポーズには対応していません"};
  a.standingPose=pose;return {ok:true,message:"立ちポーズを "+pose+" に変更"};
 }

 action(id,type,{room=null,head=null}={}){
  const a=this.get(id);if(!a)return {ok:false,message:"先にアバターを召喚してください"};
  if(type==="follow"){a.follow=true;a.roam=false;a.goal=null;a.seatId=null;a.seatPose=null;a.seatSurface=null;a.y=0;a.motion="idle";a.time=null;return {ok:true,message:"ついてくる"};}
  if(type==="wait"){a.follow=false;a.roam=false;a.goal=null;a.motion="idle";a.time=null;return {ok:true,message:"待機"};}
  if(type==="wander"){
   if(!room?.ready)return {ok:false,message:"最初に部屋の基準点・広さを登録してください"};
   a.follow=false;a.roam=true;a.seatId=null;a.seatPose=null;a.seatSurface=null;a.goal=null;a.y=0;a.time=null;
   return {ok:true,message:"登録済みの空いた床を散歩します"};
  }
  if(type==="sit"){
   const chair=room?.ready?room.seatWorld().filter(seat=>!this.actors.some(other=>other.id!==a.id&&other.seatId===seat.id)).sort((x,y)=>Math.hypot(x.x-a.x,x.z-a.z)-Math.hypot(y.x-a.x,y.z-a.z))[0]:null;
   if(!chair)return {ok:false,message:"空いている座布団を床・椅子・ソファに配置してください"};
   a.follow=false;a.roam=false;a.goal={x:chair.x,z:chair.z};a.seatId=chair.id;a.seatYaw=chair.yaw;a.seatY=chair.seatY;
   a.seatPose=chair.pose;a.seatSurface=chair.surface;
   a.motion="walk";a.time=null;
   return {ok:true,message:"座布団へ向かいます（"+chair.surface+" / "+chair.pose+"）"};
  }
  if(type==="stand"){a.follow=false;a.roam=false;a.goal=null;a.motion="idle";a.time=null;a.seatId=null;a.seatPose=null;a.seatSurface=null;a.y=0;return {ok:true,message:"立つ"};}
  if(type==="invite"){a.invited=true;return {ok:true,message:"境界扉を通る仲間に登録しました"};}
  const motions={salute:["敬礼",2.2],thumbsUp:["グッドサイン",2],doubleThumbs:["両手でグッドサイン",2.2],
   wave:["手を振る",2.5],bow:["お辞儀",2.4]};
  const entry=motions[type];
  if(entry){a.follow=false;a.roam=false;a.goal=null;a.motion=type;a.time=0;a.gestureDuration=entry[1];
   return {ok:true,message:entry[0]};}
  return {ok:false,message:"未対応の動作です"};
 }
 /** World-space movement with obstacle tests. No silent movement without a
  * known room: user safety is more important than plausible NPC behavior. */
 tick(head,dt,room=null){
  const elapsed=clamp(finite(dt)?dt:0,0,.09);
  this.elapsed+=elapsed;
  for(const a of this.actors){
   if(a.time!==null){a.time+=elapsed;if(a.time>=a.gestureDuration){a.time=null;a.motion="idle";}}
   const canRoom=Boolean(room?.ready);
   if(a.seatId&&!room?.seatWorld?.().some(seat=>seat.id===a.seatId)){
    a.seatId=null;a.seatPose=null;a.seatSurface=null;a.goal=null;a.motion="idle";a.y=0;
   }
   if(a.roam&&canRoom&&!a.goal){
    for(let j=0;j<16;j++){
     const seed=this.elapsed*1.618+MR_AVATAR_IDS.indexOf(a.id)*8.27+j*1.19;
     const test=room.world({x:Math.sin(seed*4.1)*(room.width/2-.55),
      z:Math.cos(seed*2.7)*(room.depth/2-.55)});
     if(test&&room.free(test.x,test.z,.32)){a.goal={x:test.x,z:test.z};break;}
    }
   }
   let target=null;
   if(a.follow&&safeHead(head))target={x:head[12],z:head[14],stop:1.55};
   else if(a.goal)target={...a.goal,stop:a.seatId?.08:.24};
   if(!target)continue;
   const dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz);
   if(d<=(target.stop||0.24)+.02){
    if(a.seatId){
     a.x=target.x;a.z=target.z;a.y=0;a.yaw=a.seatYaw||0;a.motion="Seated";a.goal=null;
    }else if(a.goal){a.goal=null;a.motion="idle";}
    else if(a.follow)a.motion="idle";
    continue;
   }
   const step=Math.min(d-(target.stop||0),elapsed*.8);
   if(step<=0)continue;
   const nx=a.x+dx/d*step,nz=a.z+dz/d*step;
   const free=(x,z)=>!canRoom||room.free(x,z,a.seatId?.04:.30,{seatId:a.seatId});
   if(free(nx,nz)){a.x=nx;a.z=nz;}
   else if(free(nx,a.z)){a.x=nx;}
   else if(free(a.x,nz)){a.z=nz;}
   else{a.motion="idle";if(a.roam)a.goal=null;continue;}
   a.yaw=Math.atan2(dx,dz);a.motion="walk";
  }
  return this.actors;
 }
}
