// Compact normalized CAD quads. A CAD Z-up model maps to game Y-up.
export const MAX_CAD_FACES=10000;
export function validCadMesh(data){
 return typeof data==="string"&&data.length>0&&data.length<=MAX_CAD_FACES*32&&data.length%32===0&&/^[A-Za-z0-9+/]+$/.test(data);
}
export function packCadMesh(faces){
 if(!Array.isArray(faces)||!faces.length||faces.length>MAX_CAD_FACES)throw Error("3D形状が空か表面が多すぎます。メッシュ分割数を下げてください（最大10000面）");
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const f of faces){if(!Array.isArray(f.vertices)||f.vertices.length!==4)throw Error("CAD面が不正です");
  for(const p of f.vertices){if(!Array.isArray(p)||p.length!==3||!p.every(v=>Number.isFinite(v)&&Math.abs(v)<1e7))throw Error("CAD頂点が不正です");
   for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}}}
 const span=max.map((v,i)=>v-min[i]);if(span.some(v=>v<=0))throw Error("厚みのあるソリッドを作成してください");
 const scale=.001;
 if(Math.min(...span)*scale<.001)throw Error("ゲーム最小寸法1mm未満です");
 if(Math.max(...span)*scale>200)throw Error("ゲームで扱える寸法範囲を超えています");
 const bytes=new Uint8Array(faces.length*24),view=new DataView(bytes.buffer);let k=0;
 for(const f of faces)for(const p of f.vertices){
  const q=[(p[0]-min[0])/span[0],(p[2]-min[2])/span[2],(max[1]-p[1])/span[1]];
  for(const v of q){view.setUint16(k,Math.round(v*65535),true);k+=2;}}
 let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {mesh:btoa(binary),width:span[0]*scale,height:span[2]*scale,depth:span[1]*scale,scale};
}
export function cadMeshGeometry(data){
 if(!validCadMesh(data))throw Error("CADメッシュが不正です");
 const str=atob(data),bytes=Uint8Array.from(str,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
 const b={positions:[],normals:[],colors:[],indices:[]};
 for(let k=0;k<bytes.length;k+=24){
  const p=Array.from({length:4},(_,i)=>[view.getUint16(k+i*6,true)/65535-.5,view.getUint16(k+i*6+2,true)/65535,view.getUint16(k+i*6+4,true)/65535-.5]);
  for(const [a,c,d] of [[p[0],p[1],p[2]],[p[0],p[2],p[3]]]){
   const u=c.map((v,i)=>v-a[i]),v=d.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);
   if(l<1e-12)continue;const idx=b.positions.length/3,normal=n.map(x=>x/l);
   b.positions.push(...a,...c,...d);b.normals.push(...normal,...normal,...normal);b.colors.push(1,1,1,1,1,1,1,1,1);b.indices.push(idx,idx+1,idx+2);
  }
 }
 if(!b.indices.length)throw Error("描画できるCAD面がありません");return b;
}
