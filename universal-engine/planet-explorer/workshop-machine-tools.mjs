// Workshop machine tools: game-level process model driven by actual feed travel.
// Units: mm, rpm, seconds. No tool collision or engineering-grade cutting physics.
import {setMotor,tickMotors,driveMechanism} from "./workshop-mechanics.mjs?v=5";
const finite=(...v)=>v.every(Number.isFinite);
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=s=>{throw Error(s);};
const near=(a,b)=>a&&b&&Math.abs(a.lat-b.lat)<1e-6&&Math.abs(a.lon-b.lon)<1e-6;
const find=(arr,id,label)=>arr.find(x=>x.id===Number(id))||fail(label+"がありません");
const motor=(s,id)=>find(s.motors,id,"モーター");
const edge=(s,id)=>find(s.mechanisms,id,"拘束");
const tool=(s,id)=>find(s.machines,id,"加工設備");
const active=j=>j&&["running","paused"].includes(j.status);
export function machineLocked(s,id){return s.machines.some(m=>active(m.job)&&(m.spindle===id||m.feed===id));}
export function registerMachine(s,{name,kind,spindle,feed}){
 if(!["lathe","drill","mill"].includes(kind)||s.machines.length>=32)fail("設備種別または登録上限");
 const a=motor(s,spindle),b=motor(s,feed),e=edge(s,a.mechanism),f=edge(s,b.mechanism);
 if(a===b||!["gear","shaft","revolute"].includes(e.type)||f.type!=="screw")fail("独立した回転主軸と送りねじモーターを選択");
 if(a.rpm===0||b.rpm<=0||a.running||b.running)fail("主軸rpm≠0、送りrpm>0、両モーター停止が必要");
 if(s.machines.some(m=>[m.spindle,m.feed].includes(a.id)||[m.spindle,m.feed].includes(b.id)))fail("既に設備登録されたモーターです");
 const site=s.part(e.a).pose?.site;if(!near(site,s.part(f.a).pose?.site))fail("同じ作業地点に設備を配置");
 const m={id:s.next++,name:String(name||kind).trim().slice(0,40),kind,spindle:a.id,feed:b.id,site:clone(site),job:null};s.machines.push(m);return m;
}
export function unregisterMachine(s,id){const m=tool(s,id);if(active(m.job))fail("加工を終了してください");s.machines.splice(s.machines.indexOf(m),1);}
export function startJob(s,id,partId,target){
 const m=tool(s,id);if(active(m.job))fail("設備は加工中です");
 const a=motor(s,m.spindle),b=motor(s,m.feed),f=edge(s,b.mechanism),p=s.free(partId);
 if(a.running||b.running||a.energyWh<=0||b.energyWh<=0||a.load>=a.torque||b.load>=b.torque)fail("モーターの停止・電力・負荷を確認");
 if(p.pose&&!near(p.pose.site,m.site))fail("ワークを設備と同じ地点に配置");
 if(s.machines.some(x=>active(x.job)&&x.job.part===p.id))fail("他の設備で加工中");
 const original={d:p.d,l:p.l,w:p.w},t=clone(target),positive=(...v)=>finite(...v)&&v.every(x=>x>0);
 let distance;
 if(m.kind==="lathe"){if(p.shape!=="round"||p.holes.length||!positive(t.d,t.l)||t.d>p.d||t.l>p.l)fail("旋削寸法または素材が不正");distance=Math.max((p.d-t.d)/2,p.l-t.l);}
 if(m.kind==="mill"){if(p.shape!=="plate"||p.holes.length||!positive(t.d,t.l,t.w)||t.d>p.d||t.l>p.l||t.w>p.w)fail("フライス寸法または素材が不正");distance=Math.max(p.d-t.d,(p.w-t.w)/2,(p.l-t.l)/2);}
 if(m.kind==="drill"){const w=p.shape==="round"?p.d:p.w,h=p.shape==="round"?p.d:p.l,th=p.shape==="round"?p.l:p.d;
  if(!positive(t.d,t.depth)||!finite(t.x,t.y)||t.depth>th||Math.abs(t.x)+t.d/2>w/2||Math.abs(t.y)+t.d/2>h/2||(p.shape==="round"&&Math.hypot(t.x,t.y)+t.d/2>p.d/2)||p.holes.length>=12||p.holes.some(q=>Math.hypot(q.x-t.x,q.y-t.y)<(q.d+t.d)/2))fail("穴寸法・干渉を確認");distance=t.depth;
 }
 if(!finite(distance)||distance<=0||f.position+distance>f.travel+1e-9)fail("送りストローク不足または加工量なし");
 const spindleEdge=edge(s,a.mechanism),anchor=s.part(spindleEdge.b).pose;
 // Attach workpiece at the current spindle output location; no rigid-body coupling.
 if(!p.pose)p.pose={site:clone(m.site),x:anchor.x,y:anchor.y+s.part(spindleEdge.b).l,z:anchor.z,yaw:0};
 m.job={part:p.id,target:t,original,distance,start:f.position,progress:0,status:"running",hole:null,spindleYaw:anchor.yaw,workYaw:p.pose.yaw};
 p.history.push({type:"machine-"+m.kind,machine:m.id,target:t,status:"running"});
 setMotor(s,a.id,true);setMotor(s,b.id,true);return m.job;
}
function history(p,j,status){const h=p.history.findLast(x=>x.type.startsWith("machine-")&&x.status==="running");if(h)h.status=status;}
function stop(s,m,status){for(const id of [m.spindle,m.feed])setMotor(s,id,false);m.job.status=status;if(status!=="paused")history(s.part(m.job.part),m.job,status);}
export function controlJob(s,id,command){
 const m=tool(s,id),j=m.job;if(!active(j))fail("加工中のワークなし");
 if(command==="pause"){stop(s,m,"paused");}
 else if(command==="cancel"){stop(s,m,"cancelled");}
 else if(command==="resume"){if(j.status!=="paused")fail("一時停止中のみ再開可能");const a=motor(s,m.spindle),b=motor(s,m.feed);if(a.energyWh<=0||b.energyWh<=0||a.load>=a.torque||b.load>=b.torque)fail("電力・負荷を確認");j.status="running";setMotor(s,a.id,true);setMotor(s,b.id,true);}
 else fail("操作が不正");return j;
}
export function resetFeed(s,id){
 const m=tool(s,id);if(active(m.job))fail("加工を終了してください");const b=motor(s,m.feed),f=edge(s,b.mechanism);if(b.running)fail("送りモーターを停止");
 driveMechanism(s,f.id,-f.position*2*Math.PI/(f.pitch??5));return f.position;
}
export function tickMachines(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return false;let dirty=false;
 // Stop before generic tick if power/overload makes either drive unavailable.
 for(const m of s.machines){if(m.job?.status!=="running")continue;const a=motor(s,m.spindle),b=motor(s,m.feed);
 if(!a.running||!b.running||a.energyWh<=0||b.energyWh<=0||a.load>=a.torque||b.load>=b.torque){stop(s,m,"paused");dirty=true;}}
 dirty=tickMotors(s,dt)||dirty;
 for(const m of s.machines){const j=m.job;if(j?.status!=="running")continue;const a=motor(s,m.spindle),b=motor(s,m.feed),f=edge(s,b.mechanism),p=s.part(j.part),sp=s.part(edge(s,a.mechanism).b).pose;
  const progress=Math.max(j.progress,Math.min(1,(f.position-j.start)/j.distance));const q=j.target,o=j.original,lerp=(x,y)=>x+(y-x)*progress;
  if(progress>j.progress){
   if(m.kind==="lathe"){p.d=lerp(o.d,q.d);p.w=p.d;p.l=lerp(o.l,q.l);}
   if(m.kind==="mill"){p.d=lerp(o.d,q.d);p.w=lerp(o.w,q.w);p.l=lerp(o.l,q.l);}
   if(m.kind==="drill"){const depth=q.depth*progress,th=p.shape==="round"?p.l:p.d;if(j.hole===null){j.hole=p.holes.length;p.holes.push({d:q.d,depth,x:q.x,y:q.y,through:depth>=th-1e-9});}else Object.assign(p.holes[j.hole],{depth,through:depth>=th-1e-9});}
   j.progress=progress;dirty=true;
  }
  if(m.kind==="lathe"&&p.pose)p.pose.yaw=j.workYaw+sp.yaw-j.spindleYaw;
  if(progress>=1-1e-9){j.progress=1;stop(s,m,"complete");dirty=true;}
  else if(!a.running||!b.running){stop(s,m,"paused");dirty=true;}
 }return dirty;
}
