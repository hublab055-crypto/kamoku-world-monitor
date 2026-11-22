/** Parameter definitions ported from user-supplied avator-mod.zip:
 * avatar-parameters.js (2026-11-14 archive). Keep keys, ranges and neutral
 * values interoperable with the original Avatar Review editor.
 */
const ratio=(key,label,min=80,max=120)=>({key,label,min,max});
const adjust=(key,label)=>ratio(key,label,0,100);
const size=(key,label="大きさ")=>ratio(key,label,76,126);
const fullness=name=>[ratio(name+"Size","大きさ",60,150),
 ratio(name+"Shape","形",0,100),ratio(name+"Firmness","硬さ",0,100)];
export const partControls=Object.freeze({
 hair:{label:"髪",controls:[ratio("hairLength","長さ",75,130),ratio("hairVolume","ボリューム",85,134)]},
 face:{label:"顔・輪郭",controls:[ratio("faceWidth","顔の幅",85,117),ratio("faceLength","縦の長さ",85,118),ratio("faceShape","輪郭の形",0,100)]},
 brow:{label:"眉",controls:[size("browSize"),adjust("browShape","眉のカーブ")]},
 eye:{label:"目",controls:[size("eyeSize"),adjust("eyeShape","目尻の傾き"),adjust("eyeSpacing","左右の間隔"),adjust("eyePosition","上下の位置")]},
 nose:{label:"鼻",controls:[size("noseSize"),adjust("noseShape","鼻先の丸み"),adjust("noseHeight","鼻筋の高さ"),adjust("nosePosition","上下の位置")]},
 mouth:{label:"口",controls:[size("mouthSize"),adjust("mouthShape","唇の厚さ"),adjust("mouthPosition","上下の位置")]},
 ear:{label:"耳",controls:[size("earSize"),adjust("earShape","耳先の丸み"),adjust("earPosition","上下の位置"),adjust("earSpread","左右の位置")]},
 chest:{label:"胸",controls:fullness("chest")},
 abdomen:{label:"お腹",controls:fullness("abdomen")},
 glutes:{label:"おしり",controls:fullness("glutes")},
 head:{label:"頭",controls:[ratio("headLength","高さ"),ratio("headWidth","幅")]},
 torso:{label:"胴体",controls:[ratio("torsoLength","長さ"),ratio("torsoWidth","太さ")]},
 arm:{label:"腕",controls:[ratio("armLength","長さ"),ratio("armWidth","太さ")]},
 leg:{label:"脚",controls:[ratio("legLength","長さ"),ratio("legWidth","太さ")]},
 hand:{label:"手",controls:[ratio("handLength","長さ"),ratio("handWidth","幅")]},
 foot:{label:"足",controls:[ratio("footLength","長さ"),ratio("footWidth","幅")]}
});
export const hairStyles=Object.freeze({
 original:"キャラクター標準",long:"ロング",bob:"ボブ",asymmetric:"アシンメトリー",
 quiff:"かき上げ",waves:"ウェーブ",swept:"横分け",bald:"髪なし"
});
export const outfits=Object.freeze({base:"素体",swim:"水着",casual:"普段着",work:"作業服",space:"宇宙服"});
export const bodyScaleParts=Object.freeze(["head","torso","arm","leg","hand","foot"]);
export const volumeParts=Object.freeze(["chest","abdomen","glutes"]);
export const facialParts=Object.freeze(["face","brow","eye","nose","mouth","ear"]);
const sliders=Object.values(partControls).flatMap(v=>v.controls);
export const REVIEW_SLIDERS=Object.freeze(sliders);
export const REVIEW_KEYS=Object.freeze(sliders.map(({key})=>key));
const neutral=Object.fromEntries(sliders.map(({key,min})=>[key,min===0?50:100]));
export function defaultAppearance(){return {outfit:"work",hairStyle:"original",...neutral};}
export function normalizeAppearance(saved){
 const value=defaultAppearance();
 for(const [field,options] of [["outfit",outfits],["hairStyle",hairStyles]]){
  if(Object.hasOwn(options,saved?.[field]))value[field]=saved[field];
 }
 for(const {key,min,max} of sliders){
  const supplied=saved?.[key];
  const n=typeof supplied==="string"&&supplied.trim()?Number(supplied):supplied;
  if(Number.isFinite(n))value[key]=Math.round(Math.min(max,Math.max(min,n)));
 }
 return value;
}
const directions={
 browShape:["直線寄り","弓形寄り"],eyeShape:["下げる","上げる"],
 eyeSpacing:["狭く","広く"],eyePosition:["下へ","上へ"],
 noseShape:["細め","丸め"],noseHeight:["低く","高く"],nosePosition:["下へ","上へ"],
 mouthShape:["薄く","厚く"],mouthPosition:["下へ","上へ"],
 earShape:["とがり","丸み"],earPosition:["下へ","上へ"],earSpread:["内へ","外へ"]
};
export function rangeText(key,value){
 if(directions[key])return value===50?"標準":directions[key][Number(value>50)]+" "+Math.abs(value-50);
 if(key.endsWith("Firmness"))return value===50?"標準":value<50?"柔らかめ "+(50-value):"硬め "+(value-50);
 if(key.endsWith("Shape"))return value===50?"標準":value<50?"すっきり "+(50-value):"丸み "+(value-50);
 return value+"%";
}
export const REVIEW_STORAGE_KEY="universal-engine-avatar-appearance-v1";
export function reviewModelKey(model){return "anime-"+model;}
export function fromReviewStorage(raw,model){
 if(!Object.hasOwn({lyra:1,mina:1,sera:1,ren:1,noah:1,elio:1},model))return null;
 try{const saved=typeof raw==="string"?JSON.parse(raw):raw;
  const record=saved?.[reviewModelKey(model)]??saved?.[model];
  return record&&typeof record==="object"&&!Array.isArray(record)?normalizeAppearance(record):null;
 }catch(_){return null;}
}
export function exportReviewStorage(roster){
 const result={};
 for(const fit of Object.values(roster||{})){
  if(!fit?.model||!fit?.appearance)continue;
  result[reviewModelKey(fit.model)]=normalizeAppearance(fit.appearance);
 }
 return result;
}
