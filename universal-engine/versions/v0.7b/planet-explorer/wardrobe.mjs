/**
 * v0.7b original procedural wardrobe.
 * 10 silhouettes, independent clothing slots and RGB dyes.
 * No external geometry or copyrighted third-party assets.
 */
import {Shape,buildOriginalModel} from "../original-assets/original-models.mjs";
import {makeJointCovers} from "./joint-covers.mjs";
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
const validColor=s=>typeof s==="string"&&/^#[0-9a-fA-F]{6}$/.test(s);
const item=(id,name,outer,legs,feet,trim,headwear,cape,bag)=>Object.freeze({
 id,name,outer,legs,feet,trim,headwear,cape,bag
});
export const OUTFITS=Object.freeze([
 item("pioneer","開拓者","#33766c","#34495a","#44382f","#d7a954","none","short","satchel"),
 item("scout","斥候","#385e89","#394451","#2c3740","#c3ba86","hood","short","satchel"),
 item("artisan","職人","#a65b46","#515046","#493b31","#b89e73","none","none","toolbag"),
 item("farmer","農民","#7a8658","#73654b","#55422f","#d5b66b","hat","none","none"),
 item("merchant","商人","#674d83","#4e4567","#342b41","#f3c978","hat","long","satchel"),
 item("priest","司祭","#e1d5ba","#797989","#494647","#caa76c","hood","long","none"),
 item("guard","衛兵","#4b6777","#343f4d","#30363e","#d6b04f","helmet","short","none"),
 item("hunter","狩人","#51694d","#4d4c37","#41342f","#b4a07a","hood","long","satchel"),
 item("traveler","旅人","#b88453","#565a65","#3b3841","#e6cb87","none","long","satchel"),
 item("villager","村人","#76959b","#626067","#524b46","#e1bf95","none","none","none")
]);
export const CLOTHING_SLOTS=Object.freeze(["outer","legs","feet","trim","headwear","cape","bag","hairStyle","hairColor"]);
export const HAIR_STYLES=Object.freeze(["short","long","bun","braid"]);
export const HEADWEAR=Object.freeze(["none","hat","hood","helmet"]);
export const CAPES=Object.freeze(["none","short","long"]);
export const BAGS=Object.freeze(["none","satchel","toolbag"]);
const BASES=Object.freeze(["pioneer","scout","artisan"]);
const palettes={
 pioneer:{coat:"#33766c",edge:"#1e514f",shirt:"#e8d5ac",trim:"#d7a954",cloth:"#34495a",hair:"#43372f",boots:"#44382f"},
 scout:{coat:"#385e89",edge:"#283f66",shirt:"#d2d4ba",trim:"#c3ba86",cloth:"#394451",hair:"#5a3c27",boots:"#2c3740"},
 artisan:{coat:"#a65b46",edge:"#713c37",shirt:"#f0d7aa",trim:"#b89e73",cloth:"#515046",hair:"#372b26",boots:"#493b31"}
};
function darker(rgb,factor=.72){return rgb.map(v=>Math.min(1,v*factor));}
function tint(geometry,style,colors){
 const original=palettes[style];
 const translations=[
 ["coat","outer"],["edge","outer"],["cloth","legs"],["trim","trim"],
 ["boots","feet"],["hair","hairColor"]
 ].map(([key,slot])=>({from:hex(original[key]),to:hex(colors[slot])}));
 const out={
  positions:[...geometry.positions],normals:[...geometry.normals],indices:[...geometry.indices],
  colors:[...geometry.colors]
 };
 for(let i=0;i<out.colors.length;i+=3){
  for(const {from,to} of translations){
   if(Math.abs(out.colors[i]-from[0])<.000001&&Math.abs(out.colors[i+1]-from[1])<.000001&&
       Math.abs(out.colors[i+2]-from[2])<.000001){
    for(let j=0;j<3;j++)out.colors[i+j]=to[j];
    break;
   }
  }
 }
 return out;
}
const paletteId=id=>OUTFITS.find(x=>x.id===id);
export function createAppearance(preset="pioneer",baseModelId="pioneer"){
 const p=paletteId(preset);
 if(!p||!BASES.includes(baseModelId))throw RangeError("Unknown outfit or base model");
 return {
  version:1,baseModelId,presetId:p.id,outer:p.outer,legs:p.legs,feet:p.feet,
  trim:p.trim,headwear:p.headwear,cape:p.cape,bag:p.bag,
  hairStyle:"short",hairColor:palettes[baseModelId].hair
 };
}
export function validateAppearance(data){
 if(!data||data.version!==1||!BASES.includes(data.baseModelId)||!paletteId(data.presetId))
  throw Error("Invalid appearance version, model or outfit");
 for(const c of ["outer","legs","feet","trim","hairColor"]){
  if(!validColor(data[c]))throw Error("Invalid color: "+c);
 }
 for(const [k,allowed] of [["headwear",HEADWEAR],["cape",CAPES],["bag",BAGS],["hairStyle",HAIR_STYLES]]){
  if(!allowed.includes(data[k]))throw Error("Invalid wardrobe slot: "+k);
 }
 return true;
}
export function restoreAppearance(data,fallback="pioneer"){
 if(!data)return createAppearance(fallback,fallback);
 const clone={...data};
 validateAppearance(clone);
 return clone;
}
export function withOutfit(current,id){
 validateAppearance(current);
 const preset=createAppearance(id,current.baseModelId);
 return {...preset,hairStyle:current.hairStyle,hairColor:current.hairColor};
}
export function withAppearanceSlot(current,slot,value){
 validateAppearance(current);
 if(!CLOTHING_SLOTS.includes(slot))throw RangeError("Invalid wardrobe slot");
 const next={...current,[slot]:value};
 validateAppearance(next);
 return next;
}
function layer(name,pivot,fill){
 const geometry=new Shape();
 fill(geometry);
 return {name:"clothing:"+name,pivot,geometry};
}
function faceHair(style,color){
 const c=hex(color),dark=darker(c,.72),pieces=[];
 if(style==="long"){
  pieces.push(layer("long-hair","head",m=>{
   m.prism(0,-.28,-.17,.19,.07,.25,.12,.58,c);
   m.box(-.19,-.10,-.065,.085,.38,.12,dark);
   m.box(.19,-.10,-.065,.085,.38,.12,dark);
  }));
 }else if(style==="bun"){
  pieces.push(layer("bun-hair","head",m=>m.crystal(0,.47,-.15,.18,.17,.16,c)));
 }else if(style==="braid"){
  pieces.push(layer("braid-hair","head",m=>{
   m.crystal(.20,.05,-.18,.10,.20,.10,c);
   m.cylinder(.23,-.35,-.15,.066,.42,dark,6,.053);
  }));
 }
 return pieces;
}
export function buildAppearanceParts(data){
 validateAppearance(data);
 const model=buildOriginalModel(data.baseModelId);
 const colors={outer:data.outer,legs:data.legs,feet:data.feet,trim:data.trim,hairColor:data.hairColor};
 const parts=model.parts.map(p=>({...p,geometry:tint(p.geometry,data.baseModelId,colors)}));
 // Covers use the base palette and recolor their sleeve/trouser segments by body part.
 for(const part of makeJointCovers(data.baseModelId)){
  const g=part.geometry;
  let target=data.outer;
  if(/hip|knee|ankle|toe/i.test(part.name))target=/ankle|toe/i.test(part.name)?data.feet:data.legs;
  if(/finger|wrist/i.test(part.name)){
   parts.push(part);continue; // skin color, not dyed
  }
  const m={positions:[...g.positions],normals:[...g.normals],indices:[...g.indices],colors:[]};
  const dye=hex(target);
  for(let i=0;i<g.colors.length;i+=3)m.colors.push(...dye);
  parts.push({...part,geometry:m});
 }
 const outer=hex(data.outer),trim=hex(data.trim),dark=darker(outer);
 if(data.cape!=="none"){
  parts.push(layer(data.cape+"-cape","torso",m=>{
   const length=data.cape==="long"?1.15:.64;
   m.prism(0,.32,-.25,.38,.050,.52,.035,-length,dark);
   m.box(0,.55,-.265,.36,.09,.07,trim);
   m.box(0,.51,-.29,.11,.04,.05,outer);
  }));
 }
 if(data.headwear==="hat"){
  parts.push(layer("hat","head",m=>{
   m.cylinder(0,.40,0,.33,.055,trim,9);
   m.cylinder(0,.44,-.025,.23,.25,outer,8,.22);
   m.box(0,.55,.20,.24,.046,.04,dark);
  }));
 }else if(data.headwear==="hood"){
  parts.push(layer("hood","head",m=>{
   m.prism(0,.21,-.075,.27,.21,.23,.20,.33,outer);
   m.box(-.25,.12,.005,.075,.28,.18,dark);
   m.box(.25,.12,.005,.075,.28,.18,dark);
  }));
 }else if(data.headwear==="helmet"){
  parts.push(layer("helmet","head",m=>{
   m.crystal(0,.39,0,.265,.25,.245,[.55,.62,.64]);
   m.box(0,.29,.255,.23,.08,.075,trim);
   m.box(0,.30,.34,.038,.13,.035,[.35,.42,.49]);
  }));
 }
 if(data.bag!=="none"){
  parts.push(layer("bag","pelvis",m=>{
   const c=data.bag==="toolbag"?[.37,.30,.24]:[.42,.29,.22];
   m.box(-.34,-.21,-.16,.22,.38,.16,c);
   m.box(-.34,.12,-.15,.18,.055,.18,trim);
   m.box(-.34,.08,.05,.19,.037,.04,darker(c));
  }));
 }
 parts.push(...faceHair(data.hairStyle,data.hairColor));
 return parts;
}
export function appearanceDescription(data){
 validateAppearance(data);
 return {preset:paletteId(data.presetId).name,base:data.baseModelId,
  layers:buildAppearanceParts(data).length,headwear:data.headwear,cape:data.cape,bag:data.bag};
}
