// Supported Universal CAD feature subset -> game CAM jobs. Not real machine G-code.
import {startJob,controlJob,resetFeed,tickMachines} from "./workshop-machine-tools.mjs?v=6";
const fail=x=>{throw Error(x);};
const clone=x=>JSON.parse(JSON.stringify(x));
const num=(...x)=>x.every(Number.isFinite);
const same=(a,b)=>a&&b&&Math.abs(a.lat-b.lat)<1e-6&&Math.abs(a.lon-b.lon)<1e-6;
const eq=(a,b)=>Math.abs(a-b)<1e-7;
const active=p=>p&&["running","paused","ready"].includes(p.status);
const find=(s,id)=>s.machines.find(m=>m.id===id)||fail("設備がありません");
export function cadTarget(doc){
 if(!doc||!Array.isArray(doc.shapes)||!Array.isArray(doc.features)||doc.shapes.length>10000||doc.features.length>100)fail("CAD JSON形式を確認してください");
 const fs=doc.features.filter(f=>!f.disabled);
 if(!fs.length||fs[0].kind!=="addExtrude"||fs.some(f=>f.plane!=="XY"||f.sourceIds?.length!==1||!num(f.depth)||f.depth<=0)||fs.slice(1).some(f=>f.kind!=="cutExtrude"))fail("XY正方向の単一押し出し＋円形貫通穴のみ対応");
 const get=f=>doc.shapes.find(s=>s.id===f.sourceIds[0])||fail("参照スケッチなし");
 const b=get(fs[0]),t=fs[0].depth;let target,cx,cy;
 if(b.type==="circle"&&num(b.c?.x,b.c?.y,b.r)&&b.r>0){cx=b.c.x;cy=b.c.y;target={shape:"round",d:2*b.r,l:t,w:2*b.r,holes:[]};}
 else if(b.type==="rect"&&num(b.a?.x,b.a?.y,b.b?.x,b.b?.y)){cx=(b.a.x+b.b.x)/2;cy=(b.a.y+b.b.y)/2;target={shape:"plate",d:t,l:Math.abs(b.a.y-b.b.y),w:Math.abs(b.a.x-b.b.x),holes:[]};}
 else fail("円または矩形の押し出しを指定してください");
 if(![target.d,target.l,target.w].every(v=>v>0&&v<=100000)||fs.length>13)fail("寸法または穴数の上限");
 for(const f of fs.slice(1)){const c=get(f);if(c.type!=="circle"||!num(c.c?.x,c.c?.y,c.r)||c.r<=0||f.depth<t)fail("CADの底面起点カットは貫通円穴のみ対応");
 const h={d:c.r*2,depth:t,x:c.c.x-cx,y:c.c.y-cy};const w=target.shape==="round"?target.d:target.w,l=target.shape==="round"?target.d:target.l;
 if(Math.abs(h.x)+c.r>w/2||Math.abs(h.y)+c.r>l/2||(target.shape==="round"&&Math.hypot(h.x,h.y)+c.r>w/2)||target.holes.some(q=>Math.hypot(q.x-h.x,q.y-h.y)<(q.d+h.d)/2))fail("穴が外形または他の穴と干渉");target.holes.push(h);}
 return target;
}
export function makeProgram(s,partId,target,site){
 const p=s.free(partId);if(p.shape!==target.shape||p.holes.length||p.d<target.d||p.l<target.l||(p.shape==="plate"&&p.w<target.w))fail("未加工の同形状・十分な寸法の素材を選択");
 const steps=[],machineFor=(kind,distance)=>{const m=s.machines.find(m=>m.kind===kind&&same(m.site,site)&&(!m.job||!["running","paused"].includes(m.job.status))&&[m.spindle,m.feed].every(id=>s.motors.some(v=>v.id===id&&!v.running&&v.energyWh>0&&v.load<v.torque))&&s.mechanisms.some(e=>e.id===s.motors.find(v=>v.id===m.feed)?.mechanism&&e.travel>=distance));if(!m)fail(kind+" 設備・ストローク・電力を確認");return m.id;};
 if(!eq(p.d,target.d)||!eq(p.l,target.l)||(p.shape==="plate"&&!eq(p.w,target.w))){const kind=p.shape==="round"?"lathe":"mill",distance=kind==="lathe"?Math.max((p.d-target.d)/2,p.l-target.l):Math.max(p.d-target.d,(p.l-target.l)/2,(p.w-target.w)/2);steps.push({kind,machine:machineFor(kind,distance),target:{d:target.d,l:target.l,w:target.w},distance});}
 for(const h of target.holes)steps.push({kind:"drill",machine:machineFor("drill",h.depth),target:clone(h),distance:h.depth});
 if(!steps.length)fail("加工工程がありません");
 return {part:p.id,target:clone(target),steps,index:0,status:"ready",site:clone(site),error:"",started:false};
}
export function installProgram(s,partId,doc,site){if(active(s.cam))fail("既存プログラムを中止または完了してください");s.cam=makeProgram(s,partId,cadTarget(doc),site);return s.cam;}
function current(s){const p=s.cam;if(!p||!active(p))fail("実行可能なCAMプログラムなし");return p;}
function launch(s,p){
 const step=p.steps[p.index],m=find(s,step.machine),part=s.part(p.part);
 if(!same(m.site,p.site)||!m||m.kind!==step.kind)fail("設備構成が変化しています");
 resetFeed(s,m.id);
 const prev=part.pose?clone(part.pose):null;
 // Virtual transfer / clamping: startJob positions stock at the selected station.
 delete part.pose;
 try{startJob(s,m.id,p.part,step.target);}catch(e){if(prev)part.pose=prev;throw e;}
 p.started=true;
}
export function camControl(s,command){
 const p=current(s),m=p.started?find(s,p.steps[p.index].machine):null;
 if(command==="cancel"){if(m&&["running","paused"].includes(m.job?.status))controlJob(s,m.id,"cancel");p.status="cancelled";return p;}
 if(command==="pause"){if(p.status!=="running")fail("実行中のみ停止可能");if(m&&m.job?.status==="running")controlJob(s,m.id,"pause");p.status="paused";return p;}
 if(command==="start"){if(!["ready","paused"].includes(p.status))fail("停止状態のみ開始可能");if(m?.job?.status==="paused")controlJob(s,m.id,"resume");else if(!p.started)launch(s,p);else fail("工程状態が不正");p.status="running";p.error="";return p;}
 fail("操作が不正");
}
export function tickCAM(s,dt){
 let changed=tickMachines(s,dt);const p=s.cam;if(!p||p.status!=="running")return changed;
 try{const m=find(s,p.steps[p.index].machine);if(m.job?.status==="paused"){p.status="paused";p.error="設備停止：電力・負荷を確認";return true;}
 if(m.job?.status==="cancelled"){p.status="cancelled";return true;}
 if(m.job?.status==="complete"){p.index++;p.started=false;if(p.index>=p.steps.length){p.status="complete";return true;}try{launch(s,p);}catch(e){p.status="paused";p.error=e.message;}return true;}
 }catch(e){p.status="paused";p.error=e.message;return true;}return changed;
}
export function programText(p){return ["UE-CAM 1 / mm / ゲーム専用（実機非対応）",...p.steps.map((s,i)=>String(i+1).padStart(2,"0")+" "+s.kind.toUpperCase()+" M"+s.machine+" "+Object.entries(s.target).map(([k,v])=>k.toUpperCase()+v).join(" ")+" FEED_TRAVEL="+s.distance)].join("\n");}
