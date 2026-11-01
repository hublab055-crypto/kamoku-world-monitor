import {sharedShipInteriorGeometry} from "./ship-shared-scene.mjs?v=6";
import {CABIN_FLOOR_M} from "./starship-layout.mjs";
/** Procedural reusable exterior mesh; forward is local -Z and rear hatch is at +13m. */
const unit=v=>{const l=Math.hypot(...v)||1;return v.map(n=>n/l);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const builder=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(g,a,b,c,color){
 const n=unit(cross(sub(b,a),sub(c,a))),k=g.positions.length/3;
 g.positions.push(...a,...b,...c);g.normals.push(...n,...n,...n);
 g.colors.push(...color,...color,...color);g.indices.push(k,k+1,k+2);
}
function quad(g,a,b,c,d,col){tri(g,a,b,c,col);tri(g,a,c,d,col);}
function box(g,x,y,z,rx,h,rz,col){
 const p=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+h,z-rz],[x-rx,y+h,z-rz],
 [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+h,z+rz],[x-rx,y+h,z+rz]];
 for(const [a,b,c,d] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(g,p[a],p[b],p[c],p[d],col);
}
export function spacecraftGroundGeometry(open=false){
 // The exterior and visible cabin share the same hollow pressure hull. No
 // solid box or central engine may fill the rear doorway or cockpit view.
 const cabin=sharedShipInteriorGeometry(open);
 const g={positions:cabin.positions.map((v,i)=>i%3===1?v+CABIN_FLOOR_M:v),
  normals:[...cabin.normals],colors:[...cabin.colors],indices:[...cabin.indices]};
 const hull=[.44,.56,.63],dark=[.075,.12,.17],frame=[.20,.32,.42],light=[.21,.86,.90];
 for(const side of [-1,1]){
  tri(g,[side*4.2,3.2,-4],[side*8,3,4],[side*4.1,3,9],hull);
  tri(g,[side*4.1,3,9],[side*8,3,4],[side*4.2,3.2,-4],hull);
  for(const z of [-9,8]){
   box(g,side*2.65,0,z,.35,1.9,.35,frame);
   box(g,side*3.3,.12,z,1.15,.22,1,dark);
  }
  box(g,side*5,2.8,10.8,.7,1.6,1.5,dark);
  box(g,side*5,3.28,12.35,.6,.65,.17,light);
  box(g,side*4.25,5.1,-7,.08,.16,2,light);
 }
 return g;
}
