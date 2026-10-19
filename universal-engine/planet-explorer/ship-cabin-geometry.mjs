/** Cutaway interior of the medium sailship; deck-relative, +Z to bow.
 * Kept as a separate mesh so the outer hull can be hidden while inside.
 */
const geometry=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(m,a,b,c,col){
 const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const norm=Math.hypot(...n)||1,k=m.positions.length/3;
 m.positions.push(...a,...b,...c);
 for(let i=0;i<3;i++){m.normals.push(...n.map(x=>x/norm));m.colors.push(...col);}
 m.indices.push(k,k+1,k+2);
}
function quad(m,a,b,c,d,col){triangle(m,a,b,c,col);triangle(m,a,c,d,col);}
function box(m,x,y,z,rx,h,rz,col){
 const points=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+h,z-rz],[x-rx,y+h,z-rz],
 [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+h,z+rz],[x-rx,y+h,z+rz]];
 for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[4,7,3,0]])
  quad(m,points[a],points[b],points[c],points[d],col);
}
export const CABIN_FURNITURE=Object.freeze([
 {kind:"bed",x:-1.12,z:-1.40,yaw:0},
 {kind:"chair",x:.82,z:.89,yaw:Math.PI},
 {kind:"table",x:.08,z:.72,yaw:0},
 {kind:"bookshelf",x:1.15,z:-1.44,yaw:0},
 {kind:"lamp",x:-.05,z:-1.79,yaw:0}
]);
export function shipCabinGeometry(){
 const m=geometry(),dark=[.29,.18,.12],wood=[.56,.34,.18],
  pale=[.79,.62,.37],iron=[.42,.50,.53],rug=[.26,.48,.45],glass=[.19,.46,.59],
  door=[.42,.25,.13];
 // Hull ceiling deliberately open to keep furniture visible from the cabin camera.
 box(m,0,0,0,2.05,.20,2.55,dark);
 for(let x=-1.65;x<=1.65;x+=.55)box(m,x,.20,0,.016,.055,2.47,pale);
 box(m,0,.25,.35,1.12,.029,1.21,rug);
 box(m,0,.24,-2.40,2.03,2.26,.085,wood);
 // Half-height walls, portholes with colour detail.
 for(const side of [-1,1]){
  box(m,side*2.0,.25,0,.10,1.77,2.52,wood);
  box(m,side*1.89,1.26,-.77,.035,.38,.38,iron);
  box(m,side*1.84,1.32,-.77,.04,.25,.25,glass);
  box(m,side*1.89,1.26,1.29,.035,.38,.38,iron);
  box(m,side*1.84,1.32,1.29,.04,.25,.25,glass);
 }
 box(m,0,.23,2.44,1.9,1.24,.07,wood);
 box(m,-1.00,.23,2.44,.86,1.84,.075,wood);
 box(m,1.08,.23,2.44,.77,1.84,.075,wood);
 box(m,0,1.95,2.45,.54,.12,.075,pale);
 box(m,0,.23,2.44,.52,.05,.08,door);
 box(m,0,.32,2.46,.043,1.53,.065,door);
 // Structural ribs and overhead beams.
 for(const z of [-2.15,0,2.18]){
  box(m,-1.83,.25,z,.055,2.1,.06,pale);
  box(m,1.83,.25,z,.055,2.1,.06,pale);
  box(m,0,2.3,z,1.9,.10,.08,dark);
 }
 box(m,0,2.37,-.10,.07,.40,.07,pale);
 box(m,0,2.78,-.10,.33,.13,.30,pale);
 return m;
}
