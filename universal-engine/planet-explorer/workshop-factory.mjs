// Game factory cell controller. Units mm, seconds; virtual tooling/handling, no real PLC or CMM.
const fail=m=>{throw Error(m)};
const clone=x=>JSON.parse(JSON.stringify(x));
const valid=(...xs)=>xs.every(Number.isFinite);
const near=(a,b)=>a&&b&&Math.abs(a.lat-b.lat)<1e-6&&Math.abs(a.lon-b.lon)<1e-6;
export function addTool(s,{kind,diameter=8,life=100,name=""}){
 if(!["lathe","mill","drill"].includes(kind)||!valid(diameter,life)||diameter<=0||diameter>100000||life<=0||life>1e7||s.tools.length>=100)fail("工具設定が不正");
 const t={id:s.next++,kind,diameter,life,remaining:life,name:String(name||kind).slice(0,40)};s.tools.push(t);return t;
}
export function configureFactory(p,{tolerance=.05,transferSeconds=2,changeSeconds=1,inspectionSeconds=1}={}){
 if(p.status!=="ready"||!valid(tolerance,transferSeconds,changeSeconds,inspectionSeconds)||tolerance<=0||tolerance>100||[transferSeconds,changeSeconds,inspectionSeconds].some(v=>v<.1||v>60))fail("工程生成直後に設定（正の公差・時間）");
 p.factory={tolerance,transferSeconds,changeSeconds,inspectionSeconds,phase:"ready",elapsed:0,tool:null,spent:0,report:null,from:null,to:null,events:[]};return p.factory;
}
function event(f,msg){f.events.push(msg);if(f.events.length>80)f.events.shift();}
export function chooseTool(s,step,required=step.distance){
 const t=s.tools.find(t=>t.kind===step.kind&&(step.kind!=="drill"||Math.abs(t.diameter-step.target.d)<1e-7)&&t.remaining+1e-9>=required);
 if(!t)fail("適合工具または工具寿命が不足: "+step.kind);return t;
}
export function prepareStep(s,p){
 const f=p.factory,step=p.steps[p.index],m=s.machines.find(x=>x.id===step.machine);
 if(!m||m.kind!==step.kind||!near(m.site,p.site))fail("設備構成が変化");
 if(["running","paused"].includes(m.job?.status))fail("設備使用中");
 const t=chooseTool(s,step),mot=s.motors.find(x=>x.id===m.spindle),edge=s.mechanisms.find(x=>x.id===mot?.mechanism);
 if(!edge)fail("主軸なし");const dest=s.part(edge.b),a=dest.pose;if(!a)fail("設備の位置なし");
 const part=s.part(p.part);if(part.pose&&!near(part.pose.site,p.site))fail("素材が作業地点の外にあります");
 f.from=clone(part.pose||{site:p.site,x:a.x-100,y:a.y+100,z:a.z,yaw:0});f.to={site:clone(p.site),x:a.x,y:a.y+(dest.shape==="round"?dest.l:dest.d),z:a.z,yaw:f.from.yaw};
 f.phase="transfer";f.elapsed=0;f.tool=t.id;f.spent=0;part.pose=clone(f.from);event(f,"工程 "+(p.index+1)+" 搬送開始");
}
export function advancePreparation(s,p,dt){
 const f=p.factory,step=p.steps[p.index],part=s.part(p.part),m=s.machines.find(x=>x.id===step.machine);
 if(!m)fail("設備がありません");
 f.elapsed+=dt;
 if(f.phase==="transfer"){
  const t=Math.min(1,f.elapsed/f.transferSeconds),a=f.from,b=f.to;part.pose={site:clone(b.site),x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+Math.sin(Math.PI*t)*80,z:a.z+(b.z-a.z)*t,yaw:a.yaw};
  if(t>=1){f.phase="tool-change";f.elapsed=0;event(f,"搬送完了 / ATC開始");}return false;
 }
 if(f.phase==="tool-change"&&f.elapsed>=f.changeSeconds){
  const t=s.tools.find(x=>x.id===f.tool);if(!t||t.remaining+1e-9<step.distance)fail("工具寿命不足");
  m.activeTool=t.id;f.phase="cutting";f.elapsed=0;event(f,"工具 #"+t.id+" 装着");return true;
 }return false;
}
export function accountWear(s,p,progress){
 const f=p.factory,step=p.steps[p.index],t=s.tools.find(x=>x.id===f.tool);
 if(!t)fail("工具がありません");const total=Math.max(0,Math.min(1,progress))*step.distance,delta=Math.max(0,total-f.spent);t.remaining=Math.max(0,t.remaining-delta);f.spent=total;
}
export function inspectPart(part,target,tol){
 if(!valid(tol)||tol<=0)fail("公差が不正");const rows=[];
 const measure=(name,nominal,actual)=>{const error=actual-nominal;rows.push({name,nominal,actual,error,pass:Number.isFinite(error)&&Math.abs(error)<=tol+1e-9});};
 measure("径/厚さ",target.d,part.d);measure("長さ",target.l,part.l);if(target.shape==="plate")measure("幅",target.w,part.w);
 measure("穴数",target.holes.length,part.holes.length);rows[rows.length-1].pass=target.holes.length===part.holes.length;
 const unused=new Set(part.holes.map((_,i)=>i));
 for(const [i,h] of target.holes.entries()){
  const ids=[...unused].sort((a,b)=>Math.hypot(part.holes[a].x-h.x,part.holes[a].y-h.y)-Math.hypot(part.holes[b].x-h.x,part.holes[b].y-h.y)),idx=ids[0],a=part.holes[idx];if(a)unused.delete(idx);
  for(const [key,label] of [["d","径"],["depth","深さ"],["x","X"],["y","Y"]])measure("穴"+(i+1)+" "+label,h[key],a?.[key]??NaN);
  rows.push({name:"穴"+(i+1)+" 貫通",nominal:1,actual:a?.through?1:0,error:a?.through?0:-1,pass:!!a?.through});
 }return {tolerance:tol,pass:part.shape===target.shape&&rows.every(r=>r.pass),rows};
}
export function startInspection(p){p.factory.phase="inspect";p.factory.elapsed=0;event(p.factory,"最終検査開始");}
export function finishInspection(s,p,dt){const f=p.factory;f.elapsed+=dt;if(f.elapsed<f.inspectionSeconds)return false;f.report=inspectPart(s.part(p.part),p.target,f.tolerance);f.phase="done";p.status=f.report.pass?"complete":"rejected";event(f,f.report.pass?"検査合格":"検査不合格");return true;}
