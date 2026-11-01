/** Atomic music crafting against the existing Actions.resources inventory.
 * Creative mode bypasses costs; normal mode checks then deducts all costs.
 */
export const MUSIC_RECIPES=Object.freeze([
 {id:"music-stage",name:"🎹🎸 ピアノ・ギターセット",cost:{wood:8,metal:5,fiber:3},item:"music-stage"},
 {id:"music-keyboard",name:"🎹 キーボード",cost:{wood:4,metal:3},item:"music-keyboard"},
 {id:"music-guitar",name:"🎸 ギター",cost:{wood:5,fiber:4,metal:1},item:"music-guitar"},
 {id:"music-drums",name:"🥁 ドラム",cost:{wood:4,metal:2,fiber:2},item:"music-drums"},
 {id:"music-custom",name:"🛠 自作Asset楽器",cost:{wood:6,metal:3,fiber:2},item:"music-custom"}
]);
export const MUSIC_INVENTORY_FORMAT="ue/music-instruments";
const allowed=new Set(MUSIC_RECIPES.map(x=>x.item));
const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=999;
export function normalizeMusicInventory(raw){
 const items={};for(const id of allowed)items[id]=0;
 if(raw==null)return {format:MUSIC_INVENTORY_FORMAT,version:1,items};
 if(raw.format!==MUSIC_INVENTORY_FORMAT||raw.version!==1||!raw.items||typeof raw.items!=="object"||Array.isArray(raw.items))throw Error("楽器の所持情報が不正です");
 for(const [id,n] of Object.entries(raw.items)){if(!allowed.has(id)||!validCount(n))throw Error("楽器の所持数が不正です");items[id]=n;}
 return {format:MUSIC_INVENTORY_FORMAT,version:1,items};
}
export function recipeById(id){return MUSIC_RECIPES.find(x=>x.id===id)||null;}
export function craftMusicInstrument(inventory,resources,recipeId,{creative=false}={}){
 const recipe=recipeById(recipeId);
 if(!recipe)throw Error("未対応の楽器レシピです");
 const state=normalizeMusicInventory(inventory);
 const bag=resources;
 if(!bag||typeof bag!=="object")throw Error("資源インベントリを取得できません");
 if(!creative)for(const [key,amount]of Object.entries(recipe.cost)){
  if(!validCount(bag[key])||bag[key]<amount)throw Error("材料が不足しています："+key+" "+amount+"個");
 }
 if(state.items[recipe.item]>=999)throw Error("楽器の所持上限です");
 const next=normalizeMusicInventory(state);next.items[recipe.item]++;
 if(!creative)for(const [key,amount]of Object.entries(recipe.cost))bag[key]-=amount;
 return next;
}
export function takeMusicInstrument(inventory,item,{creative=false}={}){
 const next=normalizeMusicInventory(inventory);
 if(!allowed.has(item))throw Error("未対応の楽器です");
 if(!creative){if(next.items[item]===0)throw Error("作った楽器を所持していません");next.items[item]--;}
 return next;
}
export function returnMusicInstrument(inventory,item,{creative=false}={}){
 const next=normalizeMusicInventory(inventory);
 if(!allowed.has(item))throw Error("未対応の楽器です");
 if(!creative){if(next.items[item]>=999)throw Error("楽器の所持上限です");next.items[item]++;}
 return next;
}
export function extractAssetMusicControls(document){
 if(document?.format!=="ue/asset-document"||document?.version!==2||document.meta?.assetType!=="instrument"||!Array.isArray(document.nodes))
  throw Error("楽器として保存されたAssetを選んでください");
 const items=[];
 for(const node of document.nodes){
  const control=node.audioControl;
  if(!control||control.kind==="none")continue;
  if(!["key","button","string"].includes(control.kind)||!["keys","guitar","bass","drums"].includes(control.track)||
     !Number.isInteger(control.pitch)||control.pitch<28||control.pitch>96)throw Error("音符設定が不正です");
  const p=node.transform?.position,size=node.geometry?.size;
  if(!p||!size||![p.x,p.y,p.z,size.x,size.y,size.z].every(Number.isFinite)||
    size.x<.1||size.y<.1||size.z<.1||size.x>4||size.y>4||size.z>4)
   throw Error("楽器パーツ寸法が不正です");
  items.push({kind:control.kind,track:control.track,pitch:control.pitch,
   x:p.x,y:p.z,z:p.y,width:size.x,height:size.z,depth:size.y});
 }
 if(!items.length||items.length>80)throw Error("音が鳴るキー・ボタン・弦を1〜80個配置してください");
 return items;
}
