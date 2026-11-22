/** Unit-height owner construction solids, all with a centre footprint of 1 m. */
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(b,a,c,d){
 const u=c.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const length=Math.hypot(...n)||1,normal=n.map(x=>x/length),index=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...normal,...normal,...normal);
 for(let i=0;i<3;i++)b.colors.push(1,1,1);
 b.indices.push(index,index+1,index+2);
}
function quad(b,a,c,d,e){tri(b,a,c,d);tri(b,a,d,e);}
function cappedRing(b,radiusBottom,radiusTop,sides=16){
 const y0=radiusBottom===0?.0:0,y1=1;
 for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides,c=(i+1)*Math.PI*2/sides;
  const p=(r,y,t)=>[r*Math.cos(t),y,r*Math.sin(t)];
  if(radiusTop>0)quad(b,p(radiusBottom,y0,a),p(radiusBottom,y0,c),p(radiusTop,y1,c),p(radiusTop,y1,a));
  else tri(b,p(radiusBottom,y0,a),p(radiusBottom,y0,c),[0,y1,0]);
  tri(b,[0,y0,0],p(radiusBottom,y0,c),p(radiusBottom,y0,a));
  if(radiusTop)tri(b,[0,y1,0],p(radiusTop,y1,a),p(radiusTop,y1,c));
 }
}
export function ownerPrimitiveGeometry(shape){
 const b=fresh();
 if(shape==="cube"){
  const v=[[-.5,0,-.5],[.5,0,-.5],[.5,1,-.5],[-.5,1,-.5],
   [-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5]];
  for(const [a,c,d,e] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
   quad(b,v[a],v[c],v[d],v[e]);
 }else if(shape==="cylinder")cappedRing(b,.5,.5,20);
 else if(shape==="cone")cappedRing(b,.5,0,20);
 else if(shape==="sphere"){
  const steps=12,sides=20;
  const point=(theta,phi)=>[.5*Math.sin(theta)*Math.cos(phi),
   .5+.5*Math.cos(theta),.5*Math.sin(theta)*Math.sin(phi)];
  for(let j=0;j<steps;j++)for(let i=0;i<sides;i++){
   const a=j*Math.PI/steps,c=(j+1)*Math.PI/steps,p=i*Math.PI*2/sides,q=(i+1)*Math.PI*2/sides;
   if(j===0)tri(b,point(a,p),point(c,p),point(c,q));
   else if(j===steps-1)tri(b,point(a,p),point(c,p),point(a,q));
   else quad(b,point(a,p),point(c,p),point(c,q),point(a,q));
  }
 }else throw new RangeError("Unsupported owner primitive");
 return b;
}
