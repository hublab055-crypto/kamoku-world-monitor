/**
 * Universal Engine - enterable hut logic.
 * Coordinate system: metres, +Z is the hut's front wall and doorway.
 * No browser/WebGL dependency; independently testable.
 */
export const HUT = Object.freeze({halfWidth:2.74,halfDepth:2.40,doorHalfWidth:.69,reach:3.1});
export function completedHut(b){return b?.kind==="hut"&&b.progress>=1&&Number.isFinite(b.x)&&Number.isFinite(b.z);}
export function hutDoor(b){return {x:b.x,z:b.z+HUT.halfDepth+.13};}
export function inHut(b,x,z,pad=0){
 return Math.abs(x-b.x)<HUT.halfWidth-pad&&Math.abs(z-b.z)<HUT.halfDepth-pad;
}
export function closestDoor(structures,x,z,maxDistance=HUT.reach){
 let best=null,dist=maxDistance;
 for(const b of structures||[]){
  if(!completedHut(b))continue;
  const p=hutDoor(b),d=Math.hypot(x-p.x,z-p.z);
  if(d<=dist){best=b;dist=d;}
 }
 return best;
}
function relocate(actor,x,z){
 actor.x=x;actor.z=z;
 const p=actor.locationAt(x,z);
 actor.lat=p.lat;actor.lon=p.lon;
 actor.clearMoveTarget();
 actor.blocked=false;actor.moving=false;
}
export class HutAccess{
 constructor(actions,{insideId=null}={}){
  this.actions=actions;this.insideId=insideId;this.pendingDoorId=null;
 }
 get inside(){return this.actions.structures.find(b=>completedHut(b)&&b.id===this.insideId)||null;}
 find(id){return this.actions.structures.find(b=>completedHut(b)&&b.id===id)||null;}
 nearby(actor){return closestDoor(this.actions.structures,actor.x,actor.z);}
 toggle(hut,actor){
  if(!completedHut(hut))return {ok:false,message:"完成した小屋を選んでください。"};
  if(hut.id!==this.insideId&&Math.hypot(actor.x-hut.x,actor.z-hut.z-HUT.halfDepth-.13)>HUT.reach)
   return {ok:false,message:"ドアにもう少し近づいてください。"};
  hut.doorOpen=!hut.doorOpen;
  return {ok:true,message:hut.doorOpen?"🚪 ドアを開けました。中に入れます。":"🚪 ドアを閉めました。"};
 }
 enter(hut,actor){
  if(!completedHut(hut))return {ok:false,message:"完成した小屋ではありません。"};
  if(!hut.doorOpen)return {ok:false,message:"先にドアを開けてください。"};
  if(Math.hypot(actor.x-hut.x,actor.z-hut.z-HUT.halfDepth-.13)>HUT.reach)
   return {ok:false,message:"入口まで近づいてください。"};
  relocate(actor,hut.x,hut.z+1.32);
  this.insideId=hut.id;this.pendingDoorId=null;
  return {ok:true,message:"🏠 小屋の中に入りました。"};
 }
 exit(actor){
  const hut=this.inside;
  if(!hut)return {ok:false,message:"屋内ではありません。"};
  if(!hut.doorOpen)return {ok:false,message:"ドアを開けてから外に出てください。"};
  relocate(actor,hut.x,hut.z+3.22);
  this.insideId=null;this.pendingDoorId=null;
  return {ok:true,message:"🌿 小屋の外に出ました。"};
 }
 /**
  * Resolve a finished ExplorerController.update() without changing terrain movement logic.
  * Blocks exterior walls, permits doorway crossings only while the door is open.
  */
 guard(previous,actor){
  const x=actor.x,z=actor.z;
  const restore=()=>{
   actor.x=previous.x;actor.z=previous.z;actor.lat=previous.lat;actor.lon=previous.lon;
   actor.blocked=true;actor.moving=false;actor.clearMoveTarget();
   return "blocked";
  };
  const hut=this.inside;
  if(hut){
   const rx=x-hut.x,rz=z-hut.z;
   if(Math.abs(rx)>HUT.halfWidth-.18||rz < -HUT.halfDepth+.18)return restore();
   if(rz>HUT.halfDepth-.17){
    if(Math.abs(rx)>HUT.doorHalfWidth||!hut.doorOpen)return restore();
    if(rz>HUT.halfDepth+.16){this.insideId=null;return "exit";}
   }
   return null;
  }
  for(const b of this.actions.structures){
   if(!completedHut(b)||!inHut(b,x,z,-.15))continue;
   const rx=x-b.x,rz=z-b.z,prevZ=previous.z-b.z;
   // Keep the open doorway corridor traversable before the player crosses the wall.
   if(b.doorOpen&&Math.abs(rx)<HUT.doorHalfWidth&&prevZ>=HUT.halfDepth-.3){
    if(rz<=HUT.halfDepth-.17){
     this.insideId=b.id;this.pendingDoorId=null;return "enter";
    }
    continue;
   }
   return restore();
  }
  return null;
 }
 snapshot(){return {schemaVersion:1,insideId:this.insideId};}
}
