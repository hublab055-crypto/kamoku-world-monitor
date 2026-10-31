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
 const g=builder(),hull=[.44,.56,.63],dark=[.075,.12,.17],frame=[.20,.32,.42],
  light=[.21,.86,.90],yellow=[.98,.72,.23],glass=[.07,.29,.46],ramp=[.27,.35,.42];
 // Flight deck, tapered nose and broad engine block
 box(g,0,2.0,0,3.55,3.1,11.7,hull);
 box(g,0,2.3,-9.9,2.85,2.6,3.6,hull);
 for(let side of [-1,1]){
  box(g,side*2.7,4.2,-9.6,.31,1.10,2.9,glass);
  box(g,side*2.2,2.6,-13.4,.32,1.2,.22,frame);
  box(g,side*3.55,3.6,0,.14,1.2,9.5,frame);
  // Delta wing in plan (triangular aerodynamic profile).
  const s=side;
  tri(g,[s*3.2,3.2,-4],[s*8.0,3.0,4],[s*3.1,3.0,9],hull);
  tri(g,[s*3.1,3.0,9],[s*8.0,3.0,4],[s*3.2,3.2,-4],hull);
  for(const z of [-9.0,8.0]){
   box(g,side*2.65,0,z,.45,2.3,.43,frame);
   box(g,side*3.3,.12,z,1.15,.22,1.0,dark);
  }
  box(g,side*2.4,3.9,-11.1,.20,.20,1.55,light);
 }
 box(g,0,4.0,-13.5,4.3,1.7,.6,hull);
 box(g,0,5.17,-10.9,4.0,.24,3.0,glass);
 box(g,0,5.25,0,1.2,.26,8.5,frame);
 // Rear engines
 for(const x of [-2.15,0,2.15]){
  box(g,x,2.8,11.93,.88,1.6,1.5,dark);
  box(g,x,3.28,13.45,.62,.65,.17,light);
 }
 // Hatch frame and interior passage (closed/open geometry variants).
 box(g,-1.42,2.05,12.08,.18,2.25,.17,frame);
 box(g,1.42,2.05,12.08,.18,2.25,.17,frame);
 box(g,0,4.11,12.08,1.38,.22,.17,frame);
 if(!open){
  box(g,0,2.16,12.29,1.24,2.02,.20,dark);
  box(g,0,3.0,12.51,.34,.15,.045,yellow);
 }else{
  box(g,0,2.12,12.3,1.15,.16,.25,frame);
  // Docking ramp slopes down to ground approximately at +17 metres.
  tri(g,[-1.25,2.15,12.3],[1.25,2.15,12.3],[1.25,.12,17.6],ramp);
  tri(g,[-1.25,2.15,12.3],[1.25,.12,17.6],[-1.25,.12,17.6],ramp);
  for(const x of [-1.2,1.2])box(g,x,.28,15.4,.05,.19,2.7,yellow);
 }
 return g;
}
