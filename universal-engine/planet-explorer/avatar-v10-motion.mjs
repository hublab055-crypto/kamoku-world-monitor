import {crewPhase} from "./ship-crew-greetings.mjs?v=1";

const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const mul=(v,n)=>v.map(x=>x*n);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
const identity=[0,0,0,1];
const yAxis=[0,1,0],down=[0,-1,0],front=[0,0,1];
const combine=(a,b)=>{
 const u=a.slice(0,3),v=b.slice(0,3);
 return [...add(add(mul(v,a[3]),mul(u,b[3])),cross(u,v)),a[3]*b[3]-dot(u,v)];
};
function rotate(v,q){
 const u=q.slice(0,3),t=mul(cross(u,v),2);
 return add(v,add(mul(t,q[3]),cross(u,t)));
}
function angle(axis,value){
 return [...mul(axis,Math.sin(value/2)),Math.cos(value/2)];
}
function aim(from,to){
 const a=norm(from),b=norm(to),d=dot(a,b);
 if(d<-.99999)return angle(norm(cross(a,Math.abs(a[1])>.85?[1,0,0]:yAxis)),Math.PI);
 return norm([...cross(a,b),1+d]);
}
function mix(a,b,weight){
 const end=dot(a,b)<0?mul(b,-1):b;
 return norm(a.map((x,i)=>x+(end[i]-x)*weight));
}
function orientation(direction,up){
 const finger=norm(direction),base=aim(down,finger);
 const side=rotate(front,base),reference=norm(sub(up,mul(finger,dot(up,finger))));
 const theta=Math.atan2(dot(finger,cross(side,reference)),dot(side,reference));
 return combine(angle(finger,theta),base);
}

function jointWorld(pose,parents,index) {
 const bone=pose[index],parent=parents[index];
 if(parent<0)return {p:bone.translation,q:bone.rotation};
 const world=jointWorld(pose,parents,parent);
 return {p:add(world.p,rotate(bone.translation,world.q)),q:combine(world.q,bone.rotation)};
}

function poseArm(rig,pose,side,goal,handRotation,bend,weight,fingers,thumbDirection=null) {
 if(weight<=0)return;
 const index=rig.jointsByName;
 const upper=index.get("UpperArm_"+side),lower=index.get("LowerArm_"+side),hand=index.get("Hand_"+side);
 if([upper,lower,hand].some(i=>i===undefined))return;
 const parent=jointWorld(pose,rig.parents,rig.parents[upper]);
 const shoulder=jointWorld(pose,rig.parents,upper);
 const arm=pose[lower].translation,forearm=pose[hand].translation;
 const armLength=Math.hypot(...arm),forearmLength=Math.hypot(...forearm);
 const delta=sub(goal,shoulder.p),axis=norm(delta);
 const distance=Math.min(armLength+forearmLength-.002,Math.max(.025,Math.abs(armLength-forearmLength)+.002,Math.hypot(...delta)));
 const pole=norm(sub(bend,mul(axis,dot(bend,axis))));
 const reach=(armLength**2-forearmLength**2+distance**2)/(2*distance);
 const elbow=add(mul(axis,reach),mul(pole,Math.sqrt(Math.max(0,armLength**2-reach**2))));
 const upperWorld=combine(aim(rotate(arm,shoulder.q),elbow),shoulder.q);
 const lowBase=combine(upperWorld,pose[lower].rotation);
 const lowerWorld=combine(aim(rotate(forearm,lowBase),sub(mul(axis,distance),elbow)),lowBase);
 pose[upper].rotation=mix(pose[upper].rotation,combine(inverse(parent.q),upperWorld),weight);
 pose[lower].rotation=mix(pose[lower].rotation,combine(inverse(upperWorld),lowerWorld),weight);
 pose[hand].rotation=mix(pose[hand].rotation,combine(inverse(lowerWorld),handRotation),weight);
 const sign=side==="L"?1:-1;
 for(const name of ["Index","Middle","Ring","Pinky"]){
  for(const [segment,gain] of [[1,.82],[2,1],[3,.64]]){
   const finger=pose[index.get(name+segment+"_"+side)];
   if(finger)finger.rotation=mix(finger.rotation,angle(front,-sign*fingers*gain),weight);
  }
 }
 const palm=pose[index.get("PalmFlex_"+side)],thumb=pose[index.get("Thumb_"+side)],thumbTip=pose[index.get("ThumbTip_"+side)];
 if(palm)palm.rotation=mix(palm.rotation,identity,weight);
 if(thumb){
  const bone=pose[index.get("ThumbTip_"+side)];
  const thumbPose=thumbDirection&&bone?aim(bone.translation,rotate(thumbDirection,inverse(handRotation))):angle([1,0,0],.10);
  thumb.rotation=mix(thumb.rotation,thumbPose,weight);
 }
 if(thumbTip)thumbTip.rotation=mix(thumbTip.rotation,identity,weight);
}

export function poseAvatarV10Gesture(rig,pose,{motion,time,grip,yaw=0,x=0,z=0}) {
 const names=rig.jointsByName;
 const head=names.get("Head"),hips=names.get("Hips"),chest=names.get("Chest");
 if(head===undefined||hips===undefined||chest===undefined)return;
 const native=point=>point.map((v,i)=>v/rig.scale+rig.center[i]);
 const place=(world)=>{
  const dx=world[0]-x,dz=world[2]-z;
  return native([dx*Math.cos(yaw)-dz*Math.sin(yaw),world[1],dx*Math.sin(yaw)+dz*Math.cos(yaw)]);
 };
 const arm=(side,goal,finger,palm,weight,curl,bend,thumbDirection=null)=>
  poseArm(rig,pose,side,goal,orientation(finger,palm),bend,weight,curl,thumbDirection);
 const envelope=(on,ready,release,end)=>crewPhase(time,on,ready)*(1-crewPhase(time,release,end));
 if(motion==="salute"){
  const formal=envelope(0,.30,1.93,2.20);
  for(const i of [hips,chest,head])pose[i].rotation=mix(pose[i].rotation,identity,formal*.94);
  for(const side of ["L","R"]){
   const sign=side==="L"?1:-1;
   arm(side,native([sign*.239,.855,.025]),down,front,formal,.07,[sign,-1,0]);
  }
  const salute=envelope(.40,.92,1.55,1.92);
  const temple=jointWorld(pose,rig.parents,head).p;
  arm("R",add(temple,[-.157,.033,.118]),[.86,.13,.17],[.09,-1,0],salute,.02,[-.95,-.35,.19]);
 }else if(motion==="handshake"&&grip){
  const weight=envelope(.18,.72,1.95,2.63);
  const hand=orientation([.39,-.12,1],[.92,.06,-.36]);
  const anchor=rig.nodes[names.get("Review_grip_R")]?.translation||[0,-.052,0];
  const goal=sub(place(grip),rotate(anchor,hand));
  poseArm(rig,pose,"R",goal,hand,[-.68,-1,.15],weight,.53);
 }else if(motion==="hug"){
  const weight=envelope(.13,.79,1.88,2.74);
  pose[chest].rotation=mix(pose[chest].rotation,angle([1,0,0],.10),weight);
  pose[head].rotation=mix(pose[head].rotation,combine(angle(yAxis,.12),angle(front,.18)),weight);
  for(const side of ["L","R"]){
   const sign=side==="L"?1:-1;
   arm(side,native([sign*(.278+.18*(1-weight)),side==="R"?1.38:1.18,.45+.13*weight]),
    [-sign,.08,.42],[0,.9,-.3],weight,.26,[sign*.95,-.25,0]);
  }
 }else if(motion==="thumbsUp"||motion==="doubleThumbs"){
  const weight=envelope(.05,.53,1.53,motion==="thumbsUp"?2.0:2.15);
  for(const side of motion==="doubleThumbs"?["R","L"]:["R"]){
   const sign=side==="L"?1:-1;
   arm(side,native([sign*.285,1.30+.027*Math.sin(time*9)*weight,.267]),
    [-sign*.24,-.13,1],[sign,0,.17],weight,1.35,[sign*.5,-1,.12],[0,1,.04]);
  }
 }
}
