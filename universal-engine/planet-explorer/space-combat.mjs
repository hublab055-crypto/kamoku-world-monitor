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
 {id:"pirate-alpha",name:"☠️ 海賊迎撃機",bearing:0,pitch:0,distance:260,hp:100},
 {id:"pirate-beta",name:"☠️ 海賊護衛機",bearing:-13,pitch:4,distance:340,hp:100},
 {id:"pirate-gamma",name:"☠️ 海賊偵察機",bearing:17,pitch:-5,distance:400,hp:75}
]);
export function combatEligible(voyage){
 return Boolean(voyage?.active&&(voyage.seated===true||
  voyage.seated!==false&&voyage.interior?.mode==="cockpit")&&
  ["origin-orbit","parking-orbit","launch","cruise","approach","flyby","orbit"].includes(voyage.status));
}
/** Fixed inertial bearing relative to the departure attitude, displayed in vessel coordinates. */
export function shipContactPosition(target,voyage){
 const rad=Math.PI/180;
 const yaw=((Number(voyage?.attitudeYawDeg)||0)-(target.bearing||0))*rad;
 const pitch=((Number(voyage?.pitchDeg)||0)-(target.pitch||0))*rad;
 const d=target.distance;
 return [-Math.sin(yaw)*Math.cos(pitch)*d,2-Math.sin(pitch)*d,
  -Math.cos(yaw)*Math.cos(pitch)*d];
}
export class SpaceCombat{
 constructor(){
  this.targets=HOSTILES.map(t=>({...t}));
  this.weapon="pulse";this.missiles=SHIP_WEAPONS.missile.ammo;
  this.locked=[];this.visible=new Set();this.dwellId=null;this.dwellSeconds=0;
  this.cooldown=0;this.flashes=[];this.lastMessage="";
 }
 get config(){return SHIP_WEAPONS[this.weapon];}
 get liveTargets(){return this.targets.filter(t=>t.hp>0);}
 setWeapon(type){
  if(!SHIP_WEAPONS[type])return false;
  this.weapon=type;this.locked=this.locked.slice(0,this.config.locks);
  this.dwellId=null;this.dwellSeconds=0;return true;
 }
 /** Called after projection: rear, occluded/off-screen and dead targets immediately lose lock. */
 syncVisibility(projected=[],dt=0,{vr=false,eligible=true}={}){
  this.cooldown=Math.max(0,this.cooldown-clamp(Number.isFinite(dt)?dt:0,0,.12));
  for(const f of this.flashes)f.seconds=Math.max(0,f.seconds-clamp(dt||0,0,.12));
  this.flashes=this.flashes.filter(f=>f.seconds>0);
  this.visible=new Set(eligible?projected.filter(p=>p.onScreen&&
   Number.isFinite(p.u)&&Number.isFinite(p.v)&&
   p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1&&
   this.targets.some(t=>t.id===p.id&&t.hp>0)).map(p=>p.id):[]);
  this.locked=this.locked.filter(id=>this.visible.has(id));
  if(!vr||!eligible){this.dwellId=null;this.dwellSeconds=0;return;}
  // Gaze-center dwell is per target, not a general auto-acquire cone.
  const nearest=projected.filter(p=>this.visible.has(p.id)).
   map(p=>({...p,delta:Math.hypot(p.u-.5,p.v-.5)})).
   filter(p=>p.delta<.075).sort((a,b)=>a.delta-b.delta)[0];
  const id=nearest?.id||null;
  if(id!==this.dwellId){this.dwellId=id;this.dwellSeconds=0;}
  if(!id||this.locked.includes(id))return;
  this.dwellSeconds+=clamp(Number.isFinite(dt)?dt:0,0,.12);
  if(this.dwellSeconds>=.85){
   this.acquire(id);
   this.dwellId=null;this.dwellSeconds=0;
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
   target.hp=Math.max(0,target.hp-this.config.damage);
   hits.push({id,name:target.name,destroyed:target.hp===0,hp:target.hp});
   this.flashes.push({id,seconds:.5});
  }
  if(!hits.length){this.locked=[];return {ok:false,message:"目標が視界外です"};}
  if(this.weapon==="missile")this.missiles-=hits.length;
  this.cooldown=this.config.cooldown;
  this.locked=this.locked.filter(id=>this.targets.some(t=>t.id===id&&t.hp>0)&&this.visible.has(id));
  const destroyed=hits.filter(h=>h.destroyed).length;
  const message="🚀 "+this.config.name+" "+hits.length+"発命中"+
   (destroyed?"／敵機"+destroyed+"機撃破":"");
  this.lastMessage=message;
  return {ok:true,message,hits};
 }
}
