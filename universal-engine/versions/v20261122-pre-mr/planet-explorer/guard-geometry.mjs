/** Original low-poly guard, knight and outpost geometry for WebGL2.
 * Same non-indexed colored-mesh contract as settlement-geometry.mjs.
 * Phase-specific meshes are shared by all guards (no per-frame GPU allocation).
 */
const make=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(b,a,c,d,color){
 const u=c.map((n,i)=>n-a[i]),v=d.map((n,i)=>n-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const mag=Math.hypot(...n)||1,norm=n.map(q=>q/mag),i=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...norm,...norm,...norm);
 b.colors.push(...color,...color,...color);b.indices.push(i,i+1,i+2);
}
function quad(b,a,c,d,e,color){tri(b,a,c,d,color);tri(b,a,d,e,color);}
function block(b,x,y,z,w,h,d,col){
 // Half widths and depth, base-aligned height. All dimensions are meters.
 const v=[[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
  [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
 for(const [a,c,e,f] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(b,v[a],v[c],v[e],v[f],col);
}
function roof(b,x,y,z,r=1.5,c=[.27,.33,.39]){
 const top=[x,y+1.2,z],corners=[[x-r,y,z-r],[x+r,y,z-r],[x+r,y,z+r],[x-r,y,z+r]];
 for(let i=0;i<4;i++)tri(b,corners[i],corners[(i+1)%4],top,c);
}
const COLORS=Object.freeze({
 guard:{coat:[.13,.27,.48],trim:[.78,.69,.29],steel:[.66,.73,.77],dark:[.16,.20,.24],shield:[.15,.32,.49]},
 knight:{coat:[.39,.23,.31],trim:[.89,.69,.33],steel:[.80,.85,.88],dark:[.22,.24,.28],shield:[.48,.26,.31]}
});
/** `phase` ranges 0-3 and is chosen using the guard's recorded walk distance.
 * Guard weapon is held, raised for attack, or relaxed for patrol.
 */
export function guardGeometry(kind="guard",phase=0,{hostile=false}={}){
 const b=make(),c=COLORS[kind==="knight"?"knight":"guard"],walk=Number(phase)%4;
 const stride=[0,.19,0,-.19][(walk+4)%4],left=-stride,right=stride;
 const skin=[.78,.62,.49];
 // Boots and visibly alternating marching limbs.
 for(const [side,zstep] of [[-1,left],[1,right]]){
  block(b,side*.19,.08+Math.max(0,zstep)*.12,zstep*.7,.135,.73,.16,c.dark);
  block(b,side*.19,.02,zstep*.7+.08,.17,.16,.25,c.dark);
 }
 block(b,0,.74,0,.34,.77,.23,c.coat);
 block(b,0,.87,.248,.31,.055,.04,c.trim);
 block(b,0,1.40,0,.38,.18,.26,c.steel);
 block(b,0,1.52,0,.25,.36,.22,skin);
 block(b,0,1.87,-.015,.31,.20,.29,c.steel);
 block(b,0,2.02,-.015,.20,.10,.20,c.dark);
 for(const sx of [-1,1]){
  block(b,sx*.17,1.72,.217,.04,.04,.032,[.13,.18,.19]);
 }
 block(b,0,1.55,.245,.20,.055,.05,c.dark);
 // Distinct bracers, shield on left, spear/sword in right.
 block(b,-.45,1.0,-.02,.13,.67,.145,c.coat);
 block(b,-.45,.94,.14,.17,.20,.14,c.steel);
 block(b,.45,1.0,stride*.23,.13,.67,.145,c.coat);
 block(b,.45,.95,stride*.23,.18,.15,.14,c.steel);
 block(b,-.60,.79,.21,.24,.57,.08,c.shield);
 block(b,-.60,1.22,.29,.25,.07,.09,c.trim);
 block(b,-.60,.89,.30,.13,.23,.09,c.steel);
 if(kind==="knight"){
  block(b,.52,.25,.22,.042,1.80,.052,c.dark);
  block(b,.52,1.88,.22,.14,.52,.07,c.steel);
  block(b,.52,.63,.29,.22,.06,.14,c.trim);
  block(b,0,.78,-.25,.31,.73,.09,c.shield); // cape
 }else{
  const rise=hostile?.25:0;
  block(b,.52,.24+rise,.20,.047,1.65,.047,[.48,.34,.18]);
  block(b,.52,1.86+rise,.20,.10,.37,.09,c.steel);
  block(b,.52,2.19+rise,.20,.16,.10,.09,c.steel);
 }
 return b;
}
/** Physical structure at the persistent spawn/return point.
 * Conquest changes banner color while preserving identical collision footprint.
 */
export function guardPostGeometry({occupied=false}={}){
 const b=make(),stone=[.46,.49,.50],wood=[.35,.25,.15],roofCol=[.22,.29,.36],
 banner=occupied?[.23,.61,.32]:[.60,.21,.22];
 block(b,0,-.06,0,3.4,.28,3.4,stone);
 for(const x of [-2.7,2.7])for(const z of [-2.7,2.7])
  block(b,x,.15,z,.38,3.2,.38,stone);
 for(const z of [-2.7,2.7])block(b,0,.15,z,2.7,1.55,.28,stone);
 for(const x of [-2.7,2.7])block(b,x,.15,0,.28,1.55,2.7,stone);
 roof(b,0,3.24,0,3.1,roofCol);
 block(b,0,.10,2.58,.75,1.48,.19,wood); // post door
 block(b,0,1.95,2.65,.25,.35,.09,[.75,.78,.79]);
 block(b,0,3.86,0,.07,2.0,.07,wood);
 block(b,.57,4.95,0,.57,.52,.035,banner);
 return b;
}
