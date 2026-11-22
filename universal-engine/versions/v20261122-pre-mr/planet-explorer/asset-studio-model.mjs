import {OWNER_PRIMITIVES} from "./owner-world.mjs?v=0.9c-asset-v2";

const finite=Number.isFinite;
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
const safeText=(value,length=40)=>String(value||"").trim().slice(0,length);
const vector=(value,fallback={x:0,y:0,z:0})=>({
 x:finite(value?.x)?value.x:fallback.x,
 y:finite(value?.y)?value.y:fallback.y,
 z:finite(value?.z)?value.z:fallback.z
});

export const ASSET_DOCUMENT_FORMAT="ue/asset-document";
export const ASSET_DOCUMENT_VERSION=2;
export const ASSET_TYPES=Object.freeze(["building","machine","vehicle","equipment","plant","creature","avatar"]);
export const ASSET_SNAP_MODES=Object.freeze(["none","endpoint","face","center","centroid","auto"]);
export const ASSET_ANCHORS=Object.freeze(["center","top-left","top","top-right","right","bottom-right","bottom","bottom-left","left"]);

function rotations(part){
 const rz=finite(part?.rz)?part.rz:finite(part?.rotation)?part.rotation:0;
 return {rx:finite(part?.rx)?part.rx:0,ry:finite(part?.ry)?part.ry:0,rz};
}

function normalizePart(part,id){
 const r=rotations(part),pivot=vector(part?.pivot),sockets=Array.isArray(part?.sockets)?clone(part.sockets):[];
 return {id:Number.isSafeInteger(part?.id)?part.id:id,name:safeText(part?.name||"Part "+id),
  parentId:Number.isSafeInteger(part?.parentId)?part.parentId:null,shape:part?.shape,
  x:Number(part?.x),y:Number(part?.y),z:Number(part?.z),width:Number(part?.width),height:Number(part?.height),depth:Number(part?.depth),
  rx:r.rx,ry:r.ry,rz:r.rz,rotation:r.rz,pivot,color:Array.isArray(part?.color)?[...part.color]:part?.color,
  group:safeText(part?.group),sockets};
}

const validSocket=socket=>socket&&typeof socket.name==="string"&&socket.name.length<=40&&
 [socket.position?.x,socket.position?.y,socket.position?.z].every(finite);
const validPart=part=>part&&Number.isSafeInteger(part.id)&&part.id>0&&OWNER_PRIMITIVES.includes(part.shape)&&
 [part.x,part.y,part.z,part.width,part.height,part.depth,part.rx,part.ry,part.rz,part.rotation,
  part.pivot?.x,part.pivot?.y,part.pivot?.z].every(finite)&&
 [part.width,part.height,part.depth].every(value=>value>=.1&&value<=200)&&
 [part.x,part.y,part.z].every(value=>Math.abs(value)<=500)&&
 [part.rx,part.ry,part.rz].every(value=>Math.abs(value)<=1e5)&&
 (part.parentId===null||Number.isSafeInteger(part.parentId))&&
 typeof part.name==="string"&&part.name.length<=40&&typeof part.group==="string"&&part.group.length<=40&&
 Array.isArray(part.color)&&part.color.length===3&&part.color.every(value=>finite(value)&&value>=0&&value<=1)&&
 Array.isArray(part.sockets)&&part.sockets.length<=32&&part.sockets.every(validSocket);

function nodeToPart(node,index){
 if(node?.type!=="primitive")return null;
 const position=node.transform?.position||{},rotation=node.transform?.rotation||{},size=node.geometry?.size||{};
 return normalizePart({id:node.id,name:node.name,parentId:node.parentId,shape:node.geometry?.shape,
  x:position.x,y:position.y,z:position.z,width:size.x,height:size.z,depth:size.y,
  rx:rotation.x,ry:rotation.y,rz:rotation.z,pivot:node.transform?.pivot,
  color:node.material?.baseColor,group:node.group,sockets:node.sockets},index+1);
}

function partToNode(part){
 return {id:part.id,type:"primitive",name:part.name||"Part "+part.id,parentId:part.parentId??null,group:part.group||"",
  transform:{position:{x:part.x,y:part.y,z:part.z},rotation:{x:part.rx,y:part.ry,z:part.rz},pivot:{...part.pivot}},
  geometry:{shape:part.shape,size:{x:part.width,y:part.depth,z:part.height}},
  material:{baseColor:[...part.color]},sockets:clone(part.sockets||[])};
}

function validateHierarchy(parts){
 const ids=new Set(parts.map(part=>part.id));
 if(ids.size!==parts.length||parts.some(part=>part.parentId!==null&&(!ids.has(part.parentId)||part.parentId===part.id)))return false;
 for(const part of parts){
  const visited=new Set([part.id]);let parent=part.parentId;
  while(parent!==null){if(visited.has(parent))return false;visited.add(parent);parent=parts.find(item=>item.id===parent)?.parentId??null;}
 }
 return true;
}

/** Convert the former flat v1 draft into the typed, extensible AssetDocument v2. */
export function migrateAssetDocument(saved){
 if(saved?.version===1&&Array.isArray(saved.parts)){
  const parts=saved.parts.map((part,index)=>normalizePart(part,index+1));
  if(parts.length>96||!parts.every(validPart)||!validateHierarchy(parts))throw Error("Asset制作データが不正です");
  return {format:ASSET_DOCUMENT_FORMAT,version:ASSET_DOCUMENT_VERSION,
   meta:{name:"",assetType:"building",units:"m"},workspace:{planeZ:clamp(Number(saved.planeZ)||0,-500,500)},
   nodes:parts.map(partToNode)};
 }
 if(saved?.format!==ASSET_DOCUMENT_FORMAT||saved?.version!==ASSET_DOCUMENT_VERSION||
  !saved.meta||!ASSET_TYPES.includes(saved.meta.assetType)||saved.meta.units!=="m"||
  !Array.isArray(saved.nodes)||saved.nodes.length>96)throw Error("Asset制作データが不正です");
 const parts=saved.nodes.map(nodeToPart);
 if(parts.some(part=>!part)||!parts.every(validPart)||!validateHierarchy(parts))throw Error("Asset制作データが不正です");
 return {format:ASSET_DOCUMENT_FORMAT,version:ASSET_DOCUMENT_VERSION,
  meta:{name:safeText(saved.meta.name),assetType:saved.meta.assetType,units:"m"},
  workspace:{planeZ:clamp(Number(saved.workspace?.planeZ)||0,-500,500)},nodes:parts.map(partToNode)};
}

export function partAnchor(part,anchor="center"){
 const map={center:[0,0],"top-left":[-.5,-.5],top:[0,-.5],"top-right":[.5,-.5],right:[.5,0],
  "bottom-right":[.5,.5],bottom:[0,.5],"bottom-left":[-.5,.5],left:[-.5,0]};
 const [nx,ny]=map[anchor]||map.center,p=rotate(nx*part.width,ny*part.depth,rotations(part).rz);
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
  if(used.length)candidates.push({x:used.reduce((sum,part)=>sum+part.x,0)/used.length,
   y:used.reduce((sum,part)=>sum+part.y,0)/used.length,kind:"centroid",partId:null});
 }
 return candidates;
}

export class AssetStudioModel{
 constructor(saved=null){
  this.parts=[];this.nextId=1;this.planeZ=0;this.meta={name:"",assetType:"building",units:"m"};
  this.selected=new Set();this.undoStack=[];this.redoStack=[];
  if(saved)this._load(saved);
 }
 _load(saved){
  const document=migrateAssetDocument(saved),parts=document.nodes.map(nodeToPart);
  this.parts=parts;this.nextId=Math.max(1,...parts.map(part=>part.id+1));this.planeZ=document.workspace.planeZ;
  this.meta={...document.meta};this.selected.clear();
 }
 snapshot(){return {format:ASSET_DOCUMENT_FORMAT,version:ASSET_DOCUMENT_VERSION,meta:{...this.meta},
  workspace:{planeZ:this.planeZ},nodes:this.parts.map(partToNode)};}
 prefabDocument(name=this.meta.name){const document=this.snapshot();document.meta.name=safeText(name);return document;}
 setMeta(values={}){if(values.name!==undefined)this.meta.name=safeText(values.name);
  if(ASSET_TYPES.includes(values.assetType))this.meta.assetType=values.assetType;return {...this.meta};}
 _remember(){this.undoStack.push(this.snapshot());if(this.undoStack.length>60)this.undoStack.shift();this.redoStack=[];}
 _restore(state){this._load(state);}
 undo(){if(!this.undoStack.length)return false;this.redoStack.push(this.snapshot());this._restore(this.undoStack.pop());return true;}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push(this.snapshot());this._restore(this.redoStack.pop());return true;}
 setPlane(value){this.planeZ=clamp(Number(value)||0,-500,500);return this.planeZ;}
 add(template,x,y,{snapMode="none",sourceAnchor="center",snapDistance=1.25}={}){
  const id=this.nextId,r=rotations(template),draft=normalizePart({id,name:template.name||"Part "+id,parentId:null,
   shape:template.shape,x:Number(x),y:Number(y),z:this.planeZ,width:Number(template.width),height:Number(template.height),
   depth:Number(template.depth),rx:r.rx,ry:r.ry,rz:r.rz,pivot:template.pivot||{x:0,y:0,z:0},
   color:[...template.color],group:template.group,sockets:[]},id);
  if(!validPart(draft)||this.parts.length>=96)return null;
  const source=partAnchor(draft,sourceAnchor),target=this.nearestSnap(source.x,source.y,snapMode,snapDistance);
  if(target){draft.x+=target.x-source.x;draft.y+=target.y-source.y;}
  this._remember();draft.id=this.nextId++;draft.name=template.name||"Part "+draft.id;this.parts.push(draft);
  this.selected=new Set([draft.id]);return draft;
 }
 nearestSnap(x,y,mode="auto",distance=1.25,exclude=new Set()){
  if(mode==="none")return null;
  let best=null;for(const point of snapCandidates(this.parts,mode,exclude)){
   const d=Math.hypot(point.x-x,point.y-y);if(d<=distance&&(!best||d<best.d))best={...point,d};
  }return best;
 }
 hit(x,y){return [...this.parts].reverse().find(part=>{const q=rotate(x-part.x,y-part.y,-part.rz);
  return Math.abs(q.x)<=part.width/2&&Math.abs(q.y)<=part.depth/2;})||null;}
 select(id,{add=false}={}){if(!add)this.selected.clear();if(id){if(add&&this.selected.has(id))this.selected.delete(id);else this.selected.add(id);}return this.selection();}
 selection(){return this.parts.filter(part=>this.selected.has(part.id));}
 move(dx=0,dy=0,dz=0){
  const chosen=this.selection();if(!chosen.length||![dx,dy,dz].every(finite))return false;this._remember();
  for(const part of chosen){part.x=clamp(part.x+dx,-500,500);part.y=clamp(part.y+dy,-500,500);part.z=clamp(part.z+dz,-500,500);}return true;
 }
 update(values){
  const chosen=this.selection();if(!chosen.length)return false;
  const patch={...values};if(values.color)patch.color=[...values.color];
  if(finite(values.rotation)&&!finite(values.rz))patch.rz=values.rotation;
  if(finite(values.rz))patch.rotation=values.rz;
  const candidates=chosen.map(part=>normalizePart({...part,...patch,color:patch.color||part.color},part.id));
  if(!candidates.every(validPart))return false;this._remember();
  for(let index=0;index<chosen.length;index++)Object.assign(chosen[index],candidates[index]);return true;
 }
 remove(){if(!this.selected.size)return false;this._remember();const removed=new Set(this.selected);
  this.parts=this.parts.filter(part=>!removed.has(part.id));for(const part of this.parts)if(removed.has(part.parentId))part.parentId=null;
  this.selected.clear();return true;}
 copy(step=1){
  const chosen=this.selection();if(!chosen.length||this.parts.length+chosen.length>96)return [];
  this._remember();const idMap=new Map(),copies=chosen.map(part=>{const id=this.nextId++;idMap.set(part.id,id);
   return normalizePart({...clone(part),id,name:safeText(part.name+" copy"),x:clamp(part.x+step,-500,500),y:clamp(part.y+step,-500,500)},id);});
  for(const copy of copies)if(idMap.has(copy.parentId))copy.parentId=idMap.get(copy.parentId);else copy.parentId=null;
  this.parts.push(...copies);this.selected=new Set(copies.map(part=>part.id));return copies;
 }
 group(name){const chosen=this.selection(),group=safeText(name);if(!chosen.length||!group)return false;
  this._remember();for(const part of chosen)part.group=group;return true;}
 loadPrefab(prefab){
  if(prefab?.assetDocument){
   let document;try{document=migrateAssetDocument(prefab.assetDocument);}catch(_){return false;}
   if(!document.nodes.length)return false;this._remember();this._load(document);this.meta.name=safeText(prefab.name||this.meta.name);return true;
  }
  if(!prefab||!Array.isArray(prefab.parts)||!prefab.parts.length||prefab.parts.length>96)return false;
  const parts=prefab.parts.map((part,index)=>normalizePart({id:index+1,name:"Part "+(index+1),shape:part.shape,
   x:part.x,y:part.z,z:part.offsetY,width:part.width,height:part.height,depth:part.depth,
   rx:part.rx,ry:part.ry,rz:finite(part.rz)?part.rz:part.rotation,color:[...part.color],group:prefab.name},index+1));
  if(!parts.every(validPart))return false;this._remember();this.parts=parts;this.nextId=parts.length+1;
  this.meta={name:safeText(prefab.name),assetType:"building",units:"m"};this.selected.clear();return true;
 }
 prefabParts(){
  if(!this.parts.length)return [];
  const cx=this.parts.reduce((sum,part)=>sum+part.x,0)/this.parts.length,cy=this.parts.reduce((sum,part)=>sum+part.y,0)/this.parts.length;
  return this.parts.map(part=>({shape:part.shape,x:part.x-cx,z:part.y-cy,width:part.width,height:part.height,depth:part.depth,
   offsetY:part.z,rotation:part.rz,rx:part.rx,ry:part.ry,rz:part.rz,color:[...part.color]}));
 }
}
