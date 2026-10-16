/** Frontier World GLB importer for the native UniversalENGINE WebGL renderer.
 * Geometry is rendered as bind-pose vertex-colored meshes; animations and textures
 * remain unsupported in this adapter. Previously imported Frontier World avatars
 * can be read from their shared IndexedDB cache.
 */
const counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function values(glb,bytes,id){
 const a=glb.accessors[id],view=glb.bufferViews[a.bufferView],count=counts[a.type],d=new DataView(bytes);
 if(!count||a.sparse||a.count>150000)throw Error("GLB accessor unsupported");
 const b={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 if(!b)throw Error("GLB component unsupported");
 const step=view.byteStride||count*b,start=(view.byteOffset||0)+(a.byteOffset||0),out=[];
 if(start+step*(a.count-1)+count*b>bytes.byteLength)throw Error("GLB bounds");
 for(let i=0;i<a.count;i++){
  const row=[];for(let j=0;j<count;j++){
   const p=start+i*step+j*b;
   row.push(a.componentType===5126?d.getFloat32(p,true):a.componentType===5125?d.getUint32(p,true):a.componentType===5123?d.getUint16(p,true):d.getUint8(p));
  }
  out.push(row);
 }
 return out;
}
export function parseFrontierGLB(buffer){
 const raw=buffer instanceof ArrayBuffer?buffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 const v=new DataView(raw);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==raw.byteLength)throw Error("GLB2形式が必要です");
 let json=null,bin=null,offset=12;
 while(offset+8<=raw.byteLength){
  const n=v.getUint32(offset,true),type=v.getUint32(offset+4,true);offset+=8;
  if(offset+n>raw.byteLength)throw Error("GLB不正な長さ");
  if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,offset,n)));
  if(type===0x004e4942)bin=raw.slice(offset,offset+n);
  offset+=n;
 }
 if(!json?.meshes||!bin)throw Error("GLBにメッシュがありません");
 const chunks=[],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const mesh of json.meshes)for(const p of mesh.primitives||[]){
  if(p.mode!=null&&p.mode!==4)continue;
  const attrs=p.attributes||{},pos=values(json,bin,attrs.POSITION);
  const normals=attrs.NORMAL!=null?values(json,bin,attrs.NORMAL):null;
  const colors=attrs.COLOR_0!=null?values(json,bin,attrs.COLOR_0):null;
  const indices=p.indices!=null?values(json,bin,p.indices).map(row=>row[0]):pos.map((_,i)=>i);
  const color=json.materials?.[p.material]?.pbrMetallicRoughness?.baseColorFactor||[.75,.70,.62,1];
  let chunk={positions:[],normals:[],colors:[],indices:[]};
  const flush=()=>{if(chunk.indices.length)chunks.push(chunk);chunk={positions:[],normals:[],colors:[],indices:[]};};
  for(let k=0;k+2<indices.length;k+=3){
   if(chunk.indices.length>=60000)flush();
   for(const idx of [indices[k],indices[k+1],indices[k+2]]){
    if(!pos[idx])throw Error("GLB index out of range");
    const xyz=pos[idx],n=normals?.[idx]||[0,1,0],c=colors?.[idx]||[1,1,1];
    const i=chunk.indices.length;chunk.indices.push(i);
    chunk.positions.push(...xyz);chunk.normals.push(...n.slice(0,3));
    chunk.colors.push(...[0,1,2].map(j=>Math.max(.02,Math.min(1,color[j]*(c[j]??1)))));
    for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],xyz[j]);hi[j]=Math.max(hi[j],xyz[j]);}
   }
  }flush();
 }
 if(!chunks.length)throw Error("GLB has no triangles");
 const scale=1.8/Math.max(.001,hi[1]-lo[1]),cx=(lo[0]+hi[0])/2,cz=(lo[2]+hi[2])/2;
 for(const c of chunks)for(let i=0;i<c.positions.length;i+=3){
  c.positions[i]=(c.positions[i]-cx)*scale;
  c.positions[i+1]=(c.positions[i+1]-lo[1])*scale;
  c.positions[i+2]=(c.positions[i+2]-cz)*scale;
 }
 return {chunks,triangles:chunks.reduce((s,c)=>s+c.indices.length/3,0),animations:(json.animations||[]).length};
}
const DB="frontier-3d-avatar-cache";
async function database(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("models"))req.result.createObjectStore("models");};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
export async function cachedFrontierGLB(sex,write=null){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction("models",write?"readwrite":"readonly");
  const req=write?tx.objectStore("models").put(write,sex):tx.objectStore("models").get(sex);
  req.onsuccess=()=>resolve(write||req.result||null);req.onerror=()=>reject(req.error);
 });}finally{db.close();}
}
/** Stable bundled avatars. Never implicitly read device-local imports. */
export const AVATAR_PACK_VERSION="ue-original-avatars-20261016";
export const STANDARD_AVATAR_URLS=Object.freeze({
 male:"../original-assets/models/pioneer.glb",
 female:"../original-assets/models/scout.glb"
});
export function standardAvatarURL(sex,quality="auto"){
 if(!Object.prototype.hasOwnProperty.call(STANDARD_AVATAR_URLS,sex))throw Error("Unknown avatar sex: "+sex);
 if(!["auto","high","mobile"].includes(quality))throw Error("Unknown avatar quality: "+quality);
 // Real high/mobile LOD pairs are not yet authored; both share one bundled mesh.
 return STANDARD_AVATAR_URLS[sex]+"?pack="+encodeURIComponent(AVATAR_PACK_VERSION);
}
/** Browser-local imported GLBs are only used after an explicit opt-in. */
export async function findFrontierGLB(sex,{source="standard",quality="auto",force=false}={}){
 if(!Object.prototype.hasOwnProperty.call(STANDARD_AVATAR_URLS,sex))throw Error("Unknown avatar sex: "+sex);
 if(source==="imported"){
  const buffer=await cachedFrontierGLB(sex);
  return buffer?{buffer,source:"imported",quality:"custom",version:"local"}:null;
 }
 if(source!=="standard")throw Error("Unknown avatar source: "+source);
 const url=standardAvatarURL(sex,quality);
 const response=await fetch(url,{cache:force?"reload":"default"});
 if(!response.ok)throw Error("標準GLBの取得失敗: HTTP "+response.status+" ("+sex+")");
 const buffer=await response.arrayBuffer();
 if(!buffer.byteLength)throw Error("標準GLBファイルが空です: "+sex);
 return {buffer,source:"standard",quality:"shared",version:AVATAR_PACK_VERSION,url};
}
