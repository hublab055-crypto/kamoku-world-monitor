/** Low-poly, original observation tower and ambient townspeople.
 * One baked mesh each, so mobile WebGL2 does not issue a draw call per resident.
 */
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(b,a,c,d,color){
 const u=c.map((n,i)=>n-a[i]),v=d.map((n,i)=>n-a[i]);
 const q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const mag=Math.hypot(...q)||1,n=q.map(v=>v/mag),k=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...n,...n,...n);
 b.colors.push(...color,...color,...color);b.indices.push(k,k+1,k+2);
}
function quad(b,a,c,d,e,color){triangle(b,a,c,d,color);triangle(b,a,d,e,color);}
function block(b,x,y,z,w,h,d,color){
 const v=[[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
  [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
 for(const [a,c,e,f] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(b,v[a],v[c],v[e],v[f],color);
}
/** Prism between 3D endpoints. Sides have true normals for directional lighting. */
function strut(b,a,c,width,color){
 const dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2],mag=Math.hypot(dx,dy,dz)||1;
 const side=Math.hypot(dx,dz)>1e-5?[-dz/mag,0,dx/mag]:[1,0,0];
 const other=[dy*side[2]/mag-dz*side[1]/mag,
  dz*side[0]/mag-dx*side[2]/mag,
  dx*side[1]/mag-dy*side[0]/mag];
 const corners=(p)=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([u,v])=>
  p.map((n,i)=>n+width*(side[i]*u+other[i]*v)));
 const t=corners(a),e=corners(c);
 for(let i=0;i<4;i++)quad(b,t[i],t[(i+1)%4],e[(i+1)%4],e[i],color);
 quad(b,t[3],t[2],t[1],t[0],color);quad(b,e[0],e[1],e[2],e[3],color);
}
/** 108 m lattice tower inspired by a Japanese red-and-white observation tower. */
export function observationTowerGeometry({x=0,z=0,y=0}={}){
 const b=fresh(),red=[.91,.24,.15],white=[.92,.91,.85],grey=[.28,.36,.41];
 const levels=[0,12,24,36,48,60,72,84,94,102,108],widths=[22,20,16,12,9,7,5,3.8,2.5,1.1,.4];
 const corners=(h,w)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>[x+sx*w,y+h,z+sz*w]);
 for(let floor=0;floor<levels.length-1;floor++){
  const lower=corners(levels[floor],widths[floor]);
  const upper=corners(levels[floor+1],widths[floor+1]);
  const col=floor%3===1?white:red;
  for(let j=0;j<4;j++){
   strut(b,lower[j],upper[j],floor<6?.9:.5,col);
   strut(b,lower[j],lower[(j+1)%4],.42,col);
   const k=(j+1)%4;
   // Alternating diagonals and horizontal bracing form a visible truss.
   if(floor<8){
    strut(b,lower[j],upper[k],.28,col);
    strut(b,lower[k],upper[j],.24,col);
   }
  }
 }
 // Two contrasting observation platforms with railings.
 for(const [h,w] of [[60,8.5],[85,5.5]]){
  block(b,x,y+h,z,w,2.2,w,grey);
  block(b,x,y+h+2.3,z,w-1,1.1,w-1,[.57,.75,.79]);
  for(const sx of [-1,1])for(const sz of [-1,1])
   block(b,x+sx*(w-.4),y+h+3.4,z+sz*(w-.4),.18,1.5,.18,white);
 }
 block(b,x,y-.6,z,23,.65,23,[.49,.49,.46]);
 return b;
}
export function settlementResidentsGeometry(residents=[],heightAt=()=>0){
 const b=fresh(),cloth=[
  [.18,.36,.66],[.71,.29,.20],[.39,.55,.28],
  [.64,.50,.29],[.44,.32,.56],[.26,.52,.52]
 ];
 // Character-scale figures near shops, homes and village lanes.
 for(const p of residents){
  const x=p.localX??p.x,z=p.localZ??p.z,y=heightAt(x,z);
  const color=cloth[p.clothing%cloth.length],skin=[.78,.58,.43],hair=[.22,.16,.13];
  block(b,x,y+.85,z,.28,.9,.19,color);
  block(b,x,y+1.76,z,.23,.38,.23,skin);
  block(b,x,y+2.02,z,.25,.15,.25,hair);
  const step=p.id?.endsWith("1")||p.clothing%2===0?.15:-.10;
  block(b,x-.14,y+.04,z+step,.105,.8,.12,[.24,.24,.29]);
  block(b,x+.14,y+.04,z-step,.105,.8,.12,[.24,.24,.29]);
  block(b,x-.38,y+1.01,z,.10,.63,.12,skin);
  block(b,x+.38,y+1.05,z,.10,.59,.12,skin);
 }
 return b;
}
