/**
 * v0.9am — relative ship maneuver dynamics, independent of the route clock.
 * This is an attitude / local-thruster layer on top of the existing guided
 * transfer path, NOT a two-body orbital mechanics solver.
 */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=Number.isFinite;
const DEG=Math.PI/180;
const axes=["yaw","pitch","roll"];
const eps=1e-12;
export const DYNAMICS_KEYS=[
 "yaw","pitch","roll","yawRate","pitchRate","rollRate",
 "rightM","upM","backM","rightMps","upMps","backMps"
];
export const emptyShipDynamics=()=>Object.fromEntries(DYNAMICS_KEYS.map(key=>[key,0]));
export function restoreShipDynamics(value){
 const state=emptyShipDynamics();
 if(value&&typeof value==="object"){
  for(const key of DYNAMICS_KEYS){
   const n=value[key];
   if(finite(n))state[key]=clamp(n,-2e6,2e6);
  }
 }
 for(const a of axes){
  state[a]=clamp(state[a],-Math.PI,Math.PI);
  state[a+"Rate"]=clamp(state[a+"Rate"],-2,2);
 }
 for(const key of ["rightM","upM","backM"])state[key]=clamp(state[key],-50000,50000);
 for(const key of ["rightMps","upMps","backMps"])state[key]=clamp(state[key],-250,250);
 return state;
}
export function maneuverSpeedMps(state){
 return Math.hypot(state.rightMps,state.upMps,state.backMps);
}
export function advanceShipDynamics(state,{
 dt=0,status="docked",autopilot=true,heading=0,pitchCommand=0,rollCommand=0,
 throttle=0,fuel=0
}={}){
 if(!finite(dt)||dt<0)throw new RangeError("Invalid dynamics clock");
 const result=restoreShipDynamics(state);
 if(["docked","landed"].includes(status))return emptyShipDynamics();
 const s=clamp(dt,0,.12);
 if(s===0)return result;
 const targets={
  yaw:autopilot?0:clamp(heading,-60,60)*DEG,
  pitch:autopilot?0:clamp(pitchCommand,-35,35)*DEG,
  roll:autopilot?0:clamp(rollCommand,-45,45)*DEG
 };
 // Damped PD-controller: rotation continues briefly after input stops.
 // Sub-stepping keeps the result stable under 30/60/90-Hz rendering.
 const pieces=Math.max(1,Math.ceil(s/.016)),h=s/pieces;
 for(let j=0;j<pieces;j++){
  for(const axis of axes){
   const rateKey=axis+"Rate",limit=axis==="yaw"?1.3:axis==="pitch"?.95:1.5;
   const acceleration=(targets[axis]-result[axis])*7.5-result[rateKey]*5.8;
   result[rateKey]=clamp(result[rateKey]+acceleration*h,-limit,limit);
   result[axis]+=result[rateKey]*h;
   if(Math.abs(result[axis])<eps&&Math.abs(result[rateKey])<eps){result[axis]=0;result[rateKey]=0;}
  }
  const active=["ascent","origin-orbit","cruise","approach","orbit","entry"].includes(status);
  if(!active)continue;
  const thrust=active&&fuel>0?clamp(throttle,0,1)*4.8:0; // m/s² local maneuver thrusters
  const yaw=result.yaw,pitch=result.pitch;
  const directionRight=Math.sin(yaw)*Math.cos(pitch);
  const directionBack=-Math.cos(yaw)*Math.cos(pitch);
  const directionUp=Math.sin(pitch);
  // 0.12/s linear damping avoids indefinite drift in this assisted-flight mode.
  const drag=Math.exp(-.12*h);
  result.rightMps=clamp((result.rightMps+directionRight*thrust*h)*drag,-250,250);
  result.backMps=clamp((result.backMps+directionBack*thrust*h)*drag,-250,250);
  result.upMps=clamp((result.upMps+directionUp*thrust*h)*drag,-250,250);
  result.rightM=clamp(result.rightM+result.rightMps*h,-50000,50000);
  result.backM=clamp(result.backM+result.backMps*h,-50000,50000);
  result.upM=clamp(result.upM+result.upMps*h,-50000,50000);
 }
 return result;
}
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const scale=(v,k)=>v.map(n=>n*k);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const m=Math.hypot(...v);return m?scale(v,1/m):v;};
const blend=(a,b,u)=>add(scale(a,1-u),scale(b,u));
/** Continuous supervised offset goes to zero at the target pad.
 * The baseline space/ground route is left unchanged for legacy save recovery.
 */
export function shipDynamicsWeight(v){
 if(["docked","landed","touchdown"].includes(v.status))return 0;
 if(v.status==="entry"){
  const t=clamp(v.stageProgress||0,0,1);
  return (1-t)*(1-t)*(1+2*t);
 }
 return 1;
}
export function applyShipDynamics(frame,v){
 const d=v?.flightDynamics;
 if(!frame||!d)return frame;
 const weight=shipDynamicsWeight(v);
 if(weight<=0)return {...frame,maneuverSpeedMps:0};
 // Orient around the nominal flight frame, preserving orthonormality and handedness.
 const yaw=d.yaw||0,pitch=d.pitch||0,roll=d.roll||0;
 const c=Math.cos(yaw),s=Math.sin(yaw);
 let right=blend(scale(frame.right,c),frame.back,-s);
 let back=blend(scale(frame.right,s),frame.back,c),up=[...frame.up];
 // Pitch: positive pitch raises the nose (-back vector).
 const cp=Math.cos(pitch),sp=Math.sin(pitch);
 const ppUp=add(scale(up,cp),scale(back,sp));
 back=add(scale(back,cp),scale(up,-sp));up=ppUp;
 // Roll: positive banks right.
 const cr=Math.cos(roll),sr=Math.sin(roll);
 const rr=add(scale(right,cr),scale(up,sr));
 up=add(scale(up,cr),scale(right,-sr));right=rr;
 // The underlying route frame may be numerically approximate: reorthogonalize.
 right=norm(right);up=norm(up);back=norm(cross(right,up));
 const offset=add(add(scale(frame.right,(d.rightM||0)*weight),
  scale(frame.up,(d.upM||0)*weight)),scale(frame.back,(d.backM||0)*weight));
 const position=add(frame.position,offset);
 return {...frame,position,right,up,back,
  // Offset is local maneuver velocity, not absolute heliocentric or orbital speed.
  maneuverSpeedMps:maneuverSpeedMps(d),
  flightAttitude:{yawRad:yaw,pitchRad:pitch,rollRad:roll},
  maneuverOffsetM:[(d.rightM||0)*weight,(d.upM||0)*weight,(d.backM||0)*weight]
 };
}
