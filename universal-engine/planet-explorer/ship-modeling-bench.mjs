// Ship-local modeling bench: metres, +Y up, independent of planet coordinates.
export const MODELING_BENCH=Object.freeze({x:3.05,z:-3.05,width:1.4,depth:1.5,top:.94,reach:1.9});
export const MODELING_SHAPES=Object.freeze(["cube","cylinder","sphere","cone"]);
const finite=Number.isFinite,copy=x=>JSON.parse(JSON.stringify(x));
const colors={cube:[.53,.72,.84],cylinder:[.78,.74,.56],sphere:[.44,.8,.72],cone:[.75,.55,.75]};
const fail=message=>({ok:false,message});
export function nearModelingBench(interior){
 return !!interior&&!interior.seated&&Math.hypot(interior.x-MODELING_BENCH.x,interior.z-MODELING_BENCH.z)<=MODELING_BENCH.reach;
}
export function validBenchPart(p){
 if(!p||!MODELING_SHAPES.includes(p.shape)||![p.x,p.y,p.z,p.width,p.height,p.depth,p.rotation].every(finite)||![p.width,p.height,p.depth].every(v=>v>=.001&&v<=1.2)||p.y<0||p.y+p.height>1.5+1e-9)return false;
 const c=Math.abs(Math.cos(p.rotation)),s=Math.abs(Math.sin(p.rotation));
 return Math.abs(p.x)+(c*p.width+s*p.depth)/2<=MODELING_BENCH.width/2-.025+1e-9&&Math.abs(p.z)+(s*p.width+c*p.depth)/2<=MODELING_BENCH.depth/2-.025+1e-9;
}
export class ShipModelingBench{
 constructor(saved){
  this.parts=[];this.next=1;this.selected=null;this.grip=null;
  if(saved?.version===1&&Array.isArray(saved.parts)&&saved.parts.length<=48){
   const ids=new Set();for(const p of saved.parts){if(!validBenchPart(p)||!Number.isSafeInteger(p.id)||p.id<1||ids.has(p.id))throw Error("モデリング台保存データ不正");ids.add(p.id);this.parts.push({...copy(p),color:[...colors[p.shape]]});}this.next=Math.max(0,...ids)+1;
  }
 }
 snapshot(){return {version:1,parts:copy(this.parts)};}
 select(id){this.selected=this.parts.some(p=>p.id===id)?id:null;}
 add(values){if(this.parts.length>=48)return fail("制作部品の上限48個");const p={...values,id:this.next,color:colors[values.shape]};if(!validBenchPart(p))return fail("寸法または作業台範囲を確認");this.next++;this.parts.push(copy(p));this.selected=p.id;return {ok:true};}
 update(values){const p=this.parts.find(p=>p.id===this.selected);if(!p)return fail("部品を選択");const next={...p,...values,id:p.id,color:colors[values.shape??p.shape]};if(!validBenchPart(next))return fail("寸法または作業台範囲を確認");Object.assign(p,copy(next));return {ok:true};}
 remove(){if(this.selected===null)return fail("部品を選択");this.parts=this.parts.filter(p=>p.id!==this.selected);this.selected=null;return {ok:true};}
 // A single fresh tracked hand can translate a part within the work envelope.
 grab(hand,point){
  if(this.grip||!["left","right"].includes(hand)||!point||![point.x,point.y,point.z].every(finite))return false;
  const b=MODELING_BENCH,local={x:point.x-b.x,y:point.y-b.top-.005,z:point.z-b.z};
  let best=null,distance=Infinity;
  for(const p of this.parts){const dx=local.x-p.x,dz=local.z-p.z,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
   const x=c*dx-s*dz,z=s*dx+c*dz,y=local.y-p.y;
   const d=Math.hypot(Math.max(0,Math.abs(x)-p.width/2),Math.max(0,-y,y-p.height),Math.max(0,Math.abs(z)-p.depth/2));
   if(d<=.10&&d<distance){best=p;distance=d;}
  }
  if(!best)return false;this.selected=best.id;this.grip={hand,id:best.id,start:{...point},origin:{x:best.x,y:best.y,z:best.z}};return true;
 }
 moveGrip(hand,point){
  const g=this.grip;if(!g||g.hand!==hand||!point||![point.x,point.y,point.z].every(finite))return false;
  const p=this.parts.find(p=>p.id===g.id);if(!p)return false;
  const b=MODELING_BENCH,c=Math.abs(Math.cos(p.rotation)),s=Math.abs(Math.sin(p.rotation));
  const mx=Math.max(0,b.width/2-.025-(c*p.width+s*p.depth)/2),mz=Math.max(0,b.depth/2-.025-(s*p.width+c*p.depth)/2);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const next={...p,x:clamp(g.origin.x+point.x-g.start.x,-mx,mx),y:clamp(g.origin.y+point.y-g.start.y,0,1.5-p.height),z:clamp(g.origin.z+point.z-g.start.z,-mz,mz)};
  if(!validBenchPart(next))return false;Object.assign(p,next);return true;
 }
 releaseGrip(hand){if(!this.grip||this.grip.hand!==hand)return false;this.grip=null;return true;}
 storeOutput(world,name){
  if(!this.parts.length)return fail("部品を作成してください");
  return world.storeCAD({name,parts:this.prefabParts()});
 }
 prefabParts(){return this.parts.map(({shape,x,y,z,width,height,depth,rotation,color})=>({shape,x,z,width,height,depth,offsetY:y,rotation,rx:0,ry:0,rz:rotation,color:[...color]}));}
}
