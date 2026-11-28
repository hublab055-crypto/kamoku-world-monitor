import {MODELING_BENCH as B} from "./ship-modeling-bench.mjs";
import {xrShipLocalPoint} from "./ship-hotas-vr.mjs";
export const CAD_PALETTE=Object.freeze([
 ["XY","XY"],["XZ","XZ"],["YZ","YZ"],["datum","PLN"],["select","SEL"],
 ["line","-"],["circle","O"],["rect","BOX"],["trim","TR"],["extend","EX"],
 ["offset","OF"],["move","M"],["undo","U"],["redo","R"],["normal","N"],
 ["free","F"],["addExtrude","EXT"],["cutExtrude","CUT"],["addRevolve","REV"],["apply","OK"]
].map(([id,label],i)=>({id,label,x:B.x+(i%5-2)*.115,y:B.top+.55-Math.floor(i/5)*.115,z:B.z-.48})));
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const cadToShip=([x,y,z])=>[B.x+x*.001,B.top+B.datumHeight+z*.001,B.z-y*.001];
export const shipToCad=([x,y,z])=>[(x-B.x)*1000,(B.z-z)*1000,(y-B.top-B.datumHeight)*1000];
export function shipRay(matrix,stage){
 if(!matrix||matrix.length!==16)return null;
 const a=xrShipLocalPoint(matrix,stage),m=Array.from(matrix);
 for(let i=0;i<3;i++)m[12+i]-=matrix[8+i];
 const b=xrShipLocalPoint(m,stage);if(!a||!b)return null;
 const o=[a.x,a.y,a.z],d=sub([b.x,b.y,b.z],o),n=Math.hypot(...d);
 return n>1e-8?{o,d:d.map(x=>x/n)}:null;
}
export function paletteHit(ray){
 if(!ray||Math.abs(ray.d[2])<1e-8)return null;
 const t=(CAD_PALETTE[0].z-ray.o[2])/ray.d[2];if(t<.04||t>2.5)return null;
 const x=ray.o[0]+t*ray.d[0],y=ray.o[1]+t*ray.d[1];
 return CAD_PALETTE.find(p=>Math.abs(x-p.x)<.051&&Math.abs(y-p.y)<.051)||null;
}
export function planeHit(ray,plane){
 if(!ray||!plane)return null;
 const o=shipToCad(ray.o),d=[ray.d[0],-ray.d[2],ray.d[1]],den=dot(d,plane.n);
 if(Math.abs(den)<1e-7)return null;
 const t=dot(sub(plane.o,o),plane.n)/den;if(t<40||t>2500)return null;
 const q=sub(o.map((x,i)=>x+t*d[i]),plane.o),u=dot(q,plane.u),v=dot(q,plane.v);
 return Math.abs(u)<=600&&Math.abs(v)<=600?{u,v}:null;
}
export function validSpatialState(s){
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6);
 return !!s&&s.plane&&["o","u","v","n"].every(k=>vec(s.plane[k]))&&Array.isArray(s.lines)&&s.lines.length<=1600&&s.lines.every(l=>Array.isArray(l)&&l.length===2&&l.every(vec));
}
