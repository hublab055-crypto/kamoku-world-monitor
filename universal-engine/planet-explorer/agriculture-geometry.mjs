/** Self-contained small low-poly meshes for visibly growing field crops and orchards. */
const mesh=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(m,a,b,c,color){
 const u=a.map((v,i)=>b[i]-v),v=a.map((w,i)=>c[i]-w);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const length=Math.hypot(...n)||1,k=m.positions.length/3;
 m.positions.push(...a,...b,...c);
 for(let i=0;i<3;i++){m.normals.push(...n.map(t=>t/length));m.colors.push(...color);}
 m.indices.push(k,k+1,k+2);
}
function quad(m,a,b,c,d,color){triangle(m,a,b,c,color);triangle(m,a,c,d,color);}
function box(m,x,y,z,w,h,d,color){
 const a=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],
  [x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];
 for(const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[4,7,3,0]])
  quad(m,a[i],a[j],a[k],a[l],color);
}
function leaf(m,x,y,z,size,color){
 triangle(m,[x,y,z],[x-size,y-size*.32,z-size*.3],[x,y+size*.8,z+size*.28],color);
 triangle(m,[x,y,z],[x+size,y-size*.32,z+size*.3],[x,y+size*.8,z-size*.28],color);
}
export function agricultureGeometry(kind="field",growth=0){
 const m=mesh(),t=Math.max(0,Math.min(1,growth));
 const soil=[.31,.205,.115],furrow=[.24,.15,.07];
 box(m,0,-.065,0,3.15,.09,3.15,soil);
 if(kind==="field"||kind==="wheat"||kind==="carrot"){
  for(const x of [-1,0,1])box(m,x,-.014,0,.36,.06,2.85,furrow);
  if(kind==="field")return m;
  for(let i=0;i<9;i++){
   const x=-1+(i%3),z=-.96+Math.floor(i/3)*.96;
   if(kind==="wheat"){
    const h=.12+t*.92,col=t>.9?[.83,.64,.19]:[.38,.66,.20];
    box(m,x,.015,z,.047,h,.048,[.32,.56,.21]);
    for(let l=0;l<3;l++)leaf(m,x,.14+h*l*.23,z,.14+t*.11,[.37,.61,.19]);
    if(t>.62)box(m,x,.02+h,z,.13,.13+t*.20,.13,col);
   }else{
    const h=.10+.36*t;
    box(m,x,.015,z,.045,h,.045,[.25,.59,.20]);
    leaf(m,x,.07+h*.6,z,.20+t*.15,[.27,.65,.17]);
    if(t>.58)box(m,x,-.015,z,.10+.13*t,.16+.15*t,.10+.13*t,[.92,.39,.075]);
   }
  }
  return m;
 }
 if(kind==="apple"){
  // Young apple sapling grows into a recognisable orchard tree.
  const h=.65+2.65*t;
  box(m,0,.015,0,.18+.16*t,h,.22+.16*t,[.39,.24,.11]);
  const crown=.35+t*1.20;
  for(const [x,z,y] of [[0,0,0],[-.48,.15,-.15],[.49,.13,-.10],[0,-.52,.04]]){
   const w=crown*(x===0?1.0:.7);
   box(m,x*t,h*.72+y*t,z*t,w,crown*.85,w,[.15+.09*(x+.5),.42+.11*t,.13]);
  }
  if(t>.82)for(let i=0;i<8;i++){
   const angle=i*Math.PI*2/8;
   box(m,Math.cos(angle)*crown*.35,h*.76+Math.sin(i*4)*.25,
    Math.sin(angle)*crown*.37,.12,.12,.12,[.85,.14,.12]);
  }
 }
 return m;
}
