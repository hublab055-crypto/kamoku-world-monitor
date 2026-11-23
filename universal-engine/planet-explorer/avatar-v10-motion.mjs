import {crewPhase} from "./ship-crew-greetings.mjs?v=20261117-family-gestures";

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
 // A real seated posture on a registered zabuton, not the standing idle pose.
 // Bone names are resolved from the GLB rig; missing optional leg joints are tolerated.
 const posture={
  floor_legs_out:[.21,-1.36,.02,0,0,0],
  floor_crosslegged:[.25,-1.20,1.30,.32,.02,0],
  floor_seiza:[.23,-.12,2.15,.05,.03,0],
  floor_side_sit:[.22,-.82,1.72,.44,.06,0],
  floor_knees_up:[.26,-.80,1.82,.05,-.16,0],
  chair_upright:[.48,-1.32,1.42,0,0,0],
  chair_relaxed:[.45,-1.30,1.38,.04,.18,0],
  chair_ankles_crossed:[.47,-1.28,1.47,.12,.02,0],
  chair_edge:[.49,-1.10,1.30,0,-.12,0],
  sofa_relaxed:[.43,-1.30,1.46,.02,.20,0],
  sofa_upright:[.46,-1.22,1.42,0,0,0],
  sofa_sideways:[.44,-1.23,1.44,.20,.08,.17],
  sofa_legs_crossed:[.44,-1.20,1.50,.18,.06,0]
 };
 if(posture[motion]){
  const [defaultY,hipFlex,kneeFlex,splay,lean,twist]=posture[motion];
  const options=arguments[2]||{},seatY=Number.isFinite(options.seatY)?options.seatY:defaultY;
  const adjust=options.adjust||{},deg=value=>Math.max(-35,Math.min(35,Number(value)||0))*Math.PI/180;
  const target=native([0,Math.max(.12,Math.min(.85,seatY||defaultY)),0])[1];
  const current=jointWorld(pose,rig.parents,hips).p[1];
  pose[hips].translation[1]+=Math.max(-.55/rig.scale,Math.min(.18/rig.scale,target-current));
  const get=(name,alt)=>names.get(name)??names.get(alt);
  for(const [side,sign] of [["L",1],["R",-1]]){
   const top=get("UpperLeg_"+side,"Thigh_"+side)??get("LegUpper_"+side,"Hip_"+side);
   const knee=get("LowerLeg_"+side,"Shin_"+side)??get("LegLower_"+side,"Calf_"+side);
   if(top!==undefined){
    const spread=angle([0,0,1],sign*(splay+deg(adjust.hip)));
    pose[top].rotation=combine(spread,combine(angle([1,0,0],hipFlex),pose[top].rotation));
   }
   if(knee!==undefined)pose[knee].rotation=combine(angle([1,0,0],kneeFlex+deg(adjust.knee)),pose[knee].rotation);
  }
  pose[chest].rotation=combine(angle([1,0,0],lean+deg(adjust.back)),pose[chest].rotation);
  if(twist)pose[hips].rotation=combine(angle(yAxis,twist),pose[hips].rotation);
  return;
 }
 if(motion?.startsWith("stand_")){
  const options=arguments[2]||{},adjust=options.adjust||{},degrees=v=>Math.max(-35,Math.min(35,Number(v)||0))*Math.PI/180;
  if(motion==="stand_attention")pose[chest].rotation=mix(pose[chest].rotation,identity,.88);
  if(motion==="stand_weight_shift")pose[hips].rotation=combine(angle(front,.11),pose[hips].rotation);
  if(motion==="stand_hands_hips"){
   for(const side of ["L","R"]){
    const sign=side==="L"?1:-1;
    arm(side,native([sign*.20,.93,.10]),[0,-1,.05],[0,0,1],1,.23,[sign*.65,-1,.1]);
   }
  }
  if(motion==="stand_arms_crossed"){
   arm("L",native([-.1,1.19,.22]),[1,0,.08],[0,0,1],1,.18,[.5,-1,.25]);
   arm("R",native([.1,1.20,.24]),[-1,0,.08],[0,0,1],1,.18,[-.5,-1,.25]);
  }
  pose[chest].rotation=combine(angle([1,0,0],degrees(adjust.back)),pose[chest].rotation);
  return;
 }
 if(["drink","eat","read","rest","watchTV"].includes(motion)){
  if(motion==="drink"||motion==="eat"){
   const goal=jointWorld(pose,rig.parents,head).p;
   const w=.8+.15*Math.sin(time*2);
   arm("R",add(goal,[-.09,-.23,.17]),[0,1,.2],[0,0,1],w,.24,[-.5,-1,.4]);
  }else if(motion==="read"){
   arm("L",native([.18,.94,.36]),[0,-1,.1],[0,0,1],.9,.26,[.6,-1,.25]);
   arm("R",native([-.14,.96,.36]),[0,-1,.1],[0,0,1],.9,.26,[-.6,-1,.25]);
   pose[head].rotation=combine(angle([1,0,0],.17),pose[head].rotation);
  }else if(motion==="rest")pose[chest].rotation=combine(angle([1,0,0],.12),pose[chest].rotation);
  else pose[head].rotation=combine(angle(yAxis,.04*Math.sin(time*.7)),pose[head].rotation);
  return;
 }
 if(motion==="wave"){
  const w=envelope(.05,.40,2.10,2.50),temple=jointWorld(pose,rig.parents,head).p;
  const sway=Math.sin(time*11)*.13;
  arm("R",add(temple,[.22+sway,.32,.12]),[.1,1,.2],[0,0,1],w,.08,[-.5,.85,0]);
  pose[head].rotation=mix(pose[head].rotation,angle(yAxis,-.08),w*.48);
 }else if(motion==="bow"){
  const w=envelope(.08,.62,1.55,2.32);
  pose[chest].rotation=mix(pose[chest].rotation,angle([1,0,0],.32),w);
  pose[head].rotation=mix(pose[head].rotation,angle([1,0,0],.17),w*.92);
 }else if(motion==="salute"){
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
 }else if(motion==="handhold"&&grip){
  // Both players extend their right hands to a shared contact point.
  const weight=envelope(.13,.63,1.82,2.59);
  const hand=orientation([.24,-.56,1],[.05,1,.15]);
  const anchor=rig.nodes[names.get("Review_grip_R")]?.translation||[0,-.052,0];
  const goal=sub(place(grip),rotate(anchor,hand));
  poseArm(rig,pose,"R",goal,hand,[-.48,-1,.18],weight,.19);
  pose[head].rotation=mix(pose[head].rotation,angle([1,0,0],.08),weight);
 }else if(motion==="kiss"){
  // A brief, non-explicit affectionate pose; no intimate contact simulation.
  const weight=envelope(.18,.66,1.67,2.38);
  pose[chest].rotation=mix(pose[chest].rotation,angle([1,0,0],.075),weight);
  pose[head].rotation=mix(pose[head].rotation,
   combine(angle([1,0,0],.11),angle([0,0,1],.11)),weight);
  for(const side of ["L","R"]){
   const sign=side==="L"?1:-1;
   arm(side,native([sign*.25,1.17,.30]),[-sign*.18,-.10,.92],[0,1,-.12],
    weight*.80,.12,[sign*.78,-.45,0]);
  }
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

/** Applies recorded HMD + controller poses to a real V10 skinned skeleton.
 * User height calibrates against the initial HMD; missing controllers fall
 * back to the original idle animation. Legs/feet are never claimed tracked.
 * A yaw-aligned replay requires no WebXR session or external assets.
 */
export function poseAvatarV10MotionActor(rig,pose,frame){
 if(!frame?.head?.p?.length||!frame?.first?.p?.length)return false;
 const index=rig.jointsByName,headID=index?.get("Head"),pelvisID=index?.get("Hips");
 if(headID===undefined||pelvisID===undefined)return false;
 const origin=frame.first.p;
 const metresPerBody=frame.floorTracked?clampActor(1.60/(origin[1]||1.60),.78,1.24):1;
 const normalized=raw=>[
  (raw[0]-origin[0])*metresPerBody,
  (frame.floorTracked?raw[1]*metresPerBody:1.58+(raw[1]-origin[1])),
  (origin[2]-raw[2])*metresPerBody
 ];
 const native=raw=>normalized(raw).map((v,i)=>v/rig.scale+rig.center[i]);
 const mirrorQuat=q=>norm([-q[0],-q[1],q[2],q[3]]);
 pose[headID].rotation=mix(pose[headID].rotation,mirrorQuat(frame.head.q||identity),.78);
 // Approximate bobbing and crouching from HMD height. This is inferred
 // centre-of-mass motion, NOT knee or foot position sensing.
 if(frame.floorTracked){
  const dy=clampActor((frame.head.p[1]-origin[1])*metresPerBody,-.42,.18);
  pose[pelvisID].translation[1]+=dy*.55/rig.scale;
 }
 for(const [side,tracked] of [["L",frame.left],["R",frame.right]]){
  if(!tracked?.p?.length||!tracked?.q?.length)continue;
  const goal=native(tracked.p),rot=mirrorQuat(tracked.q);
  const bend=side==="L"?[.7,-1,.2]:[-.7,-1,.2];
  poseArm(rig,pose,side,goal,rot,bend,.94,.11);
 }
 return true;
}
function clampActor(n,a,b){return Math.max(a,Math.min(b,n));}
