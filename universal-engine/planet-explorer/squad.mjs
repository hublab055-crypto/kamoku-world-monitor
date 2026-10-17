import {ExplorerController} from "./controller.mjs";
import {actionDuration,ATTACK_VARIANTS} from "./actions.mjs";
import {terrainSurface} from "./geo.mjs";
import {FrontierBridge,FW_ACTIONS} from "./frontier-bridge.mjs";
import {GroupRegistry,formationOffsets} from "./groups.mjs";

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
    task:null,cooldown:0,order:"idle",patrolSide:0,status:"待機"};
  });
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
  if(this.groups.activeId===id)this.selected=new Set(group.members);
  return group;
 }
 removeGroup(id){return this.groups.remove(id);}
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
  return this.orderMove(g.members,g.rally.x,g.rally.z,{formation:g.formation,spacing:g.spacing});
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
   ids=active.members;formation=active.formation;spacing=active.spacing;
  }
  const targets=ids.map(id=>this.get(id)).filter(Boolean);
  const offsets=formation?formationOffsets(targets.length,formation,spacing??2.4):null;
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
    a.task=null;a.order="manual";a.cooldown=1.5;a.status="移動指示";moved++;
   }
  });
  return moved;
 }
 halt(ids){
  for(const id of ids){const a=this.get(id);if(a){this.frontier?.cancel(a);a.control.clearMoveTarget();a.task=null;a.auto=false;a.cooldown=1.5;a.order="hold";a.status="待機指示";}}
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
  for(const a of this.agents){
   if(a.id!=="player"){
    a.control.altitudeM=this.get("player").control.altitudeM;
    a.control.targetAltitudeM=a.control.altitudeM;
   }
   a.cooldown=Math.max(0,a.cooldown-dt);
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
    const progress=1-a.task.remaining/a.task.duration;
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
  return key?.startsWith("equipped_")?{action:key.slice("equipped_".length),progress:1-a.task.remaining/a.task.duration,hand:a.task.hand||"right",variant:a.task.variant||"overhead"}:
   this.frontier?.isAction(key)?{action:key==="gather_nearby"?"axe":"idle",progress:.5}:
   key?{action:key==="gather_wood"?"axe":"mine",progress:1-a.task.remaining/a.task.duration}:
   {action:"idle",progress:0};
 }
 repositionAfterLanding(){
  const lead=this.get("player").control;
  this.agents.slice(1).forEach((a,i)=>{
   a.control.setLanding(lead.lat,lead.lon);
   a.control.x+=(i? -3:3);a.control.z+=(i?3:1);
   const next=a.control.locationAt(a.control.x,a.control.z);
   a.control.lat=next.lat;a.control.lon=next.lon;
   a.control.altitudeM=lead.altitudeM;a.control.targetAltitudeM=lead.targetAltitudeM;
   a.task=null;a.order="idle";a.rally={x:a.control.x,z:a.control.z};
  });
  this.frontier?.rebase();
 }
 snapshot(){
  return {version:1,frontier:this.frontier?.snapshot(),selected:[...this.selected],groups:this.groups.snapshot(),
   agents:this.agents.map(a=>({id:a.id,auto:a.auto,rules:a.rules.map(r=>({...r})),
    control:a.id==="player"?null:a.control.snapshot(),rally:{...a.rally},status:a.status}))};
 }
 restore(data){
  if(!data||data.version!==1||!Array.isArray(data.agents)||data.agents.length!==3)throw Error("Invalid squad save");
  for(const a of this.agents){
   const s=data.agents.find(x=>x.id===a.id);
   if(!s||!Array.isArray(s.rules)||s.rules.length!==8||typeof s.auto!=="boolean"||!finitePoint(s.rally))throw Error("Invalid saved actor");
   a.rules=s.rules.map(sanitizeRule);a.auto=s.auto;a.rally={x:s.rally.x,z:s.rally.z};
   if(a.id!=="player")a.control=ExplorerController.fromSnapshot(this.terrain,s.control);
   a.status="復元済み";a.task=null;a.cooldown=0;
  }
  this.selected=new Set(Array.isArray(data.selected)?data.selected.filter(id=>this.get(id)):["player"]);
  if(!this.selected.size)this.selected.add("player");
  this.groups.restore(data.groups);
  const active=this.activeGroup();
  if(active&&!(active.members.length===this.selected.size&&active.members.every(id=>this.selected.has(id))))
   this.groups.activate(null);
 }
}
