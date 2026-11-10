/** Approximate *route-frame* inertia, independent of throttle and ship attitude.
 * Coordinates are measured in fractions of a selected interplanetary route:
 * along=1 is destination orbital intercept, cross=0 is course centre.
 * This is deliberately not an SI 6DoF solution; it replaces the timer-driven
 * autopilot progress until universal stellar positions are introduced.
 */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const finite=v=>typeof v==="number"&&Number.isFinite(v);
export const ROUTE_MAX_SPEED=.08; // selected-route fractions / simulation second
export const ROUTE_ACCEL=.006; // fractions / simulation second squared
export function advanceRouteMotion(input,dt){
 if(!finite(dt)||dt<0)throw new RangeError("Invalid route time");
 const step=clamp(dt,0,.12);
 const prior=input?.position||{};
 const pos={along:finite(prior.along)?prior.along:0,cross:finite(prior.cross)?prior.cross:0};
 const v=input?.velocity||{};
 let along=clamp(finite(v.along)?v.along:0,-ROUTE_MAX_SPEED,ROUTE_MAX_SPEED);
 let cross=clamp(finite(v.cross)?v.cross:0,-ROUTE_MAX_SPEED,ROUTE_MAX_SPEED);
 const throttle=clamp(finite(input?.throttle)?input.throttle:0,-1,1);
 const propellant=Boolean(input?.fuelAvailable);
 let thrust={along:0,cross:0};
 if(propellant&&step>0){
  if(input?.autopilot){
   const distance=1-pos.along;
   // Both velocity and position are in one route reference frame. PD
   // guidance brakes before intercept, corrects cross-track, and returns
   // from an overshoot *without* jumping the ship to its destination.
   const desiredAlong=distance>.20?.038:distance>.02?distance*.17:
    clamp(distance*.17,-.024,.004);
   const desiredCross=clamp(-pos.cross*.15,-.024,.024);
   thrust.along=clamp((desiredAlong-along)*.48,-ROUTE_ACCEL,ROUTE_ACCEL);
   thrust.cross=clamp((desiredCross-cross)*.48,-ROUTE_ACCEL,ROUTE_ACCEL);
   const mag=Math.hypot(thrust.along,thrust.cross);
   if(mag>ROUTE_ACCEL){
    thrust.along=thrust.along/mag*ROUTE_ACCEL;
    thrust.cross=thrust.cross/mag*ROUTE_ACCEL;
   }
  }else{
   const yaw=(finite(input?.yawDeg)?input.yawDeg:0)*Math.PI/180;
   thrust.along=Math.cos(yaw)*throttle*ROUTE_ACCEL;
   thrust.cross=Math.sin(yaw)*throttle*ROUTE_ACCEL;
  }
  along+=thrust.along*step;cross+=thrust.cross*step;
  const speed=Math.hypot(along,cross);
  if(speed>ROUTE_MAX_SPEED){const scale=ROUTE_MAX_SPEED/speed;along*=scale;cross*=scale;}
 }
 const result={position:{along:pos.along+along*step,cross:pos.cross+cross*step},
  velocity:{along,cross},speed:Math.hypot(along,cross),
  thrustMagnitude:Math.hypot(thrust.along,thrust.cross)/ROUTE_ACCEL,
  deltaAlong:along*step};
 return result;
}
export function routeIntercept(position,velocity,{distance=.012,maxSpeed=.007}={}){
 if(!position||!velocity)return false;
 return Math.hypot(1-position.along,position.cross)<=distance&&
  Math.hypot(velocity.along,velocity.cross)<=maxSpeed;
}
export function remainingRouteFraction(position){
 return Math.hypot(1-(position?.along??0),position?.cross??0);
}

/** Integrate ship-local thrusters into the shared route frame (X cross, Y up, Z along). */
export function advanceManualRoute({position,velocity,yawDeg,pitchDeg,throttle,strafe=0,lift=0,fuelAvailable},step){
 const yaw=yawDeg*Math.PI/180,pitch=pitchDeg*Math.PI/180;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],forward=[sy*cp,sp,cy*cp];
 const input=value=>finite(value)?clamp(value,-1,1):0;
 const x=input(strafe),y=input(lift),z=input(throttle);
 const strength=Math.hypot(x,y,z);
 const thrust=fuelAvailable?Math.min(strength,1):0;
 let nextVelocity=velocity;
 if(thrust>0&&step>0){
  const impulse=ROUTE_ACCEL*step/Math.max(1,strength);
  nextVelocity=velocity.map((v,i)=>v+(x*right[i]+y*up[i]+z*forward[i])*impulse);
  const speed=Math.hypot(...nextVelocity);
  if(speed>ROUTE_MAX_SPEED)nextVelocity=nextVelocity.map(v=>v*ROUTE_MAX_SPEED/speed);
 }
 return {position:position.map((v,i)=>v+nextVelocity[i]*step),velocity:nextVelocity,thrust};
}
