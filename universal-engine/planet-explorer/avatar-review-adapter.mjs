import {defaultAppearance,normalizeAppearance,bodyScaleParts,volumeParts} from "./avatar-review-parameters.mjs?v=20261114-original";
/** The original review model uses percentages (100 neutral/50 midpoint).
 * The game renderer draws compact GLB assets in metres. Convert the values
 * without changing the original saved keys, bounds or neutral values.
 */
export const pct=(v)=>Math.max(-1.5,Math.min(1.5,((Number.isFinite(v)?v:100)-100)/100));
export const offset=(v)=>Math.max(-1,Math.min(1,((Number.isFinite(v)?v:50)-50)/50));
export function reviewShaderParams(appearance){
 const v=normalizeAppearance(appearance);
 const ratios=bodyScaleParts.flatMap(k=>[pct(v[k+"Length"]),pct(v[k+"Width"])]);
 const volume=volumeParts.map(k=>pct(v[k+"Size"])*2);
 const shape=volumeParts.map(k=>offset(v[k+"Shape"]));
 const firmness=volumeParts.map(k=>offset(v[k+"Firmness"]));
 return {appearance:v,ratios,volume,shape,firmness,
  hair:[pct(v.hairLength),pct(v.hairVolume)],hideHair:v.hairStyle==="bald"};
}
export function migrateLegacyFit(saved){
 if(saved?.appearance)return normalizeAppearance(saved.appearance);
 const v=defaultAppearance();
 const face=saved?.face||{},body=saved?.body||{};
 const cl=(n,a,b)=>Math.max(a,Math.min(b,Math.round(n)));
 const map={
  browSize:["browSize",100,1],browShape:["browShape",50,.5],
  eyeSize:["eyeSize",100,1],eyeShape:["eyeShape",50,.5],
  eyeSpacing:["eyeSpacing",50,.5],eyePosition:["eyeHeight",50,.5],
  noseSize:["noseSize",100,1],noseShape:["noseShape",50,.5],
  noseHeight:["noseDepth",50,.5],nosePosition:["noseHeight",50,.5],
  mouthSize:["mouthSize",100,1],mouthShape:["mouthShape",50,.5],
  mouthPosition:["mouthHeight",50,.5],earSize:["earSize",100,1],
  earShape:["earShape",50,.5],earPosition:["earHeight",50,.5],
  faceWidth:["faceSize",100,1],faceShape:["jawShape",50,.5]
 };
 for(const [key,[old,neutral,scale]] of Object.entries(map)){
  if(Number.isFinite(face[old]))v[key]=cl(neutral+face[old]*scale,0,150);
 }
 const legacy={
  torsoWidth:body.waist,headWidth:body.shoulders,armWidth:body.arms,
  legWidth:body.legs,handWidth:body.hands,footWidth:body.feet,
  torsoLength:body.height,legLength:body.height,chestSize:body.chest,
  glutesSize:body.hips
 };
 for(const [key,raw] of Object.entries(legacy))
  if(Number.isFinite(raw))v[key]=cl(100+raw*.3,60,150);
 return normalizeAppearance(v);
}
export function reviewHairPreset(style){
 const presets={original:[1,1,0],long:[1.28,1.04,0],bob:[.82,1.02,0],
  asymmetric:[1.07,.96,.06],quiff:[.92,1.14,0],
  waves:[1.12,1.18,0],swept:[1,1.03,-.07],bald:[1,1,0]};
 return presets[style]||presets.original;
}
