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
   return {...t,faction:"hostile",shield:100,maxShield:100,maxHp:t.hp,shieldFlash:0,position:[Math.sin(yaw)*t.distance,Math.sin(pitch)*t.distance,
    Math.cos(yaw)*Math.cos(pitch)*t.distance],velocity:[0,0,0]};
  });
  this.weapon="pulse";this.missiles=SHIP_WEAPONS.missile.ammo;
  this.locked=[];this.visible=new Set();this.dwellId=null;this.dwellSeconds=0;
  this.cooldown=0;this.flashes=[];this.projectiles=[];this.player={hp:100,maxHp:100,shield:100,maxShield:100,shieldFlash:0};this.enemyCooldown=3;this.lastMessage="";this.elapsed=0;
  this.lastHeading=null;this.headingRate=0;this.playerRangeTravel=0;
  this.lastShipPosition=null;
 }
 /** Local enemy maneuver prototype: independent targets weave, pass and re-engage.
  * This is deliberately not yet a network-authoritative physics simulation. */
 advance(dt,voyage=null){
  const step=clamp(Number.isFinite(dt)?dt:0,0,.12);
  if(!step)return;
  this.elapsed+=step;
  this.player.shieldFlash=Math.max(0,this.player.shieldFlash-step);
  for(const t of this.targets)t.shieldFlash=Math.max(0,t.shieldFlash-step);
  this.enemyCooldown-=step;
  if(this.enemyCooldown<=0&&voyage&&combatEligible(voyage)&&this.liveTargets.length){
   const attacker=this.liveTargets.filter(t=>t.distance<650).sort((a,b)=>a.distance-b.distance)[0];
   if(attacker){this.enemyCooldown=2.5+Math.random()*1.5;this.projectiles.push({id:attacker.id,weapon:"enemy",seconds:Math.max(.25,attacker.distance/320),total:Math.max(.25,attacker.distance/320),enemy:true});}
  }
  for(const shot of this.projectiles){
   shot.seconds-=step;
   if(shot.seconds>0)continue;
   if(shot.enemy){this.applyDamage(this.player,12,"player");continue;}
   const target=this.targets.find(t=>t.id===shot.id);
   if(target?.hp>0)this.applyDamage(target,shot.damage,shot.id);
  }
  this.projectiles=this.projectiles.filter(p=>p.seconds>0);
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
  this.shipPosition=ship;
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

  }
 }
 applyDamage(target,damage,id){
  const absorbed=Math.min(target.shield||0,damage);
  target.shield=Math.max(0,(target.shield||0)-absorbed);
  if(absorbed)target.shieldFlash=.35;
  target.hp=Math.max(0,target.hp-(damage-absorbed));
  this.flashes.push({id,seconds:.5,shield:absorbed>0,destroyed:target.hp===0});
  return {id,hp:target.hp,shield:target.shield,destroyed:target.hp===0};
 }
 get config(){return SHIP_WEAPONS[this.weapon];}
 get liveTargets(){return this.targets.filter(t=>t.hp>0);}
 setWeapon(type){
  if(!SHIP_WEAPONS[type])return false;
  this.weapon=type;this.locked=this.locked.slice(0,this.config.locks);
  this.dwellId=null;this.dwellSeconds=0;return true;
 }
 syncVisibility(projected=[],dt=0,{vr=false,eligible=true,voyage=null}={}){
  this.advance(dt,voyage);
  this.cooldown=Math.max(0,this.cooldown-clamp(Number.isFinite(dt)?dt:0,0,.12));
  for(const f of this.flashes)f.seconds=Math.max(0,f.seconds-clamp(dt||0,0,.12));
  this.flashes=this.flashes.filter(f=>f.seconds>0);
  this.visible=new Set(eligible?projected.filter(p=>p.onScreen&&
   Number.isFinite(p.u)&&Number.isFinite(p.v)&&
   p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1&&
   this.targets.some(t=>t.id===p.id&&t.hp>0)).map(p=>p.id):[]);
  this.locked=this.locked.filter(id=>this.visible.has(id));
  if(!vr||!eligible){this.dwellId=null;this.dwellSeconds=0;return;}
  const nearest=projected.filter(p=>this.visible.has(p.id)).
   map(p=>({...p,delta:Math.hypot(p.u-.5,p.v-.5)})).
   filter(p=>p.delta<.075).sort((a,b)=>a.delta-b.delta)[0];
  const id=nearest?.id||null;
  if(id!==this.dwellId){this.dwellId=id;this.dwellSeconds=0;}
  if(!id||this.locked.includes(id))return;
  this.dwellSeconds+=clamp(Number.isFinite(dt)?dt:0,0,.12);
  if(this.dwellSeconds>=.85){
   this.acquire(id);this.dwellId=null;this.dwellSeconds=0;
  }
 }
 acquire(id){
  if(!this.visible.has(id)||!this.targets.some(t=>t.id===id&&t.hp>0))return false;
  if(this.locked.includes(id))return true;
  if(this.config.locks===1)this.locked=[id];
  else{
   if(this.locked.length>=this.config.locks)return false;
   this.locked.push(id);
  }
  return true;
 }
 fire(eligible=true){
  if(!eligible)return {ok:false,message:"操縦席に着席し、宇宙航行中に使用してください"};
  if(this.cooldown>0)return {ok:false,message:"兵装を再装填しています"};
  if(!this.locked.length)return {ok:false,message:"敵機をロックオンしてください"};
  if(this.weapon==="missile"&&this.missiles<=0)return {ok:false,message:"ミサイル残弾がありません"};
  const shots=this.locked.slice(0,this.weapon==="missile"?
   Math.min(this.config.locks,this.missiles):this.config.locks);
  const hits=[];
  for(const id of shots){
   const target=this.targets.find(t=>t.id===id);
   if(!target||target.hp<=0||!this.visible.has(id))continue;
   const seconds=this.weapon==="missile"?Math.max(.35,target.distance/250):Math.max(.08,target.distance/900);
   this.projectiles.push({id,weapon:this.weapon,seconds,total:seconds,damage:this.config.damage,enemy:false});
   hits.push({id,name:target.name,pending:true,hp:target.hp});
  }
  if(!hits.length){this.locked=[];return {ok:false,message:"目標が視界外です"};}
  if(this.weapon==="missile")this.missiles-=hits.length;
  this.cooldown=this.config.cooldown;
  this.locked=this.locked.filter(id=>this.targets.some(t=>t.id===id&&t.hp>0)&&this.visible.has(id));
  const message="🚀 "+this.config.name+" "+hits.length+"発発射";
  this.lastMessage=message;
  return {ok:true,message,hits};
 }
}
