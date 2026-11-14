/** V10 body parameters shared by base, swimwear and all wardrobe layers. */
export const AVATAR_V10_BODY=Object.freeze([
 ["全体", [["height","身長"],["shoulders","肩幅"],["chest","胸部"],["waist","胴・ウエスト"],["hips","腰・ヒップ"]]],
 ["四肢", [["arms","腕の太さ"],["hands","手の大きさ"],["legs","脚の太さ"],["feet","足の大きさ"]]]
]);
export const BODY_KEYS=Object.freeze(AVATAR_V10_BODY.flatMap(([,fields])=>fields.map(([key])=>key)));
export const AVATAR_V10_SWIM_STYLES=Object.freeze({
 onepiece:"ワンピース",twopiece:"セパレート",trunks:"スイムパンツ"
});
export const AVATAR_V10_SWIM_COLORS=Object.freeze({
 navy:{label:"ネイビー",rgb:[.075,.19,.42]},
 teal:{label:"ターコイズ",rgb:[.08,.56,.62]},
 coral:{label:"コーラル",rgb:[.93,.34,.36]},
 black:{label:"ブラック",rgb:[.055,.066,.085]},
 white:{label:"ホワイト",rgb:[.83,.88,.93]}
});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function normalizeAvatarV10Body(saved){
 return Object.fromEntries(BODY_KEYS.map(key=>{
  const value=saved?.[key];
  return [key,Number.isFinite(value)?Math.round(clamp(value,-100,100)):0];
 }));
}
export function normalizeAvatarV10Swim(saved){
 return {
  style:Object.hasOwn(AVATAR_V10_SWIM_STYLES,saved?.style)?saved.style:"onepiece",
  color:Object.hasOwn(AVATAR_V10_SWIM_COLORS,saved?.color)?saved.color:"navy"
 };
}
export function shaderBodyParams(body){
 const v=normalizeAvatarV10Body(body);
 return [
  v.height/100,v.shoulders/100,v.chest/100,v.waist/100,v.hips/100,
  v.arms/100,v.hands/100,v.legs/100,v.feet/100
 ];
}
export function shaderSwimParams(fit){
 const swim=normalizeAvatarV10Swim(fit?.swim);
 const style=Object.keys(AVATAR_V10_SWIM_STYLES).indexOf(swim.style);
 return {style,color:AVATAR_V10_SWIM_COLORS[swim.color].rgb};
}
/** Independent of assets: any V10 skin primitive can receive swim coverage.
 * Garments are not silently replaced with casual clothing.
 */
export function isBodySurface(name,wardrobe){
 return !wardrobe&&!/(?:face|skull|hair|eyes|brow|lip|mouth|ear|teeth|lash|accessory|weapon|bag|helmet|shoe|boot)/i.test(String(name||""));
}
