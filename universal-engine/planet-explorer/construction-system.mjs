/** Persistent placeable walls and civic facilities.
 * Building material quantities are the existing crafting item units;
 * harvestable kg is tracked separately for carrying weight.
 */
export const FACILITIES=Object.freeze({
 warehouse:{name:"共同倉庫",wood:14,stone:9,metal:2,footprint:7,color:[.45,.35,.25]},
 "general-store":{name:"日用品商店",wood:12,stone:5,metal:1,footprint:6,color:[.54,.46,.27]},
 smithy:{name:"鍛冶屋",wood:9,stone:14,metal:3,footprint:6,color:[.38,.35,.36]},
 apothecary:{name:"薬屋",wood:11,stone:7,metal:1,footprint:6,color:[.24,.52,.37]},
 bookshop:{name:"本屋",wood:13,stone:6,metal:1,footprint:6,color:[.31,.40,.58]},
 "magic-shop":{name:"魔法店",wood:13,stone:8,metal:3,footprint:7,color:[.41,.28,.59]},
 market:{name:"マーケット",wood:18,stone:9,metal:1,footprint:9,color:[.58,.32,.22]}
});
export const BUILD_KINDS=Object.freeze(["stone-wall",...Object.keys(FACILITIES)]);
export const WALL_LENGTH_M=2;
const neat=v=>Math.round(v*100)/100;
const costOf=(kind,count=1)=>kind==="stone-wall"?{stone:count*2}:{wood:FACILITIES[kind].wood,stone:FACILITIES[kind].stone,metal:FACILITIES[kind].metal};
const available=(materials,cost)=>Object.entries(cost).every(([k,n])=>(materials?.[k]||0)>=n);
export class ConstructionSystem{
 constructor(saved=null){
  this.structures=[];
  this.warehouseStocks=Object.fromEntries(Object.entries(saved?.warehouseStocks||{}).filter(([id,v])=>/^\d+$/.test(id)&&v&&typeof v==="object"));
  this.warehouseWeightKg=Object.fromEntries(Object.entries(saved?.warehouseWeightKg||{}).filter(([id,v])=>/^\d+$/.test(id)&&Number.isFinite(v)&&v>=0));
  this.nextId=1;
  if(saved){
   if(saved.version!==1||!Array.isArray(saved.structures)||saved.structures.length>3000)
    throw Error("建築データが不正です");
   for(const site of saved.structures){
    if(!BUILD_KINDS.includes(site.kind)||!Number.isFinite(site.x)||!Number.isFinite(site.z)||
     !Number.isFinite(site.height)||!Number.isFinite(site.rotation)||
     !Number.isFinite(site.id)||site.id<1)throw Error("建築位置が不正です");
    this.structures.push({...site});
   }
   this.nextId=Math.max(1,...this.structures.map(s=>s.id+1));
  }
 }
 inspect(kind,x,z,surfaceAt,existing=[]){
  if(!BUILD_KINDS.includes(kind))return {ok:false,message:"未対応の施設です"};
  if(![x,z].every(Number.isFinite))return {ok:false,message:"建築位置を指定してください"};
  const surface=surfaceAt(x,z);
  if(!surface||surface.water||surface.river||!Number.isFinite(surface.elevationM)||surface.elevationM>2800)
   return {ok:false,message:"水域または建設できない地形です"};
  const pad=kind==="stone-wall"?1.5:FACILITIES[kind].footprint;
  if([...this.structures,...existing].some(s=>Math.hypot(s.x-x,s.z-z)<(s.kind==="stone-wall"?1.65:pad)))
   return {ok:false,message:"建物・壁の設置位置が重なっています"};
  if(kind!=="stone-wall"){
   const alt=surfaceAt(x+2,z);
   if(!alt||Math.abs(alt.elevationM-surface.elevationM)>2)
    return {ok:false,message:"急斜面には設置できません"};
  }
  return {ok:true,surface};
 }
 place(kind,x,z,surfaceAt,resources={},existing=[]){
  const check=this.inspect(kind,x,z,surfaceAt,existing);
  if(!check.ok)return check;
  const cost=costOf(kind);
  if(!available(resources,cost))return {ok:false,message:"建築資材不足："+JSON.stringify(cost)};
  for(const [k,n] of Object.entries(cost))resources[k]-=n;
  const site={id:this.nextId++,kind,x:neat(x),z:neat(z),height:check.surface.elevationM,
   lat:check.surface.lat,lon:check.surface.lon,rotation:0,progress:1};
  this.structures.push(site);
  return {ok:true,created:[site],cost,message:"🏗️ "+(FACILITIES[kind]?.name||"石壁")+"を設置しました"};
 }
 placeLine(start,end,surfaceAt,resources={},existing=[]){
  if(!start||!end)return {ok:false,message:"線の始点と終点を選択してください"};
  const len=Math.hypot(end.x-start.x,end.z-start.z);
  if(!Number.isFinite(len)||len<.7||len>128)return {ok:false,message:"壁の長さは約1〜128mです"};
  const count=Math.max(1,Math.ceil(len/WALL_LENGTH_M));
  if(count>64)return {ok:false,message:"壁が長すぎます"};
  const angle=-Math.atan2(end.z-start.z,end.x-start.x);
  const candidates=[];
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,x=start.x+(end.x-start.x)*t,z=start.z+(end.z-start.z)*t;
   const test=this.inspect("stone-wall",x,z,surfaceAt,existing);
   if(!test.ok)return {...test,at:i};
   const last=candidates.at(-1);
   if(last&&Math.abs(last.height-test.surface.elevationM)>1.15)
    return {ok:false,message:"急な段差には壁を延長できません"};
   candidates.push({kind:"stone-wall",x:neat(x),z:neat(z),height:test.surface.elevationM,
     lat:test.surface.lat,lon:test.surface.lon,rotation:angle,progress:1});
  }
  const cost=costOf("stone-wall",count);
  if(!available(resources,cost))return {ok:false,message:"石壁用の石材が不足（"+cost.stone+"個）"};
  for(const [k,n] of Object.entries(cost))resources[k]-=n;
  for(const site of candidates){site.id=this.nextId++;this.structures.push(site);}
  return {ok:true,created:candidates,cost,message:"🧱 石壁を"+count+"区画設置しました"};
 }
 nearestWarehouse(x,z,maxDistance=8){
  return this.structures.filter(s=>s.kind==="warehouse")
   .sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))
   .find(s=>Math.hypot(s.x-x,s.z-z)<=maxDistance)||null;
 }
 depositWarehouse(id,bag,massKg=0){
  const warehouse=this.structures.find(s=>s.id===Number(id)&&s.kind==="warehouse");
  if(!warehouse)return {ok:false,message:"共同倉庫がありません"};
  const current={...(this.warehouseStocks[String(id)]||{})};
  let moved=0;
  for(const [key,qty] of Object.entries(bag||{})){
   if(!/^[a-zA-Z]{1,24}$/.test(key)||!Number.isSafeInteger(qty)||qty<0||qty>9999)
    return {ok:false,message:"収納資材に不正な値があります"};
   if((current[key]||0)+qty>999999)return {ok:false,message:"倉庫の収納上限を超えました"};
   current[key]=(current[key]||0)+qty;moved+=qty;
  }
  if(!moved)return {ok:false,message:"リュックは空です"};
  this.warehouseStocks[String(id)]=current;
  this.warehouseWeightKg[String(id)]=(this.warehouseWeightKg[String(id)]||0)+Math.max(0,Number(massKg)||0);
  for(const key of Object.keys(bag))bag[key]=0;
  return {ok:true,message:"🏢 共同倉庫に"+moved+"個（"+massKg+"kg）収納",moved};
 }
 snapshot(){return {version:1,structures:this.structures.map(s=>({...s})),
  warehouseStocks:JSON.parse(JSON.stringify(this.warehouseStocks)),
  warehouseWeightKg:{...this.warehouseWeightKg}};}
}

/** Physical collision with built 2m masonry segments. Character radius 0.35m. */
export function blockedByStoneWall(from,to,structures=[],radius=.35){
 const distance=Math.hypot(to.x-from.x,to.z-from.z);
 const samples=Math.max(1,Math.ceil(distance/.25));
 for(let j=0;j<=samples;j++){
  const t=j/samples,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
  for(const wall of structures){
   if(wall.kind!=="stone-wall"||Math.abs(wall.x-x)>3||Math.abs(wall.z-z)>3)continue;
   const angle=wall.rotation||0,dx=x-wall.x,dz=z-wall.z;
   const along=dx*Math.cos(angle)-dz*Math.sin(angle);
   const across=dx*Math.sin(angle)+dz*Math.cos(angle);
   if(Math.abs(along)<=1.04+radius&&Math.abs(across)<=.31+radius)return true;
  }
 }
 return false;
}
