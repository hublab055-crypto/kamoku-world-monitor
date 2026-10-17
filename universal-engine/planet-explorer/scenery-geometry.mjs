/**
 * Terrain-following low-poly scenery geometry, split below the uint16 mesh limit.
 * Vertices are batched by scene type; no individual WebGL draw per grass blade.
 */
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(b,a,c,d,color){
  const u=c.map((n,i)=>n-a[i]),v=d.map((n,i)=>n-a[i]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...cross)||1,n=cross.map(a=>a/length),k=b.positions.length/3;
  b.positions.push(...a,...c,...d);
  b.normals.push(...n,...n,...n);
  b.colors.push(...color,...color,...color);
  b.indices.push(k,k+1,k+2);
}
function quad(b,a,c,d,e,col){tri(b,a,c,d,col);tri(b,a,d,e,col)}
function box(b,x,y,z,wx,h,wz,col){
  const v=[[x-wx,y,z-wz],[x+wx,y,z-wz],[x+wx,y+h,z-wz],[x-wx,y+h,z-wz],
    [x-wx,y,z+wz],[x+wx,y,z+wz],[x+wx,y+h,z+wz],[x-wx,y+h,z+wz]];
  for(const [i,j,k,l] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])quad(b,v[i],v[j],v[k],v[l],col);
}
function cone(b,x,y,z,height,radius,col,sides=6){
  for(let i=0;i<sides;i++){
    const a=i*2*Math.PI/sides,c=(i+1)*2*Math.PI/sides;
    tri(b,[x+radius*Math.cos(a),y,z+radius*Math.sin(a)],
      [x+radius*Math.cos(c),y,z+radius*Math.sin(c)],[x,y+height,z],col);
  }
}
function tree(b,t){
  const x=t.localX,z=t.localZ,y=t.elevationM-.35,k=t.scale;
  if(t.type==="boulder"){
    box(b,x,y,z,1.05*k,.95*k,.86*k,[.52,.52,.48]);
    cone(b,x,y+.25*k,z,.90*k,.96*k,[.49,.50,.47],6);
    return;
  }
  box(b,x,y,z,.18*k,3.1*k,.18*k,[.38,.27,.16]);
  if(t.type==="pine"){
    cone(b,x,y+1.10*k,z,4.15*k,1.45*k,[.14,.32,.19]);
    cone(b,x,y+3.03*k,z,3.15*k,1.13*k,[.18,.42,.24]);
  }else if(t.type==="flowering"){
    cone(b,x,y+1.55*k,z,3.65*k,1.58*k,[.33,.55,.29],8);
    cone(b,x,y+3.01*k,z,2.52*k,1.26*k,[.80,.49,.58],8);
  }else{
    cone(b,x,y+1.65*k,z,3.42*k,1.74*k,[.25,.49,.22],8);
    cone(b,x,y+2.95*k,z,2.78*k,1.45*k,[.31,.61,.27],8);
  }
}
function meadow(b,g){
  const {x,z,y,scale,rotation}=g,c=Math.cos(rotation),s=Math.sin(rotation),w=scale*.26;
  const col=g.tint>.77?[.63,.59,.27]:g.tint<.16?[.22,.40,.18]:[.31,.58,.25];
  tri(b,[x-c*w,y,z-s*w],[x+c*w,y,z+s*w],[x,y+scale*.90,z],col);
  tri(b,[x+s*w,y,z-c*w],[x-s*w,y,z+c*w],[x,y+scale*.72,z],[.24,.45,.18]);
}
function pitched(b,x,z,y,w,d,rise,col){
  const x0=x-w-.28,x1=x+w+.28,z0=z-d-.28,z1=z+d+.28;
  quad(b,[x0,y,z0],[x,y+rise,z0],[x,y+rise,z1],[x0,y,z1],col);
  quad(b,[x,y+rise,z0],[x1,y,z0],[x1,y,z1],[x,y+rise,z1],col);
  tri(b,[x0,y,z0],[x1,y,z0],[x,y+rise,z0],[.37,.28,.20]);
  tri(b,[x1,y,z1],[x0,y,z1],[x,y+rise,z1],[.37,.28,.20]);
}
function building(b,t){
  const x=t.localX,z=t.localZ,y=t.elevationM-1.25,kind=t.type;
  const timber=[.47,.34,.22],dark=[.27,.20,.14],roof=[.30,.27,.26],stone=[.48,.48,.45];
  if(kind==="watchtower"){
    for(const xx of [-2.4,2.4])for(const zz of [-2.4,2.4])box(b,x+xx,y,z+zz,.23,10,.23,timber);
    box(b,x,y+7.9,z,3.05,.44,3.05,dark);
    for(const xx of [-2.9,2.9])box(b,x+xx,y+8.5,z,.13,1.1,3.05,timber);
    for(const zz of [-2.9,2.9])box(b,x,y+8.5,z+zz,3.05,1.1,.13,timber);
    pitched(b,x,z,y+11.1,3.1,3.1,1.85,roof);
    box(b,x-2.55,y+.4,z+2.7,.13,7.1,.13,dark);
    return;
  }
  if(kind==="well"){
    box(b,x,y,z,1.65,1.45,1.65,stone);
    box(b,x,y+1.45,z,1.02,.08,1.02,[.13,.21,.22]);
    for(const xx of [-1.48,1.48])box(b,x+xx,y+.6,z,.14,3.4,.14,timber);
    pitched(b,x,z,y+4.0,1.8,1.6,.85,roof);
    return;
  }
  if(kind==="market"){
    for(const xx of [-3.4,3.4])for(const zz of [-2.5,2.5])
      box(b,x+xx,y,z+zz,.14,3.7,.14,dark);
    pitched(b,x,z,y+3.65,3.65,2.75,1.05,[.66,.42,.24]);
    box(b,x,y+.3,z,3.0,1.05,1.35,timber);
    box(b,x,y+1.30,z+1.3,3.1,.17,.2,[.79,.65,.41]);
    return;
  }
  const large=["lodge","barn","stable","workshop"].includes(kind);
  const hw=large?6.6:4.15,hd=large?5.15:3.62,h=large?4.9:3.7;
  box(b,x,y-1.2,z,hw+.65,1.8,hd+.65,stone);
  box(b,x,y,z,hw,h,hd,kind==="barn"?[.45,.29,.19]:timber);
  for(const xx of [-hw+.24,hw-.24]){
    box(b,x+xx,y,z+hd+.11,.15,h,.13,dark);
  }
  box(b,x,y+h-.24,z+hd+.12,hw,.18,.13,dark);
  box(b,x,y+.04,z+hd+.16,.83,2.72,.14,[.24,.18,.12]);
  for(const xx of [-hw*.67,hw*.67]){
    box(b,x+xx,y+2.07,z+hd+.20,.72,.94,.12,[.84,.67,.39]);
    box(b,x+xx,y+2.07,z+hd+.31,.05,.94,.05,dark);
  }
  pitched(b,x,z,y+h+.08,hw,hd,large?2.45:1.97,roof);
  if(kind==="lodge"||kind==="cabin"){
    box(b,x+hw*.68,y+h-1.05,z-hd*.5,.55,3.35,.58,stone);
    box(b,x,y+.05,z+hd+.85,hw*.75,.20,1.13,timber);
  }
  if(["barn","stable","workshop"].includes(kind)){
    for(let j=0;j<4;j++)box(b,x-hw+1.0+j*3.3,y+.1,z+hd+1.8,.14,2.9,.14,dark);
    box(b,x,y+2.9,z+hd+1.8,hw+.1,.16,.16,timber);
  }
}
export function meshBatch(items,append,maxVertices=50000){
  let b=fresh(),meshes=[];
  for(const item of items){
    if(b.positions.length/3>maxVertices){
      if(b.indices.length)meshes.push(b);
      b=fresh();
    }
    append(b,item);
    if(b.positions.length/3>=65535)throw new RangeError("Scenery mesh exceeds 16-bit vertex index limit.");
  }
  if(b.indices.length)meshes.push(b);
  return meshes;
}
export function buildSceneryMeshes(plan){
  return {
    woods:meshBatch(plan.trees,tree),
    meadow:meshBatch(plan.grass,meadow),
    settlement:meshBatch(plan.buildings,building)
  };
}
