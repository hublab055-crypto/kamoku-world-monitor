/** Spacecraft fire-control effects and planetary cargo capsules.
 * Projectile rendering is visual only: collision/damage to other actors
 * is intentionally not claimed here. Dropped supplies are persisted until
 * deposited in the destination planet's recoverable cache.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const valid=n=>Number.isFinite(n);
const FIRE_STATES=new Set(["ascent","origin-orbit","parking-orbit","launch","cruise","approach","orbit","entry","descent"]);
const DROP_STATES=new Set(["entry","touchdown","landed"]);
const cleanShot=s=>s&&["x","y","z","vx","vy","vz","ttl"].every(k=>valid(s[k]))&&s.ttl>0;
const cleanDrop=d=>d&&typeof d.resource==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(d.resource)&&
 Number.isInteger(d.quantity)&&d.quantity>0&&d.quantity<=100&&typeof d.bodyId==="string"&&
 valid(d.lat)&&valid(d.lon);
export class ShipMissionActions {
 constructor(data={}){
  this.energy=clamp(valid(data?.energy)?data.energy:100,0,100);
  this.cooldown=clamp(valid(data?.cooldown)?data.cooldown:0,0,5);
  this.shots=(Array.isArray(data?.shots)?data.shots:[]).filter(cleanShot).slice(-24).map(s=>({...s}));
  this.drops=(Array.isArray(data?.drops)?data.drops:[]).filter(cleanDrop).slice(-64).map(d=>({...d}));
 }
 fire(voyage){
  if(!voyage||!FIRE_STATES.has(voyage.status))return {ok:false,message:"現在の航行段階では射撃できません"};
  if(voyage.seated===false)return {ok:false,message:"火器操作には操縦席への着席が必要です"};
  if(this.cooldown>0)return {ok:false,message:"火器の再装填中です"};
  if(this.energy<14)return {ok:false,message:"火器コンデンサの充電が不足しています"};
  const pitch=(voyage.flightControl?.pitch||0)*Math.PI/180;
  const heading=(voyage.heading||0)*Math.PI/180;
  const speed=48;
  this.shots.push({x:0,y:1.2,z:-16,vx:Math.sin(heading)*speed*Math.cos(pitch),
   vy:Math.sin(pitch)*speed,vz:-Math.cos(heading)*speed*Math.cos(pitch),ttl:4.5});
  if(this.shots.length>24)this.shots.shift();
  this.energy=clamp(this.energy-14,0,100);this.cooldown=.85;
  return {ok:true,message:"🔆 艦載パルス砲発射。残エネルギー "+Math.round(this.energy)+"%"};
 }
 drop(resources,resource,quantity,voyage){
  if(!voyage||!DROP_STATES.has(voyage.status))return {ok:false,message:"物資投下は着陸降下中または着陸後に行えます"};
  if(voyage.seated===false)return {ok:false,message:"物資投下には操縦席への着席が必要です"};
  const site=voyage.landingSite;
  if(!site||site.bodyId!==voyage.destinationId||![site.lat,site.lon].every(valid))
   return {ok:false,message:"投下先の安全な着陸地点が未確定です"};
  if(typeof resource!=="string"||!Object.hasOwn(resources||{},resource)||!/^[a-zA-Z0-9_-]{1,80}$/.test(resource))
   return {ok:false,message:"投下できる物資を選択してください"};
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)
   return {ok:false,message:"投下数は1～100個で指定してください"};
  if(!valid(resources[resource])||resources[resource]<quantity)
   return {ok:false,message:"船倉の在庫が不足しています"};
  if(this.drops.length>=64)return {ok:false,message:"投下カプセルが上限（64件）です"};
  const drop={id:"pod-"+Date.now().toString(36)+"-"+this.drops.length,
   resource,quantity,bodyId:site.bodyId,lat:site.lat,lon:site.lon,
   height:18,velocity:0};
  resources[resource]-=quantity;
  this.drops.push(drop);
  return {ok:true,drop,message:"📦 "+resource+" ×"+quantity+"を投下。着陸後に回収できます"};
 }
 tick(dt){
  const step=clamp(valid(dt)?dt:0,0,.12);
  this.cooldown=Math.max(0,this.cooldown-step);
  this.energy=clamp(this.energy+step*1.8,0,100);
  for(const shot of this.shots){
   shot.x+=shot.vx*step;shot.y+=shot.vy*step;shot.z+=shot.vz*step;shot.ttl-=step;
  }
  this.shots=this.shots.filter(cleanShot);
  for(const drop of this.drops){
   if(!valid(drop.height)||drop.height<=0)continue;
   drop.velocity=clamp((valid(drop.velocity)?drop.velocity:0)+9.81*step,0,50);
   drop.height=Math.max(0,drop.height-drop.velocity*step);
  }
 }
 snapshot(){
  return {schemaVersion:1,energy:this.energy,cooldown:this.cooldown,
   shots:this.shots.map(s=>({...s})),drops:this.drops.map(d=>({...d}))};
 }
}
