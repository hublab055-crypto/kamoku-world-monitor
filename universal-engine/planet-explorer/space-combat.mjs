/** Shipboard targeting core. No DOM/WebXR dependency; one combat session per voyage.
 * The existing flight model only simulates visual yaw/pitch, so contacts are
 * local encounter targets rather than actors in an authoritative solar system.
 */
export const SHIP_WEAPONS=Object.freeze({
 pulse:Object.freeze({name:"パルス砲",locks:1,cooldown:.22,damage:25,ammo:Infinity}),
 missile:Object.freeze({name:"誘導ミサイル",locks:3,cooldown:1.3,damage:65,ammo:12})
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HOSTILES=Object.freeze([
 {id:"pirate-alpha",name:"☠️ 海賊迎撃機",bearing:0,pitch:0,distance:260,hp:100,phase:0},
 {id:"pirate-beta",name:"☠️ 海賊護衛機",bearing:-13,pitch:4,distance:340,hp:100,phase:1.8},
 {id:"pirate-gamma",name:"☠️ 海賊偵察機",bearing:17,pitch:-5,distance:400,hp:75,phase:3.6}
]);
export function combatEligible(voyage){
 return Boolean(voyage?.active&&(voyage.seated===true||
  voyage.seated!==false&&voyage.interior?.mode==="cockpit")&&
  ["origin-orbit","parking-orbit","launch","cruise","approach","flyby","orbit"].includes(voyage.status));
}
/** Fixed inertial bearing relative to the departure attitude, displayed in vessel coordinates. */
export function shipContactPosition(target,voyage){
 const rad=Math.PI/180;
 const yaw=((Number(voyage?.attitudeYawDeg)||0)-(target.bearing||0)-(target.evadeYaw||0))*rad;
 const pitch=((Number(voyage?.pitchDeg)||0)-(target.pitch||0)-(target.evadePitch||0))*rad;
 const d=target.distance;
 return [-Math.sin(yaw)*Math.cos(pitch)*d,2-Math.sin(pitch)*d,
  -Math.cos(yaw)*Math.cos(pitch)*d];
}
export class SpaceCombat{
 constructor(){
  this.targets=HOSTILES.map(t=>{
   const yaw=t.bearing*Math.PI/180,pitch=t.pitch*Math.PI/180;
   return {...t,position:[Math.sin(yaw)*t.distance,Math.sin(pitch)*t.distance,
    Math.cos(yaw)*Math.cos(pitch)*t.distance],velocity:[0,0,0]};
  });
  this.weapon="pulse";this.missiles=SHIP_WEAPONS.missile.ammo;
  this.locked=[];this.visible=new Set();this.dwellId=null;this.dwellSeconds=0;
  this.cooldown=0;this.flashes=[];this.lastMessage="";this.elapsed=0;
  this.lastHeading=null;this.headingRate=0;this.playerRangeTravel=0;
  this.lastShipPosition=null;
 }
 /** Local enemy maneuver prototype: independent targets weave, pass and re-engage.
  * This is deliberately not yet a network-authoritative physics simulation. */
 advance(dt,voyage=null){
  const step=clamp(Number.isFinite(dt)?dt:0,0,.12);
  if(!step)return;
  this.elapsed+=step;
  const heading=Number(voyage?.attitudeYawDeg)||0;
  const turn=this.lastHeading===null?0:((heading-this.lastHeading+540)%360)-180;
  this.headingRate=clamp(turn/step,-90,90);
  this.lastHeading=heading;
  const throttle=clamp(Number(voyage?.throttle)||0,0,1);
  // Positive thrust must visibly close range to contacts ahead; steering reduces closure.
  const facing=Math.max(0,Math.cos(heading*Math.PI/180));
  this.playerRangeTravel+=throttle*step*95*facing;
  // Convert voyage coordinates to a shared encounter frame in metres.
  const coordinates=[voyage?.transferX,voyage?.transferY,voyage?.transferZ];
  const validCoordinates=coordinates.every(Number.isFinite);
  const ship=validCoordinates?coordinates.map(n=>n*12000):[0,0,0];
  const previous=this.lastShipPosition||ship;
  const shipVelocity=ship.map((n,i)=>(n-previous[i])/step);
  this.lastShipPosition=validCoordinates?ship:null;
  // Intercept lead responds to observed turning and thrust. These are
  // local encounter approximations, not solar-system inertial velocities.
  for(const t of this.liveTargets){
   const time=this.elapsed+t.phase;
   const role=t.id==="pirate-alpha"?"interceptor":
    t.id==="pirate-beta"?"flanker":"scout";
   const lead=clamp(this.headingRate*.35,-24,24);
   const wave=role==="scout"?1.4:role==="flanker"?.75:1;
   const desiredYaw=role==="flanker"?
    22+lead*.5+Math.sin(time*.3)*12:
    role==="scout"?-22+Math.sin(time*.8)*35:
    lead+Math.sin(time*.45)*14;
   const desiredPitch=(role==="scout"?15:role==="flanker"?-10:0)+
    Math.sin(time*.55+t.phase)*7*wave;
   const maneuver=role==="scout"?34:role==="interceptor"?25:17;
   const yawNow=t.evadeYaw||0,pitchNow=t.evadePitch||0;
   t.evadeYaw=yawNow+clamp(desiredYaw-yawNow,-maneuver*step,maneuver*step);
   t.evadePitch=pitchNow+clamp(desiredPitch-pitchNow,-maneuver*step,maneuver*step);
   // Role-specific pursuit with lead prediction and acceleration limits.
   const desiredRange=role==="interceptor"?125:role==="flanker"?230:340;
   const offset=role==="flanker"?[95,0,-40]:role==="scout"?[-110,55,85]:[0,0,-desiredRange];
   const predicted=ship.map((n,i)=>n+shipVelocity[i]*.7+offset[i]);
   const displacement=predicted.map((n,i)=>n-t.position[i]);
   const length=Math.hypot(...displacement)||1;
   const speed=role==="interceptor"?125:role==="flanker"?95:115;
   const acceleration=role==="scout"?85:role==="interceptor"?65:50;
   const wanted=displacement.map(n=>n/length*speed);
   t.velocity=t.velocity.map((n,i)=>n+clamp(wanted[i]-n,-acceleration*step,acceleration*step));
   t.position=t.position.map((n,i)=>n+t.velocity[i]*step);
   const relative=t.position.map((n,i)=>n-ship[i]);
   t.distance=Math.hypot(...relative);
   t.bearing=Math.atan2(relative[0],relative[2])*180/Math.PI;
   t.pitch=Math.atan2(relative[1],Math.hypot(relative[0],relative[2]))*180/Math.PI;
   t.evadeYaw=0;t.evadePitch=0;
   t.aiState=t.distance<desiredRange*.7?"breakaway":
    length>desiredRange?"intercept":"pursuit";
