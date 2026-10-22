import {OWNER_PRIMITIVES} from "./owner-world.mjs?v=0.9a-assets";

const finite=Number.isFinite;
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
const validPart=p=>p&&OWNER_PRIMITIVES.includes(p.shape)&&
 [p.x,p.y,p.z,p.width,p.height,p.depth,p.rotation].every(finite)&&
 [p.width,p.height,p.depth].every(v=>v>=.1&&v<=200)&&Math.abs(p.x)<=500&&Math.abs(p.y)<=500&&Math.abs(p.z)<=500&&
 Array.isArray(p.color)&&p.color.length===3&&p.color.every(v=>finite(v)&&v>=0&&v<=1);

export const ASSET_SNAP_MODES=Object.freeze(["none","endpoint","face","center","centroid","auto"]);
export const ASSET_ANCHORS=Object.freeze(["center","top-left","top","top-right","right","bottom-right","bottom","bottom-left","left"]);

export function partAnchor(part,anchor="center"){
 const map={center:[0,0],"top-left":[-.5,-.5],top:[0,-.5],"top-right":[.5,-.5],right:[.5,0],
  "bottom-right":[.5,.5],bottom:[0,.5],"bottom-left":[-.5,.5],left:[-.5,0]};
 const [nx,ny]=map[anchor]||map.center,p=rotate(nx*part.width,ny*part.depth,part.rotation);
 return {x:part.x+p.x,y:part.y+p.y};
}

export function snapCandidates(parts,mode="auto",exclude=new Set()){
 const candidates=[];
 for(const part of parts){
  if(exclude.has(part.id))continue;
  const anchors=mode==="endpoint"?["top-left","top-right","bottom-right","bottom-left"]:
   mode==="face"?["top","right","bottom","left"]:mode==="center"?["center"]:
   mode==="auto"?ASSET_ANCHORS:[];
  for(const anchor of anchors)candidates.push({...partAnchor(part,anchor),kind:anchor,partId:part.id});
 }
 if((mode==="centroid"||mode==="auto")&&parts.length){
  const used=parts.filter(part=>!exclude.has(part.id));
  if(used.length)candidates.push({x:used.reduce((s,p)=>s+p.x,0)/used.length,
   y:used.reduce((s,p)=>s+p.y,0)/used.length,kind:"centroid",partId:null});
 }
 return candidates;
}

export class AssetStudioModel{
 constructor(saved=null){
  this.parts=[];this.nextId=1;this.planeZ=0;this.selected=new Set();this.undoStack=[];this.redoStack=[];
  if(saved){
   if(saved.version!==1||!Array.isArray(saved.parts)||saved.parts.length>96||!saved.parts.every(validPart))throw Error("Asset制作データが不正です");
   this.parts=saved.parts.map(p=>({...p,id:Number.isSafeInteger(p.id)?p.id:this.nextId++,group:String(p.group||"").slice(0,40),color:[...p.color]}));
   this.nextId=Math.max(1,...this.parts.map(p=>p.id+1));this.planeZ=clamp(Number(saved.planeZ)||0,-500,500);
  }
 }
 snapshot(){return {version:1,planeZ:this.planeZ,parts:clone(this.parts)};}
 _remember(){this.undoStack.push(this.snapshot());if(this.undoStack.length>60)this.undoStack.shift();this.redoStack=[];}
 _restore(state){this.parts=clone(state.parts);this.planeZ=state.planeZ;this.nextId=Math.max(1,...this.parts.map(p=>p.id+1));this.selected.clear();}
 undo(){if(!this.undoStack.length)return false;this.redoStack.push(this.snapshot());this._restore(this.undoStack.pop());return true;}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push(this.snapshot());this._restore(this.redoStack.pop());return true;}
 setPlane(value){this.planeZ=clamp(Number(value)||0,-500,500);return this.planeZ;}
 add(template,x,y,{snapMode="none",sourceAnchor="center",snapDistance=1.25}={}){
  const draft={id:this.nextId,shape:template.shape,x:Number(x),y:Number(y),z:this.planeZ,width:Number(template.width),
   height:Number(template.height),depth:Number(template.depth),rotation:Number(template.rotation)||0,
   color:[...template.color],group:String(template.group||"").trim().slice(0,40)};
  if(!validPart(draft)||this.parts.length>=96)return null;
  const source=partAnchor(draft,sourceAnchor),target=this.nearestSnap(source.x,source.y,snapMode,snapDistance);
  if(target){draft.x+=target.x-source.x;draft.y+=target.y-source.y;}
  this._remember();draft.id=this.nextId++;this.parts.push(draft);this.selected=new Set([draft.id]);return draft;
 }
 nearestSnap(x,y,mode="auto",distance=1.25,exclude=new Set()){
  if(mode==="none")return null;
  let best=null;for(const point of snapCandidates(this.parts,mode,exclude)){
   const d=Math.hypot(point.x-x,point.y-y);if(d<=distance&&(!best||d<best.d))best={...point,d};
  }return best;
 }
 hit(x,y){
  return [...this.parts].reverse().find(p=>{const q=rotate(x-p.x,y-p.y,-p.rotation);return Math.abs(q.x)<=p.width/2&&Math.abs(q.y)<=p.depth/2;})||null;
 }
 select(id,{add=false}={}){if(!add)this.selected.clear();if(id){if(add&&this.selected.has(id))this.selected.delete(id);else this.selected.add(id);}return this.selection();}
 selection(){return this.parts.filter(p=>this.selected.has(p.id));}
 move(dx=0,dy=0,dz=0){
  const chosen=this.selection();if(!chosen.length||![dx,dy,dz].every(finite))return false;this._remember();
  for(const p of chosen){p.x=clamp(p.x+dx,-500,500);p.y=clamp(p.y+dy,-500,500);p.z=clamp(p.z+dz,-500,500);}return true;
 }
 update(values){
  const chosen=this.selection();if(!chosen.length)return false;const next={...chosen[0],...values,color:values.color?[...values.color]:chosen[0].color};
  if(!validPart(next))return false;this._remember();for(const p of chosen)Object.assign(p,{...values,color:values.color?[...values.color]:p.color});return true;
 }
 remove(){if(!this.selected.size)return false;this._remember();this.parts=this.parts.filter(p=>!this.selected.has(p.id));this.selected.clear();return true;}
 copy(step=1){
  const chosen=this.selection();if(!chosen.length||this.parts.length+chosen.length>96)return [];
  this._remember();const copies=chosen.map(p=>({...clone(p),id:this.nextId++,x:clamp(p.x+step,-500,500),y:clamp(p.y+step,-500,500)}));
  this.parts.push(...copies);this.selected=new Set(copies.map(p=>p.id));return copies;
 }
 group(name){const chosen=this.selection(),group=String(name||"").trim().slice(0,40);if(!chosen.length||!group)return false;
  this._remember();for(const p of chosen)p.group=group;return true;}
 loadPrefab(prefab){
  if(!prefab||!Array.isArray(prefab.parts)||!prefab.parts.length||prefab.parts.length>96)return false;
  const parts=prefab.parts.map((p,i)=>({id:i+1,shape:p.shape,x:p.x,y:p.z,z:p.offsetY,width:p.width,height:p.height,
   depth:p.depth,rotation:p.rotation,color:[...p.color],group:prefab.name}));
  if(!parts.every(validPart))return false;this._remember();this.parts=parts;this.nextId=parts.length+1;this.selected.clear();return true;
 }
 prefabParts(){
  if(!this.parts.length)return [];
  const cx=this.parts.reduce((s,p)=>s+p.x,0)/this.parts.length,cy=this.parts.reduce((s,p)=>s+p.y,0)/this.parts.length;
  return this.parts.map(p=>({shape:p.shape,x:p.x-cx,z:p.y-cy,width:p.width,height:p.height,depth:p.depth,
   offsetY:p.z,rotation:p.rotation,color:[...p.color]}));
 }
}
