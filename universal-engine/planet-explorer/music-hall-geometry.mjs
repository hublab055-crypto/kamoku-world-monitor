/** Low-poly theater and classroom interiors; rooms share town interior XYZ frame. */
import {hallRoom,hallSeats} from "./music-hall.mjs?v=0.9ap";
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(g,a,b,c,color){
 const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const len=Math.hypot(...n)||1,i=g.positions.length/3;
 for(const p of [a,b,c]){g.positions.push(...p);g.normals.push(...n.map(x=>x/len));g.colors.push(...color);}
 g.indices.push(i,i+1,i+2);
}
const quad=(g,a,b,c,d,color)=>{triangle(g,a,b,c,color);triangle(g,a,c,d,color);};
function block(g,x,y,z,halfX,height,halfZ,color){
 const v=[[x-halfX,y,z-halfZ],[x+halfX,y,z-halfZ],[x+halfX,y+height,z-halfZ],[x-halfX,y+height,z-halfZ],
  [x-halfX,y,z+halfZ],[x+halfX,y,z+halfZ],[x+halfX,y+height,z+halfZ],[x-halfX,y+height,z+halfZ]];
 for(const [i,j,k,l]of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])quad(g,v[i],v[j],v[k],v[l],color);
}
export function musicHallInteriorGeometry(kind,{furnishingsOnly=false}={}){
 const room=hallRoom(kind);
 if(!room)throw Error("音楽室の種類が不正です");
 const g=fresh(),w=room.halfWidth,z0=room.zMin,z1=room.zMax;
 const timber=[.32,.22,.18],wall=[.61,.55,.48],floor=[.38,.28,.23];
 const height=kind==="theater"?6.4:4.5;
 // The full-room path remains supported, but the shared world uses only furniture.
 // Ground-side building walls and roof are drawn by the planet renderer.
 if(!furnishingsOnly){
 block(g,0,-.25,(z0+z1)*.5,w,.30,(z1-z0)/2,floor);
 block(g,-w+.17,0,(z0+z1)/2,.22,height,(z1-z0)/2,wall);
 block(g,w-.17,0,(z0+z1)/2,.22,height,(z1-z0)/2,wall);
 block(g,0,0,z0+.16,w,height,.19,wall);
 for(const x of [-w+1.3,w-1.3]){
  block(g,x,2.25,z0+.39,.70,1.25,.03,[.30,.48,.53]);
  block(g,x,2.25,z0+.48,.05,1.30,.05,timber);
 }
 }
 if(furnishingsOnly)block(g,0,.02,(z0+z1)*.5,w-.18,.10,(z1-z0)/2-.18,floor);
 if(kind==="theater"){
  // Raised music stage, side curtains, proscenium arch and house lights.
  block(g,0,0,-7.7,w-1.3,.64,2.2,[.43,.27,.17]);
  block(g,0,.65,-9.65,w-1.3,5,.16,[.13,.14,.20]);
  for(const x of [-w+1.0,w-1.0]){
   block(g,x,.56,-8.05,.72,4.8,2.0,[.53,.12,.19]);
   block(g,x,4.65,-6.6,.44,.70,.5,[.79,.65,.35]);
  }
  block(g,0,4.7,-6.9,w-1.3,.55,.25,[.61,.30,.14]);
  for(const x of [-w+2.0,0,w-2.0])block(g,x,5.0,-6.8,.30,.32,.30,[.98,.85,.43]);
  for(const seat of hallSeats("theater")){
   block(g,seat.x,.05,seat.z,.69,.48,.54,[.31,.20,.15]);
   block(g,seat.x,.48,seat.z-.48,.68,.95,.16,[.53,.27,.24]);
   block(g,seat.x-.60,.36,seat.z,.10,.33,.53,timber);
   block(g,seat.x+.60,.36,seat.z,.10,.33,.53,timber);
  }
 }else{
  // Classroom front board, music practice keyboard, chairs and work desks.
  block(g,0,.94,-5.9,3.3,1.80,.12,[.17,.30,.28]);
  block(g,0,2.75,-5.8,3.55,.17,.25,timber);
  for(let i=0;i<5;i++)block(g,-2.4+i*1.2,1.65,-5.65,.07,.06,.055,[.89,.88,.76]);
  block(g,0,0,-3.6,2.0,1.03,.75,[.27,.25,.24]);
  for(let i=0;i<9;i++)block(g,-1.7+i*.42,1.03,-3.13,.18,.045,.25,[.88,.86,.78]);
  for(const seat of hallSeats("school")){
   block(g,seat.x,0,seat.z,.50,.47,.47,[.38,.26,.15]);
   block(g,seat.x,.46,seat.z-.42,.52,.70,.15,timber);
  }
  block(g,0,3.65,0,1.1,.12,.46,[.93,.81,.57]);
 }
 // Exit marker belongs to the interior wall only, not to the floor furniture mesh.
 if(!furnishingsOnly){
 block(g,0,3.20,z1-.22,1.05,.33,.14,[.31,.63,.47]);
 for(const x of [-w+1,w-1])block(g,x,.4,z1-.55,.08,2.7,.15,timber);
 }
 return g;
}
