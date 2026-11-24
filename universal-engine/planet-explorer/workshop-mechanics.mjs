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
export function addMechanism(state,a,b,type,{ratio=1,travel=100,axis=0}={}){
 finite(ratio,travel,axis);if(!["revolute","slider","gear"].includes(type)||ratio<=0||ratio>100||travel<=0||travel>100000)throw Error("拘束設定が不正");
 const p=state.free(a),q=state.free(b);if(p===q||!p.pose||!q.pose||Math.abs(p.pose.site.lat-q.pose.site.lat)>1e-6||Math.abs(p.pose.site.lon-q.pose.site.lon)>1e-6)throw Error("別々の部品を同じ作業地点に配置");
 const dist=Math.hypot(p.pose.x-q.pose.x,p.pose.z-q.pose.z);if(type==="revolute"&&dist>.001)throw Error("回転中心を一致させてください");if(type==="gear"&&dist<.001)throw Error("歯車中心間距離を確保してください");
 const m={id:state.next++,a:p.id,b:q.id,type,ratio,travel,axis,position:0,baseA:clone(p.pose),baseB:clone(q.pose)};state.mechanisms.push(m);return m;}
 export function driveMechanism(state,id,delta){finite(delta);if(Math.abs(delta)>100000)throw Error("駆動量が大きすぎます");const m=state.mechanisms.find(x=>x.id===Number(id));if(!m)throw Error("拘束なし");const p=state.part(m.a),q=state.part(m.b);if(m.type==="slider"){m.position=Math.max(-m.travel,Math.min(m.travel,m.position+delta));q.pose.x=m.baseB.x+Math.cos(m.axis)*m.position;q.pose.z=m.baseB.z+Math.sin(m.axis)*m.position;}else{m.position+=delta;if(m.type==="gear"){p.pose.yaw=m.baseA.yaw+m.position;q.pose.yaw=m.baseB.yaw-m.position*m.ratio;}else q.pose.yaw=m.baseB.yaw+m.position;}return m;}
 export function removeMechanism(state,id){const i=state.mechanisms.findIndex(x=>x.id===Number(id));if(i<0)throw Error("拘束なし");return state.mechanisms.splice(i,1)[0];}
