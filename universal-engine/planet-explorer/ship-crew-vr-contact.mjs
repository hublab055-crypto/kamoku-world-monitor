/** Pure WebXR-space contact test. GLB crew positions use ship-local metres.
 * stage converts ship-local points into the same reference space as Quest
 * grip poses. Never infer a contact from an untracked/missing controller.
 */
const pos=m=>m?.length>=16&&[12,13,14].every(i=>Number.isFinite(m[i]))?[m[12],m[13],m[14]]:null;
const transform=(m,p)=>m?.length>=16?[
 m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
 m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
 m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]
]:null;
const distance=(a,b)=>a&&b?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]):Infinity;
function limb(member,yaw,side,height,forward){
 const sign=side==="left"?1:-1; // V10 local +X is left side
 const x=sign*(height>1.3?.255:.15),z=forward;
 return [member.x+Math.cos(yaw)*x+Math.sin(yaw)*z,height,
  member.z-Math.sin(yaw)*x+Math.cos(yaw)*z];
}
export function detectShipCrewTouch({interior,stage,handPoses={},gripsHeld=new Set()}={}){
 if(!interior||interior.seated||interior.greetings?.pair||!stage||gripsHeld.size===0)return null;
 const hands=Object.fromEntries(["left","right"].map(side=>[side,pos(handPoses[side])]));
 if(!hands.left&&!hands.right)return null;
 const actors=interior.greetings?.actors(interior)||[];
 for(const member of actors.filter(actor=>actor.id!=="player")){
  const crew=interior.greetings.crew.find(m=>m.id===member.id);
  if(!crew||!interior.canReachCrew(crew))continue;
  const d=interior.distance(crew);
  if(d<=1.55&&gripsHeld.has("left")&&gripsHeld.has("right")){
   const a=transform(stage,limb(member,member.yaw,"left",1.44,.025));
   const b=transform(stage,limb(member,member.yaw,"right",1.44,.025));
   if(distance(hands.left,a)<.44&&distance(hands.right,b)<.44)
    return {id:member.id,action:"hug"};
  }
  if(d<=1.85){
   for(const side of ["left","right"]){
    if(!gripsHeld.has(side)||!hands[side])continue;
    const target=transform(stage,limb(member,member.yaw,side,1.16,.32));
    if(distance(hands[side],target)<.38)
     return {id:member.id,action:"handshake",hand:side};
   }
  }
 }
 return null;
}
