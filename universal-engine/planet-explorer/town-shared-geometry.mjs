/** Town interiors drawn by the same WebGL view-projection as the street. */
import {sharedRoom} from "./town-shared-world.mjs?v=0.9at";
const make=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(g,a,b,c,col){
 const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const size=Math.hypot(...n)||1,start=g.positions.length/3;
 for(const p of [a,b,c]){g.positions.push(...p);g.normals.push(...n.map(x=>x/size));g.colors.push(...col);}
 g.indices.push(start,start+1,start+2);
}
function box(g,x,y,z,w,h,d,col){
 const v=[[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
 [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
 for(const [a,b,c,d] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]]){
  tri(g,v[a],v[b],v[c],col);tri(g,v[a],v[c],v[d],col);
 }
}
export function sharedTownFurnitureGeometry(type){
 const r=sharedRoom(type);if(!r)throw Error("Unsupported town room");
 const g=make(),wood=[.41,.28,.18],pale=[.75,.60,.38],stone=[.50,.48,.43];
 box(g,0,.03,0,r.halfX-.20,.11,r.halfZ-.20,[.53,.41,.29]);
 if(type==="cabin"){
  box(g,-2.0,.11,-1.8,1.0,.50,.90,wood);
  box(g,-2.0,.61,-1.8,.95,.14,.82,[.80,.72,.57]);
  box(g,1.45,.11,-.6,.95,.96,.80,wood);
  box(g,1.45,1.07,-.6,1.02,.10,.84,pale);
  box(g,2.6,.11,1.9,.44,.62,.48,wood);
  box(g,-2.9,.11,1.2,.36,2.1,.45,wood);
 }else if(type==="lodge"){
  box(g,0,.11,-3.3,4.6,.8,.80,wood); // counter against rear wall
  box(g,0,.91,-3.3,4.6,.16,.82,pale);
  for(const x of [-2.7,2.65]){
   box(g,x,.11,-1.45,1.0,.88,.80,wood);
   box(g,x,.99,-1.45,1.07,.12,.90,pale);
   for(const z of [-.2,.2])box(g,x,.11,z+.25,.45,.54,.43,wood);
  }
  for(const x of [-4.5,0,4.5])box(g,x,.12,2.65,.55,.83,.5,wood);
 }else if(type==="workshop"){
  for(const [x,z] of [[-2.4,-1.5],[2.2,-2]]){
   box(g,x,.11,z,1.2,1.05,.72,wood);
   box(g,x,1.16,z,1.26,.13,.80,stone);
  }
  for(let i=0;i<5;i++)box(g,-4+i*1.65,.11,2.5,.55,.75,.44,pale);
  box(g,3.7,1.20,3.6,.16,1.55,.15,[.34,.41,.47]);
 }else if(type==="granary"){
  for(const x of [-2.4,2.4])for(let i=0;i<3;i++)
   box(g,x,.11+i*.55,-1.6,.75,.48,.9,[.67,.54,.31]);
  box(g,0,.11,-2,.66,1.1,.66,wood);
 }else if(type==="stable"||type==="barn"){
  for(const x of [-3.5,3.5]){
   box(g,x,.11,-1.6,1.15,1.25,1.0,wood);
   box(g,x,1.25,-1.6,1.18,.12,1.03,pale);
  }
  for(const x of [-5,5])box(g,x,.11,2.0,.24,1.1,2.1,wood);
 }
 // Lamp near rear wall, visible from the street when the door opens.
 box(g,0,2.8,-r.halfZ+.65,.23,.48,.20,[.96,.79,.40]);
 return g;
}
