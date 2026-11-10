import {normalizeTurrets,aimTurret} from "./ship-turrets.mjs?v=20261108-vtol";
/** Shipboard targeting core. No DOM/WebXR dependency; one combat session per voyage.
 * Contacts share the integrated voyage route frame; this is a local encounter
 * simulation rather than a network-authoritative solar-system physics engine.
 */
export const SHIP_WEAPONS=Object.freeze({
 rapid:Object.freeze({name:"速射砲",locks:1,cooldown:.07,damage:6,ammo:Infinity}),
 pulse:Object.freeze({name:"パルス砲",locks:1,cooldown:.22,damage:25,ammo:Infinity}),
 missile:Object.freeze({name:"誘導ミサイル",locks:3,cooldown:1.3,damage:65,ammo:12})
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const NON_HOSTILES=Object.freeze([
 {id:"fleet-carrier",name:"連邦空母",type:"ship",faction:"friendly",bearing:-48,pitch:12,distance:1150,phase:1.5,hull:"carrier"},
 {id:"ally-surveyor",hull:"fighter",name:"連邦測量艇",type:"ship",faction:"friendly",bearing:-28,pitch:7,distance:510,phase:1.0},
 {id:"trade-caravan",hull:"cargo",name:"貨物船オリオン",type:"ship",faction:"neutral",bearing:32,pitch:-4,distance:650,phase:2.1},
 {id:"asteroid-ore",name:"鉄・ニッケル鉱石群",type:"resource",faction:"resource",bearing:-41,pitch:-12,distance:880,phase:3.7}
]);
const HOSTILES=Object.freeze([
 {id:"pirate-alpha",hull:"fighter",name:"☠️ 海賊迎撃機",bearing:0,pitch:0,distance:260,hp:100,phase:0},
 {id:"pirate-beta",hull:"battleship",name:"☠️ 海賊戦艦",bearing:-13,pitch:4,distance:340,hp:100,phase:1.8},
 {id:"pirate-gamma",hull:"fighter",name:"☠️ 海賊偵察機",bearing:17,pitch:-5,distance:400,hp:75,phase:3.6}
]);
export function combatEligible(voyage){
 return Boolean(voyage?.active&&(voyage.seated===true||
  voyage.seated!==false&&voyage.interior?.mode==="cockpit")&&
  ["origin-orbit","parking-orbit","launch","cruise","approach","flyby","orbit"].includes(voyage.status));
}
/** One encounter coordinate frame in metres. Ships, radar distances,
 * 3D meshes and targeting all reference this exact relative vector.
 * Legacy bearing-only callers remain supported for archived saves/tests.
 */
export function shipEncounterPosition(voyage){
 const coords=[voyage?.transferX,voyage?.transferY,voyage?.transferZ];
 if(coords.every(Number.isFinite))return coords.map(n=>n*12000);
 if(Number.isFinite(voyage?.routeAlong))return [(voyage.crossTrack||0)*12000,(voyage.routeVertical||0)*12000,voyage.routeAlong*12000];
 return [0,0,0];
}
export function shipContactRelative(target,voyage){
 if(Array.isArray(target?.position)&&target.position.length===3&&target.position.every(Number.isFinite)){
  const ship=shipEncounterPosition(voyage);
  return target.position.map((n,i)=>n-ship[i]);
 }
 const yaw=((target?.bearing||0)+(target?.evadeYaw||0))*Math.PI/180;
 const pitch=((target?.pitch||0)+(target?.evadePitch||0))*Math.PI/180;
 const d=Number.isFinite(target?.distance)?target.distance:0;
 return [Math.sin(yaw)*Math.cos(pitch)*d,Math.sin(pitch)*d,Math.cos(yaw)*Math.cos(pitch)*d];
}
export function shipContactDistance(target,voyage){
 return Math.hypot(...shipContactRelative(target,voyage));
}
export function shipContactPosition(target,voyage){
 return encounterPointToShip(shipContactRelative(target,voyage),voyage);
}
export function encounterPointToShip(relative,voyage){
 const [x,y,z]=relative;
 const yaw=(Number(voyage?.attitudeYawDeg)||0)*Math.PI/180;
 const pitch=(Number(voyage?.pitchDeg)||0)*Math.PI/180;
 const cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 // Inertial +Z is the encounter's forward direction; ship-local -Z is forward.
 const front=-sy*x-cy*z;
 return [cy*x-sy*z,2+cp*y+sp*front,-sp*y+cp*front];
}
export function shipPointToEncounter(point,voyage){
 const yaw=(voyage?.attitudeYawDeg||0)*Math.PI/180,pitch=(voyage?.pitchDeg||0)*Math.PI/180;
 const [x,h,z]=point,y=h-2,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const origin=shipEncounterPosition(voyage);
 return [cy*x-sp*sy*y-cp*sy*z,cp*y-sp*z,-sy*x-sp*cy*y-cp*cy*z].map((n,i)=>n+origin[i]);
}
/** Curved visual homing arc, arriving at the moving enemy instead of firing
 * a straight static target interpolation. No physics or hit chance implied. */
export function missileTrailPoint(start,end,fraction,seed=0){
 const f=clamp(Number.isFinite(fraction)?fraction:0,0,1);
 const linear=start.map((n,i)=>n+(end[i]-n)*f);
 const tangent=[end[0]-start[0],end[1]-start[1],end[2]-start[2]];
 const horizontal=Math.hypot(tangent[0],tangent[2])||1;
 const side=[-tangent[2]/horizontal,0,tangent[0]/horizontal];
 const arc=16*Math.sin(f*Math.PI)*(1-f*.55);
 const wave=Math.sin(f*18+seed)*arc*.42;
 return [linear[0]+side[0]*wave,
  linear[1]+arc*.65+Math.sin(f*12+seed)*arc*.16,
  linear[2]+side[2]*wave];
}
export class SpaceCombat{
 constructor(saved=null){
  this.targets=HOSTILES.map(t=>{
   const yaw=t.bearing*Math.PI/180,pitch=t.pitch*Math.PI/180;
   return {...t,flareAmmo:2,ciwsAmmo:t.hull==="battleship"?24:0,defenseReady:0,faction:"hostile",shield:100,maxShield:100,maxHp:t.hp,shieldFlash:0,position:[Math.sin(yaw)*t.distance,Math.sin(pitch)*t.distance,
    Math.cos(yaw)*Math.cos(pitch)*t.distance],velocity:[0,0,0]};
  });
  this.nonHostiles=NON_HOSTILES.map(t=>{
   const yaw=t.bearing*Math.PI/180,pitch=t.pitch*Math.PI/180,d=t.distance;
   return {...t,baseDistance:t.distance,hp:1,maxHp:1,shield:0,maxShield:0,
    position:[Math.sin(yaw)*Math.cos(pitch)*d,Math.sin(pitch)*d,Math.cos(yaw)*Math.cos(pitch)*d],
    velocity:[0,0,0]};
  });
  this.ciwsEnabled=saved?.ciwsEnabled!==false;this.ciwsAmmo=saved?.ciwsAmmo??600;
  this.flareAmmo=saved?.flareAmmo??8;this.flareCooldown=0;this.ciwsCooldown=0;
  this.defenseBursts=[];this.defenseTraces=[];this.flares=[];this.missileSequence=0;
  this.turrets=normalizeTurrets();this.autoFire=false;this.fireControl=saved?.fireControl===true;this.voyage=null;
  this.weapon="pulse";this.missiles=SHIP_WEAPONS.missile.ammo;
  this.locked=[];this.visible=new Set();this.dwellId=null;this.dwellSeconds=0;
  this.cooldown=0;this.flashes=[];this.projectiles=[];this.explosions=[];this.player={hp:100,maxHp:100,shield:100,maxShield:100,shieldFlash:0};this.enemyCooldown=3;this.lastMessage="";this.elapsed=0;
  this.parts={engine:100,hull:100,weapons:100,shield:100,...saved?.parts};
  this.supplies={fuel:3,kits:12,...saved?.supplies};this.lastHit=-(saved?.rechargeWait===undefined?100:8-saved.rechargeWait);this.rescueAfter=saved?.rescueWait||0;
  if(saved?.player){this.player.hp=clamp(saved.player.hp,0,100);this.player.shield=clamp(saved.player.shield,0,100);}
  this.lastHeading=null;this.headingRate=0;this.playerRangeTravel=0;
  this.lastShipPosition=null;this.shipPosition=[0,0,0];
  this.radioEvents=[];this.radioSequence=0;this.playerSurrendered=false;
  this.ceasefireUntil=0;this.warningSent=false;
 }
 /** Local enemy maneuver prototype: independent targets weave, pass and re-engage.
  * This is deliberately not yet a network-authoritative physics simulation. */
 advance(dt,voyage=null){
  const step=clamp(Number.isFinite(dt)?dt:0,0,.12);
  if(!step)return;
  this.elapsed+=step;this.voyage=voyage;
  if(this.elapsed-this.lastHit>8&&this.parts.shield>0)this.player.shield=Math.min(100,this.player.shield+step*4*this.parts.shield/100);
  if(voyage&&!combatEligible(voyage))return;
  if(voyage&&!this.lastShipPosition){
   const origin=shipEncounterPosition(voyage);
   if(!this.encounterAnchored){
    for(const c of [...this.targets,...this.nonHostiles])c.position=c.position.map((n,i)=>n+origin[i]);
    this.encounterOrigin=origin;this.encounterAnchored=true;
   }
  }
  this.player.shieldFlash=Math.max(0,this.player.shieldFlash-step);
  for(const effect of this.explosions)effect.seconds-=step;
  this.explosions=this.explosions.filter(effect=>effect.seconds>0);
  for(const t of this.targets)t.shieldFlash=Math.max(0,t.shieldFlash-step);
  this.enemyCooldown-=step;
  if(this.enemyCooldown<=0&&voyage&&combatEligible(voyage)&&!this.playerSurrendered&&
     this.elapsed>=this.ceasefireUntil&&this.combatTargets.length){
   const attacker=this.combatTargets.filter(t=>t.distance<650).sort((a,b)=>a.distance-b.distance)[0];
   if(attacker){
    this.enemyCooldown=3.5+Math.random()*1.5;
    this.launchEnemyMissile(attacker,voyage);
    const seconds=Math.max(.25,attacker.distance/320),ship=shipEncounterPosition(voyage);
    this.projectiles.push({id:attacker.id,weapon:"enemy",seconds,total:seconds,enemy:true,
     origin:[...attacker.position],impact:ship.map((n,i)=>n+(this.shipVelocity?.[i]||0)*seconds)});
   }
  }
  this.advanceDefense(step,voyage);
  for(const shot of this.projectiles){
   if(shot.weapon==="enemy-missile")continue;
   if(voyage&&shot.weapon==="missile"&&!shot.enemy&&this.interceptPlayerMissile(shot))continue;
   shot.seconds-=step;
   if(shot.seconds>0)continue;
   if(shot.enemy){if(!shot.impact||Math.hypot(...shot.impact.map((n,i)=>n-shipEncounterPosition(voyage)[i]))<25)this.applyDamage(this.player,12,"player");continue;}
   const target=this.targets.find(t=>t.id===shot.id);
   if(shot.decoy){this.defenseBursts.push({position:[...shot.decoy],seconds:.55,total:.55});continue;}
   if(target?.hp>0&&(shot.weapon==="missile"||!shot.impact||Math.hypot(...shot.impact.map((n,i)=>n-target.position[i]))<25))this.applyDamage(target,shot.damage,shot.id);
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
  const validCoordinates=coordinates.every(Number.isFinite)||Number.isFinite(voyage?.routeAlong);
  const ship=shipEncounterPosition(voyage);
  const previous=this.lastShipPosition||ship;
  const shipVelocity=ship.map((n,i)=>(n-previous[i])/step);this.shipVelocity=shipVelocity;
  this.lastShipPosition=validCoordinates?ship:null;
  this.shipPosition=ship;
  // Intercept lead responds to observed turning and thrust. These are
  // local encounter approximations, not solar-system inertial velocities.
  for(const t of this.combatTargets){
   const time=this.elapsed+t.phase;
   const role=t.id==="pirate-alpha"?"interceptor":
    t.id==="pirate-beta"?"flanker":"scout";
   // Role-specific pursuit with lead prediction and acceleration limits.
   const desiredRange=role==="interceptor"?125:role==="flanker"?230:340;
   // Attack runs alternate with a committed pass and a wide re-entry turn.
   const range=shipContactDistance(t,voyage);
   if(!t.aiState)t.aiState="intercept";
   if(t.aiState!=="breakaway"&&range<90){t.aiState="breakaway";t.breakUntil=this.elapsed+3;}
   if(t.aiState==="breakaway"&&this.elapsed>=t.breakUntil)t.aiState="intercept";
   const relative=t.position.map((n,i)=>n-ship[i]);
   const radial=Math.hypot(...relative)||1;
   const side=role==="flanker"?1:-1;
   const offset=t.aiState==="breakaway"?
    relative.map((n,i)=>n/radial*360+(i===0?side*120:i===1?65:0)):
    [Math.sin(time*.6)*desiredRange*.35,Math.sin(time*.45+t.phase)*55,0];
   const predicted=ship.map((n,i)=>n+shipVelocity[i]*.7+offset[i]);
   const displacement=predicted.map((n,i)=>n-t.position[i]);
   const length=Math.hypot(...displacement)||1;
   const speed=t.hull==="battleship"?65:role==="interceptor"?125:115;
   const acceleration=t.hull==="battleship"?24:role==="scout"?85:65;
   const wanted=displacement.map(n=>n/length*speed);
   t.velocity=t.velocity.map((n,i)=>n+clamp(wanted[i]-n,-acceleration*step,acceleration*step));
   t.position=t.position.map((n,i)=>n+t.velocity[i]*step);
   const updated=t.position.map((n,i)=>n-ship[i]);
   t.distance=Math.hypot(...updated);
   t.bearing=Math.atan2(updated[0],updated[2])*180/Math.PI;
   t.pitch=Math.atan2(updated[1],Math.hypot(updated[0],updated[2]))*180/Math.PI;
   t.evadeYaw=0;t.evadePitch=0;
  }
  // Merchant, allied and mineral contacts occupy that SAME encounter frame.
  for(const c of this.nonHostiles){
   const t=this.elapsed*.12+c.phase;
   c.position=[Math.sin(c.bearing*Math.PI/180)*c.baseDistance+Math.sin(t)*9,
    Math.sin(c.pitch*Math.PI/180)*c.baseDistance+Math.cos(t*.8)*4,
    Math.cos(c.bearing*Math.PI/180)*c.baseDistance+Math.sin(t*.4)*6].map((n,i)=>n+(this.encounterOrigin?.[i]||0));
   c.distance=shipContactDistance(c,voyage);
  }
  if(!this.warningSent&&voyage&&combatEligible(voyage)&&
    this.combatTargets.some(t=>t.distance<650)){
   this.warningSent=true;
   this.emitRadio("☠️ 海賊船：こちらの航路から退避しろ。停止して貨物を引き渡せ。","pirate-alpha","warning");
  }
  for(const enemy of this.combatTargets){
   if(enemy.hp<=enemy.maxHp*.42&&!enemy.offeredSurrender&&!enemy.surrenderResolved){
    enemy.offeredSurrender=true;
    this.emitRadio("☠️ "+enemy.name+"：降伏する。撃たないでくれ。",enemy.id,"offer");
   }
  }
 }
 applyDamage(target,damage,id){
  const absorbed=Math.min(target.shield||0,damage);
  target.shield=Math.max(0,(target.shield||0)-absorbed);
  if(absorbed)target.shieldFlash=.35;
  target.hp=Math.max(0,target.hp-(damage-absorbed));
  if(id==="player"){
   this.lastHit=this.elapsed;
   const keys=Object.keys(this.parts),key=keys[Math.floor(this.elapsed*10)%keys.length];
   this.parts[key]=Math.max(0,this.parts[key]-(damage-absorbed)*1.5);
  }
  const destroyed=target.hp===0;
  this.flashes.push({id,seconds:destroyed?1.6:.5,shield:absorbed>0,destroyed});
  if(destroyed&&id!=="player"&&!this.explosions.some(x=>x.id===id)){
   this.explosions.push({id,seconds:2.4,total:2.4});
   this.emitRadio("💥 "+target.name+"：船体崩壊・通信途絶",id,"destroyed");
  }
  return {id,hp:target.hp,shield:target.shield,destroyed};
 }
 lockContact(id,voyage=this.voyage){
  if(!combatEligible(voyage))return false;
  const target=this.combatTargets.find(t=>t.id===id);
  if(!target||shipContactDistance(target,voyage)>1500)return false;
  this.visible.add(id);return this.acquire(id);
 }
 launchEnemyMissile(attacker,voyage){
  const ship=shipEncounterPosition(voyage),delta=ship.map((n,i)=>n-attacker.position[i]);
  const length=Math.hypot(...delta)||1;
  this.projectiles.push({id:attacker.id,uid:++this.missileSequence,weapon:"enemy-missile",enemy:true,
   position:[...attacker.position],direction:delta.map(n=>n/length),seconds:12,total:12,hp:12});
 }
 deployFlares(voyage=this.voyage){
  if(!combatEligible(voyage))return {ok:false,message:"フレアは航行中の操縦席から使用してください"};
  if(this.flareAmmo<=0||this.flareCooldown>0)return {ok:false,message:"フレア残弾なし、または再装填中です"};
  this.flareAmmo--;this.flareCooldown=3;
  const origin=shipEncounterPosition(voyage);
  for(let i=0;i<6;i++)this.flares.push({position:[...origin],velocity:[(i-2.5)*18,-8+Math.sin(i)*12,-30],seconds:4});
  return {ok:true,message:"🔥 フレアを散布しました"};
 }
 advanceDefense(step,voyage){
  this.flareCooldown=Math.max(0,this.flareCooldown-step);this.ciwsCooldown=Math.max(0,this.ciwsCooldown-step);
  for(const effect of [...this.defenseBursts,...this.defenseTraces])effect.seconds-=step;
  this.defenseBursts=this.defenseBursts.filter(e=>e.seconds>0);this.defenseTraces=this.defenseTraces.filter(e=>e.seconds>0);
  for(const flare of this.flares){flare.seconds-=step;flare.position=flare.position.map((n,i)=>n+flare.velocity[i]*step);}
  this.flares=this.flares.filter(f=>f.seconds>0);
  const ship=shipEncounterPosition(voyage);
  const missiles=this.projectiles.filter(s=>s.weapon==="enemy-missile"&&s.seconds>0);
  const burst=position=>this.defenseBursts.push({position:[...position],seconds:.55,total:.55});
  for(const missile of missiles){
   missile.seconds-=step;
   const flare=this.flares.find(f=>Math.hypot(...f.position.map((n,i)=>n-missile.position[i]))<450);
   if(flare)missile.decoy=[...flare.position];
   const aim=missile.decoy||ship,delta=aim.map((n,i)=>n-missile.position[i]),distance=Math.hypot(...delta);
   const rate=Math.min(1,step*2.5);
   const wanted=delta.map(n=>n/(distance||1));
   missile.direction=missile.direction.map((n,i)=>n+(wanted[i]-n)*rate);
   const length=Math.hypot(...missile.direction)||1;missile.direction=missile.direction.map(n=>n/length);
   missile.trail=[...(missile.trail||[]),[...missile.position]].slice(-10);
   missile.position=missile.position.map((n,i)=>n+missile.direction[i]*180*step);
   if(distance<12+180*step){
    missile.seconds=0;burst(missile.position);
    if(!missile.decoy)this.applyDamage(this.player,30,"player");
   }
  }
  const incoming=missiles.filter(m=>m.seconds>0&&Math.hypot(...m.position.map((n,i)=>n-ship[i]))<300)
   .sort((a,b)=>Math.hypot(...a.position.map((n,i)=>n-ship[i]))-Math.hypot(...b.position.map((n,i)=>n-ship[i])))[0];
  if(incoming&&this.ciwsEnabled&&this.ciwsAmmo>=3&&this.parts.weapons>0&&this.ciwsCooldown<=0&&!this.playerSurrendered){
   this.ciwsAmmo-=3;this.ciwsCooldown=.1;incoming.hp-=6;
   this.defenseTraces.push({start:shipPointToEncounter([0,5.6,-2],voyage),end:[...incoming.position],seconds:.12});
   if(incoming.hp<=0){incoming.seconds=0;burst(incoming.position);}
  }
 }
 interceptPlayerMissile(shot){
  const target=this.combatTargets.find(t=>t.id===shot.id);
  if(shot.decoy||!target||!shot.origin||this.elapsed<target.defenseReady)return false;
  const progress=1-shot.seconds/shot.total;
  const position=missileTrailPoint(shot.origin,target.position,progress,shot.id.length*.7);
  const distance=Math.hypot(...target.position.map((n,i)=>n-position[i]));
  if(distance>120)return false;
  if(target.ciwsAmmo>=3&&distance<=90){
   target.ciwsAmmo-=3;
   this.defenseTraces.push({start:[...target.position],end:position,seconds:.12});
  }else if(target.flareAmmo>0){
   target.flareAmmo--;
   const decoy=target.position.map((n,i)=>n+[16,10,-22][i]);
   this.flares.push({position:decoy,velocity:[20,8,-15],seconds:2});
   shot.decoy=decoy;
   target.defenseReady=this.elapsed+4;
   return false;
  }else return false;
  target.defenseReady=this.elapsed+2;
  shot.seconds=0;
  this.defenseBursts.push({position,seconds:.55,total:.55});
  return true;
 }
 systemSnapshot(){return {fireControl:this.fireControl,ciwsEnabled:this.ciwsEnabled,ciwsAmmo:this.ciwsAmmo,flareAmmo:this.flareAmmo,rescueWait:Math.max(0,this.rescueAfter-this.elapsed),rechargeWait:Math.max(0,8-(this.elapsed-this.lastHit)),player:{hp:this.player.hp,shield:this.player.shield},parts:{...this.parts},supplies:{...this.supplies}};}
 refuel(voyage,rescue=false){
  if(!voyage)return {ok:false,message:"宇宙船がありません"};
  if(voyage.fuel>=100)return {ok:false,message:"燃料は満タンです"};
  if(rescue){
   if(voyage.fuel>0||this.elapsed<this.rescueAfter)return {ok:false,message:"救援補給は燃料切れ時に利用できます（再要請は120秒後）"};
   voyage.fuel=20;this.rescueAfter=this.elapsed+120;
  }else{
   if(this.supplies.fuel<=0)return {ok:false,message:"予備燃料がありません。燃料切れ時は救援補給を要請してください"};
   this.supplies.fuel--;voyage.fuel=Math.min(100,voyage.fuel+35);
  }
  voyage.shipSystems=this.systemSnapshot();return {ok:true,message:rescue?"🚚 救援補給で燃料20%を受領":"⛽ 予備燃料を補給しました"};
 }
 repairPart(key){
  if(!Object.hasOwn(this.parts,key)||this.parts[key]>=100&&this.player.hp>=100)return {ok:false,message:"修理の必要はありません"};
  if(this.supplies.kits<=0)return {ok:false,message:"修理キットがありません"};
  this.supplies.kits--;this.parts[key]=Math.min(100,this.parts[key]+35);this.player.hp=Math.min(100,this.player.hp+20);
  return {ok:true,message:"🔧 選択箇所を修理しました"};
 }
 emitRadio(message,targetId=null,kind="message"){
  this.radioEvents.push({id:++this.radioSequence,message,targetId,kind});
  this.radioEvents=this.radioEvents.slice(-8);
  this.lastMessage=message;
 }
 get combatTargets(){return this.liveTargets.filter(t=>t.faction==="hostile"&&!t.surrendered);}
 get allContacts(){return [...this.liveTargets,...this.nonHostiles];}
 demandSurrender(id=null){
  if(this.playerSurrendered)return {ok:false,message:"降伏中は交渉を開始できません"};
  const target=this.combatTargets.find(t=>t.id===(id||this.locked[0]))||
   this.combatTargets.slice().sort((a,b)=>a.distance-b.distance)[0];
  if(!target)return {ok:false,message:"交渉可能な敵船はいません"};
  if(target.hp<=target.maxHp*.65&&target.shield<=25){
   target.surrendered=true;this.locked=this.locked.filter(n=>n!==target.id);
   this.emitRadio("🏳️ "+target.name+"：降伏を受諾。機関停止・兵装解除。",target.id,"surrender");
   return {ok:true,message:"🏳️ 敵船が降伏しました"};
  }
  this.emitRadio("☠️ "+target.name+"：降伏勧告を拒否する。こちらに近づくな。",target.id,"refusal");
  return {ok:false,message:"降伏勧告は拒否されました"};
 }
 requestCeasefire(){
  if(!this.combatTargets.length)return {ok:false,message:"交渉相手がいません"};
  if(this.combatTargets.some(t=>t.shield<35||t.hp<t.maxHp*.65)){
   this.ceasefireUntil=this.elapsed+15;
   this.emitRadio("📻 停戦を15秒間受諾。交戦再開には注意。",null,"ceasefire");
   return {ok:true,message:"📻 15秒間の停戦が成立しました"};
  }
  this.emitRadio("☠️ 海賊船：停戦交渉を拒否。貨物を渡せ。",null,"refusal");
  return {ok:false,message:"停戦交渉は拒否されました"};
 }
 offerSurrender(){
  if(this.playerSurrendered){
   this.playerSurrendered=false;
   this.emitRadio("📻 こちらの降伏を撤回した。",null,"resumed");
   return {ok:true,message:"⚔️ 武装を再起動しました"};
  }
  this.playerSurrendered=true;this.locked=[];
  this.emitRadio("📻 こちらは降伏する。武装停止・交戦停止を要請。",null,"player-surrender");
  return {ok:true,message:"🏳️ 降伏を通告しました。兵装停止"};
 }
 respondSurrender(id,accept=true){
  const t=this.targets.find(t=>t.id===id);
  if(!t?.offeredSurrender||t.hp<=0)return {ok:false,message:"降伏の申し出はありません"};
  t.offeredSurrender=false;t.surrenderResolved=true;
  if(accept){t.surrendered=true;this.locked=this.locked.filter(n=>n!==id);}
  this.emitRadio(accept?"🏳️ "+t.name+"：降伏を受け入れた。攻撃を停止。":
   "☠️ "+t.name+"：降伏を拒否された。戦闘を継続。",id,accept?"surrender":"refusal");
  return {ok:true,message:accept?"敵船の降伏を受諾しました":"敵船の降伏を拒否しました"};
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
   this.combatTargets.some(t=>t.id===p.id&&t.hp>0)).map(p=>p.id):[]);
  this.locked=this.locked.filter(id=>eligible&&this.combatTargets.some(t=>t.id===id&&shipContactDistance(t,voyage)<=1500));
  if(this.fireControl&&eligible&&!this.playerSurrendered){
   const candidates=this.combatTargets.filter(t=>this.visible.has(t.id)&&!this.locked.includes(t.id))
    .map(t=>({id:t.id,range:shipContactDistance(t,voyage)})).filter(t=>t.range<=1500)
    .sort((a,b)=>a.range-b.range);
   for(const target of candidates){
    if(this.locked.length>=this.config.locks)break;
    this.acquire(target.id);
   }
  }
  this.updateTurrets(dt,voyage);
  if(this.autoFire&&eligible&&this.cooldown<=0)this.fire(true);
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
  if(!this.visible.has(id)||!this.combatTargets.some(t=>t.id===id&&t.hp>0))return false;
  if(this.locked.includes(id))return true;
  if(this.config.locks===1)this.locked=[id];
  else{
   if(this.locked.length>=this.config.locks)return false;
   this.locked.push(id);
  }
  return true;
 }
 updateTurrets(dt,voyage=this.voyage){
  const target=this.combatTargets.find(t=>t.id===this.locked[0]);
  for(const mount of this.turrets){
   mount.targetId=target?.id||null;mount.aligned=false;
   if(target&&mount.enabled){
    const seconds=mount.weapon==="pulse"?shipContactDistance(target,voyage)/900:0;
    const predicted={...target,position:target.position.map((n,i)=>n+target.velocity[i]*seconds)};
    aimTurret(mount,shipContactPosition(predicted,voyage),dt);
   }
  }
 }
 fire(eligible=true){
  if(!eligible)return {ok:false,message:"操縦席に着席し、宇宙航行中に使用してください"};
  if(this.playerSurrendered)return {ok:false,message:"降伏中は発射できません。通信メニューから降伏を撤回してください"};
  if(this.parts.weapons<=0)return {ok:false,message:"兵装が損傷しています。整備メニューから修理してください"};
  if(this.cooldown>0)return {ok:false,message:"兵装を再装填しています"};
  if(!this.locked.length)return {ok:false,message:"敵機をロックオンしてください"};
  if(this.weapon==="missile"&&this.missiles<=0)return {ok:false,message:"ミサイル残弾がありません"};
  const shots=this.locked.slice(0,this.weapon==="missile"?
   Math.min(this.config.locks,this.missiles):this.config.locks);
  const hits=[];
  for(const id of shots){
   const target=this.targets.find(t=>t.id===id);
   if(!target||target.hp<=0||target.surrendered||shipContactDistance(target,this.voyage)>1500)continue;
   const mount=this.turrets.find(m=>m.enabled&&(m.weapon===this.weapon||this.weapon==="rapid"&&m.weapon==="pulse")&&m.aligned&&m.targetId===(this.weapon==="missile"?this.locked[0]:id));
   if(this.voyage&&!mount)continue;
   const seconds=this.weapon==="missile"?Math.max(.35,target.distance/250):Math.max(.08,target.distance/900);
   this.projectiles.push({id,weapon:this.weapon,seconds,total:seconds,damage:this.config.damage,enemy:false,muzzle:mount?[mount.x,mount.y,mount.z]:[0,2,-7],
    origin:this.voyage?shipPointToEncounter(mount?[mount.x,mount.y,mount.z]:[0,2,-7],this.voyage):null,
    impact:this.voyage&&this.weapon!=="missile"?target.position.map((n,i)=>n+target.velocity[i]*seconds):null});
   hits.push({id,name:target.name,pending:true,hp:target.hp});
  }
  if(!hits.length)return {ok:false,message:"砲塔旋回中、または対応する兵装が無効です"};
  if(this.weapon==="missile")this.missiles-=hits.length;
  if(this.elapsed<this.ceasefireUntil){
   this.ceasefireUntil=this.elapsed;
   this.emitRadio("⚠️ こちらの発砲により停戦が破棄された。",null,"ceasefire-broken");
  }
  this.cooldown=this.config.cooldown;
  this.locked=this.locked.filter(id=>this.combatTargets.some(t=>t.id===id&&t.hp>0)&&shipContactDistance(this.targets.find(t=>t.id===id),this.voyage)<=1500);
  const message="🚀 "+this.config.name+" "+hits.length+"発発射";
  this.lastMessage=message;
  return {ok:true,message,hits};
 }
}
