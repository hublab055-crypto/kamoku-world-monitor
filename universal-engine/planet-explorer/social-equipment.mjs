/** Frontier World social commands and five quick-use slots.
 * Pure model: proximity is evaluated in the same metre-space as SquadEngine.
 */
export const ITEM_OPTIONS=Object.freeze([
 ["none","— 空き","▫️"],["sword","剣","⚔️"],["axe","斧","🪓"],
 ["pickaxe","つるはし","⛏️"],["book","本","📖"],["cup","コップ","🥛"],
 ["bowl","椀","🥣"],["spoon","スプーン","🥄"],["meal","料理","🍲"],
 ["water","水","💧"],["wood","木材","🪵"],["stone","石","🪨"],
 ["fiber","繊維","🌿"],["rawFood","食材","🥕"],["bedroll","ベッドロール","🛏️"]
]);
export const ITEM_MAP=new Map(ITEM_OPTIONS.map(([id,name,icon])=>[id,{name,icon}]));
const validItems=new Set(ITEM_MAP.keys());
const sources=Object.freeze({wood:"frontier",stone:"frontier",fiber:"frontier",
 water:"lifestyle",rawFood:"lifestyle",meal:"lifestyle",cup:"lifestyle",bowl:"lifestyle",
 spoon:"lifestyle",bedroll:"lifestyle"});
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const defaults=()=>["sword","axe","pickaxe","cup","book"];
export class SocialEquipment {
 constructor(snapshot=null){
  this.actors={};this.relations={};this.history=[];this.maxDistance=4;
  for(const id of ["player","scout","artisan"])this.actors[id]={slots:defaults(),selected:0};
  if(snapshot)this.restore(snapshot);
 }
 actor(id){return this.actors[id]||null;}
 equip(id,index,item){
  const actor=this.actor(id);
  if(!actor||!Number.isInteger(index)||index<0||index>4||!validItems.has(item))return false;
  actor.slots[index]=item;return true;
 }
 select(id,index){
  const actor=this.actor(id);
  if(!actor||!Number.isInteger(index)||index<0||index>4)return false;
  actor.selected=index;return true;
 }
 chosen(id){const actor=this.actor(id);return actor?.slots[actor.selected]||"none";}
 near(a,b){return !!a&&!!b&&a.id!==b.id&&Math.hypot(a.control.x-b.control.x,a.control.z-b.control.z)<=this.maxDistance;}
 relation(a,b){return this.relations[a+":"+b]??40;}
 adjust(a,b,delta){const key=a+":"+b;this.relations[key]=clamp(this.relation(a,b)+delta,0,100);return this.relations[key];}
 message(actor,target){
  const level=this.relation(actor.id,target.id);
  const lines=level>=70?["一緒に頑張ろう。","会えてうれしいよ。","これからもよろしく。"]:
   level>=45?["今日はどこへ行く？","調子はどう？","手伝えることはある？"]:
   ["こんにちは。","はじめまして。","この辺りを探索中なんだ。"];
  const count=this.history.filter(x=>x.kind==="talk"&&x.from===actor.id&&x.to===target.id).length;
  return target.name+"：「"+lines[count%lines.length]+"」";
 }
 talk(actor,target){
  if(!this.near(actor,target))return {ok:false,message:"話すには相手の4m以内に近づいてください。"};
  const message=this.message(actor,target);
  this.adjust(actor.id,target.id,1);
  this.history.push({kind:"talk",from:actor.id,to:target.id,message});
  if(this.history.length>60)this.history.shift();
  return {ok:true,message};
 }
 availableGifts(sender,life,frontier){
  const bag=frontier?.person(sender.id)?.inventory||{},inventory=life?.inventory||{};
  return ITEM_OPTIONS.filter(([id])=>sources[id] && (
   sources[id]==="frontier"?(bag[id]||0)>0:(inventory[id]||0)>0))
   .map(([id,name,icon])=>({id,name,icon}));
 }
 gift(sender,target,item,life,frontier){
  if(!this.near(sender,target))return {ok:false,message:"渡すには相手の4m以内に近づいてください。"};
  if(!validItems.has(item)||!sources[item])return {ok:false,message:"そのアイテムは渡せません。"};
  const p=frontier?.person(sender.id),recipient=frontier?.person(target.id);
  const inventory=sources[item]==="frontier"?p?.inventory:life?.inventory;
  if(!inventory||!(inventory[item]>0)||!recipient)return {ok:false,message:"渡せる持ち物がありません。"};
  inventory[item]--;
  recipient.gifts={...(recipient.gifts||{})};
  recipient.gifts[item]=(recipient.gifts[item]||0)+1;
  const affection=this.adjust(sender.id,target.id,item==="meal"?7:4);
  const name=ITEM_MAP.get(item)?.name||item;
  const message=sender.name+" → "+target.name+"："+name+"をプレゼント（親密度 "+affection+"）";
  this.history.push({kind:"gift",from:sender.id,to:target.id,item,message});
  if(this.history.length>60)this.history.shift();
  return {ok:true,message};
 }
 use(actor,life,frontier){
  const item=this.chosen(actor.id);
  if(item==="none")return {ok:false,message:"スロットが空です。"};
  if(["sword","axe","pickaxe"].includes(item))
   return {ok:true,kind:"action",action:{sword:"sword",axe:"axe",pickaxe:"mine"}[item]};
  if(item==="book")return {ok:true,kind:"book"};
  if(item==="bedroll")return {ok:true,kind:"deploy",item:"bedroll"};
  if(["cup","bowl","spoon"].includes(item)){
   const result=life?.useItem(item)||{ok:false,message:"生活システムが利用できません。"};
   return {...result,kind:"item"};
  }
  if(item==="meal"){
   if(!(life?.inventory?.meal>0))return {ok:false,message:"料理を持っていません。"};
   life.inventory.meal--;life.stats.hunger=clamp(life.stats.hunger-35,0,100);
   life.stats.stamina=clamp(life.stats.stamina+8,0,100);
   if(frontier?.person(actor.id))frontier.person(actor.id).stamina=clamp(frontier.person(actor.id).stamina+8,0,100);
   return {ok:true,kind:"item",message:"🍲 料理を食べました。"};
  }
  if(item==="water"){
   if(!(life?.inventory?.water>0))return {ok:false,message:"水がありません。"};
   life.inventory.water--;life.stats.stamina=clamp(life.stats.stamina+4,0,100);
   if(frontier?.person(actor.id))frontier.person(actor.id).stamina=clamp(frontier.person(actor.id).stamina+4,0,100);
   return {ok:true,kind:"item",message:"💧 水を飲みました。"};
  }
  return {ok:false,message:"選択した材料はクラフトやプレゼントで使用できます。"};
 }
 snapshot(){
  return {version:1,actors:Object.fromEntries(Object.entries(this.actors).map(([id,a])=>[id,{slots:[...a.slots],selected:a.selected}])),
   relations:{...this.relations},history:this.history.slice(-60)};
 }
 restore(data){
  if(data?.version!==1)return false;
  for(const id of Object.keys(this.actors)){
   const a=data.actors?.[id];
   if(!a)continue;
   this.actors[id]={slots:Array.from({length:5},(_,i)=>validItems.has(a.slots?.[i])?a.slots[i]:defaults()[i]),
    selected:Number.isInteger(a.selected)?clamp(a.selected,0,4):0};
  }
  this.relations={};
  for(const [k,v] of Object.entries(data.relations||{}))
   if(/^(player|scout|artisan):(player|scout|artisan)$/.test(k)&&Number.isFinite(v))this.relations[k]=clamp(v,0,100);
  this.history=Array.isArray(data.history)?data.history.slice(-60).filter(e=>e&&["talk","gift"].includes(e.kind)&&typeof e.message==="string"&&e.message.length<300):[];
  return true;
 }
}
