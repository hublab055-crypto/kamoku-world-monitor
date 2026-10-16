/** WebGL ground picking via inverse view-projection and indexed triangle tests. */
export function invert4(a) {
  if(!Array.isArray(a)||a.length!==16)throw new TypeError("Expected 4x4 matrix");
  const inv=new Array(16),m=a;
  inv[0]=m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
  inv[4]=-m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
  inv[8]=m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
  inv[12]=-m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
  inv[1]=-m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
  inv[5]=m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
  inv[9]=-m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
  inv[13]=m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
  inv[2]=m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
  inv[6]=-m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
  inv[10]=m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
  inv[14]=-m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
  inv[3]=-m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
  inv[7]=m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
  inv[11]=-m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
  inv[15]=m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
  const determinant=m[0]*inv[0]+m[1]*inv[4]+m[2]*inv[8]+m[3]*inv[12];
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-20)return null;
  return inv.map(v=>v/determinant);
}
export function unproject(inverse, x,y,z) {
  const v=[x,y,z,1],p=[0,0,0,0];
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)p[r]+=inverse[c*4+r]*v[c];
  if(Math.abs(p[3])<1e-10)return null;
  return p.slice(0,3).map(v=>v/p[3]);
}
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function rayTriangle(origin,direction,a,b,c) {
  const edge1=subtract(b,a),edge2=subtract(c,a),p=cross(direction,edge2);
  const det=dot(edge1,p);
  if(Math.abs(det)<1e-9)return null;
  const inv=1/det,tvec=subtract(origin,a),u=dot(tvec,p)*inv;
  if(u<0||u>1)return null;
  const q=cross(tvec,edge1),v=dot(direction,q)*inv;
  if(v<0||u+v>1)return null;
  const t=dot(edge2,q)*inv;
  return t>0?t:null;
}
export function hitMeshRay(positions,indices,origin,direction) {
  if(!positions||!indices||!origin||!direction)return null;
  let nearest=Infinity;
  for(let k=0;k<indices.length;k+=3){
    const ia=indices[k]*3,ib=indices[k+1]*3,ic=indices[k+2]*3;
    const t=rayTriangle(origin,direction,
      [positions[ia],positions[ia+1],positions[ia+2]],
      [positions[ib],positions[ib+1],positions[ib+2]],
      [positions[ic],positions[ic+1],positions[ic+2]]);
    if(t!==null&&t<nearest)nearest=t;
  }
  return nearest===Infinity?null:origin.map((v,i)=>v+direction[i]*nearest);
}
export function pickSurface(positions,indices,vp,ndcX,ndcY){
  if(!Number.isFinite(ndcX)||!Number.isFinite(ndcY))return null;
  const inverse=invert4(vp);if(!inverse)return null;
  const a=unproject(inverse,ndcX,ndcY,-1),b=unproject(inverse,ndcX,ndcY,1);
  if(!a||!b)return null;
  return hitMeshRay(positions,indices,a,subtract(b,a));
}
