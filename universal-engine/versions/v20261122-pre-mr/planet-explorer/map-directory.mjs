/** Nearby interactive object index shared by TPV/RTS.
 * Listing is read-only: looking at the map never orders a unit or changes a target.
 */
import {VILLAGE_SITES} from "./world-scenery.mjs";
import {settlementLayout} from "./settlements.mjs?v=0.8r-towns";
import {WILD_SPECIES} from "./fauna.mjs?v=0.8f-animals";
import {FACILITIES} from "./construction-system.mjs";

export const MAP_CATEGORIES=Object.freeze([
 {id:"buildings",title:"建物",icon:"🏠"},
 {id:"animals",title:"動物",icon:"🐎"},
 {id:"people",title:"人物",icon:"🧍"},
 {id:"resources",title:"資源",icon:"🌲"}
]);
const NAMES=Object.freeze({
 lodge:"集会所",cabin:"住居",barn:"納屋",workshop:"工房",
 watchtower:"見張り台",granary:"穀物倉庫",well:"井戸",market:"市場",stable:"厩舎",
 hut:"作業小屋","stone-wall":"石壁"
});
const label=(kind)=>FACILITIES[kind]?.name||NAMES[kind]||kind;
const valid=(p)=>Number.isFinite(p?.x)&&Number.isFinite(p?.z);
export const metres=n=>n<1000?Math.round(n)+"m":(n/1000).toFixed(2)+"km";

export function mapDirectoryEntries(context,{category="animals",radiusM=450,search="",limit=80}={}){
 if(!MAP_CATEGORIES.some(c=>c.id===category))return {total:0,items:[]};
 const {controller,fauna,squad,renderer,constructions,actions}=context||{};
 if(!controller)return {total:0,items:[]};
 const candidates=[];
 const add=(entry)=>{
  if(!valid(entry))return;
  const distanceM=Math.hypot(entry.x-controller.x,entry.z-controller.z);
  if(distanceM>radiusM)return;
  candidates.push({...entry,distanceM});
 };
 if(category==="animals")for(const a of fauna?.animals||[]){
  const type=WILD_SPECIES[a.kind];
  if(!type)continue;
  add({id:a.id,source:"animal",category,x:a.x,z:a.z,icon:type.icon,
   title:type.name,subtitle:(a.tame?"飼育中":"野生")+(a.grazing?"・採食中":"")});
 }
 if(category==="people")for(const a of squad?.agents||[]){
  const p=a.control;
  if(!p)continue;
  add({id:a.id,source:"person",category,x:p.x,z:p.z,icon:"🧍",
   title:a.name||a.id,subtitle:a.id==="player"?"プレイヤー":a.auto?"自動行動":"人物"});
 }
 if(category==="people"&&renderer?.settlementId&&renderer.settlementId!=="pioneer"){
  for(const resident of settlementLayout(renderer.settlementId).residents){
   add({id:resident.id,source:"resident",category,x:resident.x,z:resident.z,
    icon:"🧑",title:"街の住民",subtitle:resident.activity+"中"});
  }
 }
 if(category==="buildings"){
  for(const b of constructions?.structures||[]){
   add({id:"built-"+b.id,entityId:b.id,source:"construction",category,x:b.x,z:b.z,
    icon:b.kind==="stone-wall"?"🧱":"🏘️",title:label(b.kind),
    subtitle:"建築済み #"+b.id});
  }
  for(const b of actions?.structures||[]){
   if(b.progress<1)continue;
   add({id:"hut-"+b.id,entityId:b.id,source:"hut",category,x:b.x,z:b.z,
    icon:"🏠",title:label(b.kind),subtitle:"自分の建築物 #"+b.id});
  }
  const sites=!renderer?.settlementId||renderer.settlementId==="pioneer"?VILLAGE_SITES:
   settlementLayout(renderer.settlementId).buildings;
  for(let i=0;i<sites.length;i++){
   const b=sites[i];
   add({id:"village-"+i,source:"village",category,x:b.x,z:b.z,
    icon:b.type==="stable"?"🐴":"🏘️",title:label(b.type),subtitle:"村の施設"});
  }
 }
 if(category==="resources")for(const n of renderer?.resourceNodes||[]){
  add({id:n.id,source:"resource",category,x:n.x,z:n.z,
   icon:n.kind==="stone"?"🪨":"🌲",title:n.name||n.type||"資源",
   subtitle:n.state==="fallen"?"倒木":n.state==="rubble"?"砕石":n.kind==="stone"?"採掘":"採集"});
 }
 const query=String(search).trim().normalize("NFKC").toLocaleLowerCase();
 const filtered=query?candidates.filter(e=>(e.title+" "+e.subtitle+" "+e.id)
  .normalize("NFKC").toLocaleLowerCase().includes(query)):candidates;
 filtered.sort((a,b)=>a.distanceM-b.distanceM||a.id.localeCompare(b.id));
 return {total:filtered.length,items:filtered.slice(0,Math.max(1,Math.min(150,Math.floor(limit)||80)))};
}
