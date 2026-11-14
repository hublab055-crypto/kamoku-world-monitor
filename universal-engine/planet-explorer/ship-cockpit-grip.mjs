import {COCKPIT_LEVER,COCKPIT_STICK} from "./ship-control-hit.mjs?v=20261114-armrest-holograms";
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const column=(m,i)=>[m[i*4],m[i*4+1],m[i*4+2]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const finiteMatrix=m=>Boolean(m&&m.length===16&&Array.from(m).every(Number.isFinite));
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
export const COCKPIT_GRIP_REACH_M=.32;
const POSITION={left:COCKPIT_LEVER,right:COCKPIT_STICK};
export function cockpitGripTarget(stage,hand){
 if(!finiteMatrix(stage)||!POSITION[hand])return null;
 const [x,y,z]=POSITION[hand];
 return [0,1,2].map(i=>stage[i]*x+stage[i+4]*y+stage[i+8]*z+stage[i+12]);
}
export function canGrabCockpitControl({voyage,hand,grip,stage,reach=COCKPIT_GRIP_REACH_M}={}){
 if(!voyage?.active||!voyage?.seated||!finiteMatrix(grip))return false;
 const target=cockpitGripTarget(stage,hand);
 return Boolean(target&&Math.hypot(...target.map((v,i)=>v-grip[12+i]))<=reach);
}
export function beginCockpitGrip(previous,{voyage,hand,grip,stage}={}){
 if(!canGrabCockpitControl({voyage,hand,grip,stage}))return previous||{};
 return {...previous,[hand]:{
  position:[grip[12],grip[13],grip[14]],
  throttle:voyage.throttle||0,
  stageAxes:{x:unit(column(stage,0)),z:unit(column(stage,2))}
 }};
}
export function endCockpitGrip(previous,hand){
 if(!previous?.[hand])return previous||{};
 const next={...previous};delete next[hand];return next;
}
function deadzone(x,threshold=.035){return Math.abs(x)<threshold?0:Math.sign(x)*(Math.abs(x)-threshold)/(1-threshold);}
/** Uses real grip translation in vessel axes; calling code must supply current fresh pose.
 * Lost tracking/release returns neutral steer immediately (no ghost movement).
 */
export function updateCockpitGrip(previous,{voyage,poses,dt}={}){
 if(!voyage?.active||!voyage.seated)return {held:{},deflection:{yaw:0,pitch:0,throttle:0}};
 const held={...previous},deflection={yaw:0,pitch:0,throttle:0};
 const time=clamp(Number.isFinite(dt)?dt:0,0,.1);
 for(const hand of ["left","right"]){
  const start=held[hand],pose=poses?.[hand];
  if(!start)continue;
  if(!finiteMatrix(pose)){delete held[hand];continue;}
  const delta=[pose[12],pose[13],pose[14]].map((v,i)=>v-start.position[i]);
  if(hand==="left"){
   // Push the left lever forward (ship-local -Z) to increase thrust.
   const travel=clamp(-dot(delta,start.stageAxes.z),-.26,.26);
   const next=clamp(start.throttle+deadzone(travel,.012)*2.5,-1,1);
   if(Math.abs(next-voyage.throttle)>.005){
    voyage.setThrottle(next);voyage.setAutopilot(false);
   }
   deflection.throttle=travel/.26;
  }else{
   const lateral=clamp(dot(delta,start.stageAxes.x),-.20,.20);
   const foreaft=clamp(dot(delta,start.stageAxes.z),-.20,.20);
   const x=deadzone(lateral,.018)/.20,z=deadzone(foreaft,.018)/.20;
   deflection.yaw=clamp(x,-1,1);deflection.pitch=clamp(z,-1,1);
   if(time&&(deflection.yaw||deflection.pitch)){
    voyage.setAutopilot(false);
    // ±45 deg/s yaw and ±32 deg/s pitch at full stick displacement.
    voyage.steer(deflection.yaw*45*time);
    voyage.pitch(deflection.pitch*32*time);
   }
  }
 }
 return {held,deflection};
}
