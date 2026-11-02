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
export function shipTouchPilot(stick,dt,{yawDegPerSecond=38,throttlePerSecond=.46}={}){
 if(!finite(dt)||dt<=0)return {yawDelta:0,throttleDelta:0};
 const axes=shipTouchAxes(stick);
 const step=clamp(dt,0,.08);
 return {yawDelta:axes.sideways*step*yawDegPerSecond,
  throttleDelta:axes.forward*step*throttlePerSecond};
}
export function shipCameraPose({
 mode="cockpit",wide=true,distance=52,interior={},
 landingAttitude=0
}={}){
 const chase=mode==="chase";
 const dist=clamp(finite(distance)?distance:52,28,125);
 const pitch=clamp((finite(interior.pitch)?interior.pitch:0)+landingAttitude,-1.2,1.2);
 const yaw=finite(interior.yaw)?interior.yaw:0;
 if(chase){
  return {eye:[0,Math.max(12,dist*.30),dist],target:[0,3,-3],
   fovDeg:wide?96:79,drawExterior:true};
 }
 const eyeY=interior.seated?1.25:interior.z>13&&interior.hatchPassable?
  1.62-.25*(interior.z-13):1.62;
 const eye=[finite(interior.x)?interior.x:0,eyeY,finite(interior.z)?interior.z:0];
 const sight=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
 return {eye,target:eye.map((n,i)=>n+sight[i]),
  fovDeg:wide?94:75,drawExterior:false};
}
