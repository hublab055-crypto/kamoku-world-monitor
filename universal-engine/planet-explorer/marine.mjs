import {geoOffset,geoLocal,terrainSurface} from "./geo.mjs?v=0.8b-river-valley";
import {VoyageLog} from "./circumnavigation.mjs?v=0.8m-geodesic";
import {ShipFishing,SHIP_FURNITURE} from "./ship-life.mjs?v=0.8m-fishing";

/** Ocean gameplay uses the same terrain sampler as collision and the orbit picker. */
export const isWater = s => Boolean(s?.water || s?.river);
const validLand = s => !isWater(s) && s.elevationM >= 1 && s.elevationM < 2800;
const fail = message => ({ok:false,message});

/** Never convert a sea click into an unsafe land spawn.
 * Shore snapping is explicit in the preview and limited to 100 km. */
export function resolveLanding(terrain,lat,lon,mode="land"){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90)
  return fail("降下地点の座標が不正です");
 const first=terrainSurface(terrain,lat,lon);
 if(mode==="sea"||mode==="sea-ship"){
  if(mode==="sea-ship")
   return first.water&&!first.river?
    {ok:true,lat,lon,mode:"sea-ship",movedM:0}:
    fail("帆船での降下は海の上を指定してください（川・陸地は不可）");
  return isWater(first)?{ok:true,lat,lon,mode:"sea",movedM:0}:
   fail("海上降下は海・川の上を選択してください");
 }
 if(mode!=="land")return fail("降下方式が不正です");
 if(validLand(first))return {ok:true,lat,lon,mode:"land",movedM:0};
 // Rendered orbital cells are much coarser than the ground-height sampler.
 // Search only near the clicked shoreline; no teleport across an ocean.
 const radius=terrain.planet.radiusM;
 for(const d of [500,1500,4000,8000,15000,25000,40000,65000,100000]){
  let best=null;
  for(let i=0;i<48;i++){
   const a=i*2*Math.PI/48,p=geoOffset(lat,lon,Math.cos(a)*d,Math.sin(a)*d,radius);
   const sample=terrainSurface(terrain,p.lat,p.lon);
   if(!validLand(sample))continue;
   if(!best||sample.elevationM<best.height)best={lat:p.lat,lon:p.lon,height:sample.elevationM};
  }
  if(best)return {ok:true,lat:best.lat,lon:best.lon,mode:"land",movedM:d};
 }
 return fail("選択した周辺100km以内に安全な陸地がありません。海上降下を選ぶか別の陸地を指定してください");
}

export const BOATS=Object.freeze({
 raft:{name:"木のいかだ",cost:{wood:10,fiber:6},speed:4.2},
 canoe:{name:"手こぎ舟",cost:{wood:18,fiber:10},speed:6.8},
 sailing_ship:{name:"外洋用中型帆船",cost:{wood:85,plank:45,fiber:45,metal:8},speed:8.5,deckY:1.65}
});
export function waveHeight(x,z,seconds,wind=1){
 const v=Math.max(0,Math.min(2,Number.isFinite(wind)?wind:1));
 return (.11*Math.sin(x*.13+seconds*1.35*v+z*.035)+
         .065*Math.sin(z*.19-seconds*.92*v+x*.04)+
         .035*Math.cos((x-z)*.32+seconds*1.71*v));
}
/** A bounded, low-poly moving surface only above actual ocean, never over land. */
export function oceanWavePatch(terrain,origin,cx,cz,seconds,{radius=110,cells=26}={}){
 const positions=[],normals=[],colors=[],indices=[];
 const grid=[],water=[],step=2*radius/cells;
 for(let j=0;j<=cells;j++)for(let i=0;i<=cells;i++){
  const x=cx-radius+i*step,z=cz-radius+j*step;
  const geo=geoOffset(origin.lat,origin.lon,x,z,terrain.planet.radiusM);
  const sample=terrainSurface(terrain,geo.lat,geo.lon);
  grid.push([x,waveHeight(x,z,seconds)+.08,z]);
  water.push(Boolean(sample.water));
 }
 for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){
  const a=j*(cells+1)+i,b=a+1,c=a+cells+1,d=c+1;
  if(!water[a]||!water[b]||!water[c]||!water[d])continue;
  const k=positions.length/3;
  for(const n of [a,c,b,d]){
   positions.push(...grid[n]);normals.push(0,1,0);
   const fleck=.025*Math.sin(grid[n][0]*.31+seconds*.7);
   colors.push(.08+fleck,.35+fleck,.56+fleck);
  }
  indices.push(k,k+1,k+2,k+2,k+1,k+3);
 }
 return {positions,normals,colors,indices};
}
export function fishAt(seed,x,z,t=0,count=11){
 // A deterministic school with slow movement; keep models near the avatar.
 return Array.from({length:count},(_,i)=>{
  const a=(seed%97+i*2.399963),r=11+(i%6)*6;
  return {x:x+Math.cos(a+t*.07)*r+Math.sin(t*.22+i)*2,
          z:z+Math.sin(a+t*.07)*r+Math.cos(t*.17+i)*2,
          yaw:a+t*.14,depthM:1.0+(i%4)*.6,kind:i%3};
 });
}
export class MarineWorld{
 constructor(data=null){
  this.boats=[];this.nextId=1;this.boardedId=null;
  this.diving=false;this.depthM=0;this.oxygen=100;
  this.cabinId=null;this.cabinActivity="idle";
  this.fishing=new ShipFishing(data?.fishing);
  this.voyage=new VoyageLog(data?.voyage);this.justCompletedLap=false;
  if(data?.version===1&&Array.isArray(data.boats)){
   this.boats=data.boats.slice(0,64).filter(b=>Object.hasOwn(BOATS,b.kind)&&
    [b.lat,b.lon,b.yaw].every(Number.isFinite)&&Math.abs(b.lat)<=90&&Math.abs(b.lon)<=180)
    .map(b=>({id:String(b.id),kind:b.kind,lat:b.lat,lon:b.lon,yaw:b.yaw,
     sailTrim:b.kind==="sailing_ship"&&Number.isFinite(b.sailTrim)?Math.max(0,Math.min(1,b.sailTrim)):.65,
     cruise:b.kind==="sailing_ship"&&Boolean(b.cruise),
     anchor:b.kind==="sailing_ship"&&Boolean(b.anchor)}));
   this.nextId=Math.max(1,...this.boats.map(b=>Number(b.id.replace(/^boat-/,""))||0))+1;
   this.boardedId=this.boats.some(b=>b.id===data.boardedId)?data.boardedId:null;
   this.cabinId=data.cabinId===this.boardedId&&this.boats.find(b=>b.id===data.cabinId)?.kind==="sailing_ship"?data.cabinId:null;
   this.cabinActivity=this.cabinId&&Object.keys(SHIP_FURNITURE).includes(data.cabinActivity)?data.cabinActivity:"idle";
   this.oxygen=Number.isFinite(data.oxygen)?Math.max(0,Math.min(100,data.oxygen)):100;
   this.diving=Boolean(data.diving&&!this.boardedId);
   this.depthM=this.diving&&Number.isFinite(data.depthM)?Math.max(0,Math.min(12,data.depthM)):0;
  }
 }
 get boarded(){return this.boats.find(b=>b.id===this.boardedId)||null;}
 /** Sail speed is a fraction of the game-tuned hull speed; dropped anchor halts it. */
 sailingSpeed(boat=this.boarded){
  if(!boat)return 4.2;
  if(boat.kind!=="sailing_ship")return BOATS[boat.kind]?.speed||4.2;
  return boat.anchor?0:BOATS.sailing_ship.speed*Math.max(0,Math.min(1,boat.sailTrim||0));
 }
 /** Spawn at an explicitly chosen ocean coordinate without using crafting resources.
  * Reuse an existing ocean-going ship at the same landing point to avoid duplicates.
  */
 spawnLandingShip(controller,terrain){
  const surface=terrainSurface(terrain,controller.lat,controller.lon);
  if(!surface.water||surface.river)return fail("中型帆船での降下は海上でのみ可能です");
  if(this.boardedId)return fail("ほかの船に乗船中です。先に降りてください");
  const existing=this.nearby(controller,14)
   .find(b=>b.kind==="sailing_ship"&&terrainSurface(terrain,b.lat,b.lon).water);
  if(!existing&&this.boats.length>=64)return fail("船が64隻あるため、新しい中型帆船を配置できません");
  const vessel=existing?this.boats.find(b=>b.id===existing.id):{
   id:"boat-"+this.nextId++,kind:"sailing_ship",lat:controller.lat,lon:controller.lon,
   yaw:controller.yaw,sailTrim:.65,cruise:false,anchor:false
  };
  if(!existing)this.boats.push(vessel);
  this.boardedId=vessel.id;this.diving=false;this.depthM=0;this.oxygen=100;
  // Spawn at the helm; this is a transport, not an infinite source of materials.
  if(existing){
   controller.x=existing.x;controller.z=existing.z;
   controller.lat=vessel.lat;controller.lon=vessel.lon;controller.yaw=vessel.yaw;
  }
  controller.travelMode="boat";controller.boatOceanOnly=true;controller.clearMoveTarget();
  this.cabinId=null;this.cabinActivity="idle";this.fishing.stop();
  this.voyage=new VoyageLog(null,{lat:vessel.lat,lon:vessel.lon});
  controller.boatSpeed=this.sailingSpeed(vessel);
  return {ok:true,boat:vessel,message:"⛵ 外洋用中型帆船の甲板に降下しました。帆・舵・巡航と下船を操作できます"};
 }
 setSails(trim){
  const boat=this.boarded;
  if(boat?.kind!=="sailing_ship")return fail("帆の調整は中型帆船に乗っている間だけ可能です");
  if(!Number.isFinite(trim)||trim<0||trim>1)return fail("帆の開き具合は0〜100%を指定してください");
  boat.sailTrim=Math.round(trim*100)/100;
  if(boat.sailTrim===0)boat.cruise=false;
  return {ok:true,message:"⛵ 帆の開き具合を"+Math.round(boat.sailTrim*100)+"%に調整しました"};
 }
 setCruise(enabled){
  const boat=this.boarded;
  if(boat?.kind!=="sailing_ship")return fail("巡航は中型帆船に乗っている間だけ操作できます");
  if(enabled){
   if(boat.anchor)return fail("錨を上げてから巡航してください");
   if(boat.sailTrim<=0)return fail("帆を開いてから巡航してください");
  }
  boat.cruise=Boolean(enabled);
  return {ok:true,message:boat.cruise?"⛵ 巡航開始。帆走しながら舵を操作できます":
   "⛵ 自動巡航を解除しました"};
 }
 setAnchor(enabled){
  const boat=this.boarded;
  if(boat?.kind!=="sailing_ship")return fail("投錨は中型帆船に乗っている間だけ操作できます");
  boat.anchor=Boolean(enabled);
  if(boat.anchor)boat.cruise=false;
  return {ok:true,message:boat.anchor?"⚓ 投錨しました。船を停止します":"⚓ 揚錨しました。帆を張って航海できます"};
 }
 steer(deltaRadians,controller){
  const boat=this.boarded;
  if(boat?.kind!=="sailing_ship")return fail("舵は中型帆船に乗っている間だけ操作できます");
  if(!Number.isFinite(deltaRadians)||Math.abs(deltaRadians)>Math.PI/2)return fail("舵角が不正です");
  controller.clearMoveTarget();controller.turn(deltaRadians);boat.yaw=controller.yaw;
  return {ok:true,message:"🧭 船首の向きを"+Math.round(((boat.yaw*180/Math.PI)%360+360)%360)+"°に変更しました"};
 }
 /** Cabin is ship-relative, so sleeping and sitting remain valid while sailing. */
 enterCabin(){
  const boat=this.boarded;
  if(boat?.kind!=="sailing_ship")return fail("中型帆船に乗っている間だけ船室に入れます");
  this.cabinId=boat.id;this.cabinActivity="idle";this.fishing.stop();
  return {ok:true,message:"🚪 甲板から船室へ入りました。ベッド・椅子・食卓・本棚が使えます"};
 }
 exitCabin(){
  if(!this.cabinId)return fail("船室には入っていません");
  this.cabinId=null;this.cabinActivity="idle";
  return {ok:true,message:"⛵ 船室から甲板へ出ました。釣りや操船ができます"};
 }
 cabinUse(kind){
  if(!this.cabinId||this.cabinId!==this.boardedId)return fail("まず船室に入ってください");
  const spec=SHIP_FURNITURE[kind];
  if(!spec)return fail("船室にその家具はありません");
  this.cabinActivity=kind;
  return {ok:true,kind,message:spec.icon+" "+spec.name+"を使います"};
 }
 castLine(controller,terrain){
  const surface=terrainSurface(terrain,controller.lat,controller.lon);
  const boat=this.boarded;
  const atWater=isWater(surface)||(boat&&boat.kind==="sailing_ship");
  if(!atWater){
   // Shore casting is possible if there is navigable water less than 15 m away.
   let coast=false;
   for(let r=3;r<=15&&!coast;r+=3)for(let i=0;i<16;i++){
    const a=i*2*Math.PI/16,p=controller.locationAt(controller.x+Math.cos(a)*r,
     controller.z+Math.sin(a)*r);
    if(isWater(terrainSurface(terrain,p.lat,p.lon))){coast=true;break;}
   }
   if(!coast)return fail("釣りには海岸または船の甲板が必要です");
  }
  if(!boat&&isWater(surface))return fail("水泳中は釣れません。浜辺か船へ移動してください");
  return this.fishing.cast({water:true,aboard:Boolean(boat),inCabin:Boolean(this.cabinId)});
 }
 tickFishing(dt,seed){return this.fishing.advance(dt,seed);}
 reelFish(resources){return this.fishing.reel(resources);}
 stopFishing(){return this.fishing.stop();}
 mode(controller,terrain){
  if(this.boarded)return "boat";
  const water=isWater(terrainSurface(terrain,controller.lat,controller.lon));
  if(!water){this.diving=false;this.depthM=0;return "walk";}
  return this.diving?"dive":"swim";
 }
 update(dt,controller,terrain){
  const mode=this.mode(controller,terrain);
  controller.travelMode=mode;
  this.justCompletedLap=false;
  if(!this.boarded&&this.cabinId)this.cabinId=null;
  controller.boatOceanOnly=this.boarded?.kind==="sailing_ship";
  // A vessel under cruising sail keeps its course when its captain jumps
  // into the water. Never advance the currently boarded boat twice.
  if(dt>0){
   for(const vessel of this.boats){
    if(vessel.id===this.boardedId||vessel.kind!=="sailing_ship"||
       !vessel.cruise||vessel.anchor||vessel.sailTrim<=0)continue;
    const speed=BOATS.sailing_ship.speed*vessel.sailTrim,travel=Math.min(dt,.25)*speed;
    const steps=Math.max(1,Math.ceil(travel/1.5));
    let latitude=vessel.lat,longitude=vessel.lon,blocked=false;
    for(let i=0;i<steps;i++){
     const next=geoOffset(latitude,longitude,Math.sin(vessel.yaw)*travel/steps,
      Math.cos(vessel.yaw)*travel/steps,terrain.planet.radiusM);
     const area=terrainSurface(terrain,next.lat,next.lon);
     if(!area.water||area.river){blocked=true;break;}
     latitude=next.lat;longitude=next.lon;
    }
    vessel.lat=latitude;vessel.lon=longitude;
    if(blocked)vessel.cruise=false;
   }
  }
  if(mode==="boat"){
   const boat=this.boarded,geo=controller.locationAt(controller.x,controller.z);
   boat.lat=geo.lat;boat.lon=geo.lon;boat.yaw=controller.yaw;
   if(boat.kind==="sailing_ship"&&dt>0)this.justCompletedLap=this.voyage.advance(boat.lat,boat.lon,terrain.planet.radiusM);
   this.oxygen=Math.min(100,this.oxygen+dt*14);this.depthM=0;
  }else if(mode==="dive"){
   this.depthM=Math.min(12,this.depthM+dt*1.4);
   this.oxygen=Math.max(0,this.oxygen-dt*8);
   if(this.oxygen===0){this.diving=false;this.depthM=0;}
  }else{
   this.depthM=Math.max(0,this.depthM-dt*2);
   this.oxygen=Math.min(100,this.oxygen+dt*18);
  }
  return mode;
 }
 dive(controller,terrain){
  if(this.boarded)return fail("船から降りてから潜ってください");
  if(!isWater(terrainSurface(terrain,controller.lat,controller.lon)))return fail("潜水は水面で開始してください");
  this.diving=!this.diving;
  if(!this.diving)this.depthM=0;
  return {ok:true,message:this.diving?"🤿 潜水開始。酸素ゲージに注意してください":"🌊 水面へ浮上しました"};
 }
 nearby(controller,limit=30){
  // Always compute nearby vessels from CURRENT geodetic coordinates.
  // A fixed-origin inverse geodesic fails after crossing half the planet.
  const here={lat:controller.lat,lon:controller.lon};
  return this.boats.map(boat=>{
   const m=geoLocal(here.lat,here.lon,boat.lat,boat.lon,controller.terrain.planet.radiusM);
   const x=controller.x+m.eastM,z=controller.z+m.northM;
   const range=Math.hypot(m.eastM,m.northM);
   return {...boat,x,z,range};
  }).filter(b=>b.range<=limit).sort((a,b)=>a.range-b.range);
 }
 launchPoint(controller,terrain){
  const at=(x,z)=>{const geo=controller.locationAt(x,z);return {geo,s:terrainSurface(terrain,geo.lat,geo.lon),x,z};};
  const here=at(controller.x,controller.z);
  if(isWater(here.s))return here;
  for(let d=3;d<=32;d+=2){
   for(let i=0;i<32;i++){
    const a=i*2*Math.PI/32;
    const p=at(controller.x+Math.cos(a)*d,controller.z+Math.sin(a)*d);
    if(isWater(p.s))return p;
   }
  }
  return null;
 }
 craft(kind,controller,terrain,resources){
  const spec=BOATS[kind];
  if(!spec)return fail("船の種類が不正です");
  if(!controller.nearGround)return fail("地表に降りてから造船してください");
  if(this.boats.length>=64)return fail("船の設置上限です");
  const point=this.launchPoint(controller,terrain);
  if(!point)return fail("浜辺・入り江・川岸の近く（32m以内）へ移動してください");
  if(kind==="sailing_ship"&&(!point.s.water||point.s.river))return fail("中型帆船の進水には外洋につながる海岸が必要です");
  if(Object.entries(spec.cost).some(([key,n])=>(resources[key]||0)<n))
   return fail("資材不足："+Object.entries(spec.cost).map(([key,n])=>key+" "+n).join("、"));
  if(this.nearby(controller,9).some(b=>Math.hypot(b.x-point.x,b.z-point.z)<5))
   return fail("近くに船があります。少し離して造船してください");
  for(const [key,n] of Object.entries(spec.cost))resources[key]-=n;
  const boat={id:"boat-"+this.nextId++,kind,lat:point.geo.lat,lon:point.geo.lon,yaw:controller.yaw,
   sailTrim:kind==="sailing_ship"?.65:1,cruise:false,anchor:false};
  this.boats.push(boat);
  return {ok:true,boat,message:"🛶 "+spec.name+"を進水しました。『乗船』で航海できます"};
 }
 board(controller,terrain){
  if(this.boarded)return fail("すでに乗船しています");
  const nearest=this.nearby(controller,32)[0];
  if(!nearest)return fail("32m以内に船がありません");
  if(!isWater(terrainSurface(terrain,nearest.lat,nearest.lon)))return fail("船が陸上にあります");
  this.boardedId=nearest.id;this.diving=false;this.depthM=0;this.cabinId=null;this.cabinActivity="idle";
  controller.x=nearest.x;controller.z=nearest.z;controller.lat=nearest.lat;controller.lon=nearest.lon;
  controller.yaw=nearest.yaw;controller.moveTarget=null;controller.travelMode="boat";
  controller.boatOceanOnly=nearest.kind==="sailing_ship";
  controller.boatSpeed=this.sailingSpeed(this.boarded);
  return {ok:true,message:"🛶 乗船しました。スティックまたはダブルタップで航海できます"};
 }
 leave(controller,terrain){
  if(!this.boarded)return fail("乗船中ではありません");
  if(this.cabinId)return fail("船室から甲板へ出てから下船してください");
  this.fishing.stop();
  for(let d=2;d<=24;d+=2)for(let i=0;i<32;i++){
   const a=i*2*Math.PI/32,x=controller.x+Math.cos(a)*d,z=controller.z+Math.sin(a)*d;
   const geo=controller.locationAt(x,z),s=terrainSurface(terrain,geo.lat,geo.lon);
   if(validLand(s)){
    this.boardedId=null;controller.x=x;controller.z=z;controller.lat=geo.lat;controller.lon=geo.lon;
    controller.travelMode="walk";controller.boatOceanOnly=false;controller.clearMoveTarget();
    return {ok:true,message:"🏝️ 浜辺に上陸しました"};
   }
  }
  this.boardedId=null;controller.travelMode="swim";controller.boatOceanOnly=false;controller.clearMoveTarget();
  return {ok:true,message:"🌊 船から水面へ降りました。泳いで岸へ向かえます"};
 }
 snapshot(){return {version:1,boats:this.boats.map(b=>({...b})),nextId:this.nextId,
  boardedId:this.boardedId,diving:this.diving,depthM:this.depthM,oxygen:this.oxygen,
  cabinId:this.cabinId,cabinActivity:this.cabinActivity,
  fishing:this.fishing.snapshot(),voyage:this.voyage.snapshot()};}
}
