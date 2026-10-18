/** Mutable resource state for deterministic, streamed planet vegetation.
 * The seed-generated nodes remain immutable; only damage and removed node IDs
 * are saved. No save migration or network dependency required.
 */
import {RESOURCE_PROFILES,harvestYield} from "./resource-economy.mjs";
const TYPES={
 pine:{hp:3,tool:"axe",drop:{wood:3,fiber:1}},
 broadleaf:{hp:3,tool:"axe",drop:{wood:4,fiber:1}},
 flowering:{hp:2,tool:"axe",drop:{wood:2,fiber:2}},
 "maple-red":{hp:3,tool:"axe",drop:{wood:3,fiber:1}},
 "maple-orange":{hp:3,tool:"axe",drop:{wood:3,fiber:1}},
 "oak-yellow":{hp:4,tool:"axe",drop:{wood:5,fiber:1}},
 birch:{hp:2,tool:"axe",drop:{wood:3,fiber:1}},
 shrub:{hp:1,tool:"axe",drop:{wood:1,fiber:3}},
 boulder:{hp:4,tool:"mine",drop:{stone:4,clay:1}},
 pebble:{hp:1,tool:"mine",drop:{stone:1}},
 "iron-deposit":{hp:9,tool:"mine",drop:{ironOre:50}},
 "large-oak":{hp:7,tool:"axe",drop:{wood:75,fiber:5}},
 "fallen-log":{hp:1,tool:"axe",drop:{wood:3,fiber:1}},
 rubble:{hp:1,tool:"mine",drop:{stone:3}}
};
export const HARVEST_TYPES=Object.freeze(TYPES);
export class ResourceHarvest {
 constructor(saved=null){
  this.states=new Map();
  if(saved) {
   if(saved.version!==1||!Array.isArray(saved.nodes)||saved.nodes.length>100000)throw Error("資源の保存形式が不正です");
   for(const e of saved.nodes){
    if(!Array.isArray(e)||e.length!==3||typeof e[0]!=="string"||e[0].length>100||
      !["damaged","fallen","rubble","removed"].includes(e[1])||
      !Number.isSafeInteger(e[2])||e[2]<0||e[2]>10)throw Error("資源の保存内容が不正です");
    this.states.set(e[0],{state:e[1],hp:e[2]});
   }
  }
 }
 visual(node){
  const s=this.states.get(node.id);
  if(s?.state==="removed")return null;
  if(s?.state==="fallen")return {...node,type:"fallen-log",sourceType:node.sourceType||node.type,name:"倒木",kind:"wood",state:"fallen"};
  if(s?.state==="rubble")return {...node,type:"rubble",sourceType:node.sourceType||node.type,name:"砕石",kind:"stone",state:"rubble"};
  return {...node,damage:(TYPES[node.type]?.hp||3)-(s?.hp??(TYPES[node.type]?.hp||3))};
 }
 visible(nodes){return nodes.map(n=>this.visual(n)).filter(Boolean);}
 /** First hits damage a standing node; final hit fells or cracks; next tool hit
  * converts the physical remains into inventory resources. */
 hit(node,tool){
  if(!node||typeof node.id!=="string")return {ok:false,message:"資源を選択してください"};
  const current=this.states.get(node.id);
  if(current?.state==="removed")return {ok:false,message:"資源は既に回収されました"};
  const variant=current?.state==="fallen"?"fallen-log":current?.state==="rubble"?"rubble":node.type;
  const spec=TYPES[variant];
  if(!spec||!(spec.tool===tool||tool==="saw"&&spec.tool==="axe"&&current?.state==="fallen"))
  return {ok:false,message:tool==="saw"?"ノコギリは倒木に使用してください":tool==="axe"?"斧で伐採できる木を選択してください":"つるはしで砕ける岩を選択してください"};
  if(current?.state==="fallen"||current?.state==="rubble"){
   this.states.set(node.id,{state:"removed",hp:0});
   const yieldData=harvestYield(node,{saw:tool==="saw"});
   return {ok:true,stage:"collected",...yieldData,
    message:(variant==="rubble"?"🪨 採石":"🪵 木材")+" "+yieldData.massKg+"kgを回収"+(tool==="saw"?"（板材）":"")};
  }
  const hp=Math.max(0,(current?.hp??spec.hp)-1);
  if(hp>0){
   this.states.set(node.id,{state:"damaged",hp});
   return {ok:true,stage:"damaged",drops:{},hp,message:node.kind==="stone"?"⛏️ 岩にひびが入りました":"🪓 幹に切れ目が入りました"};
  }
  const stone=node.kind==="stone"||variant==="boulder";
  this.states.set(node.id,{state:stone?"rubble":"fallen",hp:0});
  return {ok:true,stage:stone?"broken":"felled",drops:{},hp:0,
    message:stone?"💥 岩が砕け、回収できる砕石になりました":"🌲 木を切り倒しました。倒木をもう一度伐採して丸太を得られます"};
 }
 snapshot(){return {version:1,nodes:[...this.states].map(([id,v])=>[id,v.state,v.hp])};}
}
