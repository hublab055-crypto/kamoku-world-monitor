/** Frontier World social commands and five quick-use slots.
 * Pure model: proximity is evaluated in the same metre-space as SquadEngine.
 */
export const ITEM_OPTIONS=Object.freeze([
 ["none","— 空き","▫️"],["sword","剣","⚔️"],["spear","長槍（両手）","🔱"],["greatsword","両手剣","⚔️"],["shield","盾","🛡️"],["potion","回復薬","🧪"],["axe","斧","🪓"],["bow","弓","🏹"],["arrow","矢","➶"],
 ["pickaxe","つるはし","⛏️"],["book","本","📖"],["cup","コップ","🥛"],
 ["bowl","椀","🥣"],["spoon","スプーン","🥄"],["meal","料理","🍲"],
 ["water","水","💧"],["wood","木材","🪵"],["stone","石","🪨"],
 ["fiber","繊維","🌿"],["rawFood","食材","🥕"],["bedroll","ベッドロール","🛏️"],
 ["tent","携帯テント","⛺"],["plate","皿","🍽️"],["pot","鍋","🍲"]
]);
export const ITEM_MAP=new Map(ITEM_OPTIONS.map(([id,name,icon])=>[id,{name,icon}]));
const validItems=new Set(ITEM_MAP.keys());
const sources=Object.freeze({wood:"frontier",stone:"frontier",fiber:"frontier",
 water:"lifestyle",rawFood:"lifestyle",meal:"lifestyle",cup:"lifestyle",bowl:"lifestyle",
 spoon:"lifestyle",bedroll:"lifestyle",tent:"lifestyle",plate:"lifestyle",pot:"lifestyle"});
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const defaults=()=>["sword","axe","pickaxe","cup","book"];
export const HANDS=Object.freeze(["right","left"]);
export const TWO_HANDED_ITEMS=Object.freeze(["spear","greatsword"]);
const twoHanded=new Set(TWO_HANDED_ITEMS);
/** A two-handed weapon is a single object occupying both equipment slots. */
export function normalizeEquipmentHands(hands,changed=null){
 const next={right:hands?.right||"none",left:hands?.left||"none"};
 if(HANDS.includes(changed)){
  const other=changed==="right"?"left":"right";
  if(twoHanded.has(next[changed]))return {right:next[changed],left:next[changed]};
  if(twoHanded.has(next[other]))next[other]="none";
  return next;
 }
 const weapon=twoHanded.has(next.right)?next.right:twoHanded.has(next.left)?next.left:null;
 return weapon?{right:weapon,left:weapon}:next;
}
export const ATTACK_MODES=Object.freeze(["overhead","sweep","thrust","combo"]);
export const ARROW_TYPES=Object.freeze({
 wood:{name:"木の矢",icon:"➶",damage:22},
 iron:{name:"鉄の矢",icon:"🪙",damage:33},
 fire:{name:"火矢",icon:"🔥",damage:17}
});
export const arrowTypeValid=type=>Object.hasOwn(ARROW_TYPES,type);
const permanent=new Set(["sword","spear","greatsword","shield","axe","pickaxe","bow","book"]);
const handDefaults=()=>({right:"sword",left:"axe"});
export const EQUIPPABLE=Object.freeze([...validItems]);
export class SocialEquipment {
 constructor(snapshot=null){
  this.actors={};this.relations={};this.history=[];this.maxDistance=4;
  for(const id of ["player","scout","artisan"])this.actors[id]={slots:defaults(),selected:0,hands:handDefaults(),arrows:12,specialArrows:{iron:0,fire:0},arrowType:"wood",potions:3,attackMode:"overhead"};
  if(snapshot)this.restore(snapshot);
 }
 actor(id){return this.actors[id]||null;}
 setAttackMode(id,mode){
  const actor=this.actor(id);
  if(!actor||!ATTACK_MODES.includes(mode))return false;
  actor.attackMode=mode;return true;
 }
 attackVariant(id,action){
  const mode=this.actor(id)?.attackMode||"overhead";
  return action==="axe"&&mode==="thrust"?"overhead":mode;
 }
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
 handItem(id,hand){return HANDS.includes(hand)?(this.actor(id)?.hands?.[hand]||"none"):"none";}
 inventoryFor(actor,life,frontier){
  if(!actor)return [];
  const bag=frontier?.person(actor.id)?.inventory||{},gifts=frontier?.person(actor.id)?.gifts||{};
  const shared=life?.inventory||{};
  return ITEM_OPTIONS.filter(([kind])=>kind!=="none").map(([id,name,icon])=>{
   const personal=Number(bag[id])||0,gifted=Number(gifts[id])||0,
    communal=Number(shared[id])||0,base=permanent.has(id)?1:id==="arrow"?(this.actor(actor.id)?.arrows||0):id==="potion"?(this.actor(actor.id)?.potions||0):0;
   const total=personal+gifted+communal+base;
   return {id,name,icon,quantity:Math.max(0,total),source:base?(id==="arrow"?"矢筒":"基本装備"):personal?"本人の袋":gifted?"受け取った品":"生活用品",
    canEquip:true};
  }).filter(item=>item.quantity>0);
 }
 quantity(actor,item,life,frontier){
  return this.inventoryFor(actor,life,frontier).find(x=>x.id===item)?.quantity||0;
 }
 equipHand(actor,hand,item,life,frontier){
  if(!actor||!this.actor(actor.id)||!HANDS.includes(hand)||!validItems.has(item))return {ok:false,message:"装備先かアイテムが無効です。"};
  if(item!=="none"&&this.quantity(actor,item,life,frontier)<1)return {ok:false,message:"持っていないアイテムは装備できません。"};
  if(item!=="none"&&!permanent.has(item)){
   const other=hand==="right"?"left":"right";
   if(this.handItem(actor.id,other)===item&&this.quantity(actor,item,life,frontier)<2)
    return {ok:false,message:"このアイテムは1個しかないため、両手に同時装備できません。"};
  }
  this.actor(actor.id).hands=normalizeEquipmentHands({...this.actor(actor.id).hands,[hand]:item},hand);
  const paired=twoHanded.has(item);
  return {ok:true,message:actor.name+"の"+(paired?"両手":hand==="right"?"右手":"左手")+"に "+(ITEM_MAP.get(item)?.name||item)+" を装備しました。"+(paired?"（盾などの併用不可）":"")};
 }
 arrowCount(id,type="wood"){
  const owner=this.actor(id);
  return owner&&arrowTypeValid(type)?(type==="wood"?owner.arrows:owner.specialArrows[type])||0:0;
 }
 setArrowType(id,type){
  const owner=this.actor(id);
  if(!owner||!arrowTypeValid(type))return false;
  owner.arrowType=type;return true;
 }
 spendArrow(id,type=this.actor(id)?.arrowType||"wood"){
  if(this.arrowCount(id,type)<=0)return false;
  const owner=this.actor(id);
  if(type==="wood")owner.arrows--;
  else owner.specialArrows[type]--;
  return true;
 }
 recoverArrow(id,type="wood"){
  const owner=this.actor(id);
  if(!owner||!arrowTypeValid(type)||this.arrowCount(id,type)>=999)return false;
  if(type==="wood")owner.arrows++;
  else owner.specialArrows[type]++;
  return true;
 }
 craftTypedArrows(id,type,resources){
  const owner=this.actor(id),recipe={
   wood:{wood:1,stone:1},iron:{wood:1,metal:2},fire:{wood:1,fiber:2}
  }[type];
  if(!owner||!recipe||!resources)return {ok:false,message:"製作する人物または矢種が無効です。"};
  const amount=type==="wood"?6:3;
  if(this.arrowCount(id,type)>999-amount)return {ok:false,message:"矢筒に空きがありません。"};
  if(Object.entries(recipe).some(([key,value])=>(resources[key]||0)<value))
   return {ok:false,message:ARROW_TYPES[type].name+"の材料が不足しています。"+
    Object.entries(recipe).map(([key,value])=>key+"×"+value).join("・")};
  for(const [key,value] of Object.entries(recipe))resources[key]-=value;
  if(type==="wood")owner.arrows+=amount;
  else owner.specialArrows[type]+=amount;
  return {ok:true,message:"🏹 "+ARROW_TYPES[type].name+"を"+amount+"本製作しました（残り"+this.arrowCount(id,type)+"本）。"};
 }
 craftArrows(id,resources){return this.craftTypedArrows(id,"wood",resources);}
 useHand(actor,hand,life,frontier){
  if(!HANDS.includes(hand))return {ok:false,message:"右手か左手を選んでください。"};
  return this.useItem(actor,this.handItem(actor?.id,hand),life,frontier);
 }
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
 use(actor,life,frontier){return this.useItem(actor,this.chosen(actor?.id),life,frontier);}
 useItem(actor,item,life,frontier){
  if(!actor||!this.actor(actor.id)||!validItems.has(item)||item==="none")
   return {ok:false,message:"スロットに使えるアイテムがありません。"};
  if(this.quantity(actor,item,life,frontier)<1)return {ok:false,message:"そのアイテムはもう持っていません。持ち物画面で確認してください。"};
  if(item==="arrow")return {ok:false,message:"矢は弓を装備して発射してください。"};
  if(item==="shield")return {ok:true,kind:"guard",message:"🛡️ 盾を構えました。"};
  if(item==="potion"){
   const data=this.actor(actor.id);
   if(!(data.potions>0))return {ok:false,message:"回復薬を使い切りました。"};
   data.potions--;
   if(life?.stats)life.stats.stamina=clamp(life.stats.stamina+25,0,100);
   return {ok:true,kind:"heal",amount:35,message:"🧪 回復薬を使用しました（残り "+data.potions+"個）。"};
  }
  if(permanent.has(item)){
   if(item==="book")return {ok:true,kind:"book"};
   if(item==="bow"){
    const type=this.actor(actor.id).arrowType||"wood";
    return this.arrowCount(actor.id,type)>0?
     {ok:true,kind:"action",action:"bow",usesArrow:true,arrowType:type}:
     {ok:false,message:ARROW_TYPES[type].name+"がありません。矢筒を補充してください。"};
   }
   return {ok:true,kind:"action",action:{sword:"sword",spear:"spear",greatsword:"greatsword",axe:"axe",pickaxe:"mine"}[item]};
  }
  if(["bedroll","tent"].includes(item))return {ok:true,kind:"deploy",item};
  const bag=frontier?.person(actor.id)?.inventory||{},
   gifts=frontier?.person(actor.id)?.gifts||{},shared=life?.inventory||{};
  const take=(kind)=>{
   if((bag[kind]||0)>0){bag[kind]--;return "bag";}
   if((gifts[kind]||0)>0){gifts[kind]--;return "gift";}
   if((shared[kind]||0)>0){shared[kind]--;return "shared";}
   return null;
  };
  if(["cup","bowl","spoon"].includes(item)){
   if(!life?.useItem)return {ok:false,message:"生活システムが利用できません。"};
   // Lifestyle.useItem performs the actual removal. Temporarily lend one
   // personally owned/gifted utensil so the existing cooking rules can run.
   const personal=(bag[item]||0)>0?"bag":(gifts[item]||0)>0?"gift":null;
   if(personal){shared[item]=(shared[item]||0)+1;}
   const result=life.useItem(item);
   if(personal){
    if(result.ok){(personal==="bag"?bag:gifts)[item]--;}
    else shared[item]--;
   }
   return {...result,kind:"item"};
  }
  if(item==="meal"||item==="water"||item==="rawFood"){
   const taken=take(item);if(!taken)return {ok:false,message:"アイテムを持っていません。"};
   const hunger=item==="meal"?35:item==="rawFood"?9:0,
    stamina=item==="meal"?8:item==="water"?4:0;
   if(life?.stats){life.stats.hunger=clamp(life.stats.hunger-hunger,0,100);
    life.stats.stamina=clamp(life.stats.stamina+stamina,0,100);}
   if(frontier?.person(actor.id))frontier.person(actor.id).stamina=clamp(frontier.person(actor.id).stamina+stamina,0,100);
   return {ok:true,kind:"item",message:item==="meal"?"🍲 料理を食べました。":item==="water"?"💧 水を飲みました。":"🥕 食材を食べました。"};
  }
  return {ok:false,message:"このアイテムは使用せずに、クラフト材料として保管します。"};
 }
 snapshot(){
  return {version:1,actors:Object.fromEntries(Object.entries(this.actors).map(([id,a])=>[id,{slots:[...a.slots],selected:a.selected,hands:{...a.hands},arrows:a.arrows,specialArrows:{...a.specialArrows},arrowType:a.arrowType,potions:a.potions,attackMode:a.attackMode}])),
   relations:{...this.relations},history:this.history.slice(-60)};
 }
 restore(data){
  if(data?.version!==1)return false;
  for(const id of Object.keys(this.actors)){
   const a=data.actors?.[id];
   if(!a)continue;
   this.actors[id]={slots:Array.from({length:5},(_,i)=>validItems.has(a.slots?.[i])?a.slots[i]:defaults()[i]),
    selected:Number.isInteger(a.selected)?clamp(a.selected,0,4):0,
    arrows:Number.isSafeInteger(a.arrows)?clamp(a.arrows,0,999):12,
    specialArrows:Object.fromEntries(["iron","fire"].map(type=>[type,
     Number.isSafeInteger(a.specialArrows?.[type])?clamp(a.specialArrows[type],0,999):0])),
    arrowType:arrowTypeValid(a.arrowType)?a.arrowType:"wood",
    potions:Number.isSafeInteger(a.potions)?clamp(a.potions,0,99):3,
    attackMode:ATTACK_MODES.includes(a.attackMode)?a.attackMode:"overhead",
    hands:normalizeEquipmentHands(Object.fromEntries(HANDS.map(hand=>[hand,validItems.has(a.hands?.[hand])?a.hands[hand]:handDefaults()[hand]])))};
  }
  this.relations={};
  for(const [k,v] of Object.entries(data.relations||{}))
   if(/^(player|scout|artisan):(player|scout|artisan)$/.test(k)&&Number.isFinite(v))this.relations[k]=clamp(v,0,100);
  this.history=Array.isArray(data.history)?data.history.slice(-60).filter(e=>e&&["talk","gift"].includes(e.kind)&&typeof e.message==="string"&&e.message.length<300):[];
  return true;
 }
}
