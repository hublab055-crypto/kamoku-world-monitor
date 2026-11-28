import {packCadMesh,validCadMesh} from "./cad-mesh-geometry.mjs";
// Ship-local modeling bench: metres, +Y up, independent of planet coordinates.
export const MODELING_BENCH=Object.freeze({x:3.05,z:-3.05,width:1.4,depth:1.5,top:.94,reach:1.9,datumHeight:.2});
export const MODELING_SHAPES=Object.freeze(["cube","cylinder","sphere","cone"]);
const finite=Number.isFinite,copy=x=>JSON.parse(JSON.stringify(x));
const colors={cube:[.53,.72,.84],cylinder:[.78,.74,.56],sphere:[.44,.8,.72],cone:[.75,.55,.75]};
const fail=message=>({ok:false,message});
const MAX_BENCH_CAD_BYTES=800000;
const meshBytes=parts=>parts.reduce((n,p)=>n+(p.cadMesh?.length||0),0);
export function nearModelingBench(interior){
 return !!interior&&!interior.seated&&Math.hypot(interior.x-MODELING_BENCH.x,interior.z-MODELING_BENCH.z)<=MODELING_BENCH.reach;
}
export function validBenchPart(p){
 if(!p||!MODELING_SHAPES.includes(p.shape)||(p.cadMesh!==undefined&&(p.shape!=="cube"||!validCadMesh(p.cadMesh)))||![p.x,p.y,p.z,p.width,p.height,p.depth,p.rotation].every(finite)||![p.width,p.height,p.depth].every(v=>v>=.001&&v<=1.2)||p.y<0||p.y+p.height>1.5+1e-9)return false;
 const c=Math.abs(Math.cos(p.rotation)),s=Math.abs(Math.sin(p.rotation));
 return Math.abs(p.x)+(c*p.width+s*p.depth)/2<=MODELING_BENCH.width/2-.025+1e-9&&Math.abs(p.z)+(s*p.width+c*p.depth)/2<=MODELING_BENCH.depth/2-.025+1e-9;
}
export class ShipModelingBench{
 constructor(saved){
  this.parts=[];this.next=1;this.selected=null;this.grip=null;
  if(saved?.version===1&&Array.isArray(saved.parts)&&saved.parts.length<=48){
   if(meshBytes(saved.parts)>MAX_BENCH_CAD_BYTES)throw Error("CAD保存容量超過");
   const ids=new Set();for(const p of saved.parts){if(!validBenchPart(p)||!Number.isSafeInteger(p.id)||p.id<1||ids.has(p.id))throw Error("モデリング台保存データ不正");ids.add(p.id);this.parts.push({...copy(p),color:[...colors[p.shape]]});}this.next=Math.max(0,...ids)+1;
  }
 }
 snapshot(){return {version:1,parts:copy(this.parts)};}
 select(id){this.selected=this.parts.some(p=>p.id===id)?id:null;}
 add(values){if(this.parts.length>=48)return fail("制作部品の上限48個");const p={...values,id:this.next,color:colors[values.shape]};if(!validBenchPart(p))return fail("寸法または作業台範囲を確認");if(meshBytes(this.parts)+meshBytes([p])>MAX_BENCH_CAD_BYTES)return fail("CAD容量上限");this.next++;this.parts.push(copy(p));this.selected=p.id;return {ok:true};}
 update(values){const p=this.parts.find(p=>p.id===this.selected);if(!p)return fail("部品を選択");const next={...p,...values,id:p.id,color:colors[values.shape??p.shape]};if(!validBenchPart(next))return fail("寸法または作業台範囲を確認");if(meshBytes(this.parts.filter(q=>q!==p))+meshBytes([next])>MAX_BENCH_CAD_BYTES)return fail("CAD容量上限");Object.assign(p,copy(next));return {ok:true};}
 // Import the actual normalized CAD mesh, not its bounding box. Re-output only replaces a selected CAD part.
 importCAD(faces,{datum=false}={}){
  if(this.grip)return fail("グリップを離してください");
  let m;try{m=packCadMesh(faces);}catch(e){return fail(e.message);}
  const p=this.parts.find(p=>p.id===this.selected&&p.cadMesh);
  const values={shape:"cube",cadMesh:m.mesh,width:m.width,height:m.height,depth:m.depth,x:p?.x??0,y:p?.y??0,z:p?.z??0,rotation:p?.rotation??0};
  if(datum){
   const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
   for(const f of faces)for(const v of f.vertices)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],v[i]);hi[i]=Math.max(hi[i],v[i]);}
   // CAD X,Y,Z maps to ship X,-Z,Y. The renderer adds 5 mm clearance.
   Object.assign(values,{x:(lo[0]+hi[0])*.0005,y:MODELING_BENCH.datumHeight-.005+lo[2]*.001,z:-(lo[1]+hi[1])*.0005,rotation:0});
  }
  return p?this.update(values):this.add(values);
 }
 remove(){if(this.selected===null)return fail("部品を選択");this.parts=this.parts.filter(p=>p.id!==this.selected);this.selected=null;return {ok:true};}
 // A grip gesture is anchored to the current dimensions, not accumulated frame deltas.
 _hit(point){
  const b=MODELING_BENCH,local={x:point.x-b.x,y:point.y-b.top-.005,z:point.z-b.z};
  let best=null,distance=Infinity;
  for(const p of this.parts){const dx=local.x-p.x,dz=local.z-p.z,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
   const x=c*dx-s*dz,z=s*dx+c*dz,y=local.y-p.y;
   const d=Math.hypot(Math.max(0,Math.abs(x)-p.width/2),Math.max(0,-y,y-p.height),Math.max(0,Math.abs(z)-p.depth/2));
   if(d<=.10&&d<distance){best=p;distance=d;}
  }
  return best;
 }
 _validPoint(p){return !!p&&[p.x,p.y,p.z].every(finite);}
 _rebase(){
  const g=this.grip,p=this.parts.find(p=>p.id===g.id);
  g.origin=copy(p);g.start=copy(g.points);g.hand=Object.keys(g.points)[0];
 }
 grab(hand,point,mode="transform"){
  if(!["left","right"].includes(hand)||!this._validPoint(point))return false;
  const p=this._hit(point);if(!p)return false;
  if(this.grip){
   const g=this.grip;if(g.mode!=="transform"||mode!=="transform"||g.points[hand]||g.id!==p.id)return false;
   const a=g.points[g.hand];if(Math.hypot(point.x-a.x,point.y-a.y,point.z-a.z)<.035)return false;
   g.points[hand]={...point};this._rebase();return true;
  }
  if(mode==="face"){
   const localY=point.y-MODELING_BENCH.top-.005;
   if(p.cadMesh||!["cube","cylinder"].includes(p.shape)||Math.abs(localY-p.y-p.height)>.055)return false;
  }
  this.selected=p.id;this.grip={hand,id:p.id,mode,points:{[hand]:{...point}}};this._rebase();return true;
 }
 moveGrip(hand,point){return this.moveGrips({[hand]:point});}
 moveGrips(points){
  const g=this.grip;if(!g)return false;
  for(const h of Object.keys(points)){if(!g.points[h]||!this._validPoint(points[h]))return false;}
  Object.assign(g.points,copy(points));
  const p=this.parts.find(p=>p.id===g.id);if(!p)return false;
  const o=g.origin,hands=Object.keys(g.points),a=g.points[hands[0]],s=g.start[hands[0]];
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  let next={...o};
  if(g.mode==="face"){
   next.height=clamp(o.height+a.y-s.y,.001,Math.min(1.2,1.5-o.y));
  }else if(hands.length===2){
   const b=g.points[hands[1]],t=g.start[hands[1]];
   const d0=Math.hypot(t.x-s.x,t.y-s.y,t.z-s.z),d1=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
   const k=clamp(d1/d0,.001/Math.min(o.width,o.height,o.depth),1.2/Math.max(o.width,o.height,o.depth));
   next.width=o.width*k;next.height=o.height*k;next.depth=o.depth*k;
   if(Math.hypot(t.x-s.x,t.z-s.z)>.025&&Math.hypot(b.x-a.x,b.z-a.z)>.025)
    next.rotation=o.rotation+Math.atan2(b.x-a.x,b.z-a.z)-Math.atan2(t.x-s.x,t.z-s.z);
   next.x=o.x+(a.x+b.x-s.x-t.x)/2;next.y=o.y+(a.y+b.y-s.y-t.y)/2;next.z=o.z+(a.z+b.z-s.z-t.z)/2;
  }else{
   next.x=o.x+a.x-s.x;next.y=o.y+a.y-s.y;next.z=o.z+a.z-s.z;
   if(finite(a.yaw)&&finite(s.yaw))next.rotation=o.rotation+Math.atan2(Math.sin(a.yaw-s.yaw),Math.cos(a.yaw-s.yaw));
  }
  const b=MODELING_BENCH,c=Math.abs(Math.cos(next.rotation)),sn=Math.abs(Math.sin(next.rotation));
  const mx=b.width/2-.025-(c*next.width+sn*next.depth)/2,mz=b.depth/2-.025-(sn*next.width+c*next.depth)/2;
  if(mx<0||mz<0||next.height>1.5)return true; // retain last valid geometry while still holding
  next.x=clamp(next.x,-mx,mx);next.z=clamp(next.z,-mz,mz);next.y=clamp(next.y,0,1.5-next.height);
  if(validBenchPart(next))Object.assign(p,next);
  return true;
 }
 releaseGrip(hand){
  const g=this.grip;if(!g?.points[hand])return false;
  delete g.points[hand];if(!Object.keys(g.points).length)this.grip=null;else this._rebase();return true;
 }
 releaseAll(){if(!this.grip)return false;this.grip=null;return true;}
 storeOutput(world,name){
  if(!this.parts.length)return fail("部品を作成してください");
  return world.storeCAD({name,parts:this.prefabParts()});
 }
 prefabParts(){return this.parts.map(({shape,x,y,z,width,height,depth,rotation,color,cadMesh})=>({shape,x,z,width,height,depth,offsetY:y,rotation,rx:0,ry:0,rz:rotation,color:[...color],...(cadMesh?{cadMesh}:{})}));}
}
