/**
 * Quest MR single-headset avatar presence. Positions are real-world XR meters.
 * Deliberately session-only: a changing tracking origin must never be persisted
 * as a Planet Explorer world coordinate.
 */
export const MR_AVATAR_IDS=Object.freeze(["navigator","engineer","companion","player"]);
export const MR_AVATAR_NAMES=Object.freeze({navigator:"副官",engineer:"機関士",companion:"同行者",player:"自分のアバター"});
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const safeHead=head=>head&&head.length===16&&[8,10,12,13,14].every(i=>finite(head[i]));
export function mrAvatarPlacement(head,{floorY=0,hit=null,distance=1.8,lateral=0}={}){
 if(!safeHead(head))return null;
 const size=Math.hypot(head[8],head[10])||1;
 const fx=-head[8]/size,fz=-head[10]/size;
 let x=head[12]+fx*distance-fz*lateral;
 let z=head[14]+fz*distance+fx*lateral;
 // Accept only near-floor hits within arm's-length to 4m, rejecting walls.
 if(hit?.length===16&&finite(hit[12])&&finite(hit[13])&&finite(hit[14])&&
  Math.abs(hit[13]-floorY)<.30&&Math.hypot(hit[12]-head[12],hit[14]-head[14])>.65&&
  Math.hypot(hit[12]-head[12],hit[14]-head[14])<4.5){
  x=hit[12];z=hit[14];
 }
 return {x,z,y:floorY,yaw:Math.atan2(head[12]-x,head[14]-z)};
}
export class MRAvatarPresence {
 constructor(maxActors=4){this.actors=[];this.maxActors=maxActors;}
 reset(){this.actors.length=0;}
 get(id){return this.actors.find(actor=>actor.id===id)||null;}
 place(id,head,{floorY=0,hit=null,size=1}={}){
  if(!MR_AVATAR_IDS.includes(id))return {ok:false,message:"この人物は選べません"};
  if(!finite(size)||size<.25||size>2)return {ok:false,message:"大きさが正しくありません"};
  const placement=mrAvatarPlacement(head,{floorY,hit});
  if(!placement)return {ok:false,message:"頭部位置を取得できません"};
  let actor=this.get(id);
  if(!actor){
   if(this.actors.length>=this.maxActors)return {ok:false,message:"同時表示は最大"+this.maxActors+"人です"};
   actor={id,x:0,z:0,y:0,yaw:0,size,follow:false,motion:"idle",time:null,gestureDuration:0};
   this.actors.push(actor);
  }
  Object.assign(actor,placement,{size,follow:false,motion:"idle",time:null,gestureDuration:0});
  return {ok:true,actor,message:MR_AVATAR_NAMES[id]+"を床に配置しました"};
 }
 remove(id){const idx=this.actors.findIndex(actor=>actor.id===id);if(idx<0)return false;this.actors.splice(idx,1);return true;}
 action(id,type){
  const a=this.get(id);if(!a)return {ok:false,message:"先にアバターを召喚してください"};
  if(type==="follow"){a.follow=true;a.motion="idle";a.time=null;return {ok:true,message:"ついてくる"};}
  if(type==="wait"){a.follow=false;a.motion="idle";a.time=null;return {ok:true,message:"待機"};}
  if(type==="sit"){a.follow=false;a.motion="Seated";a.time=null;return {ok:true,message:"着席（演出）"};}
  if(type==="stand"){a.follow=false;a.motion="idle";a.time=null;return {ok:true,message:"立つ"};}
  if(type==="salute"||type==="thumbsUp"){
   a.follow=false;a.motion=type;a.time=0;a.gestureDuration=type==="salute"?2.2:2;
   return {ok:true,message:type==="salute"?"敬礼":"グッドサイン"};
  }
  return {ok:false,message:"未対応の動作です"};
 }
 tick(head,dt){
  const available=safeHead(head);
  const elapsed=Math.min(.09,Math.max(0,finite(dt)?dt:0));
  for(const a of this.actors){
   if(a.time!==null){
    a.time+=elapsed;
    if(a.time>=a.gestureDuration){a.time=null;a.motion="idle";}
   }
   if(!available)continue;
   const dx=head[12]-a.x,dz=head[14]-a.z,d=Math.hypot(dx,dz);
   if(d>.001)a.yaw=Math.atan2(dx,dz);
   if(a.follow&&d>1.55){
    const stride=Math.min(Math.max(0,d-1.55),elapsed*.8);
    a.x+=dx/d*stride;a.z+=dz/d*stride;
    a.motion="walk";
   }else if(a.follow)a.motion="idle";
  }
  return this.actors;
 }
}
