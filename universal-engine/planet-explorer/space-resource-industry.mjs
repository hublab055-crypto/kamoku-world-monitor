/** Deterministic, saveable local extraction prototype.
 * Coordinates are in the same encounter frame as ship contacts.
 * Yields are GAME BALANCE VALUES, not measured asteroid ore assays.
 */
export const ASTEROID_CONTACTS=Object.freeze([
 {id:"asteroid-ore",name:"M型 金属質小惑星",type:"resource",faction:"resource",bearing:-41,pitch:-12,distance:880,phase:3.7,deposit:"metal"},
 {id:"asteroid-silicate",name:"S型 ケイ酸塩小惑星",type:"resource",faction:"resource",bearing:19,pitch:13,distance:1150,phase:1.1,deposit:"silicate"},
 {id:"asteroid-carbon",name:"C型 含水小惑星",type:"resource",faction:"resource",bearing:53,pitch:-7,distance:740,phase:4.2,deposit:"carbon"},
 {id:"asteroid-precious",name:"白金族濃集鉱体",type:"resource",faction:"resource",bearing:-14,pitch:21,distance:1360,phase:5.7,deposit:"precious"},
 {id:"asteroid-regolith",name:"太陽風照射レゴリス片",type:"resource",faction:"resource",bearing:31,pitch:-24,distance:1470,phase:2.9,deposit:"regolith"}
]);
export const RESOURCE_LABELS=Object.freeze({
 iron:"鉄",nickel:"ニッケル",copper:"銅",aluminum:"アルミニウム",silicon:"ケイ素",water:"水・氷",
 platinum:"プラチナ",gold:"金",silver:"銀",carbon:"炭素",helium3:"ヘリウム3",
 propellant:"推進剤",hullPlate:"船体板",circuit:"電子回路",reactorCell:"核融合燃料セル"
});
const DEPOSITS=Object.freeze({
 metal:{iron:210,nickel:65,copper:26,silver:3,gold:1,platinum:.7},
 silicate:{silicon:180,aluminum:80,iron:38,copper:10},
 carbon:{water:220,carbon:95,iron:10,copper:3},
 precious:{platinum:12,gold:9,silver:25,copper:36,nickel:25},
 // Small solar-wind-exposed fragment: extremely low trace 3He. Major
 // 3He supply is intended to come from lunar regolith/gas atmospheres later.
 regolith:{aluminum:85,silicon:95,iron:25,water:12,helium3:.025}
});
export const SPACE_RECIPES=Object.freeze([
 {id:"propellant",label:"水の電気分解 → 推進剤",tech:1,inputs:{water:12},output:"propellant",amount:8,energy:6},
 {id:"refuel",label:"推進剤を船の燃料タンクへ",tech:1,inputs:{propellant:8},fuel:25,energy:0},
 {id:"hull",label:"鉄・アルミ → 船体板",tech:1,inputs:{iron:12,aluminum:4},output:"hullPlate",amount:12,energy:5},
 {id:"repair",label:"船体板・銅 → 修理キット",tech:1,inputs:{hullPlate:12,copper:2},repairKit:1,energy:3},
 {id:"circuit",label:"銅・銀・金 → 電子回路",tech:2,inputs:{copper:4,silver:.4,gold:.2},output:"circuit",amount:3,energy:4},
 {id:"fusion",label:"ヘリウム3燃料セル（研究段階）",tech:3,inputs:{helium3:.005,platinum:.5,circuit:3},output:"reactorCell",amount:1,energy:12}
]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const safe=(n,fallback=0)=>Number.isFinite(n)?Math.max(0,n):fallback;
const round=n=>Math.round(n*10000)/10000;
export class SpaceIndustry{
 constructor(saved={}){
  this.schemaVersion=1;
  this.capacityKg=360;
  this.technologyLevel=clamp(Math.floor(safe(saved.technologyLevel,1)),1,3);
  this.stock={};
  for(const key of Object.keys(RESOURCE_LABELS))this.stock[key]=Math.min(10000,safe(saved.stock?.[key]));
  this.remaining={};
  this.strikes={};
  for(const contact of ASTEROID_CONTACTS){
   const initial=DEPOSITS[contact.deposit];
   this.remaining[contact.id]={};
   for(const [key,mass] of Object.entries(initial)){
    this.remaining[contact.id][key]=round(Math.min(mass,safe(saved.remaining?.[contact.id]?.[key],mass)));
   }
   this.strikes[contact.id]=Math.min(100000,Math.floor(safe(saved.strikes?.[contact.id])));
  }
 }
 snapshot(){return {schemaVersion:1,stock:{...this.stock},
  remaining:Object.fromEntries(Object.entries(this.remaining).map(([id,r])=>[id,{...r}])),
  strikes:{...this.strikes},technologyLevel:this.technologyLevel};}
 get cargoKg(){return Object.values(this.stock).reduce((sum,n)=>sum+n,0);}
 get freeKg(){return Math.max(0,this.capacityKg-this.cargoKg);}
 /** Mining returns a single deterministic ore fraction for each blast.
  * Mining beam is a weapon firing mode; cargo recovery is assumed automated.
  */
 mine(id,{weapon="pulse",distance=Infinity}={}){
  const contact=ASTEROID_CONTACTS.find(c=>c.id===id);
  if(!contact)return {ok:false,message:"鉱床のロックオンが必要です"};
  if(distance>1500)return {ok:false,message:"採掘射程は1.5 km以内です"};
  if(this.freeKg<.01)return {ok:false,message:"船倉が満杯です。先に精製・加工してください"};
  const ore=this.remaining[id],keys=Object.keys(ore).filter(key=>ore[key]>.00001);
  if(!keys.length)return {ok:false,message:contact.name+"：採掘可能量が残っていません"};
  const strike=this.strikes[id]++;
  // Weighted deterministic rotation keeps rarer ores scarce without random
  // save/reload rerolls; testable and replay-stable.
  const weights=keys.map(key=>Math.sqrt(ore[key]));
  const total=weights.reduce((a,b)=>a+b,0);
  let pick=((strike*0.6180339887498949)%1)*total;
  let mineral=keys.at(-1);
  for(let i=0;i<keys.length;i++){pick-=weights[i];if(pick<=0){mineral=keys[i];break;}}
  const mode=weapon==="rapid"?1:weapon==="missile"?6:3;
  const efficiency=weapon==="missile"?.4:1;
  const extracted=round(Math.min(ore[mineral],this.freeKg,mode*efficiency));
  if(extracted<=0)return {ok:false,message:"回収できる鉱石がありません"};
  ore[mineral]=round(Math.max(0,ore[mineral]-extracted));
  this.stock[mineral]=round(this.stock[mineral]+extracted);
  return {ok:true,resource:mineral,amount:extracted,remaining:round(Object.values(ore).reduce((a,b)=>a+b,0)),
   message:"⛏️ "+contact.name+"："+RESOURCE_LABELS[mineral]+" "+extracted+" kg 回収（船倉 "+round(this.cargoKg)+"/"+this.capacityKg+" kg）"};
 }
 craft(id,{voyage=null,combat=null}={}){
  const recipe=SPACE_RECIPES.find(r=>r.id===id);
  if(!recipe)return {ok:false,message:"そのレシピは存在しません"};
  if(recipe.tech>this.technologyLevel)return {ok:false,message:"技術レベル "+recipe.tech+" が必要です（現状 "+this.technologyLevel+"）"};
  const missing=Object.entries(recipe.inputs).filter(([k,v])=>(this.stock[k]||0)+1e-6<v);
  if(missing.length)return {ok:false,message:"材料不足："+missing.map(([k,v])=>RESOURCE_LABELS[k]+" "+v+" kg").join("、")};
  if(recipe.fuel&&(!voyage||voyage.fuel>=100))return {ok:false,message:"燃料タンクが満タンか、船に搭乗していません"};
  if(recipe.repairKit&&!combat)return {ok:false,message:"整備システムに接続できません"};
  const consumed=Object.values(recipe.inputs).reduce((a,b)=>a+b,0);
  if(this.freeKg+consumed<(recipe.amount||0))return {ok:false,message:"加工品の保管容量が足りません"};
  for(const [key,mass] of Object.entries(recipe.inputs))this.stock[key]=round(this.stock[key]-mass);
  if(recipe.output)this.stock[recipe.output]=round(this.stock[recipe.output]+recipe.amount);
  if(recipe.fuel)voyage.fuel=Math.min(100,voyage.fuel+recipe.fuel);
  if(recipe.repairKit)combat.supplies.kits+=recipe.repairKit;
  return {ok:true,message:"🏭 "+recipe.label+" 完了"+(recipe.fuel?" ／ 船燃料 "+Math.round(voyage.fuel)+"%":"")};
 }
}
