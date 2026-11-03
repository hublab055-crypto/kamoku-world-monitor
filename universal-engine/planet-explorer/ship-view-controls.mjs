/** Touch control & wide/third-person camera geometry for the existing ship renderer.
 * The ship always faces local -Z. Camera changes never mutate the ship or its save.
 */
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const finite=n=>typeof n==="number"&&Number.isFinite(n);
export function shipTouchAxes(stick,{deadzone=.12}={}){
 const x=clamp(finite(stick?.x)?stick.x:0,-1,1);
 const y=clamp(finite(stick?.y)?stick.y:0,-1,1);
 const magnitude=Math.min(1,Math.hypot(x,y));
 if(magnitude<=deadzone)return {forward:0,sideways:0,magnitude:0};
 const scale=magnitude/Math.max(1e-9,Math.hypot(x,y));
 return {forward:-y*scale,sideways:x*scale,magnitude};
}
/** Cockpit stick controls ATTITUDE only. Engine output belongs to the lever.
 * Touch up is a positive nose-up command; releasing the stick zeroes both axes.
 */
export function shipTouchPilot(stick,dt,{yawDegPerSecond=38,pitchDegPerSecond=30}={}){
 if(!finite(dt)||dt<=0)return {yawDelta:0,pitchDelta:0};
 const axes=shipTouchAxes(stick);
 const step=clamp(dt,0,.08);
 return {yawDelta:axes.sideways*step*yawDegPerSecond,
  pitchDelta:axes.forward*step*pitchDegPerSecond};
}
/** A celestial body is fixed in the inertial sky while the *ship* turns.
 * Render it in vessel-local coordinates, preserving distance and scale.
 * Until world-frame 6DoF is available this rotates the visual reference,
 * not the spacecraft's physical translation.
 */
export function shipCelestialPosition({yawDeg=0,pitchDeg=0,distance=420,baseY=-50}={}){
 const yaw=(finite(yawDeg)?yawDeg:0)*Math.PI/180;
 const pitch=clamp(finite(pitchDeg)?pitchDeg:0,-80,80)*Math.PI/180;
 const d=finite(distance)?Math.max(1,distance):420;
 return [-Math.sin(yaw)*Math.cos(pitch)*d,
  (finite(baseY)?baseY:0)-Math.sin(pitch)*d,
  -Math.cos(yaw)*Math.cos(pitch)*d];
}
export function shipCameraPose({
 mode="cockpit",wide=true,distance=52,interior={},
 orbitYaw=0,orbitPitch=.31,landingAttitude=0
}={}){
 const chase=mode==="chase";
 const dist=clamp(finite(distance)?distance:52,28,150);
 const pitch=clamp((finite(interior.pitch)?interior.pitch:0)+landingAttitude,-1.2,1.2);
 const yaw=finite(interior.yaw)?interior.yaw:0;
 if(chase){
  // Camera orbits the SAME ship hull. Swipe changes camera only and never
  // changes heading, linear velocity, or the player's cockpit look angle.
  const orbitAz=finite(orbitYaw)?orbitYaw:0;
  const orbitEl=clamp(finite(orbitPitch)?orbitPitch:.31,-.42,1.37);
  const center=[0,2.5,-1.5];
  const cp=Math.cos(orbitEl);
  return {eye:[center[0]+Math.sin(orbitAz)*cp*dist,
   center[1]+Math.sin(orbitEl)*dist,
   center[2]+Math.cos(orbitAz)*cp*dist],target:center,
   fovDeg:wide?96:79,drawExterior:true};
 }
 const eyeY=interior.seated?1.25:interior.z>13&&interior.hatchPassable?
  1.62-.25*(interior.z-13):1.62;
 const eye=[finite(interior.x)?interior.x:0,eyeY,finite(interior.z)?interior.z:0];
 const sight=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
 return {eye,target:eye.map((n,i)=>n+sight[i]),
  fovDeg:wide?94:75,drawExterior:false};
}
