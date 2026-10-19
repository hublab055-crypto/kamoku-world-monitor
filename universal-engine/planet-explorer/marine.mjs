import {geoOffset,geoLocal,terrainSurface} from "./geo.mjs?v=0.8b-river-valley";

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
  if(data?.version===1&&Array.isArray(data.boats)){
   this.boats=data.boats.slice(0,64).filter(b=>Object.hasOwn(BOATS,b.kind)&&
    [b.lat,b.lon,b.yaw].every(Number.isFinite)&&Math.abs(b.lat)<=90&&Math.abs(b.lon)<=180)
    .map(b=>({id:String(b.id),kind:b.kind,lat:b.lat,lon:b.lon,yaw:b.yaw}));
   this.nextId=Math.max(1,...this.boats.map(b=>Number(b.id.replace(/^boat-/,""))||0))+1;
   this.boardedId=this.boats.some(b=>b.id===data.boardedId)?data.boardedId:null;
   this.oxygen=Number.isFinite(data.oxygen)?Math.max(0,Math.min(100,data.oxygen)):100;
   this.diving=Boolean(data.diving&&!this.boardedId);
   this.depthM=this.diving&&Number.isFinite(data.depthM)?Math.max(0,Math.min(12,data.depthM)):0;
  }
 }
 get boarded(){return this.boats.find(b=>b.id===this.boardedId)||null;}
 mode(controller,terrain){
  if(this.boarded)return "boat";
  const water=isWater(terrainSurface(terrain,controller.lat,controller.lon));
  if(!water){this.diving=false;this.depthM=0;return "walk";}
  return this.diving?"dive":"swim";
 }
 update(dt,controller,terrain){
  const mode=this.mode(controller,terrain);
  controller.travelMode=mode;
  if(mode==="boat"){
   const boat=this.boarded,geo=controller.locationAt(controller.x,controller.z);
   boat.lat=geo.lat;boat.lon=geo.lon;boat.yaw=controller.yaw;
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
  return this.boats.map(boat=>{
   const m=geoLocal(controller.origin.lat,controller.origin.lon,boat.lat,boat.lon,controller.terrain.planet.radiusM);
   const range=Math.hypot(m.eastM-controller.x,m.northM-controller.z);
   return {...boat,x:m.eastM,z:m.northM,range};
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
  if(Object.entries(spec.cost).some(([key,n])=>(resources[key]||0)<n))
   return fail("資材不足："+Object.entries(spec.cost).map(([key,n])=>key+" "+n).join("、"));
  if(this.nearby(controller,9).some(b=>Math.hypot(b.x-point.x,b.z-point.z)<5))
   return fail("近くに船があります。少し離して造船してください");
  for(const [key,n] of Object.entries(spec.cost))resources[key]-=n;
  const boat={id:"boat-"+this.nextId++,kind,lat:point.geo.lat,lon:point.geo.lon,yaw:controller.yaw};
  this.boats.push(boat);
  return {ok:true,boat,message:"🛶 "+spec.name+"を進水しました。『乗船』で航海できます"};
 }
 board(controller,terrain){
  if(this.boarded)return fail("すでに乗船しています");
  const nearest=this.nearby(controller,32)[0];
  if(!nearest)return fail("32m以内に船がありません");
  if(!isWater(terrainSurface(terrain,nearest.lat,nearest.lon)))return fail("船が陸上にあります");
  this.boardedId=nearest.id;this.diving=false;this.depthM=0;
  controller.x=nearest.x;controller.z=nearest.z;controller.lat=nearest.lat;controller.lon=nearest.lon;
  controller.yaw=nearest.yaw;controller.moveTarget=null;controller.travelMode="boat";
  return {ok:true,message:"🛶 乗船しました。スティックまたはダブルタップで航海できます"};
 }
 leave(controller,terrain){
  if(!this.boarded)return fail("乗船中ではありません");
  const now=this.launchPoint(controller,terrain); // keep boat at sea
  for(let d=2;d<=24;d+=2)for(let i=0;i<32;i++){
   const a=i*2*Math.PI/32,x=controller.x+Math.cos(a)*d,z=controller.z+Math.sin(a)*d;
   const geo=controller.locationAt(x,z),s=terrainSurface(terrain,geo.lat,geo.lon);
   if(validLand(s)){
    this.boardedId=null;controller.x=x;controller.z=z;controller.lat=geo.lat;controller.lon=geo.lon;
    controller.travelMode="walk";controller.clearMoveTarget();
    return {ok:true,message:"🏝️ 浜辺に上陸しました"};
   }
  }
  this.boardedId=null;controller.travelMode="swim";controller.clearMoveTarget();
  return {ok:true,message:"🌊 船から水面へ降りました。泳いで岸へ向かえます"};
 }
 snapshot(){return {version:1,boats:this.boats.map(b=>({...b})),nextId:this.nextId,
  boardedId:this.boardedId,diving:this.diving,depthM:this.depthM,oxygen:this.oxygen};}
}
