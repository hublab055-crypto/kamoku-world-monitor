// Polygonal machining mesh, millimetres, Y is tool axis. No texture-only holes.
const ring=(x,z,r,n=24)=>Array.from({length:n},(_,i)=>[x+r*Math.cos(i*2*Math.PI/n),z+r*Math.sin(i*2*Math.PI/n)]);
export const thickness=p=>p.shape==="round"?p.l:p.d;
export function workshopMesh(p){
 const t=thickness(p),outer=p.shape==="round"?ring(0,0,p.d/2,40):[[-p.w/2,-p.l/2],[p.w/2,-p.l/2],[p.w/2,p.l/2],[-p.w/2,p.l/2]];
 const holes=p.holes.map(h=>({...h,poly:ring(h.x,h.y,h.d/2)})),b={positions:[],normals:[],colors:[],indices:[]};
 function tri(a,c,d,desired){let u=c.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);if(len<1e-12)return;if(n.reduce((s,x,i)=>s+x*desired[i],0)<0){[c,d]=[d,c];n=n.map(x=>-x);}n=n.map(x=>x/len);const i=b.positions.length/3;b.positions.push(...a,...c,...d);b.normals.push(...n,...n,...n);b.colors.push(1,1,1,1,1,1,1,1,1);b.indices.push(i,i+1,i+2);}
 const pt=(x,z,y)=>[x,y,z];
 function cap(boundaries,y,sign){
  const xs=[...new Set(boundaries.flat().map(v=>v[0]))].sort((a,b)=>a-b),edges=boundaries.flatMap(poly=>poly.map((v,i)=>[v,poly[(i+1)%poly.length]]));
  for(let i=1;i<xs.length;i++){const l=xs[i-1],r=xs[i];if(r-l<1e-10)continue;const mid=(l+r)/2;
   const crossing=edges.filter(([a,c])=>mid>Math.min(a[0],c[0])&&mid<Math.max(a[0],c[0])).map(([a,c])=>{const z=x=>a[1]+(c[1]-a[1])*(x-a[0])/(c[0]-a[0]);return {l:z(l),r:z(r),mid:z(mid)};}).sort((a,b)=>a.mid-b.mid);
   for(let j=0;j+1<crossing.length;j+=2){const a=crossing[j],c=crossing[j+1],v=[pt(l,a.l,y),pt(r,a.r,y),pt(r,c.r,y),pt(l,c.l,y)];tri(v[0],v[1],v[2],[0,sign,0]);tri(v[0],v[2],v[3],[0,sign,0]);}
  }
 }
 function wall(poly,lo,hi,sign){for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],n=[sign*(c[1]-a[1]),0,-sign*(c[0]-a[0])];const v=[pt(...a,lo),pt(...c,lo),pt(...c,hi),pt(...a,hi)];tri(v[0],v[1],v[2],n);tri(v[0],v[2],v[3],n);}}
 cap([outer,...holes.map(h=>h.poly)],t,1);cap([outer,...holes.filter(h=>h.through).map(h=>h.poly)],0,-1);wall(outer,0,t,1);
 for(const h of holes){wall(h.poly,t-h.depth,t,-1);if(!h.through)cap([h.poly],t-h.depth,1);}
 if(b.positions.length/3>=65536)throw Error("加工メッシュ上限");return b;
}
