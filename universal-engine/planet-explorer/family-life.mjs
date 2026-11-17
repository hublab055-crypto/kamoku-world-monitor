/**
 * Universal Engine: family life-cycle and Overlord's Covenant.
 *
 * All romantic/private actions require explicitly adult characters, mutual
 * consent and a separate per-session study-mode unlock. The base game fades
 * to black. An optional MOD signal can leave the camera visible, but the
 * engine never generates, records or simulates explicit sexual activity.
 * Children (including prenatal life) can never suffer injuries, be combat
 * targets, die, or develop a fatal illness. Protection is authoritative here
 * rather than a render-only effect.
 */
export const FAMILY_VERSION=1;
export const FAMILY_YEAR_DAYS=365;
export const FAMILY_GESTATION_DAYS=280;
export const FAMILY_ADULT_AGE=18;
export const FAMILY_PRIVATE_MOD_EVENT="universal-engine:adult-private-scene";
export const FAMILY_PRIVATE_MOD_API_VERSION=1;
export const FAMILY_ONENIGHT_MIN_AFFINITY=20;
export const FAMILY_GROWTH_STAGES=Object.freeze([
 {id:"infant",label:"乳児",age:0},
 {id:"toddler",label:"幼児",age:2},
 {id:"child",label:"児童",age:6},
 {id:"teen",label:"青年",age:13},
 {id:"adult",label:"成人",age:18}
]);
export const OVERLORD_COVENANT=Object.freeze({
 id:"overlord-covenant",name:"オーバーロードの守護契約",
 rule:"未成年と胎児の被害・死傷・致死性疾患・戦闘参加を禁止する",
 sanctuary:"高次元の庇護界",guardian:"オーバーロードの保護官"
});
const ADULT_ROSTER=Object.freeze(["player","navigator","engineer","companion"]);
const copy=o=>JSON.parse(JSON.stringify(o));
const validDay=v=>Number.isFinite(v)&&v>=0;
const safeId=v=>typeof v==="string"&&/^[a-z0-9-]{1,60}$/i.test(v);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const stageOf=age=>{
 let stage=FAMILY_GROWTH_STAGES[0];
 for(const entry of FAMILY_GROWTH_STAGES)if(age>=entry.age)stage=entry;
 return stage;
};
function defaultAdult(id){
 return {id,ageYears:25,canConsent:true,available:true};
}
function readChild(raw){
 if(!raw||!safeId(raw.id)||!validDay(raw.birthDay)||!Array.isArray(raw.parents))return null;
 const parents=raw.parents.filter(id=>ADULT_ROSTER.includes(id)).slice(0,2);
 return {
  id:raw.id,name:typeof raw.name==="string"?raw.name.slice(0,48):"子ども",
  birthDay:raw.birthDay,parents,guardian:ADULT_ROSTER.includes(raw.guardian)?raw.guardian:raw.guardian==="overlord"?"overlord":null,
  location:["home","sanctuary","foster"].includes(raw.location)?raw.location:"home",
  homeSafe:raw.homeSafe!==false,
  care:{nutrition:clamp(Number(raw.care?.nutrition)||75,0,100),
   comfort:clamp(Number(raw.care?.comfort)||75,0,100),
   learning:clamp(Number(raw.care?.learning)||0,0,100)},
  protected:true,injuries:0,fatalIllness:false,dead:false,combatEligible:false,inherited:raw.inherited===true,
  growthStage:"infant",ageYears:0
 };
}
export class FamilyLife {
 constructor(saved=null,{day=0}={}){
  if(saved?.version!==undefined&&saved.version!==FAMILY_VERSION)throw Error("Unsupported family save version");
  this.day=validDay(saved?.day)?saved.day:(validDay(day)?day:0);
  this.adults=Object.fromEntries(ADULT_ROSTER.map(id=>{
   const value=saved?.adults?.[id]||{};
   return [id,{...defaultAdult(id),
    ageYears:Number.isFinite(value.ageYears)?clamp(value.ageYears,18,120):25,
    available:value.available!==false}];
  }));
  this.partners={};this.pregnancies=[];this.children=[];
  // Casual meetings do not create a long-term romantic or marriage flag.
  // Keep only a fictional event count needed for separately consented
  // family planning, never session unlocks or intimate details.
  this.encounters={};
  for(const [id,v] of Object.entries(saved?.encounters||{})){
   if(!ADULT_ROSTER.includes(id)||id==="player")continue;
   const count=Number(v?.privateTime);
   if(Number.isSafeInteger(count)&&count>0&&count<=1000)
    this.encounters[id]={privateTime:count,lastDay:validDay(v.lastDay)?v.lastDay:this.day};
  }
  for(const [id,v] of Object.entries(saved?.partners||{})){
   if(!ADULT_ROSTER.includes(id)||id==="player"||!["dating","married"].includes(v?.status))continue;
   this.partners[id]={status:v.status,consent:Boolean(v.consent),
    privateTime:Math.max(0,Number(v.privateTime)||0)};
  }
  if(Array.isArray(saved?.pregnancies)){
   this.pregnancies=saved.pregnancies.filter(p=>p&&safeId(p.id)&&
    ADULT_ROSTER.includes(p.gestationalParent)&&ADULT_ROSTER.includes(p.otherParent)&&
    p.gestationalParent!==p.otherParent&&validDay(p.startDay)&&validDay(p.dueDay)&&p.dueDay>=p.startDay)
    .slice(0,20).map(p=>({id:p.id,gestationalParent:p.gestationalParent,
     otherParent:p.otherParent,startDay:p.startDay,dueDay:p.dueDay,
     name:typeof p.name==="string"?p.name.slice(0,48):"赤ちゃん"}));
  }
  if(Array.isArray(saved?.children))this.children=saved.children.map(readChild).filter(Boolean).slice(0,100);
  this.nextId=Number.isSafeInteger(saved?.nextId)&&saved.nextId>0?saved.nextId:1;
  this.history=Array.isArray(saved?.history)?saved.history.slice(-200).map(copy):[];
  // Access is PER SESSION, never transferred through saved game data.
  this.privateUnlocked=false;
  this.reconcile();
 }
 _event(type,message,extra={}){
  const event={type,day:this.day,message,...extra};this.history.push(event);
  if(this.history.length>200)this.history.shift();
  return {ok:true,message,event};
 }
 _deny(message){return {ok:false,message};}
 _adults(a,b){
  return Boolean(this.adults[a]?.available&&this.adults[b]?.available&&
   this.adults[a].ageYears>=FAMILY_ADULT_AGE&&this.adults[b].ageYears>=FAMILY_ADULT_AGE&&a!==b);
 }
 unlock(code,{adultConfirmation=false}={}){
  if(code!=="9876"||adultConfirmation!==true)
   return this._deny("成人モードは確認コード9876と成人確認が必要です");
  this.privateUnlocked=true;
  return {ok:true,message:"成人向けの非描写プライベートモードを、このセッションで解禁しました"};
 }
 lock(){this.privateUnlocked=false;return {ok:true,message:"成人モードを閉じました"};}
 beginDating(id,{mutualConsent=false,relationship=null}={}){
  if(!this._adults("player",id))return this._deny("交際には成人同士の参加が必要です");
  if(!mutualConsent||relationship?.romance!==true)
   return this._deny("両者の同意と既存の恋人関係が必要です");
  if(this.partners[id])return this._deny("すでに交際・婚姻関係があります");
  this.partners[id]={status:"dating",consent:true,privateTime:0};
  return this._event("dating","交際を始めました",{partner:id});
 }
 marry(id,{mutualConsent=false,relationship=null}={}){
  if(!this._adults("player",id))return this._deny("婚姻は成人同士に限ります");
  if(!mutualConsent||relationship?.family!==true||this.partners[id]?.status!=="dating")
   return this._deny("交際後、両者の同意と既存の家族関係が必要です");
  this.partners[id].status="married";
  return this._event("marriage","結婚しました。新しい家族が始まります",{partner:id});
 }
 action(id,kind,{mutualConsent=false,oneNight=false,relationship=null,sceneMode="fade"}={}){
  const actions={handhold:"手をつなぐ",hug:"ハグ",kiss:"キス",private:"ふたりの時間（非描写）"};
  if(!Object.hasOwn(actions,kind))return this._deny("対応していないアクションです");
  if(!this.privateUnlocked)return this._deny("専用コード9876で成人モードを解禁してください");
  if(!this._adults("player",id)||!mutualConsent)
   return this._deny("成人同士の明示的な合意が必要です");
  const regular=Boolean(this.partners[id]);
  // One-night requires a live NPC rapport signal as well as the player's
  // confirmation; a single checkbox cannot manufacture NPC consent.
  const casual=oneNight===true&&Number.isFinite(relationship?.points)&&
   relationship.points>=FAMILY_ONENIGHT_MIN_AFFINITY;
  if(!regular&&!casual)return this._deny("交際関係、または相互の同意と一定の信頼関係が必要です");
  if(kind==="private"){
   if(!casual&&this.partners[id]?.status!=="married")
    return this._deny("結婚後の家族計画か、同意したワンナイトの選択が必要です");
   if(!["fade","mod"].includes(sceneMode))return this._deny("シーン方式が無効です");
   if(regular)this.partners[id].privateTime++;
   else{
    const prev=this.encounters[id]?.privateTime||0;
    this.encounters[id]={privateTime:Math.min(1000,prev+1),lastDay:this.day};
   }
   // The core engine deliberately includes no explicit animation data.
   // Mods receive only a non-graphic, consent-gated notification.
   return this._event(kind,actions[kind],{partner:id,
    relationshipType:regular?this.partners[id].status:"one-night",
    fadeToBlack:sceneMode==="fade",cameraTransition:sceneMode==="mod"?"retain":"fade",
    ...(sceneMode==="mod"?{modEvent:{name:FAMILY_PRIVATE_MOD_EVENT,
     version:FAMILY_PRIVATE_MOD_API_VERSION,partner:id,adults:true,consent:true,
     renderContent:"external-only"}}:{})});
  }
  return this._event(kind,actions[kind],{partner:id,fadeToBlack:false});
 }
 planPregnancy(id,{mutualConsent=false,gestationalParent="player",name="赤ちゃん"}={}){
  if(!this.privateUnlocked)return this._deny("成人モードを解禁してください");
  if(!this._adults("player",id)||!mutualConsent)
   return this._deny("成人同士の家族計画への明示的な合意が必要です");
  if(!["player",id].includes(gestationalParent))return this._deny("妊娠する保護者を選択してください");
  if(!(this.partners[id]?.privateTime>0)&&!(this.encounters[id]?.privateTime>0))
   return this._deny("先に合意したプライベートな時間を選択してください");
  if(this.pregnancies.some(x=>x.gestationalParent===gestationalParent))
   return this._deny("妊娠の進行中です");
  const pregnancy={id:"pregnancy-"+this.nextId++,gestationalParent,
   otherParent:gestationalParent==="player"?id:"player",
   startDay:this.day,dueDay:this.day+FAMILY_GESTATION_DAYS,
   name:typeof name==="string"&&name.trim()?name.trim().slice(0,48):"赤ちゃん"};
  this.pregnancies.push(pregnancy);
  return this._event("pregnancy","妊娠が始まりました。家族で出産に備えます",{pregnancyId:pregnancy.id});
 }
 fetus(pregnancyId){
  const p=this.pregnancies.find(v=>v.id===pregnancyId);
  if(!p)return null;
  const days=clamp(this.day-p.startDay,0,FAMILY_GESTATION_DAYS),week=Math.floor(days/7);
  const trimester=week<13?1:week<28?2:3;
  return {pregnancyId:p.id,week,trimester,dueInDays:Math.max(0,p.dueDay-this.day),
   status:week<13?"初期：器官の形成":week<28?"中期：身体の成長":"後期：出産への準備",
   protected:true,combatEligible:false,canBeInjured:false,canDie:false};
 }
 childStatus(id){
  const child=this.children.find(c=>c.id===id);return child?copy(child):null;
 }
 isProtectedChild(id){
  return Boolean(this.children.some(c=>c.id===id)||this.pregnancies.some(p=>p.id===id));
 }
 canCombatTarget(id){return !this.isProtectedChild(id);}
 guardChild(id,{threat="danger"}={}){
  const child=this.children.find(c=>c.id===id);
  if(!child){
   if(this.pregnancies.some(p=>p.id===id))
    return this._event("prenatal-ward","胎児への危害を高次元の守護契約が遮断しました",{childId:id,blocked:true,damage:0});
   return this._deny("保護対象の子どもが見つかりません");
  }
  // Threat is intercepted before any hit/damage/condition resolution.
  child.location="sanctuary";child.homeSafe=false;
  child.injuries=0;child.dead=false;child.fatalIllness=false;
  return this._event("overlord-rescue",
   "守護契約発動：子どもを高次元の庇護界へ退避させました",{childId:id,threat:String(threat).slice(0,50),blocked:true,damage:0});
 }
 setAdultAvailable(id,available){
  if(!this.adults[id])return this._deny("保護者候補が見つかりません");
  this.adults[id].available=Boolean(available);
  this.reconcile();
  return this._event("guardian-status",available?"保護者が帰還しました":"保護者不在：代替の保護者を確認します",{adult:id});
 }
 appointGuardian(childId,guardianId){
  const child=this.children.find(c=>c.id===childId);
  if(!child||!this.adults[guardianId]?.available)return this._deny("児童と成人の保護者を選択してください");
  child.guardian=guardianId;child.location="foster";child.homeSafe=true;
  return this._event("guardian","子どもを保護者が引き受けました",{childId,guardian:guardianId});
 }
 reconcile(){
  for(const child of this.children){
   const age=Math.max(0,(this.day-child.birthDay)/FAMILY_YEAR_DAYS);
   child.ageYears=Number(age.toFixed(3));child.growthStage=stageOf(age).id;
   child.protected=true;child.injuries=0;child.fatalIllness=false;child.dead=false;
   child.combatEligible=false;
   const primary=child.parents.some(id=>this.adults[id]?.available);
   const foster=child.guardian&&this.adults[child.guardian]?.available;
   if(!primary&&!foster){
    child.homeSafe=false;child.location="sanctuary";child.guardian="overlord";
    // A sanctuary caregiver continues safe upbringing and education.
    child.care.nutrition=Math.max(75,child.care.nutrition);
    child.care.comfort=Math.max(75,child.care.comfort);
   }
  }
 }
 advanceTo(day){
  if(!validDay(day))throw RangeError("Invalid absolute game day");
  if(day<=this.day)return [];
  const old=this.day;this.day=day;
  const events=[];
  const births=this.pregnancies.filter(p=>p.dueDay<=day);
  this.pregnancies=this.pregnancies.filter(p=>p.dueDay>day);
  for(const p of births){
   if(this.children.length>=100){this.pregnancies.push(p);continue;}
   const child=readChild({id:"child-"+this.nextId++,name:p.name,
    birthDay:p.dueDay,parents:[p.gestationalParent,p.otherParent]});
   this.children.push(child);
   events.push(this._event("birth","赤ちゃんが誕生しました。保護契約が発効しました",{childId:child.id}));
  }
  for(const child of this.children){
   const past=stageOf(Math.max(0,(old-child.birthDay)/FAMILY_YEAR_DAYS));
   const now=stageOf(Math.max(0,(day-child.birthDay)/FAMILY_YEAR_DAYS));
   if(past.id!==now.id)events.push(this._event("growth",child.name+"は「"+now.label+"」になりました",{childId:child.id,stage:now.id}));
  }
  this.reconcile();
  return events;
 }
 careFor(childId,kind,{adultId="player"}={}){
  const child=this.children.find(c=>c.id===childId);
  if(!child||!this.adults[adultId]?.available)return this._deny("安全な育児には成人の保護者が必要です");
  if(child.location==="sanctuary")return this._deny("退避中のため、先に安全な帰還を行ってください");
  const effects={hold:{comfort:12,label:"抱っこ"},feed:{nutrition:15,label:"授乳・食事"},
   sleep:{comfort:10,label:"寝かしつけ"},play:{comfort:9,learning:4,label:"遊び"},
   learn:{learning:12,label:"学習・技能訓練"}};
  const e=effects[kind];
  if(!e)return this._deny("選択できない育児アクションです");
  if(kind==="learn"&&child.ageYears<2)return this._deny("学習は発達段階に応じて始めます");
  for(const [k,v] of Object.entries(e))if(k!=="label")child.care[k]=clamp(child.care[k]+v,0,100);
  return this._event("care",e.label+"を行いました",{childId,kind,adultId});
 }
 returnFromSanctuary(childId,{homeSafe=false}={}){
  const child=this.children.find(c=>c.id===childId);
  if(!child||child.location!=="sanctuary")return this._deny("退避中の子どもが見つかりません");
  const parent=child.parents.find(id=>this.adults[id]?.available);
  const foster=child.guardian&&this.adults[child.guardian]?.available;
  if(!homeSafe||!parent&&!foster)return this._deny("帰還には安全な家と成人の保護者が必要です");
  child.location=parent?"home":"foster";child.homeSafe=true;
  if(parent&&child.guardian==="overlord")child.guardian=null;
  return this._event("return","安全を確認し、子どもが庇護界から帰還しました",{childId});
 }
 canInherit(childId){
  const child=this.children.find(c=>c.id===childId);
  return Boolean(child&&child.ageYears>=FAMILY_ADULT_AGE&&
   child.location!=="sanctuary"&&!child.inherited);
 }
 markInherited(childId){
  if(!this.canInherit(childId))return this._deny("世代継承には成人した後継者と安全な生活環境が必要です");
  const child=this.children.find(c=>c.id===childId);
  child.inherited=true;
  return this._event("inheritance","新しい世代に家族と文明を引き継ぎました",{childId});
 }
 snapshot(){
  return copy({version:FAMILY_VERSION,day:this.day,adults:this.adults,partners:this.partners,encounters:this.encounters,
   pregnancies:this.pregnancies,children:this.children,nextId:this.nextId,history:this.history});
 }
}
