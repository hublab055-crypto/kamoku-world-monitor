/** Size-aware harvest masses, expressed in kilograms.
 * Existing crafting inventory remains item counts for v0.7/v0.8 saves;
 * real cargo mass is recorded separately so stone 0.5kg is representable.
 */
export const MATERIAL_WEIGHT_KG=Object.freeze({wood:1,stone:.5,fiber:.5,clay:1,metal:1,ironOre:1,plank:1,soil:1,food:1,water:1});
export const RESOURCE_PROFILES=Object.freeze({
 shrub:{name:"低木",category:"wood",kg:5,tool:"axe",items:{wood:3,fiber:2},hp:1},
 "large-oak":{name:"大木",category:"wood",kg:80,tool:"axe",items:{wood:75,fiber:5},hp:7},
 pebble:{name:"小石",category:"stone",kg:.5,tool:"mine",items:{stone:1},hp:1},
 "iron-deposit":{name:"鉄鉱床",category:"stone",kg:50,tool:"mine",items:{ironOre:50},hp:9}
});
export function harvestYield(node,{saw=false}={}){
 const type=node?.sourceType||node?.type||"";
 const profile=RESOURCE_PROFILES[type];
 if(profile){
  const items={...profile.items};
  if(saw&&profile.category==="wood"){
   const qty=items.wood||0;delete items.wood;items.plank=qty;
  }
  return {drops:items,massKg:profile.kg,profile:profile.name};
 }
 const scale=Math.max(.6,Math.min(1.8,Number(node?.scale)||1));
 const stone=node?.kind==="stone"||["rubble","boulder"].includes(type);
 const kg=stone?Math.round((7+16*scale**2)*2)/2:Math.round((14+25*scale**2)*2)/2;
 const base=stone?"stone":"wood";
 const n=Math.max(1,Math.round(kg/(stone?.5:1)));
 const items=saw&&!stone?{plank:n}:{[base]:n};
 return {drops:items,massKg:kg,profile:stone?"岩石":"立木"};
}
export function inventoryWeightKg(bag,legacyWeights=null){
 return Math.round(Object.entries(bag||{}).reduce((sum,[key,count])=>
  sum+Math.max(0,Number(count)||0)*(MATERIAL_WEIGHT_KG[key]??legacyWeights?.[key]??1),0)*100)/100;
}
