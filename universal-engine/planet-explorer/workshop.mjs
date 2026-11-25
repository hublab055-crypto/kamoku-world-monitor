import {checkAlignment} from "./workshop-spatial.mjs";
// Workshop v0.2: deterministic dimensional stock and reversible joint graph.
const copy=v=>JSON.parse(JSON.stringify(v));
const positive=v=>Number.isFinite(v)&&v>0&&v<=100000;
const fail=m=>{throw new Error(m)};
export class Workshop {
 constructor(saved){this.parts=[];this.joints=[];this.mechanisms=[];this.motors=[];this.machines=[];this.cam=null;this.tools=[];this.next=1;if(saved?.version===1){this.parts=copy(saved.parts);this.joints=copy(saved.joints);this.mechanisms=copy(saved.mechanisms||[]);this.motors=copy(saved.motors||[]).map(m=>({...m,running:false,actualRPM:0,powerW:0,status:"停止"}));this.machines=copy(saved.machines||[]).map(m=>({...m,job:m.job?.status==="running"?{...m.job,status:"paused"}:m.job}));this.tools=copy(saved.tools||[]);this.cam=copy(saved.cam||null);if(this.cam?.status==="running")this.cam.status="paused";this.next=saved.next;}}
 snapshot(){return copy({version:1,parts:this.parts,joints:this.joints,mechanisms:this.mechanisms,motors:this.motors,machines:this.machines,cam:this.cam,tools:this.tools,next:this.next});}
 part(id){return this.parts.find(p=>p.id===Number(id))||fail("部品がありません");}
 stock(shape,d,l,w=d){if(!["round","plate"].includes(shape)||![d,l,w].every(positive))fail("寸法を確認してください");if(this.parts.length>=200)fail("部品上限");const p={id:this.next++,shape,d,l,w,holes:[],history:[]};this.parts.push(p);return p;}
 free(id){const p=this.part(id);if(this.machines.some(m=>["running","paused"].includes(m.job?.status)&&m.job.part===p.id))fail("加工設備に固定中のワークです");if(this.joints.some(j=>j.a===p.id||j.b===p.id)||this.mechanisms.some(j=>j.a===p.id||j.b===p.id))fail("接合部品は取り外してから加工してください");return p;}
 turn(id,d,l){const p=this.free(id);if(p.shape!=="round"||![d,l].every(positive)||d>p.d||l>p.l||p.holes.length)fail("丸棒・素材寸法・既存穴を確認");p.history.push({type:"turn",d:p.d,l:p.l});p.d=d;p.w=d;p.l=l;return p;}
 drill(id,d,depth,x,y){const p=this.free(id),w=p.shape==="round"?p.d:p.w,h=p.shape==="round"?p.d:p.l,t=p.shape==="round"?p.l:p.d;
 if(![d,depth].every(positive)||depth>t||![x,y].every(Number.isFinite)||Math.abs(x)+d/2>w/2||Math.abs(y)+d/2>h/2||(p.shape==="round"&&Math.hypot(x,y)+d/2>p.d/2))fail("穴が素材の外側、または深すぎます");
 if(p.holes.length>=12)fail("穴は部品あたり12個まで");
 if(p.holes.some(q=>Math.hypot(x-q.x,y-q.y)<(d+q.d)/2))fail("穴が重なっています");p.holes.push({d,depth,x,y,through:depth===t});p.history.push({type:"drill",d,depth,x,y});return p;}
 mill(id,w,l,t){const p=this.free(id);if(p.shape!=="plate"||![w,l,t].every(positive)||w>p.w||l>p.l||t>p.d||p.holes.length)fail("板材・素材寸法・既存穴を確認");p.history.push({type:"mill",w:p.w,l:p.l,d:p.d});Object.assign(p,{w,l,d:t});return p;}
 join(a,b,type,{diameter=8,torque=20,site=null,holeA=0,holeB=0,spatial=false}={}){const p=this.part(a),q=this.part(b);if(this.machines.some(m=>["running","paused"].includes(m.job?.status)&&[p.id,q.id].includes(m.job.part)))fail("加工中のワークは接合不可");if(this.mechanisms.some(j=>[p.id,q.id].includes(j.a)||[p.id,q.id].includes(j.b)))fail("可動拘束を解除してください");if(p===q||!["weld","bolt"].includes(type))fail("異なる2部品を選択してください");if(this.joints.some(j=>(j.a===p.id&&j.b===q.id)||(j.a===q.id&&j.b===p.id)))fail("既に接合済み");
 if(type==="bolt"){const u=p.holes[holeA],v=q.holes[holeB];if(!positive(diameter)||!positive(torque)||!u?.through||!v?.through||u.d<diameter||v.d<diameter)fail("両部品にボルト径以上の貫通穴が必要です");}
 if(!site||![site.lat,site.lon].every(Number.isFinite))fail("作業地点を確認してください");
 const fastener=spatial?checkAlignment(p,q,type,holeA,holeB):null;
 const j={fastener,id:this.next++,a:p.id,b:q.id,type,diameter:type==="bolt"?diameter:null,torque:type==="bolt"?torque:null,holeA,holeB,site:copy(site)};this.joints.push(j);return j;}
 remove(id){const i=this.joints.findIndex(j=>j.id===Number(id));if(i<0)fail("接合がありません");return this.joints.splice(i,1)[0];}
}
