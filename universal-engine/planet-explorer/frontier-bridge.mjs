import {terrainSurface} from "./geo.mjs";
import {hutDoor} from "./buildings.mjs";
import {chooseWorkPoint} from "./terrain-collision.mjs";

/** Frontier World living systems in Universal Engine's planetary metre space. */
export const FW_WEIGHTS=Object.freeze({wood:3,stone:4,fiber:.5,food:1,water:1,clay:2,metal:3,soil:2,ironOre:1,plank:1});
export const FW_ACTIONS=Object.freeze(["rest_home","store_chest","gather_nearby"]);
export const FW_PRESET=Object.freeze([
 {enabled:true,metric:"stamina",op:"<=",value:30,action:"rest_home"},
 {enabled:true,metric:"load_kg",op:">",value:18,action:"store_chest"},
 {enabled:true,metric:"always",op:"==",value:1,action:"gather_nearby"}
]);
const kinds=["wood","stone","fiber","food","water"];
const bagKinds=Object.keys(FW_WEIGHTS);
const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const bag=b=>Object.fromEntries(bagKinds.map(k=>[k,cap(Math.floor(Number(b?.[k])||0),0,9999)]));
function generateNodes(terrain,control,base){
 const found=[];
 for(let i=0;i<48;i++){
  const r=9+(i%8)*5,angle=i*2.399963229728653;
  const x=base.x+Math.cos(angle)*r,z=base.z+Math.sin(angle)*r;
  const geo=control.locationAt(x,z),surface=terrainSurface(terrain,geo.lat,geo.lon);
  if(surface.water||surface.river||surface.slopeDeg>40)continue;
  found.push({id:"fw-"+i,kind:kinds[(i*7+Math.floor(i/5))%kinds.length],x,z,quantity:2+i%4});
 }
 return found;
}
export class FrontierBridge {
 constructor(squad,saved=null){
  this.squad=squad;this.life=null;this.events=[];this.world=null;
  const lead=squad.get("player").control;
  this.base={x:lead.x,z:lead.z};
  this.people=Object.fromEntries(squad.agents.map(a=>[a.id,{stamina:100,mental:100,inventory:bag(),radius:42,origin:{x:a.control.x,z:a.control.z},gathered:0,chestId:null,massAdjustmentKg:0}]));
  this.nodes=generateNodes(squad.terrain,lead,this.base);
  if(saved)this.restore(saved);
 }
 attachLife(life){this.life=life;}
 attachWorld(adapter){this.world=adapter;}
 setChest(id,chestId){
  const p=this.person(id);if(!p)return false;
  if(chestId!==null&&(!Number.isSafeInteger(Number(chestId))||Number(chestId)<=0))return false;
  p.chestId=chestId===null?null:Number(chestId);return true;
 }
 chests(a,sort="distance"){
  return this.life?.listChests(this.squad.actions.structures.filter(b=>b.kind==="hut"&&b.progress>=1),a.control,sort)||[];
 }
 selectedChest(a){
  const choices=this.chests(a),wanted=this.person(a.id)?.chestId;
  return choices.find(c=>c.id===wanted)||choices[0]||null;
 }
 ensureAgent(id){
  if(this.people[id])return this.people[id];
  const a=this.squad.get(id);
  if(!a)return null;
  return this.people[id]={stamina:100,mental:100,inventory:bag(),radius:42,
   origin:{x:a.control.x,z:a.control.z},gathered:0,chestId:null,massAdjustmentKg:0};
 }
 person(id){return this.ensureAgent(id);}
 isAction(kind){return FW_ACTIONS.includes(kind);}
 loadKg(id){const p=this.person(id),inv=p?.inventory||{};
   return Math.max(0,Math.round((bagKinds.reduce((t,k)=>t+(inv[k]||0)*FW_WEIGHTS[k],0)+(p?.massAdjustmentKg||0))*100)/100);}
 available(a){
  const p=this.person(a.id);
  if(!p)return [];
  if(this.world)return (this.world.list(p.origin,p.radius)||[]).filter(n=>n?.id&&["wood","stone"].includes(n.kind)&&dist(n,p.origin)<=p.radius);
  return this.nodes.filter(n=>n.quantity>0&&dist(n,p.origin)<=p.radius);
 }
 metrics(a){
  return {always:1,stamina:this.person(a.id)?.stamina??100,load_kg:this.loadKg(a.id),
   resource_nearby:this.available(a).reduce((n,p)=>n+(this.world?1:p.quantity),0)};
 }
 home(a){
  const built=this.squad.actions.structures.filter(b=>b.kind==="hut"&&b.progress>=1);
  if(!built.length)return {...this.base,kind:"camp"};
  built.sort((x,y)=>dist(x,a.control)-dist(y,a.control));
  return {...hutDoor(built[0]),kind:"hut"};
 }
 stored(){
  const x=this.squad.actions.resources,i=this.life?.inventory||{};
  return {wood:x.wood||0,stone:x.stone||0,fiber:x.fiber||0,food:i.rawFood||0,water:i.water||0};
 }
 hasItems(a){return bagKinds.some(k=>(this.person(a.id)?.inventory[k]||0)>0);}
 cancel(a){
  if(this.isAction(a.task?.kind)){a.task=null;a.control.clearMoveTarget();}
 }
 start(a,kind,slot=0){
  if(!this.isAction(kind)||kind==="store_chest"&&(!this.hasItems(a)||this.world&&!this.selectedChest(a))||kind==="gather_nearby"&&!this.available(a).length)return false;
  a.control.clearMoveTarget();a.task={kind,slot,target:null};a.order="frontier";return true;
 }
 finish(a,text){
  a.task=null;a.control.clearMoveTarget();a.cooldown=.4;a.status=text;
  this.events.push(a.name+"："+text);if(this.events.length>12)this.events.shift();
 }
 move(a,p,label,stopRange=2.2){
  if(dist(a.control,p)<=stopRange){a.control.clearMoveTarget();return true;}
  if(!a.control.moveTarget||dist(a.control.moveTarget,p)>1.4){
   if(!a.control.setMoveTarget(p.x,p.z)){this.finish(a,"到達できない場所");return false;}
  }
  a.status=label;return false;
 }
 deposit(a,chest=null){
  const inv=this.person(a.id).inventory;
  if(this.world){
   const result=chest&&this.life?.storeBackpack(chest.id,inv,this.loadKg(a.id));
   if(result?.ok){this.person(a.id).massAdjustmentKg=0;this.world.storageChanged?.(chest);}
   return result?.moved||0;
  }
  const r=this.squad.actions.resources,i=this.life?.inventory;let moved=0;
  for(const k of kinds){
   const n=inv[k];if(!n)continue;
   if(k==="food"||k==="water"){if(!i)continue;
    const dest=k==="food"?"rawFood":"water";i[dest]=(i[dest]||0)+n;
   }else r[k]=(r[k]||0)+n;
   inv[k]=0;moved+=n;
  }
  return moved;
 }
 tick(a,dt,manual=false){
  const p=this.person(a.id);if(!p)return false;
  p.stamina=cap(p.stamina-(a.control.moving?.13*dt:.008*dt),0,100);
  p.mental=cap((p.mental??100)+(p.stamina<25?-.20:.035)*dt,0,100);
  if(!a.auto||manual){this.cancel(a);return false;}
  if(!this.isAction(a.task?.kind))return false;
  const task=a.task;
  const interrupted=a.rules.slice(0,task.slot).some(r=>r.enabled&&this.squad.rulePass(a,r));
  if(interrupted){this.cancel(a);a.cooldown=0;return false;}
  if(task.kind==="rest_home"){
   const h=this.home(a);
   if(!this.move(a,h,"💤 "+(h.kind==="hut"?"家":"仮拠点")+"へ帰宅"))return true;
   p.stamina=cap(p.stamina+dt*9,0,100);
    p.mental=cap((p.mental??100)+dt*3,0,100);
   a.status="💤 休息 "+Math.floor(p.stamina)+"%";
   if(p.stamina>=99.999){p.stamina=100;this.finish(a,"スタミナ100%まで回復");}
  }else if(task.kind==="store_chest"){
   if(!this.hasItems(a)){this.finish(a,"全収納完了");return true;}
   const chest=this.world?this.selectedChest(a):null;
   if(this.world&&!chest){this.finish(a,"家にチェストを設置してください");return true;}
   const h=chest?{...hutDoor(chest.hut),kind:"chest"}:this.home(a);
   if(!this.move(a,h,"📦 "+(chest?.name||"チェスト")+"へ運搬"))return true;
   const n=this.deposit(a,chest);
   this.finish(a,n?"📦 "+(chest?.name||"チェスト")+"に"+n+"個収納":"収納先を利用できません");
   }else if(task.kind==="gather_nearby"){
   if(this.world){
    const candidates=this.available(a);
    let node=candidates.find(n=>n.id===task.target);
    if(!node||task.failed?.includes(node.id)){
     node=candidates.filter(n=>!task.failed?.includes(n.id))
      .sort((x,y)=>dist(x,a.control)-dist(y,a.control))[0];
     task.target=node?.id||null;task.swingTime=0;task.wait=0;a.control.clearMoveTarget();
    }
    if(!node){this.finish(a,"設定半径内の資源を全回収しました");return true;}
    const kind=node.kind==="stone"?"mine":"axe";
    if(dist(a.control,node)>2.6){
     const stand=chooseWorkPoint(a.control,node,(x,z)=>{
      const g=a.control.locationAt(x,z),surface=terrainSurface(this.squad.terrain,g.lat,g.lon);
      return !surface.water&&!surface.river&&surface.elevationM<2800;
     });
     if(!stand){
      task.failed=[...(task.failed||[]),node.id].slice(-80);task.target=null;
      a.status="急斜面の資源をスキップ";return true;
     }
     const moving=this.move(a,stand,"🚶 "+(kind==="axe"?"木へ接近":"岩へ接近"),.38);
     if(!moving){
      task.wait=(task.wait||0)+dt;
      if(task.wait>8){
       task.failed=[...(task.failed||[]),node.id].slice(-80);
       task.target=null;task.wait=0;a.control.clearMoveTarget();
      }
      return true;
     }
     if(dist(a.control,node)>2.6)return true; // never swing from beyond tool reach
    }
    a.control.clearMoveTarget();
    a.status=kind==="axe"?"🪓 木に斧を振っています":"⛏️ 岩を採掘しています";
    task.swingKind=kind;task.swingTime=(task.swingTime||0)+dt;
    if(task.swingTime<(kind==="axe"?.78:1.65))return true;
    task.swingTime=0;
    const result=this.world.hit(node,kind,a);
    p.stamina=cap(p.stamina-(kind==="mine"?4:2),0,100);
    if(result?.drops){
     const oldMass=bagKinds.reduce((total,k)=>total+(p.inventory[k]||0)*FW_WEIGHTS[k],0);
     for(const [k,qty] of Object.entries(result.drops))
      if(bagKinds.includes(k))p.inventory[k]=cap((p.inventory[k]||0)+qty,0,9999);
     const newMass=bagKinds.reduce((total,k)=>total+(p.inventory[k]||0)*FW_WEIGHTS[k],0);
     if(Number.isFinite(result.massKg))
      p.massAdjustmentKg=(p.massAdjustmentKg||0)+(result.massKg-(newMass-oldMass));
    }
    if(result?.stage==="collected"){p.gathered++;task.target=null;}
    if(!result?.ok){task.failed=[...(task.failed||[]),node.id];task.target=null;}
    a.status=(result?.message||"採集中")+" / 🎒 "+this.loadKg(a.id)+"kg";
    this.world.effect?.(node,result,a);
    return true;
   }
   let node=this.nodes.find(n=>n.id===task.target&&n.quantity>0);
   if(node&&!this.available(a).includes(node))node=null;
   if(!node){
    node=this.available(a).sort((x,y)=>dist(x,a.control)-dist(y,a.control))[0];
    task.target=node?.id||null;a.control.clearMoveTarget();
   }
   if(!node){this.finish(a,"半径内の資源を全回収");return true;}
   if(!this.move(a,node,"🧺 "+node.kind+"へ移動"))return true;
   node.quantity--;p.inventory[node.kind]++;p.gathered++;
   p.stamina=cap(p.stamina-(node.kind==="stone"?4:2),0,100);
   a.status="🧺 "+node.kind+" +1 / "+this.loadKg(a.id)+"kg";
   task.target=null;a.control.clearMoveTarget();
   if(!this.available(a).length)this.finish(a,"半径内の資源を全回収");
  }
  return true;
 }
 applyPreset(id){
  const a=this.squad.get(id);if(!a)return false;
  FW_PRESET.forEach((r,i)=>this.squad.setRule(id,i,{...r}));
  this.cancel(a);a.cooldown=0;return true;
 }
 setRadius(id,r){
  const p=this.person(id);if(!p||!Number.isFinite(Number(r)))return false;
  p.radius=cap(Math.round(Number(r)),5,100);return true;
 }
 setOrigin(id){
  const a=this.squad.get(id),p=this.person(id);if(!a||!p)return false;
  p.origin={x:a.control.x,z:a.control.z};this.cancel(a);return true;
 }
 rebase(){
  const a=this.squad.get("player").control;
  this.base={x:a.x,z:a.z};
  this.nodes=generateNodes(this.squad.terrain,a,this.base);
  for(const actor of this.squad.agents){
   this.person(actor.id).origin={x:actor.control.x,z:actor.control.z};this.cancel(actor);
  }
 }
 snapshot(){return {version:1,base:{...this.base},people:JSON.parse(JSON.stringify(this.people)),nodes:this.nodes.map(n=>({...n}))};}
 restore(data){
  if(!data||data.version!==1||!point(data.base)||!Array.isArray(data.nodes))return false;
  this.base={x:data.base.x,z:data.base.z};
  for(const actor of this.squad.agents){
   const s=data.people?.[actor.id],p=this.person(actor.id);if(!s)continue;
   p.stamina=cap(Number.isFinite(s.stamina)?s.stamina:100,0,100);
   p.mental=cap(Number.isFinite(s.mental)?s.mental:100,0,100);
   p.inventory=bag(s.inventory);p.radius=cap(Number(s.radius)||42,5,100);
   p.origin=point(s.origin)?{x:s.origin.x,z:s.origin.z}:{x:actor.control.x,z:actor.control.z};
   p.gathered=Math.max(0,Math.floor(Number(s.gathered)||0));
   p.massAdjustmentKg=Number.isFinite(s.massAdjustmentKg)?Math.max(-500000,Math.min(500000,s.massAdjustmentKg)):0;
    p.chestId=Number.isSafeInteger(s.chestId)&&s.chestId>0?s.chestId:null;
   p.gifts={};
   for(const [id,qty] of Object.entries(s.gifts||{}))if(/^[a-zA-Z]{1,24}$/.test(id)&&Number.isSafeInteger(qty)&&qty>=0&&qty<=9999)p.gifts[id]=qty;
  }
  const seen=new Set();
  this.nodes=data.nodes.filter(n=>n&&typeof n.id==="string"&&kinds.includes(n.kind)&&point(n)&&
   Number.isSafeInteger(n.quantity)&&n.quantity>=0&&n.quantity<=100&&!seen.has(n.id)&&seen.add(n.id))
   .slice(0,100).map(n=>({...n}));
  return true;
 }
}
