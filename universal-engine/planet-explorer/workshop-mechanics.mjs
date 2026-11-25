// Gameplay approximations, not engineering verification. mm, N, N*m, rad.
const finite=(...a)=>{if(!a.every(Number.isFinite))throw Error("数値を確認してください");};
const clone=x=>JSON.parse(JSON.stringify(x));
export function initThread(j,pitch=1.25,friction=.15,limit=20000){
 finite(pitch,friction,limit);if(j.type!=="bolt"||pitch<=0||pitch>j.diameter/2||friction<=0||friction>1||limit<=0)throw Error("ねじ設定が不正");
 const preload=j.torque/((.1+.7*friction)*j.diameter*.001);
 return j.thread={pitch,friction,limit,preload:Math.min(limit,preload),gap:0,turns:0,torque:j.torque,failed:preload>limit};
}
export function turnThread(j,turns){finite(turns);if(Math.abs(turns)>100)throw Error("回転数は100以下");const t=j.thread||initThread(j);if(t.failed)throw Error("破断済み");const d=t.preload/2000-t.gap+turns*t.pitch,f=Math.max(0,d*2000);t.turns+=turns;t.gap=Math.max(0,-d);t.preload=Math.min(t.limit,f);t.torque=t.preload*(.1+.7*t.friction)*j.diameter*.001;t.failed=f>t.limit;return t;}
export function testJointLoad(j,shear,axial){finite(shear,axial);if(shear<0||axial<0)throw Error("荷重は正の値");if(j.type==="bolt"){const t=j.thread||initThread(j);return {slip:shear>t.friction*t.preload,failed:t.failed||axial+t.preload>t.limit};}if(j.type==="weld")return {slip:false,failed:Math.hypot(shear,axial)>(j.weld?.capacity??1000)};throw Error("接合種別が不正");}
export function weldModel(j,a,b,bead=3){finite(bead);if(j.type!=="weld"||bead<=0||bead>Math.min(a.d,b.d,20))throw Error("溶接寸法が不正");const radius=Math.min(a.shape==="round"?a.d/2:Math.min(a.w,a.l)/2,b.shape==="round"?b.d/2:Math.min(b.w,b.l)/2);return j.weld={bead,radius,capacity:2*Math.PI*radius*bead*.7*100};}

// Directed transmission graph. Each moving output has one parent; cycles are rejected.
const rotary=new Set(["revolute","gear","shaft"]);
const linear=new Set(["slider","screw","crank"]);
const incoming=(s,id)=>s.mechanisms.find(m=>m.b===id);
const outgoing=(s,id)=>s.mechanisms.filter(m=>m.a===id);
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
const rootOf=(s,m)=>{let e=m;while(incoming(s,e.a))e=incoming(s,e.a);return e;};
const descendants=(s,id,seen=new Set())=>{if(seen.has(id))return seen;seen.add(id);for(const m of outgoing(s,id))descendants(s,m.b,seen);return seen;};
export function addMechanism(state,a,b,type,{ratio=1,travel=100,axis=0,pitch=5,radius=20}={}){
 finite(ratio,travel,axis,pitch,radius);
 if(!rotary.has(type)&&!linear.has(type)||ratio<=0||ratio>100||travel<=0||travel>100000||pitch<=0||pitch>10000||radius<=0||(type==="crank"&&radius>travel))throw Error("拘束設定が不正");
 const p=state.part(a),q=state.part(b);
 if(p===q||!p.pose||!q.pose||Math.abs(p.pose.site.lat-q.pose.site.lat)>1e-6||Math.abs(p.pose.site.lon-q.pose.site.lon)>1e-6)throw Error("別々の部品を同じ作業地点に配置");
 if(state.joints.some(j=>[p.id,q.id].includes(j.a)||[p.id,q.id].includes(j.b)))throw Error("固定接合を解除してください");
 if(incoming(state,q.id)||outgoing(state,q.id).length||descendants(state,q.id).has(p.id))throw Error("出力部品は未接続の部品を選択（循環・二重駆動禁止）");
 const upstream=incoming(state,p.id);
 if(upstream&&(!rotary.has(upstream.type)||type==="slider"||type==="revolute"))throw Error("回転出力には歯車・軸・送りねじ・クランクを接続してください");
 if(!upstream&&outgoing(state,p.id).length)throw Error("入力軸に既存の拘束があります");
 const dist=Math.hypot(p.pose.x-q.pose.x,p.pose.z-q.pose.z);
 if(["revolute","shaft"].includes(type)&&dist>.001)throw Error("回転中心を一致させてください");
 if(type==="gear"&&dist<.001)throw Error("歯車中心間距離を確保してください");
 const m={id:state.next++,a:p.id,b:q.id,type,ratio,travel,axis,pitch,radius,position:0,input:0,baseA:clone(p.pose),baseB:clone(q.pose)};state.mechanisms.push(m);return m;
}
function propagate(state,m,delta,isRoot){
 const p=state.part(m.a),q=state.part(m.b);
 m.input=(m.input??(m.type==="gear"?m.position:0))+delta;
 let output=0;
 if(m.type==="slider"){m.position=limit(m.position+delta,-m.travel,m.travel);}
 else if(m.type==="screw"){m.position=limit(m.position+delta*(m.pitch??5)/(2*Math.PI),-m.travel,m.travel);}
 else if(m.type==="crank"){m.position=limit((m.radius??20)*Math.sin(m.input),-m.travel,m.travel);}
 else {output=m.type==="gear"?-delta*m.ratio:delta;m.position+=m.type==="gear"?delta:output;q.pose.yaw+=output;}
 if(isRoot&&["gear","shaft","screw","crank"].includes(m.type))p.pose.yaw+=delta;
 if(linear.has(m.type)){q.pose.x=m.baseB.x+Math.cos(m.axis)*m.position;q.pose.z=m.baseB.z+Math.sin(m.axis)*m.position;}
 if(rotary.has(m.type))for(const child of outgoing(state,m.b))propagate(state,child,output,false);
}
export function driveMechanism(state,id,delta){
 finite(delta);if(Math.abs(delta)>100000)throw Error("駆動量が大きすぎます");const m=state.mechanisms.find(x=>x.id===Number(id));if(!m)throw Error("拘束なし");
 if(incoming(state,m.a))throw Error("連結機構は最上流の拘束を駆動してください");
 propagate(state,m,delta,true);return m;
}
export function removeMechanism(state,id){
 const i=state.mechanisms.findIndex(x=>x.id===Number(id));if(i<0)throw Error("拘束なし");const m=state.mechanisms[i];
 if(outgoing(state,m.b).length)throw Error("下流側の拘束から解除してください");
 if(state.motors?.some(x=>x.mechanism===m.id))throw Error("モーターを取り外してください");
 return state.mechanisms.splice(i,1)[0];
}
export function addMotor(state,id,{rpm=60,torque=10,load=2,energyWh=100,efficiency=.8}={}){
 finite(rpm,torque,load,energyWh,efficiency);
 const m=state.mechanisms.find(x=>x.id===Number(id));
 if(!m||incoming(state,m.a)||m.type==="slider")throw Error("最上流の回転駆動拘束を選択してください");
 if(Math.abs(rpm)>3000||torque<=0||load<0||energyWh<=0||efficiency<=0||efficiency>1)throw Error("モーター設定が不正");
 if(state.motors.some(x=>x.mechanism===m.id))throw Error("モーターは設定済み");
 const motor={id:state.next++,mechanism:m.id,rpm,torque,load,energyWh,efficiency,running:false,actualRPM:0,powerW:0,status:"停止"};state.motors.push(motor);return motor;
}
export function setMotor(state,id,running){const m=state.motors.find(x=>x.id===Number(id));if(!m)throw Error("モーターなし");m.running=Boolean(running);if(!running){m.actualRPM=0;m.powerW=0;}m.status=running?"運転":"停止";return m;}
export function removeMotor(state,id){const i=state.motors.findIndex(x=>x.id===Number(id));if(i<0)throw Error("モーターなし");if(state.motors[i].running)throw Error("停止してから取り外してください");return state.motors.splice(i,1)[0];}
export function tickMotors(state,dt){
 finite(dt);if(dt<=0)return false;dt=Math.min(dt,.25);let changed=false;
 for(const m of state.motors){if(!m.running)continue;changed=true;
  if(m.energyWh<=0||m.load>=m.torque){m.running=false;m.actualRPM=0;m.powerW=0;m.status=m.energyWh<=0?"電力切れ":"過負荷停止";continue;}
  const target=m.rpm,step=600*dt;m.actualRPM+=limit(target-m.actualRPM,-step,step);
  const omega=m.actualRPM*2*Math.PI/60,power=Math.abs(omega)*m.load/m.efficiency+2;
  const activeDt=Math.min(dt,m.energyWh*3600/power);
  try{driveMechanism(state,m.mechanism,omega*activeDt);}catch(e){m.running=false;m.actualRPM=0;m.powerW=0;m.status="拘束エラー";continue;}
  m.energyWh=Math.max(0,m.energyWh-power*activeDt/3600);m.powerW=power;m.status="運転";
  if(activeDt<dt||m.energyWh===0){m.running=false;m.actualRPM=0;m.powerW=0;m.status="電力切れ";}
 }return changed;
}
