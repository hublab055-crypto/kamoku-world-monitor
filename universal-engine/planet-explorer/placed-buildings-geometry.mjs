/** Local-space mesh primitives for user-placed stone walls and facilities. */
import {FACILITIES} from "./construction-system.mjs?v=0.8h-church";
import {OWNER_FACILITIES} from "./owner-world.mjs?v=0.8z-prefabs";
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(g,a,b,c,col){
 const u=b.map((v,i)=>v-a[i]),w=c.map((v,i)=>v-a[i]);
 const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
 const d=Math.hypot(...n)||1,at=g.positions.length/3;
 g.positions.push(...a,...b,...c);
 for(let i=0;i<3;i++){g.normals.push(...n.map(v=>v/d));g.colors.push(...col)}
 g.indices.push(at,at+1,at+2);
}
function face(g,a,b,c,d,col){triangle(g,a,b,c,col);triangle(g,a,c,d,col)}
function cuboid(g,x,y,z,rx,ry,rz,col){
 const a=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+ry,z-rz],[x-rx,y+ry,z-rz],
  [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+ry,z+rz],[x-rx,y+ry,z+rz]];
 for(const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[4,7,3,0]])
  face(g,a[i],a[j],a[k],a[l],col);
}
export function placedBuildingGeometry(kind){
 const g=fresh();
 if(kind==="stone-wall"){
  // Rough 2-metre coursed stonewall: each layer is part of a single mesh.
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const offset=(row%2)*.20;
   cuboid(g,-.78+col*.48+offset,row*.46,0,.23,.44,.29,
    row%2?[.53,.51,.48]:[.60,.58,.53]);
  }
  cuboid(g,0,1.84,0,1.05,.14,.40,[.37,.37,.35]);
  return g;
 }
 const config=FACILITIES[kind]||OWNER_FACILITIES[kind];
 if(!config)throw new RangeError("Unknown facility: "+kind);
 const c=config.color,w=config.footprint*.48,d=config.footprint*.38;
 const rock=[.54,.53,.50],trim=[.31,.22,.16],roof=[.29,.26,.28];
 cuboid(g,0,0,0,w+.35,.55,d+.35,rock);
 cuboid(g,0,.5,0,w,3.15,d,c);
 // Entrance and framed windows on +Z.
 cuboid(g,0,.51,d+.08,.70,2.30,.11,trim);
 for(const x of [-w*.56,w*.56]){
  cuboid(g,x,1.7,d+.09,.58,.93,.10,[.80,.72,.49]);
  cuboid(g,x,1.7,d+.14,.07,.93,.05,trim);
 }
 // Distinctive gabled roof.
 triangle(g,[-w-.4,3.65,-d-.38],[0,5.05,-d-.38],[w+.4,3.65,-d-.38],roof);
 triangle(g,[w+.4,3.65,d+.38],[0,5.05,d+.38],[-w-.4,3.65,d+.38],roof);
 face(g,[-w-.4,3.65,-d-.38],[-w-.4,3.65,d+.38],[0,5.05,d+.38],[0,5.05,-d-.38],roof);
 face(g,[0,5.05,-d-.38],[0,5.05,d+.38],[w+.4,3.65,d+.38],[w+.4,3.65,-d-.38],roof);
 // Store identity via colored entry sign rather than fragile text-on-3D.
 cuboid(g,0,3.12,d+.20,1.15,.42,.12,
  kind==="smithy"?[.62,.31,.17]:kind==="apothecary"?[.24,.66,.40]:
  kind==="bookshop"?[.27,.47,.77]:kind==="magic-shop"?[.69,.38,.82]:
  kind==="warehouse"?[.65,.56,.31]:[.76,.51,.25]);
 if(kind==="smithy")cuboid(g,w+.65,0,0,.52,2,.52,[.48,.47,.44]);
 if(kind==="warehouse")for(const x of [-w-.6,w+.6])cuboid(g,x,0,d+.5,.52,1,.52,[.47,.34,.22]);
 if(kind==="church"){
  cuboid(g,0,5.0,0,.12,2.5,.13,[.92,.84,.59]);
  cuboid(g,0,6.65,0,.64,.16,.14,[.92,.84,.59]);
 }
 if(kind==="market")for(let i=0;i<3;i++)cuboid(g,-w+i*w,0,d+1.35,.45,1.1,.4,[.60,.39,.23]);
 return g;
}
