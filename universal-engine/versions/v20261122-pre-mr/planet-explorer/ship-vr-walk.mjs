/** Apply the immersive WebXR frame's thumbstick axes to the ship-local actor.
 * All positions remain in the existing ship interior's collision-checked map.
 * Do not touch the vessel motion controls while the pilot is seated.
 */
export function applyShipVRWalk(voyage,dt,input={}){
 const interior=voyage?.interior;
 const axes={
  forward:Number.isFinite(input?.forward)?input.forward:0,
  strafe:Number.isFinite(input?.strafe)?input.strafe:0,
  turn:Number.isFinite(input?.turn)?input.turn:0
 };
 if(!interior)return {traveledM:0,altitudeM:1.62,blocked:false,indoor:true,onShip:true};
 const seated=Boolean(voyage?.seated||interior.seated);
 const moving=Math.hypot(axes.forward,axes.strafe)>.19;
 const before={x:interior.x,z:interior.z};
 if(!seated&&Number.isFinite(dt)&&dt>0){
  interior.turn(axes.turn*Math.min(dt,.08)*1.65);
  interior.walk(axes.forward,axes.strafe,dt);
 }
 const traveledM=Math.hypot(interior.x-before.x,interior.z-before.z);
 return {
  forward:axes.forward,strafe:axes.strafe,turn:axes.turn,
  traveledM,altitudeM:1.62,
  blocked:!seated&&moving&&traveledM<.001,indoor:true,onShip:true,
  seated
 };
}
