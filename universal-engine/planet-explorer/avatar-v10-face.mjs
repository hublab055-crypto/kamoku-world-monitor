const clamp = (x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const bell = (x,width)=>Math.exp(-((x/width)**2));
const faceParts = new Set(["Face and skull","Eyes, brows and lips","Neck and ears"]);

function transformPoint(out,offset,x,y,z,shape,landmarks,part,index) {
 const [scale,lift,eyeX,eyeY,noseY,mouthY]=landmarks;
 x/=scale; y=y/scale-lift; z/=scale;
 let dx=0,dy=0,dz=0;
 if(part==="Neck and ears"){
  // In the authored compact mesh the first 240 vertices are the neck grid.
  if(index>=240){
   const sign=Math.sign(x),center=sign*(scale<1?.097:.104),earY=y-1.604;
   dx=(x-center)*shape.earSize*.31+sign*earY*shape.earShape*.24;
   dy=earY*(shape.earSize*.31-shape.earShape*.26)+shape.earHeight*.016;
   dz=(z+.012)*shape.earSize*.31+earY*shape.earShape*.20;
  }
 }else{
  const front=clamp((z-.022)/.048,0,1);
  const side=Math.sign(x);
  const eyeDelta=Math.abs(x)-eyeX;
  const eye=front*bell(eyeDelta,.044)*bell(y-eyeY,.017);
  const browY=eyeY+.023;
  const brow=front*bell(eyeDelta,.042)*bell(y-browY,.012);
  const nose=front*bell(x,.026)*bell(y-noseY,.032);
  const mouth=front*bell(x,.062)*bell(y-mouthY,.021);
  const jaw=bell(y-1.528,.043);
  const face=bell(y-1.61,.132);
  dx+=side*(eyeDelta*shape.eyeSize*.35+shape.eyeSpacing*.011)*eye;
  dy+=((y-eyeY)*shape.eyeSize*.45+eyeDelta*shape.eyeShape*.24+shape.eyeHeight*.012)*eye;
  dx+=side*eyeDelta*shape.browSize*.39*brow;
  dy+=((y-browY)*shape.browSize*.4+(.009-Math.abs(eyeDelta)*.44)*shape.browShape+shape.browHeight*.013)*brow;
  dx+=x*(shape.noseSize*.36+shape.noseShape*.46)*nose;
  dy+=((y-noseY)*shape.noseSize*.39+shape.noseHeight*.016)*nose;
  dz+=(shape.noseDepth*.023+shape.noseSize*.009)*nose;
  dx+=x*shape.mouthSize*.38*mouth;
  dy+=((y-mouthY)*shape.mouthSize*.49+Math.abs(x)*shape.mouthShape*.24+shape.mouthHeight*.015)*mouth;
  dx+=x*(shape.faceSize*.16*face+shape.jawShape*.25*jaw);
  dy+=(y-1.64)*shape.faceSize*.15*face;
  dz+=(z-.015)*shape.faceSize*.12*face;
 }
 out[offset]=(x+dx)*scale;
 out[offset+1]=(y+lift+dy)*scale;
 out[offset+2]=(z+dz)*scale;
}

function updateNormals(positions,indices,normals) {
 normals.fill(0);
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2];
  const vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
  for(const j of [a,b,c]){
   normals[j]+=x; normals[j+1]+=y; normals[j+2]+=z;
  }
 }
 for(let i=0;i<normals.length;i+=3){
  const length=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
  normals[i]/=length; normals[i+1]/=length; normals[i+2]/=length;
 }
}

export function deformAvatarV10Face(source, shape, landmarks) {
 if(!faceParts.has(source.name))return null;
 const detail=Object.fromEntries(Object.entries(shape).map(([key,value])=>[key,value/100]));
 const base=source.arrays;
 const morphs=["morph0","morph1"].slice(0,source.names.length);
 if(Object.values(detail).every(x=>x===0))
  return Object.fromEntries(["positions","normals",...morphs].map(key=>[key,base[key]]));
 const positions=new Float32Array(base.positions.length);
 const normals=new Float32Array(base.normals.length);
 const result={positions,normals};
 for(const key of morphs)result[key]=new Float32Array(positions.length);
 const morphed=new Float32Array(3);
 for(let i=0;i<positions.length;i+=3){
  const x=base.positions[i],y=base.positions[i+1],z=base.positions[i+2];
  transformPoint(positions,i,x,y,z,detail,landmarks,source.name,i/3);
  for(const key of morphs){
   const delta=base[key];
   transformPoint(morphed,0,x+delta[i],y+delta[i+1],z+delta[i+2],detail,landmarks,source.name,i/3);
   for(let c=0;c<3;c++)result[key][i+c]=morphed[c]-positions[i+c];
  }
 }
 updateNormals(positions,source.indices,normals);
 return result;
}
