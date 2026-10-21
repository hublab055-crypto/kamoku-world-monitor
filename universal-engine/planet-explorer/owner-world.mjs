/** Owner-only, non-resource-consuming edits persisted at planet coordinates.
 * These changes are local save data, not an authenticated multiplayer permission.
 * Geographic coordinates allow travel/rebasing without moving owner creations.
 */
import {BUILD_KINDS,FACILITIES} from "./construction-system.mjs";
export const OWNER_FACILITIES=Object.freeze({
 house:{name:"住宅",footprint:7,color:[.57,.43,.30]},
 inn:{name:"宿屋",footprint:11,color:[.52,.32,.21]},
 school:{name:"学校",footprint:12,color:[.68,.58,.42]},
 station:{name:"駅舎",footprint:14,color:[.45,.48,.53]},
 watchtower:{name:"見張り塔",footprint:6,color:[.46,.42,.35]},
 barn:{name:"納屋",footprint:10,color:[.53,.31,.26]}
});
export const OWNER_PRIMITIVES=Object.freeze(["cube","cylinder","sphere","cone"]);
export const OWNER_BUILDING_KINDS=Object.freeze([...BUILD_KINDS.filter(k=>k!=="stone-wall"),...Object.keys(OWNER_FACILITIES)]);
const finite=Number.isFinite;
const validGeo=p=>p&&finite(p.lat)&&finite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const clone=data=>JSON.parse(JSON.stringify(data));
const near=(a,b)=>{const dy=(a.lat-b.lat)*111195;let dlon=a.lon-b.lon;dlon=((dlon+540)%360)-180;
 return Math.hypot(dy,dlon*111195*Math.cos((a.lat+b.lat)*Math.PI/360));};
const fail=message=>({ok:false,message});
export class OwnerWorld {
 constructor(saved=null){
  this.buildings=[];this.roads=[];this.stamps=[];this.primitives=[];this.nextId=1;this.undoStack=[];this.redoStack=[];
  if(saved){
   if(![1,2].includes(saved.version)||!Array.isArray(saved.buildings)||!Array.isArray(saved.roads)||!Array.isArray(saved.stamps)||
      saved.buildings.length>600||saved.roads.length>200||saved.stamps.length>500)throw Error("オーナー編集データが不正です");
   const ids=new Set();
   for(const b of saved.buildings){
    if(!validGeo(b)||!OWNER_BUILDING_KINDS.includes(b.kind)||!Number.isSafeInteger(b.id)||b.id<1||
       !finite(b.rotation)||Math.abs(b.rotation)>1e5||ids.has(b.id))throw Error("建築編集データが不正です");
    ids.add(b.id);this.buildings.push({id:b.id,kind:b.kind,lat:b.lat,lon:b.lon,rotation:b.rotation});
   }
   for(const r of saved.roads){
    if(!Number.isSafeInteger(r.id)||r.id<1||ids.has(r.id)||![3,5,8,12].includes(r.width)||
       !Array.isArray(r.points)||r.points.length<2||r.points.length>64||!r.points.every(validGeo))throw Error("道路編集データが不正です");
    ids.add(r.id);this.roads.push({id:r.id,width:r.width,points:r.points.map(p=>({lat:p.lat,lon:p.lon}))});
   }
   for(const s of saved.stamps){
    if(!validGeo(s)||!finite(s.radius)||s.radius<3||s.radius>200||
       !["raise","lower","flatten"].includes(s.mode)||!finite(s.amount)||Math.abs(s.amount)>12||
       !finite(s.target)||Math.abs(s.target)>11000)throw Error("地形ブラシ値が不正です");
    this.stamps.push({...s});
   }
   if(saved.version===2){
    if(!Array.isArray(saved.primitives)||saved.primitives.length>1200)throw Error("立体データが不正です");
    for(const p of saved.primitives){
     if(!validGeo(p)||!OWNER_PRIMITIVES.includes(p.shape)||!Number.isSafeInteger(p.id)||p.id<1||
      ids.has(p.id)||!Number.isFinite(p.rotation)||!Number.isFinite(p.offsetY)||
      Math.abs(p.offsetY)>500||![p.width,p.height,p.depth].every(v=>finite(v)&&v>=.1&&v<=200)||
      !Array.isArray(p.color)||p.color.length!==3||!p.color.every(v=>finite(v)&&v>=0&&v<=1)||
      typeof p.group!=="string"||p.group.length>40)throw Error("建築パーツが不正です");
     ids.add(p.id);this.primitives.push({...p,color:[...p.color]});
    }
   }
   this.nextId=Math.max(1,...ids)+1;
  }
 }
 snapshot(){return {version:2,buildings:clone(this.buildings),roads:clone(this.roads),stamps:clone(this.stamps),primitives:clone(this.primitives)};}
 _state(){return this.snapshot();}
 _remember(){this.undoStack.push(this._state());if(this.undoStack.length>40)this.undoStack.shift();this.redoStack=[];}
 _restore(state){this.buildings=clone(state.buildings);this.roads=clone(state.roads);this.stamps=clone(state.stamps);this.primitives=clone(state.primitives||[]);
  this.nextId=Math.max(this.nextId,1,...this.buildings.map(x=>x.id+1),...this.roads.map(x=>x.id+1),...this.primitives.map(x=>x.id+1));}
 undo(){if(!this.undoStack.length)return fail("戻せる操作はありません");
  this.redoStack.push(this._state());this._restore(this.undoStack.pop());return {ok:true,message:"↶ 直前の編集を取り消しました"};}
 redo(){if(!this.redoStack.length)return fail("やり直せる操作はありません");
  this.undoStack.push(this._state());this._restore(this.redoStack.pop());return {ok:true,message:"↷ 編集をやり直しました"};}
 heightAt(lat,lon,base){
  if(!finite(base))return base;
  let height=base;
  for(const s of this.stamps){
   const d=near({lat,lon},s);if(d>=s.radius)continue;
   const t=1-(d/s.radius)**2,weight=t*t;
   if(s.mode==="flatten")height+=(s.target-height)*Math.min(1,s.amount)*weight;
   else height+=(s.mode==="raise"?1:-1)*s.amount*weight;
  }
  return Math.max(.1,height);
 }
 sculpt(p,mode,radius,amount,baseHeight){
  if(!validGeo(p)||!["raise","lower","flatten"].includes(mode)||!finite(radius)||radius<3||radius>200||
     !finite(amount)||amount<=0||amount>12||!finite(baseHeight))return fail("地形編集条件が不正です");
  if(this.stamps.length>=500)return fail("地形編集の保存上限に達しました");
  this._remember();this.stamps.push({lat:p.lat,lon:p.lon,radius,mode,amount:mode==="flatten"?Math.min(1,amount):amount,target:baseHeight});
  return {ok:true,message:mode==="flatten"?"📐 地面を整地しました":mode==="raise"?"⛰️ 地形を盛り上げました":"🪏 地形を低くしました"};
 }
 place(kind,p){
  if(!OWNER_BUILDING_KINDS.includes(kind)||!validGeo(p))return fail("建物の種類か配置位置が不正です");
  if(this.buildings.length>=600)return fail("建物の配置上限に達しました");
  const radius=(OWNER_FACILITIES[kind]||FACILITIES[kind]).footprint*.5;
  if(this.buildings.some(b=>near(b,p)<radius+(OWNER_FACILITIES[b.kind]||FACILITIES[b.kind]).footprint*.5))
   return fail("建物同士が重なっています");
  this._remember();const building={id:this.nextId++,kind,lat:p.lat,lon:p.lon,rotation:0};
  this.buildings.push(building);return {ok:true,id:building.id,message:"🏠 建物を配置しました"};
 }
 nearest(p,limit=15){
  if(!validGeo(p))return null;
  return this.buildings.map(b=>({building:b,d:near(b,p)})).sort((a,b)=>a.d-b.d)
   .find(x=>x.d<=limit)?.building||null;
 }
 move(id,p){
  const b=this.buildings.find(b=>b.id===id);
  if(!b||!validGeo(p))return fail("移動する建物がありません");
  const r=(OWNER_FACILITIES[b.kind]||FACILITIES[b.kind]).footprint*.5;
  if(this.buildings.some(other=>other.id!==id&&near(other,p)<r+(OWNER_FACILITIES[other.kind]||FACILITIES[other.kind]).footprint*.5))
   return fail("移動先に別の建物があります");
  this._remember();b.lat=p.lat;b.lon=p.lon;return {ok:true,message:"📍 建物を移動しました"};
 }
 rotate(id,radians=Math.PI/8){
  const b=this.buildings.find(b=>b.id===id);if(!b)return fail("先に建物を選択してください");
  this._remember();b.rotation=((b.rotation+radians)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
  return {ok:true,message:"↻ 建物を回転しました"};
 }
 remove(id){
  const i=this.buildings.findIndex(b=>b.id===id);if(i<0)return fail("建物が見つかりません");
  this._remember();this.buildings.splice(i,1);return {ok:true,message:"🗑️ 建物を撤去しました"};
 }
 road(start,end,width=5){
  if(!validGeo(start)||!validGeo(end)||![3,5,8,12].includes(width))return fail("道路の座標か幅が不正です");
  const meters=near(start,end);if(meters<2||meters>2000)return fail("1区間の道路は2〜2000mにしてください");
  if(this.roads.length>=200)return fail("道路の敷設上限に達しました");
  this._remember();const r={id:this.nextId++,width,points:[{lat:start.lat,lon:start.lon},{lat:end.lat,lon:end.lon}]};
  this.roads.push(r);return {ok:true,message:"🛣️ 幅"+width+"m・長さ約"+Math.round(meters)+"mの道を引きました"};
 }
 /** Independent scaled geometric parts can be assembled into buildings by sharing a group name. */
 placePrimitive(shape,p,{width=4,height=4,depth=4,offsetY=0,rotation=0,color=[.76,.68,.55],group=""}={}){
  if(!OWNER_PRIMITIVES.includes(shape)||!validGeo(p)||this.primitives.length>=1200||
   ![width,height,depth].every(v=>finite(v)&&v>=.1&&v<=200)||
   !finite(offsetY)||Math.abs(offsetY)>500||!finite(rotation)||
   !Array.isArray(color)||color.length!==3||!color.every(c=>finite(c)&&c>=0&&c<=1))
   return fail("立体の形状・寸法が不正か、上限1200個に達しました");
  this._remember();
  const part={id:this.nextId++,shape,lat:p.lat,lon:p.lon,width,height,depth,offsetY,rotation,
   color:[...color],group:String(group).trim().slice(0,40)};
  this.primitives.push(part);
  return {ok:true,id:part.id,message:"🧱 "+shape+"を配置しました（グループ："+(part.group||"未設定")+"）"};
 }
 nearestPrimitive(p,limit=16){
  if(!validGeo(p))return null;
  return this.primitives.map(part=>({part,d:near(part,p)})).sort((a,b)=>a.d-b.d)
   .find(x=>x.d<=limit)?.part||null;
 }
 changePrimitive(id,updates){
  const part=this.primitives.find(p=>p.id===id);
  if(!part)return fail("建築パーツが見つかりません");
  const next={...part,...updates};
  if(!validGeo(next)||!OWNER_PRIMITIVES.includes(next.shape)||
   ![next.width,next.height,next.depth].every(v=>finite(v)&&v>=.1&&v<=200)||
   !finite(next.rotation)||!finite(next.offsetY)||Math.abs(next.offsetY)>500||
   !Array.isArray(next.color)||next.color.length!==3||
   !next.color.every(v=>finite(v)&&v>=0&&v<=1))return fail("建築パーツの編集値が不正です");
  this._remember();
  Object.assign(part,{...next,color:[...next.color],group:String(next.group||"").slice(0,40)});
  return {ok:true,message:"📐 建築パーツを編集しました"};
 }
 movePrimitive(id,p){return this.changePrimitive(id,{lat:p?.lat,lon:p?.lon});}
 rotatePrimitive(id,radians=Math.PI/8){
  const part=this.primitives.find(p=>p.id===id);
  return part?this.changePrimitive(id,{rotation:(part.rotation+radians)%(Math.PI*2)}):fail("建築パーツが見つかりません");
 }
 removePrimitive(id){
  const index=this.primitives.findIndex(p=>p.id===id);
  if(index<0)return fail("建築パーツが見つかりません");
  this._remember();this.primitives.splice(index,1);
  return {ok:true,message:"🗑️ 建築パーツを撤去しました"};
 }
 /** Called from UI after loading an older save with no owner edits. */
 clear(){if(!this.buildings.length&&!this.roads.length&&!this.stamps.length&&!this.primitives.length)return fail("削除するオーナー編集がありません");
  this._remember();this.buildings=[];this.roads=[];this.stamps=[];this.primitives=[];return {ok:true,message:"オーナー編集だけを初期化しました"};}
}
