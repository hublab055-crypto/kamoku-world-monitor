/**
 * Universal Engine v0.9an — opt-in heliocentric, SI-metre free flight.
 *
 * Inertial position / velocity are Float64 JS Numbers. The planet ephemeris
 * remains the project's deterministic circular/parented solar system.
 * Gravity, thrust and thin-atmosphere drag are numerical, not visual offsets.
 * Free flight is opt-in from a parking orbit, with supervised return to route.
 */
import {AU_M,STAR,BODIES,bodyById} from "./solar-system.mjs";
import {bodyCenterM} from "./unified-space-frame.mjs?v=1";
const secPerDay=86400;
const yearSeconds=365.25*secPerDay;
export const HELIOS_MU=4*Math.PI*Math.PI*AU_M**3/yearSeconds**2;
export const ALLOWED_WARPS=Object.freeze([1,10,100,1000]);
const finite=Number.isFinite,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,n)=>a.map(x=>x*n);
const length=v=>Math.hypot(...v);
const normalize=v=>mul(v,1/(length(v)||1));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const gravityMu=id=>{
 if(id===STAR.id)return HELIOS_MU;
 const b=bodyById(id);
 return b?.gravity&&b.radiusM?b.gravity*b.radiusM**2:0;
};
export function bodyVelocityMps(id,day){
 if(!finite(day))throw new RangeError("Invalid ephemeris day");
 const h=1/86400; // central difference, one second to each side
 return mul(sub(bodyCenterM(id,day+h),bodyCenterM(id,day-h)),1/(2*h*secPerDay));
}
export function nearestFlightBody(position,day){
 if(!Array.isArray(position)||position.length!==3||!position.every(finite)||!finite(day))
  throw new RangeError("Invalid flight position");
 let best=null;
 for(const body of BODIES){
  if(!(body.radiusM>0))continue;
  const center=bodyCenterM(body.id,day);
  const r=length(sub(position,center)),altitudeM=r-body.radiusM;
  if(!best||altitudeM<best.altitudeM)best={id:body.id,body,center,r,altitudeM};
 }
 return best;
}
const atmosphereScale=id=>id==="terra"?8500:id==="cinder"?11000:id==="nix"?9000:7000;
export function atmosphericAcceleration(position,velocity,day,bodyRecord){
 const {body,center,r,altitudeM}=bodyRecord||nearestFlightBody(position,day);
 const pressure=body?.pressure||0;
 if(!(pressure>0)||altitudeM>180000)return [0,0,0];
 const rho=1.225*pressure*Math.exp(-Math.max(0,altitudeM)/atmosphereScale(body.id));
 if(rho<1e-9)return [0,0,0];
 const local=sub(position,center);
 const omega=2*Math.PI/(body.rotationHours*3600);
 const rotation=[omega*local[2],0,-omega*local[0]];
 const wind=add(bodyVelocityMps(body.id,day),rotation);
 const rel=sub(velocity,wind),speed=length(rel);
 // Cd*A/m = 0.00065 m²/kg; the acceleration is limited to 70 m/s²
 // to keep the uncrewed/automated shell numerically well behaved.
 const acc=Math.min(70,.5*rho*.00065*speed*speed);
 return mul(normalize(rel),-acc);
}
export function gravitationalAcceleration(position,day){
 if(!Array.isArray(position)||position.length!==3||!position.every(finite)||!finite(day))
  throw new RangeError("Invalid gravitational state");
 let a=mul(position,-HELIOS_MU/Math.max(1,length(position))**3);
 for(const body of BODIES){
  const mu=gravityMu(body.id);
  if(mu<=0)continue;
  const center=bodyCenterM(body.id,day),delta=sub(position,center);
  const radius=Math.max(body.radiusM||1,length(delta));
  a=add(a,mul(delta,-mu/radius**3));
 }
 return a;
}
/** Initial physical free flight is tangent to the body, with body orbital
 * motion (plus any axial rotation of its footprint) already in velocity.
 */
export function parkingOrbitVelocity(frame,day){
 if(!frame?.bodyId||!frame.position||!frame.right||!finite(day))
  throw new RangeError("Valid parking orbit required");
 const body=bodyById(frame.bodyId);
 if(!body?.landable)throw new RangeError("Cannot orbit unlandable body");
 const radial=sub(frame.position,bodyCenterM(body.id,day)),r=length(radial);
 const nose=mul(frame.back,-1);
 const tangent=normalize(sub(nose,mul(radial,dot(nose,radial)/(r*r))));
 const speed=Math.sqrt(gravityMu(body.id)/r);
 return add(bodyVelocityMps(body.id,day),mul(tangent,speed));
}
export function createFreeFlight(frame,day,{warp=1}={}){
 if(!frame?.position?.every(finite)||!finite(day)||!frame.bodyId)throw new RangeError("Invalid free flight spawn");
 if(!ALLOWED_WARPS.includes(warp))throw new RangeError("Invalid warp");
 return {version:1,position:[...frame.position],velocity:parkingOrbitVelocity(frame,day),
  right:[...frame.right],up:[...frame.up],back:[...frame.back],
  warp,yawTargetDeg:0,returnToRoute:false,incident:null,lastDay:day,
  elapsedSimSeconds:0,totalThrustDeltaVMps:0};
}
export function restoreFreeFlight(input){
 if(input==null)return null;
 const vecOk=v=>Array.isArray(v)&&v.length===3&&v.every(finite)&&
  v.every(n=>Math.abs(n)<=2e12);
 if(input?.version!==1||!vecOk(input.position)||!vecOk(input.velocity)||
  !vecOk(input.right)||!vecOk(input.up)||!vecOk(input.back)||
  !finite(input.lastDay)||!finite(input.elapsedSimSeconds)||!finite(input.totalThrustDeltaVMps)||
  !ALLOWED_WARPS.includes(input.warp))return null;
 if(Math.abs(dot(input.right,input.up))>.01||
    Math.abs(length(input.right)-1)>.01||
    Math.abs(length(input.up)-1)>.01||
    Math.abs(length(input.back)-1)>.01)return null;
 return {version:1,position:[...input.position],velocity:[...input.velocity],
  right:[...input.right],up:[...input.up],back:[...input.back],
  warp:input.warp,yawTargetDeg:clamp(finite(input.yawTargetDeg)?input.yawTargetDeg:0,-180,180),
  returnToRoute:input.returnToRoute===true,
  incident:input.incident==="impact"?"impact":null,
  lastDay:input.lastDay,elapsedSimSeconds:Math.max(0,input.elapsedSimSeconds),
  totalThrustDeltaVMps:Math.max(0,input.totalThrustDeltaVMps)};
}
export function safeTimeWarp(requested,near){
 if(!ALLOWED_WARPS.includes(requested))return 1;
 if(!near)return requested;
 if(near.altitudeM<300000)return Math.min(requested,10);
 if(near.altitudeM<5*near.body.radiusM)return Math.min(requested,100);
 return requested;
}
function guidanceAcceleration(position,velocity,goal){
 if(!goal)return [0,0,0];
 const p=sub(goal.position,position),v=sub(goal.velocity,velocity);
 // Critically damped station-keeping guidance, capped at 20m/s².
 const a=add(mul(p,.00045),mul(v,.042));
 const mag=length(a);return mag>20?mul(a,20/mag):a;
}
export function freeFlightFrame(state,day,{status="origin-orbit"}={}){
 const closest=nearestFlightBody(state.position,day);
 const within=closest&&closest.altitudeM<Math.max(1e8,closest.body.radiusM*20);
 return {frame:"inertial",status,days:day,
  bodyId:within?closest.id:null,altitudeM:within?closest.altitudeM:null,
  position:[...state.position],right:[...state.right],up:[...state.up],
  back:[...state.back],freeFlight:true,
  velocityMps:[...state.velocity],absoluteSpeedMps:length(state.velocity),
  nearbyBodyId:closest?.id||null,
  closestAltitudeM:closest?.altitudeM??null};
}
/** Semi-implicit Euler substeps. Small steps in the lower atmosphere and
 * gravity well; larger ones in interplanetary space. The returned days are
 * the actual simulated physical time, so solar bodies advance consistently.
 */
export function stepFreeFlight(state,dt,day,{
 direction=[0,0,-1],throttle=0,fuel=0,guidance=null
}={}){
 if(!state||!finite(dt)||dt<0||!finite(day))throw new RangeError("Invalid physical step");
 const initial=restoreFreeFlight(state);
 if(!initial)throw new RangeError("Corrupted free flight state");
 if(initial.incident)return {state:initial,days:0,simSeconds:0,deltaV:0,atmosphericDragMps2:0};
 const near=nearestFlightBody(initial.position,day);
 const requested=initial.returnToRoute?Math.min(10,initial.warp):initial.warp;
 const warp=safeTimeWarp(requested,near);
 const wanted=clamp(dt,0,.12)*warp;
 const stepMax=near?.altitudeM<20000?0.08:
  near?.altitudeM<300000?1:
  near?.altitudeM<5*near.body.radiusM?4:120;
 const slices=Math.max(1,Math.ceil(wanted/stepMax));
 // Keep the main thread responsive during high warp.
 const count=Math.min(slices,260),h=Math.min(wanted/count,stepMax);
 let position=[...initial.position],velocity=[...initial.velocity],incident=null,
  lastDrag=0,deltaV=0,integrated=0;
 const nose=normalize(direction);
 for(let i=0;i<count;i++){
  const now=day+integrated/secPerDay;
  const nearest=nearestFlightBody(position,now);
  const gravity=gravitationalAcceleration(position,now);
  const drag=atmosphericAcceleration(position,velocity,now,nearest);
  lastDrag=length(drag);
  const thrustAccel=initial.returnToRoute?0:fuel>0?clamp(throttle,0,1)*4.8:0;
  const control=initial.returnToRoute?(fuel>0?guidanceAcceleration(position,velocity,guidance):[0,0,0]):
   mul(nose,thrustAccel);
  const acceleration=add(add(gravity,drag),control);
  const prior=[...position],stepVelocity=add(velocity,mul(acceleration,h));
  position=add(position,mul(stepVelocity,h));velocity=stepVelocity;
  deltaV+=length(control)*h;integrated+=h;
  // No tunnelling through terrain: clamp at the body's nominal surface and
  // freeze a collision. The physical mode cannot claim a successful landing.
  const after=nearestFlightBody(position,day+integrated/secPerDay);
  if(after&&after.altitudeM<=0){
   const radial=normalize(sub(position,after.center));
   position=add(after.center,mul(radial,after.body.radiusM));
   velocity=[0,0,0];incident="impact";break;
  }
  if(!position.every(finite)||!velocity.every(finite)){
   position=prior;velocity=[0,0,0];incident="impact";break;
  }
 }
 return {state:{...initial,position,velocity,incident,
   lastDay:day+integrated/secPerDay,
   elapsedSimSeconds:initial.elapsedSimSeconds+integrated,
   totalThrustDeltaVMps:initial.totalThrustDeltaVMps+deltaV},
  days:integrated/secPerDay,simSeconds:integrated,deltaV,atmosphericDragMps2:lastDrag,
  effectiveWarp:integrated/(Math.max(dt,1e-12))};
}
export function closestApproachToBody(state,bodyId,day){
 const b=bodyById(bodyId);if(!b?.radiusM)return null;
 return length(sub(state.position,bodyCenterM(bodyId,day)))-b.radiusM;
}
