import {ExplorerController} from "./controller.mjs";
import {actionDuration,ATTACK_VARIANTS} from "./actions.mjs";
import {taskBowProgress} from "./archery-timing.mjs";
import {terrainSurface} from "./geo.mjs";
import {FrontierBridge,FW_ACTIONS} from "./frontier-bridge.mjs";
import {GroupRegistry,formationOffsets} from "./groups.mjs";
import {TROOP_ROLES,TROOP_PRESETS,MAX_ALLIES,rosterForPreset,tacticalOffsets} from "./tactical-roster.mjs";

/** Local single-player RTS party and deterministic, editable IF -> THEN rules.
 * No external network, persistent background work or scripted code execution. */
export const RULE_METRICS=Object.freeze(["wood","stone","houses","idle","distance","walked","stamina","load_kg","resource_nearby"]);
export const RULE_OPERATORS=Object.freeze(["<","<=",">",">=","==","!="]);
export const RULE_ACTIONS=Object.freeze(["gather_wood","gather_stone","build","move_rally","follow","patrol","wait",...FW_ACTIONS]);
const TYPES=new Set(RULE_ACTIONS),METRICS=new Set(RULE_METRICS),OPS=new Set(RULE_OPERATORS);
const names=[["player","開拓者"],["scout","斥候"],["artisan","職人"]];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const emptyRule=()=>({enabled:false,metric:"wood",op:"<",value:5,action:"gather_wood"});
const defaultRules=()=>Array.from({length:8},(_,i)=>i===0?
 {enabled:true,metric:"wood",op:"<",value:18,action:"gather_wood"}:
 i===1?{enabled:true,metric:"stone",op:"<",value:12,action:"gather_stone"}:emptyRule());
export function sanitizeRule(raw){
 if(!raw||typeof raw!=="object"||!METRICS.has(raw.metric)||!OPS.has(raw.op)||
   !TYPES.has(raw.action)||typeof raw.enabled!=="boolean"||
   !Number.isFinite(raw.value)||Math.abs(raw.value)>1e6)throw Error("Invalid RTS rule");
 return {enabled:raw.enabled,metric:raw.metric,op:raw.op,value:raw.value,action:raw.action};
}
export function testCondition(a,op,b){
 switch(op){
 case "<":return a<b;case "<=":return a<=b;case ">":return a>b;
 case ">=":return a>=b;case "==":return a===b;case "!=":return a!==b;
 default:throw RangeError("Unknown comparison");
 }
}
const finitePoint=p=>p&&[p.x,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<1e7);
export class SquadEngine{
 constructor(terrain,lead,actions,snapshot=null){
  this.terrain=terrain;this.actions=actions;this.selected=new Set(["player"]);
  this.agents=names.map(([id,name],i)=>{
   let control=lead;
   if(i){
    const saved=lead.snapshot();
    saved.x+=i===1?3:-3;saved.z+=i===1?1:3;
    saved.moveTarget=null;
    control=ExplorerController.fromSnapshot(terrain,saved);
   }
   return {id,name,control,auto:false,rules:defaultRules(),rally:{x:control.x,z:control.z},
    task:null,cooldown:0,order:"idle",patrolSide:0,status:"待機",formationOverride:false,
    role:id==="scout"?"archer":"sword",hp:100,maxHp:100,combatCooldown:0};
  });
  this.nextActorNumber=1;
  this.groups=new GroupRegistry(()=>this.agents.map(a=>a.id));
  if(snapshot)this.restore(snapshot);
  this.frontier=new FrontierBridge(this,snapshot?.frontier||null);
 }
 attachLifestyle(life){this.frontier.attachLife(life);}
 rulePass(a,r){const metrics=this.metrics(a);return testCondition(metrics[r.metric],r.op,r.value);}
 get(id){return this.agents.find(a=>a.id===id)||null;}
 selectedAgents(){return this.agents.filter(a=>this.selected.has(a.id));}
 choose(id,{add=false}={}){
  if(!this.get(id))return false;
  this.groups.activate(null);
  if(!add)this.selected.clear();
  if(add&&this.selected.has(id)&&this.selected.size>1)this.selected.delete(id);
  else this.selected.add(id);
  return true;
 }
 selectAll(){this.groups.activate(null);this.selected=new Set(this.agents.map(a=>a.id));}
 selectedGroups(){return this.groups.selected();}
 /** Deploy a preset as actual independent actors (not an abstract unit counter). */
 deployPreset(kind){
  const plan=TROOP_PRESETS[kind],roles=rosterForPreset(kind);
  if(this.agents.length+roles.length>MAX_ALLIES)throw RangeError("アバターは最大"+MAX_ALLIES+"人です");
  const lead=this.get("player").control,offsets=tacticalOffsets(roles,2.4);
  const newIds=[];
  for(let i=0;i<roles.length;i++){
   const role=roles[i],spec=TROOP_ROLES[role],saved=lead.snapshot();
   const p=offsets[i];
   saved.x=lead.x+p.x+Math.cos(lead.yaw)*4;
   saved.z=lead.z+p.z-Math.sin(lead.yaw)*4;
   saved.moveTarget=null;saved.jumpY=0;saved.jumpV=0;
   const control=ExplorerController.fromSnapshot(this.terrain,saved);
   const id="troop-"+this.nextActorNumber++;
   const index=roles.slice(0,i+1).filter(v=>v===role).length;
   this.agents.push({id,name:spec.name+index,role,
    control,auto:false,rules:defaultRules().map(r=>({...r,enabled:false})),
    rally:{x:control.x,z:control.z},task:null,cooldown:0,order:"idle",
    patrolSide:0,status:"編成",formationOverride:false,
    hp:spec.hp,maxHp:spec.hp,combatCooldown:0});
   this.frontier?.ensureAgent(id);
   newIds.push(id);
  }
  const g=this.registerGroup(plan.name+" "+this.groups.nextId,newIds,
   {formation:"battleline",spacing:2.4,sync:true,follow:true});
  return {group:g,ids:newIds,roles};
 }
 selectGroups(ids){
  const groups=this.groups.activateMany(ids);
  if(groups.length)this.selected=new Set(groups.flatMap(g=>g.members));
  return groups;
 }
 setGroupFollow(id,follow){
  const group=this.groups.update(id,{follow:Boolean(follow)});
  for(const memberId of group.members){
   const a=this.get(memberId);
   if(!a)continue;
   a.formationOverride=false;
   if(!follow&&a.order==="formation"){
    a.control.clearMoveTarget();a.order="idle";a.status="追従解除";
   }
  }
  return group;
 }
 /** Named groups may overlap; only the active group controls formation and sync selection. */
 registerGroup(name,members,options={}){
  const actors=members.map(id=>this.get(id));
  if(!actors.length||actors.some(a=>!a))throw RangeError("部隊員が不正です");
  const rally={x:actors.reduce((sum,a)=>sum+a.control.x,0)/actors.length,
   z:actors.reduce((sum,a)=>sum+a.control.z,0)/actors.length};
  const group=this.groups.create({name,members,rally,...options});
  this.selectGroup(group.id);return group;
 }
 updateGroup(id,patch){
  const group=this.groups.update(id,patch);
  if(typeof patch.follow==="boolean")this.setGroupFollow(id,patch.follow);
  if(this.groups.activeIds.includes(id))this.selected=new Set(this.selectedGroups().flatMap(g=>g.members));
  for(const memberId of group.members){const a=this.get(memberId);if(a)a.formationOverride=false;}
  return group;
 }
 removeGroup(id){
  const removed=this.groups.remove(id);
  if(removed&&this.groups.activeIds.length)
   this.selected=new Set(this.selectedGroups().flatMap(g=>g.members));
  return removed;
 }
 selectGroup(id){
  const group=this.groups.activate(id);
  if(group)this.selected=new Set(group.members);
  return group;
 }
 activeGroup(){return this.groups.active();}
 setGroupRally(id,x,z){
  const g=this.groups.update(id,{rally:{x,z}});
  this.setRally(g.members,x,z);return g;
 }
 rallyGroup(id){
  const g=this.groups.get(id);
  if(!g||!g.rally)return 0;
  return this.orderGroupMove(id,g.rally.x,g.rally.z);
 }
 /** Group leader receives a waypoint; followers continue to correct formation during travel. */
 orderGroupMove(id,x,z,members=null){
  const g=this.groups.get(id);
  if(!g||!finitePoint({x,z}))return 0;
  const targets=(members||g.members).map(key=>this.get(key)).filter(a=>a&&a.hp>0);
  if(!targets.length)return 0;
  if(!g.follow){
   const moved=this.orderMove(targets.map(a=>a.id),x,z,{formation:g.formation,spacing:g.spacing});
   for(const a of targets)a.formationOverride=false;
   return moved;
  }
  const lead=targets[0];
  const loc=lead.control.locationAt(x,z),surface=terrainSurface(this.terrain,loc.lat,loc.lon);
  if(surface.water||surface.river||!lead.control.nearGround)return 0;
  const moving=lead.control.setMoveTarget(x,z);
  if(moving){
   this.frontier?.cancel(lead);lead.control.setMoveTarget(x,z);
   lead.task=null;lead.order="manual";lead.status="部隊移動";lead.cooldown=1.5;
  }else if(Math.hypot(lead.control.x-x,lead.control.z-z)>0.5)return 0;
  for(const a of targets)a.formationOverride=false;
  const applied=this.updateFormationFollowers(0,new Set(targets.map(a=>a.id)),[id]);
  return (moving?1:0)+applied;
 }
 /** Issue an RTS order to multiple groups; duplicate members execute only once.
  * Earlier selected group has priority when registrations overlap. */
 orderGroups(ids,command,point=null){
  const keys=[...new Set(ids)],claimed=new Set();
  let moved=0;
  for(const id of keys){
   const g=this.groups.get(id);if(!g)continue;
   const members=g.members.filter(member=>!claimed.has(member));
   if(!members.length)continue;
   for(const member of members)claimed.add(member);
   if(command==="stop"){
    this.halt(members);moved+=members.length;continue;
   }
   const leaderAlreadyAssigned=members[0]!==g.members[0];
   // A member may belong to multiple groups; the earlier group owns its leader.
   // Non-overlapping members in a later group still receive their own order.
   const move=(x,z)=>{
    if(!finitePoint({x,z}))return 0;
    return leaderAlreadyAssigned?
     this.orderMove(members,x,z,{formation:g.formation,spacing:g.spacing}):
     this.orderGroupMove(id,x,z,members);
   };
   if(command==="rally"&&g.rally)moved+=move(g.rally.x,g.rally.z);
   else if(command==="form"){
    const actors=members.map(member=>this.get(member));
    const x=actors.reduce((sum,a)=>sum+a.control.x,0)/actors.length;
    const z=actors.reduce((sum,a)=>sum+a.control.z,0)/actors.length;
    moved+=move(x,z);
   }else if(command==="move"&&finitePoint(point)){
    const index=keys.indexOf(id),shift=(index-(keys.length-1)/2)*12;
    const lead=this.get(members[0]).control;
    const dx=point.x-lead.x,dz=point.z-lead.z;
    const yaw=Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):lead.yaw;
    moved+=move(point.x+Math.cos(yaw)*shift,point.z-Math.sin(yaw)*shift);
   }
  }
  return moved;
 }
 /** Follow the first registered member's facing/route; never override an explicit
  * individual move, work task, manual input, or an actor in an earlier group. */
 updateFormationFollowers(dt=0,allowed=null,onlyIds=null,{manualLead=false}={}){
  const prioritized=[...this.groups.activeIds,...this.groups.all().map(g=>g.id)];
  const order=[...new Set(onlyIds||prioritized)],claimed=new Set();
  let issued=0;
  for(const id of order){
   const g=this.groups.get(id);
   if(!g?.follow||g.members.length<2)continue;
   const living=g.members.filter(key=>(this.get(key)?.hp??0)>0);
   if(living.length<2)continue;
   const lead=this.get(living[0]);
   if(!lead||lead.formationOverride||claimed.has(lead.id)||!lead.control.nearGround)continue;
   claimed.add(lead.id);
   const offsets=g.formation==="battleline"?
    tacticalOffsets(living.map(id=>this.get(id)?.role||"sword"),g.spacing):
    formationOffsets(living.length,g.formation,g.spacing);
   const base=offsets[0],control=lead.control;
   const target=control.moveTarget;
   const dx=(target?.x??control.x)-control.x,dz=(target?.z??control.z)-control.z;
   const yaw=Math.hypot(dx,dz)>.4?Math.atan2(dx,dz):control.yaw;
   const sn=Math.sin(yaw),cs=Math.cos(yaw);
   for(let i=1;i<living.length;i++){
    const a=this.get(living[i]);
    if(!a||claimed.has(a.id))continue;
    claimed.add(a.id);
    if(allowed&&!allowed.has(a.id))continue;
    if(a.formationOverride||a.manualHarvest||a.task||!a.control.nearGround||
      (a.id==="player"&&manualLead)||a.auto&&a.control.moveTarget&&a.order==="auto")continue;
    const offset=offsets[i],right=offset.x-base.x,forward=offset.z-base.z;
    const x=control.x+right*cs+forward*sn;
    const z=control.z-right*sn+forward*cs;
    const range=Math.hypot(x-a.control.x,z-a.control.z);
    if(range<1.0){
     if(a.order==="formation"){a.control.clearMoveTarget();a.order="idle";}
     continue;
    }
    const prev=a.control.moveTarget;
    if(prev&&Math.hypot(prev.x-x,prev.z-z)<.65)continue;
    const where=a.control.locationAt(x,z),sample=terrainSurface(this.terrain,where.lat,where.lon);
    if(sample.water||sample.river||sample.elevationM>2800)continue;
    if(!a.control.setMoveTarget(x,z))continue;
    // Do not call frontier.cancel here: it erases waypoints on each correction.
    a.order="formation";a.status="隊形追従";a.cooldown=Math.max(a.cooldown,.2);
    issued++;
   }
  }
  return issued;
 }
 setAuto(ids,enabled){
  for(const id of ids){const a=this.get(id);if(a){a.auto=Boolean(enabled);if(!enabled){this.frontier?.cancel(a);a.task=null;}}}
 }
 setRule(id,index,raw){
  const a=this.get(id);if(!a||!Number.isInteger(index)||index<0||index>=8)throw RangeError("Unknown slot");
  a.rules[index]=sanitizeRule(raw);this.frontier?.cancel(a);
 }
 setRally(ids,x,z){
  if(!finitePoint({x,z}))throw RangeError("Invalid rally");
  for(const id of ids){const a=this.get(id);if(a)a.rally={x,z};}
 }
 orderMove(ids,x,z,{formation=null,spacing=null}={}){
  if(!finitePoint({x,z}))return 0;
  const active=this.activeGroup();
  if(!formation&&active&&ids.length===active.members.length&&
     ids.every(id=>active.members.includes(id))){
   if(active.follow)return this.orderGroupMove(active.id,x,z);
   ids=active.members;formation=active.formation;spacing=active.spacing;
  }
  const targets=ids.map(id=>this.get(id)).filter(a=>a&&a.hp>0);
  const offsets=formation==="battleline"?
   tacticalOffsets(targets.map(a=>a.role||"sword"),spacing??2.4):
   formation?formationOffsets(targets.length,formation,spacing??2.4):null;
  const leader=targets[0]?.control;
  const dx=x-(leader?.x??x),dz=z-(leader?.z??z);
  const direction=Math.hypot(dx,dz)>0.01?Math.atan2(dx,dz):(leader?.yaw??0);
  const sn=Math.sin(direction),cs=Math.cos(direction);
  let moved=0;
  targets.forEach((a,i)=>{
   const col=i%3-1,row=Math.floor(i/3),offset=offsets?.[i];
   const tx=offset?x+offset.x*cs+offset.z*sn:x+(targets.length>1?col*2.4:0);
   const tz=offset?z-offset.x*sn+offset.z*cs:z+(targets.length>1?row*2.4:0);
   const p=a.control.locationAt(tx,tz),surface=terrainSurface(this.terrain,p.lat,p.lon);
   if(!surface.water&&!surface.river&&a.control.setMoveTarget(tx,tz)){
    // Reapply after Frontier cancel: cancellation may clear the move target.
    this.frontier?.cancel(a);
    a.control.setMoveTarget(tx,tz);
    a.task=null;a.order="manual";a.cooldown=1.5;a.status="移動指示";
    a.formationOverride=true;moved++;
   }
  });
  return moved;
 }
 halt(ids){
  for(const id of ids){const a=this.get(id);if(a){this.frontier?.cancel(a);a.control.clearMoveTarget();a.task=null;a.auto=false;a.cooldown=1.5;a.order="hold";a.status="待機指示";a.formationOverride=true;}}
 }
 metrics(a){
  const leader=this.get("player").control;
  return {wood:this.actions.resources.wood,stone:this.actions.resources.stone,
   houses:this.actions.structures.filter(s=>s.progress>=1).length,
   idle:(!a.task&&!a.control.moveTarget&&!a.control.moving)?1:0,
   distance:Math.hypot(a.control.x-leader.x,a.control.z-leader.z),
   walked:a.control.totalDistanceM,...(this.frontier?.metrics(a)||{})};
 }
 performEquippedAction(id,kind,hand="right",variant="overhead",targetId=null){
  const a=this.get(id);
  if(!a||a.id==="player"||!["sword","spear","greatsword","axe","mine","bow"].includes(kind)||!a.control.nearGround||a.task?.kind?.startsWith("equipped_"))return false;
  this.frontier?.cancel(a);
  a.control.clearMoveTarget();
  const move=ATTACK_VARIANTS.includes(variant)&&!(kind==="axe"&&variant==="thrust")?variant:"overhead";
  const duration=actionDuration(kind,move);
  a.task={kind:"equipped_"+kind,remaining:duration,duration,hand:hand==="left"?"left":"right",variant:move,
   targetId:Number.isInteger(targetId)?targetId:null,impacted:false};
  a.cooldown=0;a.order="manual";a.status=kind==="bow"?"🏹 弓を引いています":"⚒️ "+kind+"を使用中";
  return true;
 }
 schedule(a,action,slot=0){
  if(this.frontier?.isAction(action)){this.frontier.start(a,action,slot);return;}
  if(action==="gather_wood"||action==="gather_stone"){
   a.task={kind:action,remaining:action==="gather_wood"?1.45:1.65,duration:action==="gather_wood"?1.45:1.65};
   a.order="auto";a.status=action==="gather_wood"?"木材を採集中":"石材を採集中";
  }else if(action==="build"){
   if(this.actions.active){a.cooldown=1;return;}
   if(this.actions.start("build",a.control,(lat,lon)=>terrainSurface(this.terrain,lat,lon))){
    a.order="auto";a.status="小屋を建築中";a.cooldown=5;
   }else{a.status=this.actions.message;a.cooldown=3;}
  }else if(action==="move_rally"||action==="patrol"){
   const r=a.rally;
   const shift=action==="patrol"?(a.patrolSide?6:-6):0;
   if(a.control.setMoveTarget(r.x+shift,r.z)){a.order=action;a.status=action==="patrol"?"巡回中":"集合地点へ移動";a.patrolSide^=1;}
   a.cooldown=1;
  }else if(action==="follow"){
   const lead=this.get("player").control;
   const dx=lead.x-a.control.x,dz=lead.z-a.control.z;
   if(a.id!=="player"&&Math.hypot(dx,dz)>4){
    a.control.setMoveTarget(lead.x+(a.id==="scout"?2:-2),lead.z-2);
    a.order="follow";a.status="隊長を追従";
   }
   a.cooldown=.7;
  }else{
   a.control.clearMoveTarget();a.order="hold";a.status="待機中";a.cooldown=2;
  }
 }
 /** Call once per animation frame before the lead controller updates.
  * Automatic commands never override direct input; manual orders have cooldown. */
 advance(dt,{manualLead=false}={}){
  if(!Number.isFinite(dt)||dt<0)throw TypeError("Invalid squad delta");
  dt=clamp(dt,0,.1);
  if(dt>0)this.updateFormationFollowers(dt,null,null,{manualLead});
  for(const a of this.agents){
   if(a.hp<=0){a.control.clearMoveTarget();a.task=null;a.auto=false;a.status="戦闘不能";continue;}
   if(a.id!=="player"){
    a.control.altitudeM=this.get("player").control.altitudeM;
    a.control.targetAltitudeM=a.control.altitudeM;
   }
   a.cooldown=Math.max(0,a.cooldown-dt);
   a.combatCooldown=Math.max(0,(a.combatCooldown||0)-dt);
   const frontierBusy=this.frontier?.tick(a,dt,a.id==="player"&&manualLead)||false;
   if(a.task&&["gather_wood","gather_stone"].includes(a.task.kind)){
    a.task.remaining=Math.max(0,a.task.remaining-dt);
    if(!a.task.remaining){
     const key=a.task.kind==="gather_wood"?"wood":"stone";
     this.actions.resources[key]+=2;
     a.task=null;a.status=key==="wood"?"木材 +2":"石材 +2";
     a.cooldown=.35;
    }
   }
   if(a.task?.kind?.startsWith("equipped_")){
    a.task.remaining=Math.max(0,a.task.remaining-dt);
    const weapon=a.task.kind.slice("equipped_".length);
    const progress=weapon==="bow"?taskBowProgress(a.task):1-a.task.remaining/a.task.duration;
    if(weapon==="bow"&&!a.task.impacted&&progress>=.81){
     a.task.impacted=true;this.onEquippedImpact?.(a,a.task);
    }
    if(["sword","spear","greatsword","axe"].includes(weapon)){
     const combo=a.task.variant==="combo";
     const styles=combo?(weapon==="spear"?["sweep","thrust"]:
      weapon==="greatsword"||weapon==="axe"?["overhead","sweep"]:
      ["overhead","sweep","thrust"]):[a.task.variant];
     const times=combo?(styles.length===3?[.22,.55,.88]:[.34,.81]):[.62];
     a.task.hitStages??=[];
     for(let i=0;i<times.length;i++){
      if(progress<times[i]||a.task.hitStages.includes(i))continue;
      a.task.hitStages.push(i);
      this.onEquippedImpact?.(a,{...a.task,style:styles[i],impactIndex:i});
     }
    }
    if(a.task.remaining===0){
     const kind=a.task.kind.slice("equipped_".length);
     if(kind==="axe")this.actions.resources.wood+=2;
     if(kind==="mine")this.actions.resources.stone+=2;
     a.status=kind==="sword"?"⚔️ 剣を振った":kind==="spear"?"🔱 長槍の攻撃":kind==="greatsword"?"⚔️ 両手剣の攻撃":kind==="axe"?"🪵 木材 +2":kind==="bow"?"🏹 矢を放ちました":"🪨 石材 +2";
     a.task=null;a.cooldown=.5;
    }
   }
   if(a.id==="player"&&manualLead){this.frontier?.cancel(a);a.task=null;a.cooldown=1;}
   if(a.auto&&!a.manualHarvest&&a.control.nearGround&&!frontierBusy&&!a.task&&!a.control.moveTarget&&!a.cooldown&&!(a.id==="player"&&manualLead)){
    const metrics=this.metrics(a);
    const index=a.rules.findIndex(r=>r.enabled&&testCondition(metrics[r.metric],r.op,r.value));
    if(index>=0)this.schedule(a,a.rules[index].action,index);
   }
   if(a.id!=="player")a.control.update(dt);
  }
 }
 getMotion(a){
  const key=a.task?.kind;
  return key?.startsWith("equipped_")?{action:key.slice("equipped_".length),
   progress:key==="equipped_bow"?taskBowProgress(a.task):1-a.task.remaining/a.task.duration,
   hand:a.task.hand||"right",variant:a.task.variant||"overhead"}:
   this.frontier?.isAction(key)?{action:key==="gather_nearby"?"axe":"idle",progress:.5}:
   key?{action:key==="gather_wood"?"axe":"mine",progress:1-a.task.remaining/a.task.duration}:
   {action:"idle",progress:0};
 }
 repositionAfterLanding(){
  const lead=this.get("player").control;
  this.agents.slice(1).forEach((a,i)=>{
   a.control.setLanding(lead.lat,lead.lon,{allowWater:true});
   a.control.x+=(i? -3:3);a.control.z+=(i?3:1);
   const next=a.control.locationAt(a.control.x,a.control.z);
   a.control.lat=next.lat;a.control.lon=next.lon;
   a.control.altitudeM=lead.altitudeM;a.control.targetAltitudeM=lead.targetAltitudeM;
   a.task=null;a.order="idle";a.rally={x:a.control.x,z:a.control.z};a.formationOverride=false;
  });
  // Rebase all additional troops on the newly selected landing location.
  const extras=this.agents.slice(3);
  const offsets=tacticalOffsets(extras.map(a=>a.role||"sword"),2.4);
  extras.forEach((a,i)=>{
   a.control.setLanding(lead.lat,lead.lon,{allowWater:true});
   a.control.x+=offsets[i]?.x||0;a.control.z+=offsets[i]?.z||0;
   const site=a.control.locationAt(a.control.x,a.control.z);
   a.control.lat=site.lat;a.control.lon=site.lon;
   a.control.altitudeM=lead.altitudeM;a.control.targetAltitudeM=lead.targetAltitudeM;
   a.control.clearMoveTarget();a.task=null;a.formationOverride=false;a.order="idle";
  });
  this.frontier?.rebase();
 }
 snapshot(){
  return {version:1,frontier:this.frontier?.snapshot(),selected:[...this.selected],groups:this.groups.snapshot(),
   agents:this.agents.map(a=>({id:a.id,auto:a.auto,rules:a.rules.map(r=>({...r})),
    control:a.id==="player"?null:a.control.snapshot(),rally:{...a.rally},status:a.status,
    name:a.name,role:a.role,hp:a.hp,maxHp:a.maxHp,combatCooldown:a.combatCooldown}))};
 }
 restore(data){
  if(!data||data.version!==1||!Array.isArray(data.agents)||data.agents.length<3||
    data.agents.length>MAX_ALLIES)throw Error("Invalid squad save");
  const extra=data.agents.slice(3);
  this.agents=this.agents.slice(0,3);
  for(const record of extra){
   if(!/^troop-[1-9][0-9]*$/.test(record?.id||"")||this.get(record.id)||
      !TROOP_ROLES[record.role]||typeof record.name!=="string"||record.name.length>32)continue;
   try{
    const control=ExplorerController.fromSnapshot(this.terrain,record.control);
    this.agents.push({id:record.id,name:record.name,role:record.role,control,
     auto:false,rules:defaultRules(),rally:{x:control.x,z:control.z},
     task:null,cooldown:0,order:"idle",patrolSide:0,status:"復元",
     formationOverride:false,hp:TROOP_ROLES[record.role].hp,
     maxHp:TROOP_ROLES[record.role].hp,combatCooldown:0});
    this.nextActorNumber=Math.max(this.nextActorNumber,Number(record.id.slice(6))+1);
   }catch(_){/* Invalid extra roster record ignored. */}
  }
  for(const a of this.agents){
   const s=data.agents.find(x=>x.id===a.id);
   if(!s||!Array.isArray(s.rules)||s.rules.length!==8||typeof s.auto!=="boolean"||!finitePoint(s.rally))throw Error("Invalid saved actor");
   a.rules=s.rules.map(sanitizeRule);a.auto=s.auto;a.rally={x:s.rally.x,z:s.rally.z};
   if(a.id!=="player")a.control=ExplorerController.fromSnapshot(this.terrain,s.control);
   a.status="復元済み";a.task=null;a.cooldown=0;a.formationOverride=false;
   if(TROOP_ROLES[s.role])a.role=s.role;
   if(Number.isFinite(s.maxHp)&&s.maxHp>0&&s.maxHp<=500)a.maxHp=s.maxHp;
   if(Number.isFinite(s.hp))a.hp=Math.max(0,Math.min(a.maxHp,s.hp));
   a.combatCooldown=0;
  }
  this.selected=new Set(Array.isArray(data.selected)?data.selected.filter(id=>this.get(id)):["player"]);
  if(!this.selected.size)this.selected.add("player");
  this.groups.restore(data.groups);
  const selectedGroupMembers=new Set(this.selectedGroups().flatMap(g=>g.members));
  if(this.groups.activeIds.length&&
     !(selectedGroupMembers.size===this.selected.size&&[...selectedGroupMembers].every(id=>this.selected.has(id))))
   this.groups.activate(null);
 }
}
