/** Medium offshore sailing vessel, procedural geometry only (no external GLB).
 * The helm is the origin; +Z points at the bow, deck lies at y≈1.65 m.
 * Rendering can switch between furled, reefed and full canvas cheaply.
 */
const bld=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(mesh,a,b,c,col){
 const u=b.map((q,i)=>q-a[i]),v=c.map((q,i)=>q-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const length=Math.hypot(...n)||1,k=mesh.positions.length/3;
 mesh.positions.push(...a,...b,...c);
 for(let i=0;i<3;i++){mesh.normals.push(...n.map(x=>x/length));mesh.colors.push(...col);}
 mesh.indices.push(k,k+1,k+2);
}
const quad=(m,a,b,c,d,col)=>{tri(m,a,b,c,col);tri(m,a,c,d,col);};
function box(m,x,y,z,halfX,height,halfZ,col){
 const a=[[x-halfX,y,z-halfZ],[x+halfX,y,z-halfZ],[x+halfX,y+height,z-halfZ],[x-halfX,y+height,z-halfZ],
  [x-halfX,y,z+halfZ],[x+halfX,y,z+halfZ],[x+halfX,y+height,z+halfZ],[x-halfX,y+height,z+halfZ]];
 for(const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[4,7,3,0]])
  quad(m,a[i],a[j],a[k],a[l],col);
}
function rope(m,a,b,col){
 const d=b.map((q,i)=>q-a[i]),length=Math.hypot(...d)||1;
 const steps=Math.ceil(length/.6);
 for(let i=0;i<steps;i++){
  const t=(i+.5)/steps,p=a.map((v,k)=>v+d[k]*t);
  box(m,p[0],p[1]-.18,p[2],.016,.36,.016,col);
 }
}
export function sailingShipGeometry(trim=1){
 const m=bld(),hull=[.39,.23,.13],dark=[.24,.17,.115],edge=[.55,.32,.17],
  deck=[.65,.44,.24],cloth=[.93,.90,.77],shadow=[.82,.81,.73],
  ropeColor=[.70,.61,.45],glass=[.21,.38,.45];
 const sections=[[-8.2,.75],[-6.3,1.80],[-3.5,2.25],[1.6,2.28],[5.7,1.56],[8.15,.30]];
 // An actual tapered hull rather than an elongated rectangular raft.
 for(let i=0;i<sections.length-1;i++){
  const [z0,w0]=sections[i],[z1,w1]=sections[i+1];
  for(const sign of [-1,1]){
   quad(m,[sign*w0,1.35,z0],[sign*w0*.70,-.53,z0],
    [sign*w1*.70,-.53,z1],[sign*w1,1.35,z1],hull);
   quad(m,[sign*w0,1.36,z0],[sign*w1,1.36,z1],
    [0,1.40,z1],[0,1.40,z0],deck);
   quad(m,[sign*w0,1.35,z0],[sign*w0,1.67,z0],
    [sign*w1,1.67,z1],[sign*w1,1.35,z1],edge);
  }
  quad(m,[-w0*.70,-.53,z0],[w0*.70,-.53,z0],
   [w1*.70,-.53,z1],[-w1*.70,-.53,z1],dark);
 }
 // A usable open deck, rails, aft cabin, wheel and rudder.
 for(const sign of [-1,1]){
  for(const z of [-6,-4,-2,0,2,4]){
   const w=z>2?1.72:2.18;
   box(m,sign*w,1.60,z,.07,.55,.07,edge);
  }
  box(m,sign*2.18,2.11,-1.7,.095,.11,4.62,edge);
  box(m,sign*1.29,2.18,-3.08,.065,.43,.53,glass);
 }
 box(m,0,1.45,-5.28,1.68,.16,2.38,deck);
 box(m,0,1.62,-3.07,1.29,1.20,1.23,dark);
 box(m,0,2.80,-3.07,1.42,.19,1.38,edge);
 box(m,0,1.56,-6.2,.09,.75,.09,edge);
 for(let i=0;i<10;i++){
  const ang=i*2*Math.PI/10;
  box(m,Math.sin(ang)*.50,2.31+Math.cos(ang)*.50,-6.28,.052,.10,.06,edge);
 }
 box(m,0,-.36,-7.92,.16,.83,.28,dark);
 // Tall main mast and shorter foremast with booms and a long bowsprit.
 box(m,0,1.39,-.92,.17,9.65,.17,edge);
 box(m,0,1.39,4.10,.14,6.60,.14,edge);
 box(m,0,3.04,7.13,.085,.13,3.73,edge);
 box(m,0,9.62,-.92,3.00,.12,.11,edge);
 box(m,0,6.02,-.92,2.82,.11,.11,edge);
 box(m,0,7.35,4.10,1.95,.12,.11,edge);
 const reef=Math.max(0,Math.min(1,Number.isFinite(trim)?trim:1));
 if(reef>.04){
  const mainH=5.45*reef,foreH=3.75*reef;
  for(const side of [-1,1]){
   quad(m,[-2.69,9.57-mainH,-.92+side*.05],[2.69,9.57-mainH,-.92+side*.05],
    [2.89,9.56,-.92+side*.05],[-2.89,9.56,-.92+side*.05],side<0?cloth:shadow);
   quad(m,[-1.79,7.30-foreH,4.11+side*.05],[1.79,7.30-foreH,4.11+side*.05],
    [1.97,7.30,4.11+side*.05],[-1.97,7.30,4.11+side*.05],side<0?cloth:shadow);
   tri(m,[0,7.34,4.12+side*.035],[0,3.19,7.92],[0,7.34-foreH,4.12+side*.035],cloth);
  }
 }else{
  box(m,0,9.51,-.94,2.94,.18,.16,cloth);
  box(m,0,7.22,4.10,2.01,.15,.12,cloth);
 }
 for(const z of [-.92,4.10])for(const sign of [-1,1])
  rope(m,[0,z<0?10.70:7.73,z],[sign*2.14,1.73,z-1.75],ropeColor);
 return m;
}
