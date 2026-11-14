import {normalizeAvatarV10Body,normalizeAvatarV10Swim} from "./avatar-v10-body.mjs?v=20261114-body";
import {migrateLegacyFit} from "./avatar-review-adapter.mjs?v=20261114-original";
export const AVATAR_V10_MODELS = Object.freeze({
 lyra:"ライラ", mina:"ミナ", sera:"セラ", ren:"レン", noah:"ノア", elio:"エリオ"
});
export const AVATAR_V10_OUTFITS = Object.freeze({work:"作業服",casual:"普段着",space:"宇宙服",swim:"水着（全身・専用マテリアル）",base:"素体（全身ベースメッシュ）"});
export const AVATAR_V10_DEFAULTS = Object.freeze({player:"ren",navigator:"lyra",engineer:"elio",companion:"mina"});
export const AVATAR_V10_FACE = [
 ["眉", [["browSize","大きさ"],["browShape","アーチ"],["browHeight","位置"]]],
 ["目", [["eyeSize","大きさ"],["eyeShape","つり目・たれ目"],["eyeSpacing","間隔"],["eyeHeight","高さ"]]],
 ["鼻", [["noseSize","大きさ"],["noseShape","幅"],["noseDepth","高さ"],["noseHeight","位置"]]],
 ["口", [["mouthSize","大きさ"],["mouthShape","口角"],["mouthHeight","位置"]]],
 ["耳", [["earSize","大きさ"],["earShape","形"],["earHeight","位置"]]],
 ["輪郭", [["faceSize","大きさ"],["jawShape","あごの幅"]]]
];
export const FACE_KEYS = AVATAR_V10_FACE.flatMap(([,fields])=>fields.map(([key])=>key));
export const AVATAR_V10_STORAGE = "universal-engine:avatar-v10:v1";
const bodyIds = Object.keys(AVATAR_V10_DEFAULTS);
const cache = new Map();

export function normalizeAvatarV10(id, saved) {
 const model = Object.hasOwn(AVATAR_V10_MODELS,saved?.model) || (id==="player" && saved?.model==="classic")
  ? saved.model : AVATAR_V10_DEFAULTS[id];
 // Retain the untouched, previously shipped Lyra GLB as the first officer's default.
 // Existing edited values stay in the save and can be re-enabled in the editor.
 const preserveOriginal=id==="navigator"&&model==="lyra"&&(saved?.preserveOriginal??true)===true;
 const outfit = Object.hasOwn(AVATAR_V10_OUTFITS,saved?.outfit)?saved.outfit:
  Object.hasOwn(AVATAR_V10_OUTFITS,saved?.appearance?.outfit)?saved.appearance.outfit:"work";
 const face = Object.fromEntries(FACE_KEYS.map(key=>{
  const value = saved?.face?.[key];
  return [key,Number.isFinite(value)?Math.round(Math.min(100,Math.max(-100,value))):0];
 }));
 const body=normalizeAvatarV10Body(saved?.body);
 const swim=normalizeAvatarV10Swim(saved?.swim);
 const appearance=migrateLegacyFit(saved);
 // Original review schema (flat percentage keys) remains canonical for the
 // in-game editor, while old face/body fields remain loadable.
 appearance.outfit=outfit;
 return {model,outfit,face,body,swim,appearance,preserveOriginal};
}

export function normalizeAvatarRoster(saved) {
 return Object.fromEntries(bodyIds.map(id=>[id,normalizeAvatarV10(id,saved?.[id])]));
}

export function fetchAvatarV10(model) {
 if(!Object.hasOwn(AVATAR_V10_MODELS,model))return Promise.reject(new RangeError("未登録のV10アバターです"));
 if(!cache.has(model)){
  const url = new URL("../original-assets/avatar-v10/"+model+".glb.gz?v=1",import.meta.url);
  const pending = fetch(url).then(async response=>{
   if(!response.ok)throw Error("Avatar V10 "+model+" HTTP "+response.status);
   const blob = await response.blob();
   const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
   return new Response(stream).arrayBuffer();
  }).catch(error=>{cache.delete(model);throw error;});
  cache.set(model,pending);
 }
 return cache.get(model);
}
