/** Territorial law, finite garrisons and persistent dynasty state (v0.9d).
 * Pure simulation: rendering and player-specific HP live in the host app.
 * Inspired by tiered pursuit and RPG surrender/bounty systems; no game assets copied.
 */
export const LAW_SCHEMA=1;
export const CRIME_POINTS=Object.freeze({trespass:12,theft:18,assault:32,escape:15,attackGuard:38,killGuard:75,murder:100});
export const WANTED_THRESHOLDS=Object.freeze([0,10,35,80,150,260]);
export const wantedLevel=points=>{const p=Math.max(0,Number(points)||0);for(let i=5;i>=1;i--)if(p>=WANTED_THRESHOLDS[i])return i;return 0;};
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=v=>JSON.parse(JSON.stringify(v));
export const GUARD_POSTS=Object.freeze({
 pioneer:{name:"開拓者の見張り詰所",max:6,daily:1,x:22,z:-10},
 capital:{name:"王都城門守備隊",max:24,daily:3,x:16,z:18},
 tower:{name:"塔の街詰所",max:12,daily:2,x:20,z:12},
 port:{name:"港湾警備詰所",max:12,daily:2,x:24,z:5},
 mountain:{name:"山村衛兵詰所",max:8,daily:1,x:20,z:10},
 meadow:{name:"草原駐屯所",max:8,daily:1,x:16,z:10},
 forest:{name:"森林詰所",max:8,daily:1,x:18,z:6}
});
const normalizePerson=p=>({
 id:String(p?.id||"founder").slice(0,80),name:String(p?.name||"開拓者").slice(0,60),
 alive:p?.alive!==false,generation:Math.max(1,Math.trunc(finite(p?.generation,1))),
 parentId:p?.parentId?String(p.parentId):null,role:String(p?.role||"founder"),
 estate:Math.max(0,finite(p?.estate))
});
export class LawSystem{
 constructor(saved=null){
  this.day=finite(saved?.day);
  this.activePersonId=String(saved?.activePersonId||"founder");
  this.people=Array.isArray(saved?.people)&&saved.people.length?
   saved.people.slice(0,200).map(normalizePerson):[normalizePerson({id:"founder",name:"開拓者"})];
  if(!this.people.some(p=>p.id===this.activePersonId&&p.alive))
   this.activePersonId=saved?.pendingDeath||saved?.gameOver?null:(this.people.find(p=>p.alive)?.id||null);
  this.history=Array.isArray(saved?.history)?saved.history.slice(-300):[];
  this.heirs=Array.isArray(saved?.heirs)?saved.heirs.filter(x=>typeof x==="string").slice(0,50):[];
  this.gameOver=Boolean(saved?.gameOver)&&!this.activePersonId;
  this.custody=saved?.custody&&typeof saved.custody==="object"?copy(saved.custody):null;
  this.pendingDeath=Boolean(saved?.pendingDeath);
  this.factions={};
  for(const [id,post] of Object.entries(GUARD_POSTS)){
   const s=saved?.factions?.[id]||{};
   this.factions[id]={
    heat:clamp(finite(s.heat),0,10000),alert:clamp(finite(s.alert),0,100),
    pursuit:Boolean(s.pursuit),lastSeenDay:finite(s.lastSeenDay,-1),
    hostile:Boolean(s.hostile),challengeShown:Boolean(s.challengeShown),attackTimer:finite(s.attackTimer),lostSeconds:finite(s.lostSeconds),
    owner:String(s.owner||"crown").slice(0,60),
    current:clamp(Math.trunc(finite(s.current,post.max)),0,post.max),
    reserves:clamp(Math.trunc(finite(s.reserves,0)),0,post.max),
    restoredToday:clamp(Math.trunc(finite(s.restoredToday,0)),0,post.daily),
    replenishedDay:Math.floor(finite(s.replenishedDay,0)),
    deployed:Array.isArray(s.deployed)?s.deployed.slice(0,post.max).filter(g=>g&&typeof g.id==="string").map(g=>({
     id:g.id,x:finite(g.x,post.x),z:finite(g.z,post.z),kind:g.kind==="knight"?"knight":"guard",
     stamina:clamp(finite(g.stamina,100),0,100),hp:clamp(finite(g.hp,100),0,100)
    })):[],
    occupying:Array.isArray(s.occupying)?s.occupying.filter(x=>typeof x==="string").slice(0,50):[]
   };
  }
  this.wantedPeople=Array.isArray(saved?.wantedPeople)?saved.wantedPeople.slice(0,100).filter(x=>x&&typeof x.id==="string").map(x=>({
   id:x.id,name:String(x.name||x.id),faction:String(x.faction||"capital"),
   reward:Math.max(0,finite(x.reward)),alive:x.alive!==false,delivered:Boolean(x.delivered)
  })):[];
  this.coins=Math.max(0,finite(saved?.coins));
  this.seq=Math.max(0,Math.trunc(finite(saved?.seq)));
  this.notice=null;
 }
 snapshot(){return {schemaVersion:LAW_SCHEMA,day:this.day,activePersonId:this.activePersonId,
  people:copy(this.people),heirs:[...this.heirs],history:copy(this.history),
  gameOver:this.gameOver,pendingDeath:this.pendingDeath,custody:copy(this.custody),
  factions:copy(this.factions),wantedPeople:copy(this.wantedPeople),coins:this.coins,seq:this.seq};}
 district(id){return this.factions[id]||null;}
 level(id){return wantedLevel(this.district(id)?.heat||0);}
 reportCrime(id,kind,{witnessed=true,reporter=null}={}){
  const s=this.district(id),points=CRIME_POINTS[kind];
  if(!s||!points)return {ok:false,message:"犯罪種別または管轄が不明です"};
  if(!witnessed)return {ok:true,reported:false,message:"目撃者がおらず、まだ手配されていません"};
  s.heat=clamp(s.heat+points,0,10000);
  s.alert=clamp(s.alert+points*.6,0,100);
  s.pursuit=true;s.lastSeenDay=this.day;
  this.history.push({day:this.day,type:"crime",id,kind,reporter});
  this.notice="🚨 "+GUARD_POSTS[id].name+"：手配レベル "+this.level(id);
  return {ok:true,reported:true,level:this.level(id),points,message:this.notice};
 }
 addWitnessReport(id,kind){return this.reportCrime(id,kind,{witnessed:true});}
 /** No random spawning. Guards leave a post's finite personnel pool; replacements are daily-capped. */
 dispatch(id,x=0,z=0){
  const s=this.district(id),post=GUARD_POSTS[id];
  if(!s||s.owner!=="crown"||!this.level(id)||s.current<=0)return [];
  const desired=[0,1,2,3,5,8][this.level(id)];
  const sent=[];
  while(s.deployed.length<desired&&s.current>0){
   const kind=this.level(id)>=4&&s.deployed.length%3===0?"knight":"guard";
   const guard={id:id+":guard:"+ ++this.seq,x:post.x,z:post.z,kind,hp:kind==="knight"?160:100,stamina:100};
   s.deployed.push(guard);s.current--;sent.push(guard);
  }
  return sent;
 }
 /** Emits events; time is supplied by the world's existing simulation clock. */
 advance(dt,{day=this.day,settlementId="wilderness",x=0,z=0,stamina=100,hp=100,eligible=true}={}){
  const events=[];if(this.gameOver||this.pendingDeath||this.custody)return events;
  const nextDay=Math.max(this.day,finite(day,this.day));
  for(const [id,s] of Object.entries(this.factions)){
   const post=GUARD_POSTS[id],prev=Math.floor(s.replenishedDay),now=Math.floor(nextDay);
   if(s.owner==="crown"&&now>prev){
    // Process at most one replenishment per game day. Dead guards take days to replace.
    const elapsed=Math.min(365,now-prev);
    for(let i=0;i<elapsed;i++){
     const needed=Math.max(0,post.max-s.current-s.deployed.length);
     s.current+=Math.min(post.daily,needed);
    }
    s.replenishedDay=now;s.restoredToday=Math.min(post.daily,Math.max(0,s.current));
   }else if(now>prev){s.replenishedDay=now;}
   if(id!==settlementId){s.pursuit=false;s.challengeShown=false;s.lostSeconds=0;s.alert=Math.max(0,s.alert-Math.max(0,dt)*4);continue;}
   if(!eligible)continue;
   if(this.level(id)===0){s.pursuit=false;s.hostile=false;continue;}
   const additions=this.dispatch(id,x,z);
   if(additions.length)events.push({type:"dispatch",id,count:additions.length,message:"🏰 "+post.name+"から"+additions.length+"名を派遣"});
   let contact=false,spotted=false;
   for(const guard of s.deployed){
    const dx=x-guard.x,dz=z-guard.z,dist=Math.hypot(dx,dz);
    // Each guard only knows the player's position inside their own sight radius.
    // Outside that radius they return toward the garrison rather than GPS-tracking.
    const sees=dist<=55;
    if(sees)spotted=true;
    const tx=sees?x:post.x,tz=sees?z:post.z;
    const vx=tx-guard.x,vz=tz-guard.z,remaining=Math.hypot(vx,vz);
    if(remaining>1.65&&dt>0){
      const speed=(sees?(guard.kind==="knight"?4.6:3.2):1.8)*Math.min(dt,.12);
      const step=Math.min(remaining-(sees?1.65:0),speed);
      if(step>0){guard.x+=vx/remaining*step;guard.z+=vz/remaining*step;}
    }
    if(dist<=4.3)contact=true;
   }
   if(spotted){s.lostSeconds=0;s.pursuit=true;s.lastSeenDay=nextDay;}
   else {s.lostSeconds+=Math.max(0,dt);if(s.lostSeconds>20){s.pursuit=false;s.challengeShown=false;s.hostile=false;}}
   s.alert=Math.max(0,s.alert-(contact?0:Math.max(0,dt)*.3));
   if(contact&&this.level(id)<=2&&!s.challengeShown){
    s.challengeShown=true;events.push({type:"challenge",id,message:"衛兵「止まれ！ 武器を置いて投降せよ」"});
   }
   // Host handles periodic nonlethal/lethal damage after refusal.
   if(contact&&s.hostile&&dt>0){
    s.attackTimer=(finite(s.attackTimer)+dt);
    if(s.attackTimer>=1.5){
     s.attackTimer=0;events.push({type:"guardHit",id,staminaDamage:12,hpDamage:this.level(id)>=4?14:4,
      message:"衛兵から攻撃を受けた"});
     if(stamina<=0)events.push(this.detain(id));
    }
   }
   if(contact&&stamina<=0)events.push(this.detain(id));
  }
  this.day=nextDay;
  return events.filter(Boolean);
 }
 respond(id,choice){
  const s=this.district(id);if(!s||!this.level(id))return {ok:false,message:"手配されていません"};
  if(choice==="surrender")return this.detain(id);
  if(choice==="refuse"){s.hostile=true;s.challengeShown=true;return this.reportCrime(id,"escape");}
  if(choice==="flee"){s.pursuit=true;s.challengeShown=true;return {ok:true,message:"逃走を開始。衛兵の視界から離れれば追跡が中断します"};}
  return {ok:false,message:"不明な選択肢"};
 }
 detain(id){const s=this.district(id);if(!s||this.custody)return null;
  s.hostile=false;s.pursuit=false;s.current=clamp(s.current+s.deployed.length,0,GUARD_POSTS[id].max);s.deployed=[];s.challengeShown=false;
  this.custody={faction:id,fine:Math.max(20,Math.ceil(s.heat*2)),since:this.day};
  this.history.push({day:this.day,type:"detained",id});
  return {type:"detained",id,message:"🔒 "+GUARD_POSTS[id].name+"に勾留された"};
 }
 payFine(id,pay){if(!this.custody||this.custody.faction!==id)return {ok:false,message:"この管轄では勾留されていません"};
  const fine=this.custody.fine;
  if(typeof pay!=="function"||!pay(fine))return {ok:false,message:"罰金を支払えません（"+fine+"G）"};
  this.factions[id].heat=0;this.factions[id].alert=0;this.custody=null;this.factions[id].hostile=false;
  return {ok:true,message:"罰金 "+fine+"G を支払い釈放された"};}
 attackGuard(id,guardId,{defeat=false,attackerX=null,attackerZ=null}={}){
  const s=this.district(id),index=s?.deployed.findIndex(g=>g.id===guardId)??-1;
  if(index<0)return {ok:false,message:"対象の衛兵が見つかりません"};
  if(Number.isFinite(attackerX)&&Number.isFinite(attackerZ)&&
   Math.hypot(s.deployed[index].x-attackerX,s.deployed[index].z-attackerZ)>5)
   return {ok:false,message:"衛兵に近づく必要があります"};
  const result=this.reportCrime(id,defeat?"killGuard":"attackGuard");
  s.hostile=true;s.challengeShown=true;
  if(defeat){const [victim]=s.deployed.splice(index,1);this.history.push({day:this.day,type:"guardDefeated",id,guardId:victim.id});}
  return result;
 }
 occupyPost(id,allies=[],{x=null,z=null}={}){
  const s=this.district(id);if(!s)return {ok:false,message:"拠点がありません"};
  if(s.deployed.length||s.current>0)return {ok:false,message:"衛兵が残っています。守備隊の制圧が必要です"};
  if(Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-GUARD_POSTS[id].x,z-GUARD_POSTS[id].z)>8)
   return {ok:false,message:"詰所の中に入って占拠してください"};
  const members=[...new Set(allies.filter(x=>typeof x==="string"&&x.length))];
  if(!members.length)return {ok:false,message:"守備担当の仲間を配置してください"};
  s.owner="player";s.occupying=members;s.pursuit=false;s.heat=0;s.alert=0;
  this.history.push({day:this.day,type:"occupied",id,allies:members});
  return {ok:true,message:"🏴 "+GUARD_POSTS[id].name+"を占領。仲間"+members.length+"名が守備中"};
 }
 registerWantedNPC(data){if(!data?.id||!GUARD_POSTS[data.faction]||this.wantedPeople.some(x=>x.id===data.id))return false;
  this.wantedPeople.push({id:String(data.id),name:String(data.name||data.id),
   faction:data.faction,reward:Math.max(0,finite(data.reward)),alive:true,delivered:false});return true;}
 collectBounty(id,{captured=true}={}){const npc=this.wantedPeople.find(x=>x.id===id);
  if(!npc||npc.delivered||!npc.alive)return {ok:false,message:"引渡し可能な手配犯はいません"};
  npc.delivered=true;const reward=captured?npc.reward:Math.floor(npc.reward/2);
  this.coins+=reward;this.history.push({day:this.day,type:"bounty",id,reward});
  return {ok:true,reward,message:"賞金 "+reward+"G を獲得"};}
 designateHeir({id,name,role="companion",estate=0}){
  if(!id||this.people.some(p=>p.id===id))return {ok:false,message:"後継者IDが既に存在します"};
  const parent=this.people.find(p=>p.id===this.activePersonId);
  this.people.push(normalizePerson({id,name,role,estate,parentId:parent?.id||null,
   generation:(parent?.generation||1)+1}));this.heirs.push(id);
  return {ok:true,message:"後継候補："+name};
 }
 die({cause="戦死"}={}){
  if(this.pendingDeath||this.gameOver)return [];
  const deceased=this.people.find(p=>p.id===this.activePersonId);
  if(deceased)deceased.alive=false;
  this.history.push({day:this.day,type:"death",personId:this.activePersonId,cause});
  this.activePersonId=null;
  const available=this.people.filter(p=>p.alive&&this.heirs.includes(p.id));
  this.pendingDeath=available.length>0;
  this.gameOver=available.length===0;
  return available.map(copy);
 }
 succeed(id){
  if(!this.pendingDeath)return {ok:false,message:"継承待ちではありません"};
  const heir=this.people.find(p=>p.id===id&&p.alive&&this.heirs.includes(p.id));
  if(!heir)return {ok:false,message:"継承資格がありません"};
  this.activePersonId=id;this.pendingDeath=false;this.custody=null;
  this.history.push({day:this.day,type:"succession",personId:id});
  return {ok:true,person:copy(heir),message:"👑 "+heir.name+"（第"+heir.generation+"代）へ継承"};
 }
}
