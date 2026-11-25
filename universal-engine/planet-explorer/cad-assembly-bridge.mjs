/** Bridge from Universal CAD assembly JSON into the game's AssetDocument v2.
 * The game's primitive renderer has no holes/B-rep or feature history.
 * Keep the source document separately and explicitly label this as visual proxy geometry.
 */
import {AssetStudioModel} from "./asset-studio-model.mjs?v=0.9c-asset-v2";

export const CAD_TRANSFER_KEY="universal-engine:cad-assembly:transfer:v1";
const finite=Number.isFinite;
const allowed=new Set(["plate","block","shaft","gear","bolt","assembly"]);
const primitive={plate:"cube",block:"cube",shaft:"cylinder",gear:"cylinder",bolt:"cylinder"};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const trim=(x,len=40)=>String(x??"").slice(0,len);
function rotate(v,deg){
 let [x,y,z]=v;const [rx,ry,rz]=deg.map(a=>a*Math.PI/180);
 let a=y*Math.cos(rx)-z*Math.sin(rx),b=y*Math.sin(rx)+z*Math.cos(rx);y=a;z=b;
 a=x*Math.cos(ry)+z*Math.sin(ry);b=-x*Math.sin(ry)+z*Math.cos(ry);x=a;z=b;
 return [x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz),z];
}
const rgb=h=>{
 const s=typeof h==="string"&&/^#[0-9a-fA-F]{6}$/.test(h)?h:"#539dd0";
 return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
};
export function cadAssemblyToAssetDocument(source){
 if(!source||!["UE-assembly-v1","UE-assembly-v2"].includes(source.format)||
    source.units!=="mm"||!Array.isArray(source.objects)||source.objects.length<1||source.objects.length>100)
  throw Error("UE-assembly-v1/v2 のmm単位JSONを選んでください");
 const objects=source.objects;
 if(objects.some(o=>!o||typeof o.id!=="string"||o.id.length>80||!allowed.has(o.kind)||
  !Array.isArray(o.pos)||o.pos.length!==3||!Array.isArray(o.rot)||o.rot.length!==3||
  !Array.isArray(o.size)||o.size.length!==3||
  ![...o.pos,...o.rot,...o.size].every(n=>finite(n)&&Math.abs(n)<1e7)||
  o.size.some(n=>n<=0)||o.parent!==null&&o.parent!==undefined&&typeof o.parent!=="string"))
  throw Error("部品寸法・座標が不正です");
 const ids=new Set(objects.map(o=>o.id));
 if(ids.size!==objects.length||objects.some(o=>o.parent&&!ids.has(o.parent)))throw Error("部品階層が不正です");
 const byId=new Map(objects.map(o=>[o.id,o]));
 // Resolve the source's hierarchical translations in millimetres. Euler angles are approximated for display.
 const transformCache=new Map();
 function world(o,visiting=new Set()){
  if(transformCache.has(o.id))return transformCache.get(o.id);
  if(visiting.has(o.id))throw Error("部品階層が循環しています");
  visiting.add(o.id);
  const parent=o.parent?world(byId.get(o.parent),visiting):null;
  const p=parent?rotate(o.pos,parent.rot).map((v,i)=>v+parent.pos[i]):[...o.pos];
  const rot=parent?o.rot.map((v,i)=>v+parent.rot[i]):[...o.rot];
  visiting.delete(o.id);
  const t={pos:p,rot};transformCache.set(o.id,t);return t;
 }
 const realParts=objects.filter(o=>o.kind!=="assembly");
 if(!realParts.length||realParts.length>96)throw Error("変換可能な部品数は1〜96個です");
 const minDim=Math.min(...realParts.flatMap(o=>o.size.filter(n=>n>0)));
 const maxDim=Math.max(...realParts.flatMap(o=>o.size));
 // Gameplay's editable primitives must have >= 0.1m dimensions, even for an M6 bolt.
 // Scale the assembly proportionally as a *game visualization*, never as exact CAD.
 const scale=clamp(Math.max(0.001,0.102/minDim),0.001,200/Math.max(maxDim,1));
 const centers=realParts.map(o=>world(o).pos);
 const origin=[0,1,2].map(i=>centers.reduce((s,p)=>s+p[i],0)/centers.length);
 const nodes=realParts.map((o,index)=>{
  const t=world(o);
  // CAD Z is up. Studio X/Y are ground coordinates, Studio Z is up.
  const height=Math.max(.1,o.size[2]*scale),width=Math.max(.1,o.size[0]*scale),depth=Math.max(.1,o.size[1]*scale);
  const pos=t.pos.map((v,i)=>clamp((v-origin[i])*scale,-499,499));
  return {id:index+1,type:"primitive",name:trim(o.name||o.id),
   parentId:null,group:trim(o.parent||"CAD"),transform:{
    position:{x:pos[0],y:pos[1],z:pos[2]},rotation:{x:t.rot[0]*Math.PI/180,y:t.rot[1]*Math.PI/180,z:t.rot[2]*Math.PI/180},
    pivot:{x:0,y:0,z:0}},
   geometry:{shape:primitive[o.kind],size:{x:width,y:depth,z:height}},
   material:{baseColor:rgb(o.color)},sockets:[]};
 });
 const document={format:"ue/asset-document",version:2,
  meta:{name:"CAD Assembly Preview",assetType:"machine",units:"m"},workspace:{planeZ:0},nodes};
 // Invoke the canonical validator now, not later when a user tries to save.
 const model=new AssetStudioModel(document);
 return {document:model.snapshot(),scale,converted:realParts.length,
  note:"CAD部品のゲーム用プレビュー変換です。穴・切欠き・B-rep・組立拘束は変換されません。元JSONを保管してください。"};
}
