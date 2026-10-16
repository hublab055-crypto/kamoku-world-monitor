/**
 * Universal Engine v0.7g - furniture, crafting, domestic actions and portable shelters.
 * State is pure JSON; world renderer, HUD and geography are adapters.
 */
export const MATERIAL_NAMES=Object.freeze({wood:"木材",stone:"石材",fiber:"繊維",clay:"粘土",metal:"金属"});
export const ITEM_NAMES=Object.freeze({plate:"皿",bowl:"椀",cup:"コップ",pot:"鍋",spoon:"スプーン",rawFood:"食材",meal:"料理",served:"配膳料理",dirtyPlate:"汚れた皿",water:"水"});
export const CATALOG=Object.freeze({
 bed:{name:"ベッド",emoji:"🛏️",category:"furniture",cost:{wood:6,fiber:3},radius:.66,inside:true,actions:["sleep","rest"]},
 chair:{name:"椅子",emoji:"🪑",category:"furniture",cost:{wood:3},radius:.34,inside:true,actions:["sit","stand"]},
 table:{name:"机",emoji:"🪵",category:"furniture",cost:{wood:5},radius:.68,inside:true,actions:["serve","eat","read"]},
 fireplace:{name:"暖炉",emoji:"🔥",category:"furniture",cost:{stone:7,clay:2},radius:.57,inside:true,actions:["light","extinguish","warm","cook"]},
 kitchen:{name:"キッチン",emoji:"🍳",category:"furniture",cost:{wood:5,stone:3,metal:2},radius:.61,inside:true,actions:["cook","wash","fetchWater"]},
 bookshelf:{name:"本棚",emoji:"📚",category:"furniture",cost:{wood:6},radius:.48,inside:true,actions:["read","takeBook"]},
 lamp:{name:"ランプ",emoji:"💡",category:"furniture",cost:{wood:1,metal:1},radius:.22,inside:true,actions:["light","extinguish"]},
 chest:{name:"チェスト",emoji:"🧰",category:"furniture",cost:{wood:5,metal:1},radius:.52,inside:true,actions:["store"]},
 plate:{name:"皿 ×2",emoji:"🍽️",category:"item",cost:{clay:2},quantity:2},
 bowl:{name:"椀 ×2",emoji:"🥣",category:"item",cost:{wood:2},quantity:2},
 cup:{name:"コップ ×2",emoji:"🥛",category:"item",cost:{clay:2},quantity:2},
 pot:{name:"鍋",emoji:"🍲",category:"item",cost:{metal:3}},
 spoon:{name:"スプーン ×2",emoji:"🥄",category:"item",cost:{wood:1},quantity:2},
 tent:{name:"携帯テント",emoji:"⛺",category:"deployable",cost:{wood:5,fiber:8},radius:1.45},
 bedroll:{name:"携帯ベッドロール",emoji:"🛌",category:"deployable",cost:{fiber:4},radius:.78}
});
const defaults=Object.freeze([
 ["bed",-1.72,-.86,0],["chest",1.65,-1.20,0],["table",.55,0,0],
 ["chair",.55,-1.12,0],["chair",.55,1.14,180],
 ["lamp",-.72,-1.76,0],["bookshelf",.28,-1.95,0]
]);
const initialItems={plate:3,bowl:2,cup:2,pot:1,spoon:3,rawFood:4,meal:0,served:0,dirtyPlate:0,dirtyBowl:0,dirtyCup:0,servedBowl:0,water:4};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const validNumber=n=>Number.isFinite(n);
const copy=value=>JSON.parse(JSON.stringify(value));
function moveActor(actor,x,z,yaw=null){
 actor.x=x;actor.z=z;const p=actor.locationAt(x,z);actor.lat=p.lat;actor.lon=p.lon;
 actor.clearMoveTarget();actor.moving=false;
 if(validNumber(yaw))actor.yaw=yaw;
}
function result(ok,message){return {ok,message};}
export class Lifestyle {
 constructor(saved=null){
  const data=saved&&saved.schemaVersion===1?saved:null;
  this.inventory={...initialItems};
  if(data&&data.inventory&&typeof data.inventory==="object"){
   for(const key of Object.keys(CATALOG))if(Number.isSafeInteger(data.inventory[key])&&data.inventory[key]>=0)
    this.inventory[key]=Math.min(99999,data.inventory[key]);
   for(const key of Object.keys(initialItems))if(Number.isSafeInteger(data.inventory[key])&&data.inventory[key]>=0)
    this.inventory[key]=Math.min(99999,data.inventory[key]);
  }
  this.furnishings=Array.isArray(data?.furnishings)?
   data.furnishings.filter(f=>CATALOG[f.kind]?.inside&&[f.x,f.z,f.buildingId].every(validNumber))
   .map(f=>({...f})).slice(0,250):[];
  this.deployments=Array.isArray(data?.deployments)?
   data.deployments.filter(d=>CATALOG[d.kind]?.category==="deployable"&&[d.x,d.z,d.lat,d.lon,d.height].every(validNumber))
   .map(d=>({...d})).slice(0,150):[];
  this.nextId=Number.isSafeInteger(data?.nextId)&&data.nextId>0?data.nextId:1;
  const maximum=[...this.furnishings,...this.deployments].reduce((m,f)=>Math.max(m,f.id||0),0);
  this.nextId=Math.max(this.nextId,maximum+1);
  this.initializedHuts=Array.isArray(data?.initializedHuts)?data.initializedHuts.filter(Number.isSafeInteger):[];
  this.stats={stamina:85,hunger:22,cleanliness:85,warmth:75,knowledge:0,
   ...Object.fromEntries(Object.entries(data?.stats||{}).filter(([key,v])=>
    ["stamina","hunger","cleanliness","warmth","knowledge"].includes(key)&&validNumber(v)))};
  for(const key of Object.keys(this.stats))this.stats[key]=clamp(this.stats[key],0,key==="knowledge"?1e6:100);
  this.activity=typeof data?.activity==="string"?data.activity:"idle";
  this.activityFurnitureId=data?.activityFurnitureId??null;
  this.insideTentId=data?.insideTentId??null;
  this.readPages=Array.isArray(data?.readPages)?data.readPages.filter(x=>typeof x==="string").slice(0,10000):[];
  this.elapsed=0;
 }
 ensureHut(hut){
  if(!hut||hut.progress<1)return;
  if(this.initializedHuts.includes(hut.id))return;
  // Existing v0.7f cabins become interactive without replacing their appearance.
  for(const [kind,x,z,rotation] of defaults){
   this.furnishings.push({id:this.nextId++,kind,buildingId:hut.id,x,z,rotation,lit:false});
  }
  this.initializedHuts.push(hut.id);
 }
 atHut(hut){if(!hut)return [];this.ensureHut(hut);return this.furnishings.filter(f=>f.buildingId===hut.id);}
 nearbyCamp(actor,radius=3.5){
  return this.deployments.filter(d=>Math.hypot(actor.x-d.x,actor.z-d.z)<=radius)
   .sort((a,b)=>Math.hypot(actor.x-a.x,actor.z-a.z)-Math.hypot(actor.x-b.x,actor.z-b.z))[0]||null;
 }
 count(kind){return this.inventory[kind]||0;}
 craft(kind,resources){
  const item=CATALOG[kind];if(!item)return result(false,"レシピがありません。");
  for(const [name,quantity] of Object.entries(item.cost))
   if((resources[name]||0)<quantity)return result(false,MATERIAL_NAMES[name]+"が足りません（必要 "+quantity+"）。");
  for(const [name,quantity] of Object.entries(item.cost))resources[name]-=quantity;
  this.inventory[kind]=this.count(kind)+(item.quantity||1);
  return result(true,item.emoji+" "+item.name+" をクラフトしました。");
 }
 canPlace(kind,hut,x,z,rotation=0,ignoreId=null){
  const type=CATALOG[kind];
  if(!type?.inside||!hut||hut.progress<1)return false;
  if(![x,z,rotation].every(validNumber))return false;
  const rad=type.radius;
  if(Math.abs(x)+rad>2.49||Math.abs(z)+rad>2.13)return false;
  if(Math.abs(x)<.82&&z>1.25)return false; // clear the doorway
  for(const f of this.atHut(hut)){
   if(f.id===ignoreId)continue;
   const r=CATALOG[f.kind]?.radius||.45;
   if(Math.hypot(f.x-x,f.z-z)<Math.max(.3,(rad+r)*.72))return false;
  }
  return true;
 }
 placeFurniture(kind,hut,x,z,rotation=0){
  if(this.count(kind)<1)return result(false,"持ち物にありません。先にクラフトしてください。");
  if(!this.canPlace(kind,hut,x,z,rotation))return result(false,"ここには配置できません。壁・入口・他の家具を避けてください。");
  this.inventory[kind]--;
  this.furnishings.push({id:this.nextId++,kind,buildingId:hut.id,x,z,
   rotation:((rotation%360)+360)%360,lit:false});
  return result(true,CATALOG[kind].emoji+" "+CATALOG[kind].name+" を設置しました。");
 }
 pickUpFurniture(id,hut){
  const i=this.furnishings.findIndex(f=>f.id===id&&f.buildingId===hut?.id);
  if(i<0)return result(false,"家具がありません。");
  const f=this.furnishings[i];
  this.furnishings.splice(i,1);
  this.inventory[f.kind]=this.count(f.kind)+1;
  if(this.activityFurnitureId===id){this.activity="idle";this.activityFurnitureId=null;}
  return result(true,CATALOG[f.kind].name+" を回収しました。");
 }
 deploy(kind,actor,terrainSample,existingStructures=[]){
  if(!["tent","bedroll"].includes(kind))return result(false,"設置できるアイテムではありません。");
  if(this.count(kind)<1)return result(false,"先にクラフトしてください。");
  if(actor.altitudeM>12||actor.jumpY>.1)return result(false,"地上で設置してください。");
  const distance=kind==="tent"?4.2:2.4;
  const x=actor.x+Math.sin(actor.yaw)*distance,z=actor.z+Math.cos(actor.yaw)*distance;
  const pos=actor.locationAt(x,z),sample=terrainSample(pos.lat,pos.lon);
  if(sample.water||sample.river||sample.elevationM>2800)return result(false,"水辺や険しい場所には設置できません。");
  if(existingStructures.some(h=>h.progress>=1&&Math.hypot(h.x-x,h.z-z)<6))
   return result(false,"小屋に近すぎます。");
  if(this.deployments.some(d=>Math.hypot(d.x-x,d.z-z)<3))
   return result(false,"ほかの設置物に近すぎます。");
  this.inventory[kind]--;
  this.deployments.push({id:this.nextId++,kind,x,z,lat:pos.lat,lon:pos.lon,
   height:sample.elevationM,rotation:actor.yaw,open:true});
  return result(true,CATALOG[kind].emoji+" を地面に設置しました。");
 }
 pack(id,actor){
  const i=this.deployments.findIndex(d=>d.id===id);
  if(i<0)return result(false,"設置物がありません。");
  const obj=this.deployments[i];
  if(this.insideTentId===id)return result(false,"先にテントから出てください。");
  if(Math.hypot(actor.x-obj.x,actor.z-obj.z)>4)return result(false,"回収するには近づいてください。");
  this.deployments.splice(i,1);
  this.inventory[obj.kind]=this.count(obj.kind)+1;
  return result(true,CATALOG[obj.kind].emoji+" を畳んで持ち物に戻しました。");
 }
 enterTent(id,actor){
  const tent=this.deployments.find(d=>d.id===id&&d.kind==="tent");
  if(!tent)return result(false,"テントがありません。");
  if(Math.hypot(actor.x-tent.x,actor.z-tent.z)>4)return result(false,"テントに近づいてください。");
  this.insideTentId=id;this.activity="idle";
  moveActor(actor,tent.x,tent.z);
  return result(true,"⛺ テントの中に入りました。");
 }
 guardCamp(actor){
  if(this.insideTentId===null)return null;
  const tent=this.deployments.find(d=>d.kind==="tent"&&d.id===this.insideTentId);
  if(!tent){this.insideTentId=null;return "exit";}
  if(Math.hypot(actor.x-tent.x,actor.z-tent.z)>1.75){
   this.insideTentId=null;this.activity="idle";return "exit";
  }
  return null;
 }
 exitTent(actor){
  const tent=this.deployments.find(d=>d.id===this.insideTentId);
  if(!tent)return result(false,"テントの中にいません。");
  this.insideTentId=null;this.activity="idle";
  moveActor(actor,tent.x+Math.sin(tent.rotation)*2.4,tent.z+Math.cos(tent.rotation)*2.4);
  return result(true,"⛺ テントの外に出ました。");
 }
 rest(amount=50){
  this.stats.stamina=clamp(this.stats.stamina+amount,0,100);
  this.stats.hunger=clamp(this.stats.hunger+4,0,100);
 }
 use(id,action,hut,actor,resources){
  const f=this.furnishings.find(f=>f.id===id&&f.buildingId===hut?.id);
  if(!f)return result(false,"家具が見つかりません。");
  const kind=f.kind;
  const activity=(value)=>{this.activity=value;this.activityFurnitureId=id;moveActor(actor,hut.x+f.x,hut.z+f.z,Math.PI);};
  if(action==="sleep"&&kind==="bed"){
   activity("sleep");this.rest(70);return result(true,"🛏️ ベッドで眠り、スタミナが回復しました。");
  }
  if(action==="rest"&&kind==="bed"){activity("rest");this.rest(35);return result(true,"🛏️ ベッドで休みました。");}
  if(action==="sit"&&kind==="chair"){activity("sit");return result(true,"🪑 椅子に座りました。");}
  if(action==="stand"&&this.activity!=="idle"){
   this.activity="idle";this.activityFurnitureId=null;
   return result(true,"立ち上がりました。");
  }
  if(action==="read"&&["table","bookshelf"].includes(kind)){
   activity("read");return result(true,"📖 本を開きます。");
  }
  if(action==="light"&&["lamp","fireplace"].includes(kind)){
   if(f.lit)return result(false,"すでに灯っています。");
   if(kind==="fireplace"){
    if((resources.wood||0)<1)return result(false,"火をつける木材がありません。");
    resources.wood--;
   }
   f.lit=true;return result(true,kind==="lamp"?"💡 ランプを点灯しました。":"🔥 暖炉に火を入れました（木材 −1）。");
  }
  if(action==="extinguish"&&["lamp","fireplace"].includes(kind)){
   f.lit=false;return result(true,"火を消しました。");
  }
  if(action==="warm"&&kind==="fireplace"){
   if(!f.lit)return result(false,"まず暖炉に火をつけてください。");
   activity("warm");this.stats.warmth=100;
   return result(true,"♨️ 暖炉で暖まりました。");
  }
  if(action==="fetchWater"&&kind==="kitchen"){
   this.inventory.water=this.count("water")+3;
   return result(true,"💧 台所で水を3杯汲みました（試験版）。");
  }
  if(action==="wash"&&kind==="kitchen"){
   const dirty=this.count("dirtyPlate")+this.count("dirtyBowl")+this.count("dirtyCup");
   if(dirty<1)return result(false,"洗う食器がありません。");
   if(this.count("water")<1)return result(false,"水がありません。");
   let left=this.count("water"),qty=0;
   for(const [from,to] of [["dirtyPlate","plate"],["dirtyBowl","bowl"],["dirtyCup","cup"]]){
    const n=Math.min(this.count(from),left);
    this.inventory[from]-=n;this.inventory[to]+=n;left-=n;qty+=n;
   }
   this.inventory.water=left;activity("wash");
   this.stats.cleanliness=clamp(this.stats.cleanliness+4,0,100);
   return result(true,"🧼 食器を"+qty+"個洗い、使える状態に戻しました。");
  }
  if(action==="cook"&&["kitchen","fireplace"].includes(kind)){
   if(kind==="fireplace"&&!f.lit)return result(false,"暖炉に火がついていません。");
   if(this.count("rawFood")<1)return result(false,"食材がありません。屋外で食材採集してください。");
   if(this.count("pot")<1)return result(false,"鍋がありません。クラフトしてください。");
   if((resources.wood||0)<1)return result(false,"燃料の木材がありません。");
   resources.wood--;this.inventory.rawFood--;this.inventory.meal++;
   activity("cook");return result(true,"🍲 食材1・木材1を使って料理を作りました。");
  }
  if(action==="serve"&&kind==="table"){
   if(this.count("meal")<1||this.count("plate")<1)return result(false,"料理ときれいな皿が必要です。");
   this.inventory.meal--;this.inventory.plate--;this.inventory.served++;
   activity("serve");return result(true,"🍽️ 料理を皿に盛り、机に配膳しました。");
  }
  if(action==="eat"&&kind==="table"){
   if(this.count("served")<1)return result(false,"まず机に料理を配膳してください。");
   this.inventory.served--;this.inventory.dirtyPlate++;
   this.stats.hunger=clamp(this.stats.hunger-45,0,100);this.stats.stamina=clamp(this.stats.stamina+9,0,100);
   activity("eat");return result(true,"🍽️ ごちそうさま！空腹が回復し、皿が汚れました。");
  }
  if(action==="store"&&kind==="chest")return result(true,"🧰 チェストには家具と道具を持ち歩けます。持ち物メニューで確認してください。");
  return result(false,"この家具では実行できない操作です。");
 }
 useCamp(id,action,actor){
  const d=this.deployments.find(d=>d.id===id);if(!d)return result(false,"設置物がありません。");
  if(Math.hypot(actor.x-d.x,actor.z-d.z)>4)return result(false,"設置物に近づいてください。");
  if(action==="sleep"&&["bedroll","tent"].includes(d.kind)){
   this.activity="sleep";this.activityFurnitureId=id;
   moveActor(actor,d.x,d.z);
   this.rest(d.kind==="tent"?65:45);
   return result(true,d.kind==="tent"?"⛺ テントで眠りました。":"🛌 ベッドロールで休みました。");
  }
  if(action==="enter"&&d.kind==="tent")return this.enterTent(id,actor);
  if(action==="exit"&&d.kind==="tent")return this.exitTent(actor);
  if(action==="pack")return this.pack(id,actor);
  return result(false,"この操作はできません。");
 }
 useItem(kind){
  if(kind==="cup"){
   if(this.count("cup")<1||this.count("water")<1)
    return result(false,"飲み物の水とコップが必要です。");
   this.inventory.cup--;this.inventory.water--;this.inventory.dirtyCup++;
   this.stats.stamina=clamp(this.stats.stamina+5,0,100);
   return result(true,"🥛 コップで水を飲みました。コップは洗う必要があります。");
  }
  if(kind==="bowl"){
   if(this.count("bowl")<1||this.count("meal")<1)
    return result(false,"椀と料理が必要です。");
   this.inventory.bowl--;this.inventory.meal--;this.inventory.servedBowl++;
   return result(true,"🥣 椀に料理を盛りました。スプーンで食べられます。");
  }
  if(kind==="spoon"){
   if(this.count("spoon")<1||this.count("servedBowl")<1)
    return result(false,"スプーンと料理入りの椀が必要です。");
   this.inventory.servedBowl--;this.inventory.dirtyBowl++;
   this.stats.hunger=clamp(this.stats.hunger-42,0,100);
   this.stats.stamina=clamp(this.stats.stamina+7,0,100);
   this.activity="eat";return result(true,"🥄 スプーンで椀の料理を食べました。");
  }
  return result(false,"この道具は家具と一緒に使います。");
 }
 forage(actor){
  if(actor.altitudeM>12)return result(false,"地上で採集してください。");
  if(this.insideTentId!==null)return result(false,"テントから出て採集してください。");
  this.inventory.rawFood+=2;this.inventory.water++;
  return result(true,"🌿 食材を2個と水を1杯集めました（試験版）。");
 }
 advance(dt,moving=false){
  if(!validNumber(dt)||dt<0)throw new TypeError("Invalid dt");
  if(moving&&this.activity!=="idle"){this.activity="idle";this.activityFurnitureId=null;}
  this.elapsed+=Math.min(dt,.1);
  if(this.elapsed>=1){
   const n=Math.floor(this.elapsed);this.elapsed-=n;
   this.stats.hunger=clamp(this.stats.hunger+n*.014,0,100);
   if(moving)this.stats.stamina=clamp(this.stats.stamina-n*.04,0,100);
  }
 }
 readPage(bookId,pageIndex){
  const tag=bookId+":"+pageIndex;
  if(this.readPages.includes(tag))return false;
  this.readPages.push(tag);this.stats.knowledge=clamp(this.stats.knowledge+.25,0,1e6);
  return true;
 }
 snapshot(){return copy({schemaVersion:1,inventory:this.inventory,furnishings:this.furnishings,
  deployments:this.deployments,nextId:this.nextId,initializedHuts:this.initializedHuts,
  stats:this.stats,activity:this.activity,activityFurnitureId:this.activityFurnitureId,
  insideTentId:this.insideTentId,readPages:this.readPages});}
}
