/** Realtime track, connecting rods, driving wheels and exhaust particle meshes. */
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(b,p,q,r,color){
 const u=q.map((x,i)=>x-p[i]),v=r.map((x,i)=>x-p[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const size=Math.hypot(...n)||1,k=b.positions.length/3;
 b.positions.push(...p,...q,...r);
 for(let i=0;i<3;i++){b.normals.push(...n.map(x=>x/size));b.colors.push(...color);}
 b.indices.push(k,k+1,k+2);
}
function quad(b,a,c,d,e,color){tri(b,a,c,d,color);tri(b,a,d,e,color);}
function block(b,x,y,z,w,h,d,color){
 const v=[[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
 [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
 for(const [a,c,d,e] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(b,v[a],v[c],v[d],v[e],color);
}
function beam(b,a,c,width,height,color){
 const dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz);
 if(len<.02)return;
 const nx=-dz/len,nz=dx/len,ax=[a.x+nx*width,a.y,a.z+nz*width],
 bx=[a.x-nx*width,a.y,a.z-nz*width],cx=[c.x+nx*width,c.y,c.z+nz*width],
 dxp=[c.x-nx*width,c.y,c.z-nz*width];
 const top=arr=>[arr[0],arr[1]+height,arr[2]];
 quad(b,ax,cx,top(cx),top(ax),color);
 quad(b,dxp,bx,top(bx),top(dxp),color);
 quad(b,top(ax),top(cx),top(dxp),top(bx),color);
}
const sleeper=[.36,.25,.15],rail=[.39,.42,.43],gravel=[.43,.40,.35];
/** Terrain-following track with sleepers, two individual rails and bridges. */
export function trackGeometry(rows,{density=2.9}={}){
 const b=fresh();if(!rows||rows.length<2)return b;
 let carry=0;
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],c=rows[i],len=Math.hypot(c.x-a.x,c.z-a.z);
  if(len<.02)continue;
  const side={x:-(c.z-a.z)/len,z:(c.x-a.x)/len};
  const displaced=(p,l,y)=>({x:p.x+side.x*l,y:p.y+y,z:p.z+side.z*l});
  beam(b,displaced(a,0,-.19),displaced(c,0,-.19),1.52,.17,gravel);
  for(const sideSign of [-1,1]){
   const left=displaced(a,sideSign*1.07,.08),right=displaced(c,sideSign*1.07,.08);
   beam(b,left,right,.067,.18,rail);
  }
  let d=density-carry;
  while(d<=len){
   const t=d/len,p={x:a.x+(c.x-a.x)*t,y:a.y+(c.y-a.y)*t,z:a.z+(c.z-a.z)*t};
   beam(b,displaced(p,-1.43,-.05),displaced(p,1.43,-.05),.14,.16,sleeper);
   if(p.y>3&&a.bridge){
    beam(b,{x:p.x,y:.3,z:p.z},{x:p.x,y:p.y-.18,z:p.z},.12,.10,[.38,.37,.31]);
   }
   d+=density;
  }
  carry=(len-(d-density))%density;
 }
 return b;
}
/** Terrain-following safety fence on both sides of an urban rail corridor. */
export function trackFenceGeometry(rows,{halfWidth=3.15,postSpacing=7,gateZ=null,gateHalf=3.2}={}){
 const b=fresh();if(!rows||rows.length<2)return b;
 const steel=[.31,.35,.34],warning=[.84,.65,.19];
 let carried=0;
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],c=rows[i],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz);
  if(len<.02)continue;
  const nx=-dz/len,nz=dx/len;
  for(const side of [-1,1]){
   const p={x:a.x+nx*halfWidth,y:a.y+.05,z:a.z+nz*halfWidth};
   const q={x:c.x+nx*halfWidth,y:c.y+.05,z:c.z+nz*halfWidth};
   const midpoint=(a.z+c.z)/2;
   const gate=side===1&&Number.isFinite(gateZ)&&Math.abs(midpoint-gateZ)<gateHalf;
   if(!gate){
    beam(b,{...p,y:p.y+.70},{...q,y:q.y+.70},.045,.09,steel);
    beam(b,{...p,y:p.y+1.38},{...q,y:q.y+1.38},.045,.09,steel);
   }
  }
  let d=postSpacing-carried;
  while(d<=len){
   const t=d/len,z=a.z+(c.z-a.z)*t,y=a.y+(c.y-a.y)*t;
   for(const side of [-1,1]){
    if(side===1&&Number.isFinite(gateZ)&&Math.abs(z-gateZ)<gateHalf)continue;
    const x=a.x+(c.x-a.x)*t+nx*halfWidth,pz=z+nz*halfWidth;
    block(b,x,y+.02,pz,.085,1.58,.085,Math.abs(z-(gateZ||0))<gateHalf+postSpacing?warning:steel);
   }
   d+=postSpacing;
  }
  carried=(len-(d-postSpacing))%postSpacing;
 }
 return b;
}
export function wheelSpokesGeometry(){
 const b=fresh(),metal=[.75,.54,.24],hub=[.45,.20,.12];
 // In wheel-local space; rotation around X is applied by the renderer.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  const y=Math.cos(a)*.62,z=Math.sin(a)*.62;
  block(b,0,y*.5,z*.5,.13,.065,.065,metal);
  beam(b,{x:0,y:0,z:0},{x:0,y,z},.075,.10,metal);
 }
 block(b,0,0,0,.20,.15,.15,hub);
 return b;
}
export function connectingRodGeometry(){
 const b=fresh(),brass=[.75,.54,.26];
 block(b,0,0,0,.095,.090,.50,brass);
 block(b,0,0,.48,.15,.16,.07,[.58,.28,.14]);
 block(b,0,0,-.48,.15,.16,.07,[.58,.28,.14]);
 return b;
}
export function steamPuffGeometry(){
 const b=fresh(),color=[.87,.87,.84];
 // Low-poly octahedral smoke, light enough for several particles per frame.
 const v=[[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]];
 for(let i=0;i<4;i++){
  tri(b,v[0],v[1+i],v[1+((i+1)%4)],color);
  tri(b,v[5],v[1+((i+1)%4)],v[1+i],color);
 }
 return b;
}
/** The locomotive uses train-local +Z as its forward axis. */
export function locomotiveMotion(distanceM,timeSeconds,speedMps=0){
 const wheelRadius=.82,phase=(distanceM/wheelRadius)%(Math.PI*2),rod=[];
 for(const x of [-1.86,1.86]){
  // Driver and piston crosshead 90 degrees apart on each side.
  const shifted=phase+(x<0?0:Math.PI/2);
  const crank={y:1.02+Math.sin(shifted)*.62,z:17.1+Math.cos(shifted)*.62};
  const piston={y:1.26,z:21.12+Math.cos(shifted)*.43};
  const dy=piston.y-crank.y,dz=piston.z-crank.z;
  rod.push({x,y:(crank.y+piston.y)/2,z:(crank.z+piston.z)/2,
   length:Math.hypot(dy,dz),angle:-Math.atan2(dy,dz)});
 }
 const steamIntensity=Math.min(1,Math.abs(speedMps)/16);
 const smoke=Array.from({length:9},(_,i)=>{
  const age=(timeSeconds*.72-i/9)%1,life=(age+1)%1;
  return {x:Math.sin(timeSeconds*.7+i*1.1)*.23*life,y:4.65+life*(2.6+steamIntensity*2),
   z:20.5-life*(1.5+steamIntensity*6),scale:.25+life*(.5+steamIntensity*.6)};
 });
 return {phase,rod,smoke};
}
