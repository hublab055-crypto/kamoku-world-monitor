import {geoNormal,geoOffset,geoLocal,DEG,clamp,samplePatch,terrainSurface} from "./geo.mjs";
import {noise3} from "../planet/planet-core.mjs";
import {RIG_SEGMENTS,samplePose,jointTransforms,matrixMultiply,translate} from "./rig.mjs";
import {pickSurface} from "./picking.mjs";
import {buildOriginalModel} from "../original-assets/original-models.mjs";
import {jointTransformsV2} from "./rig-v2.mjs";
import {SmoothAnimator} from "./animator.mjs";
import {makeJointCovers} from "./joint-covers.mjs";
import {createAppearance,restoreAppearance,buildAppearanceParts} from "./wardrobe.mjs";
import {ExpressionController,makeFaceParts,expressionPoseValues} from "./expression.mjs";
import {rotZ} from "./rig.mjs";
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
export function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2),q=1/(near-far);
 return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0];
}
export function lookAt(eye,target,up=[0,1,0]){
 const f=norm(sub(target,eye)),s=norm(cross(f,up)),u=cross(s,f);
 return [s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,-dot(s,eye),-dot(u,eye),dot(f,eye),1];
}
export function multiply4(a,b){
 const out=new Array(16).fill(0);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
 return out;
}
const VERT=["#version 300 es","precision highp float;","layout(location=0) in vec3 aPos;","layout(location=1) in vec3 aNorm;","layout(location=2) in vec3 aColor;","uniform mat4 uMvp;","out vec3 vN; out vec3 vC;","void main(){vN=aNorm;vC=aColor;gl_Position=uMvp*vec4(aPos,1.0);}"].join("\n");
const FRAG=["#version 300 es","precision highp float;","in vec3 vN; in vec3 vC;","uniform vec3 uLight;uniform float uAlpha;uniform float uAmbient;","out vec4 fragColor;","void main(){float b=max(dot(normalize(vN),normalize(uLight)),0.0);fragColor=vec4(vC*(uAmbient+(1.0-uAmbient)*b),uAlpha);}"].join("\n");
function shader(gl,mode,src){
 const sh=gl.createShader(mode);gl.shaderSource(sh,src);gl.compileShader(sh);
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error("Shader compile: "+gl.getShaderInfoLog(sh));
 return sh;
}
class Mesh{
 constructor(gl,b){
  this.gl=gl;this.vao=gl.createVertexArray();this.buffers=[];
  gl.bindVertexArray(this.vao);
  for(const [i,values]of [[0,b.positions],[1,b.normals],[2,b.colors]]){
   const buffer=gl.createBuffer();this.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values ?? b.vertices),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);
  }
  this.indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(b.indices),gl.STATIC_DRAW);
  this.count=b.indices.length;gl.bindVertexArray(null);
 }
 draw(){const gl=this.gl;gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0)}
 destroy(){const gl=this.gl;for(const v of this.buffers)gl.deleteBuffer(v);gl.deleteBuffer(this.indices);gl.deleteVertexArray(this.vao)}
}
const builder=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(b,a,c,d,col){
 const n=norm(cross(sub(c,a),sub(d,a))),k=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...n,...n,...n);b.colors.push(...col,...col,...col);b.indices.push(k,k+1,k+2);
}
function quad(b,a,c,d,e,col){triangle(b,a,c,d,col);triangle(b,a,d,e,col)}
function box(b,x,y,z,rx,hh,rz,col){
 const a=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+hh,z-rz],[x-rx,y+hh,z-rz],
 [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+hh,z+rz],[x-rx,y+hh,z+rz]];
 for(const [i,j,k,l]of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])quad(b,a[i],a[j],a[k],a[l],col);
}
function cone(b,x,y,z,h,r,col,sides=7){
 for(let i=0;i<sides;i++){
  const a=i*2*Math.PI/sides,c=(i+1)*2*Math.PI/sides;
  triangle(b,[x+r*Math.cos(a),y,z+r*Math.sin(a)],[x+r*Math.cos(c),y,z+r*Math.sin(c)],[x,y+h,z],col);
 }
}
function sphereGeometry(terrain,planet){
 const ground=builder(),clouds=builder(),R=600,resLat=64,resLon=128;
 for(let j=0;j<resLat;j++)for(let i=0;i<resLon;i++){
  const la=-90+j*180/resLat,lb=-90+(j+1)*180/resLat,lo=-180+i*360/resLon,lp=-180+(i+1)*360/resLon;
  const coords=[[la,lo],[la,lp],[lb,lp],[lb,lo]],ss=coords.map(([a,b])=>terrainSurface(terrain,a,b));
  const mean=ss.reduce((a,b)=>a+b.elevationM,0)/4,lat=(la+lb)/2,lon=(lo+lp)/2;
  const temp=28-Math.abs(lat)*.61-Math.max(0,mean)*.006;
  const sea=ss.filter(s=>s.water).length>=2;
  const col=sea?[.07,.26,.51]:temp<-3||mean>3200?[.86,.90,.91]:mean>1900?[.51,.49,.42]:
   temp>29?[.60,.56,.35]:mean>1200?[.34,.49,.24]:[.15,.43,.24];
  const points=coords.map(([a,b],k)=>geoNormal(a,b).map(v=>v*(R+Math.max(0,ss[k].elevationM)*3/planet.radiusM*R)));
  quad(ground,points[0],points[3],points[2],points[1],col);
  const n=geoNormal(lat,lon);
  if(noise3(n[0]*8+3,n[1]*8,n[2]*8-1,planet.seed+91)>.20){
   const pp=coords.map(c=>geoNormal(...c).map(v=>v*(R+8)));
   quad(clouds,pp[0],pp[3],pp[2],pp[1],[.91,.95,1]);
  }
 }
 return {ground,clouds,R};
}
// Original world meshes share the same vertex-color format as the WebGL adapter.
// Each tree is a compact triangle hierarchy; no third-party model imports.
const natureModelCache=new Map();
function original(id){
 if(!natureModelCache.has(id))natureModelCache.set(id,buildOriginalModel(id));
 return natureModelCache.get(id);
}
function appendModel(b,model,x,y,z,scale=1,angle=0){
 const c=Math.cos(angle),s=Math.sin(angle);
 for(const part of model.parts){
   const mesh=part.geometry, offset=b.positions.length/3;
   for(let k=0;k<mesh.positions.length;k+=3){
     const px=mesh.positions[k]*scale,pz=mesh.positions[k+2]*scale;
     b.positions.push(x+c*px-s*pz,y+mesh.positions[k+1]*scale,z+s*px+c*pz);
     const nx=mesh.normals[k],ny=mesh.normals[k+1],nz=mesh.normals[k+2];
     b.normals.push(c*nx-s*nz,ny,s*nx+c*nz);
   }
   b.colors.push(...mesh.colors);
   for(const idx of mesh.indices)b.indices.push(idx+offset);
 }
}
function vegetation(terrain,planet,origin,cx,cz,radius){
 const b=builder();
 if(radius>4100)return b;
 const cell=98,rng=Math.min(radius*.87,850);
 let count=0;
 for(let iz=Math.floor((cz-rng)/cell);iz<=Math.ceil((cz+rng)/cell);iz++){
  for(let ix=Math.floor((cx-rng)/cell);ix<=Math.ceil((cx+rng)/cell);ix++){
   if(count>=80)break;
   const val=noise3(ix*.84,iz*.92,5,planet.seed+503);
   if(val<-.22)continue;
   const ax=ix*cell+val*9,az=iz*cell+val*11,x=ax-cx,z=az-cz;
   if(Math.abs(x)>radius*.98||Math.abs(z)>radius*.98)continue;
   const geo=geoOffset(origin.lat,origin.lon,ax,az,planet.radiusM);
   const s=terrainSurface(terrain,geo.lat,geo.lon);
   if(s.water||s.river||s.elevationM<60||s.elevationM>2200)continue;
   const id=val>.28?"broadleaf":val>.04?"pine":val>-.07?"flowering":"boulder";
   const scale=id==="boulder"?.8:1.05+Math.abs(val)*.42;
   appendModel(b,original(id),x,s.elevationM,z,scale,val*5);
   count++;
  }
  if(count>=80)break;
 }
 return b;
}
export class ExplorerRenderer{
 constructor(canvas,planet,terrain){
  const gl=canvas.getContext("webgl2",{antialias:true,alpha:false,powerPreference:"high-performance"});
  if(!gl)throw Error("WebGL2が利用できません。対応ブラウザを利用してください。");
  this.gl=gl;this.canvas=canvas;this.planet=planet;this.terrain=terrain;
  const pg=gl.createProgram();gl.attachShader(pg,shader(gl,gl.VERTEX_SHADER,VERT));
  gl.attachShader(pg,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(pg);
  if(!gl.getProgramParameter(pg,gl.LINK_STATUS))throw Error("Shader link: "+gl.getProgramInfoLog(pg));
  this.program=pg;this.uMvp=gl.getUniformLocation(pg,"uMvp");this.uLight=gl.getUniformLocation(pg,"uLight");
  this.uAlpha=gl.getUniformLocation(pg,"uAlpha");this.uAmbient=gl.getUniformLocation(pg,"uAmbient");
  const earth=sphereGeometry(terrain,planet);this.R=earth.R;
  this.globe=new Mesh(gl,earth.ground);this.cloud=new Mesh(gl,earth.clouds);
  this.patch=null;this.trees=null;this.patchKey=null;
  // Original segmented humanoid; each mesh is parented to a semantic joint.
  this.avatarStyle="pioneer";
  this.rigParts=[];
  this.animator=new SmoothAnimator();
  this.expression=new ExpressionController();
  this.appearance=createAppearance("pioneer","pioneer");
  this.setAppearance(this.appearance);
  this.tools={};
  for(const tool of ["sword","axe","pickaxe","hammer"]){
    const src=original(tool).parts[0].geometry;
    // Rotate the standalone upright tool so its handle extends from the wrist.
    const b={positions:[],normals:[],colors:[...src.colors],indices:[...src.indices]};
    for(let k=0;k<src.positions.length;k+=3){
      b.positions.push(src.positions[k]*.76,-src.positions[k+1]*.76-.12,-src.positions[k+2]*.76);
      b.normals.push(src.normals[k],-src.normals[k+1],-src.normals[k+2]);
    }
    this.tools[tool]=new Mesh(gl,b);
  }
  this.buildingMeshes=this.makeBuildingMeshes(gl);
  this.sceneActions=null;
  this.pickVP=null;this.groundPatchData=null;
  gl.enable(gl.DEPTH_TEST);
 }
 setAvatarStyle(id){
   if(!["pioneer","scout","artisan"].includes(id))throw new RangeError("Unknown avatar style");
   this.setAppearance(createAppearance(id,id));
   return id;
 }
 setAppearance(input){
   const appearance=restoreAppearance(input);
   const parts=[...buildAppearanceParts(appearance),...makeFaceParts()];
   const meshes=[];
   try{for(const part of parts)meshes.push({mesh:new Mesh(this.gl,part.geometry),part});}
   catch(e){for(const entry of meshes)entry.mesh.destroy();throw e;}
   for(const entry of this.rigParts||[])entry.mesh.destroy();
   this.rigParts=meshes;
   this.appearance=appearance;
   this.avatarStyle=appearance.baseModelId;
   return {...appearance};
 }
 makeBuildingMeshes(gl){
   const parts=original("hut").parts;
   return {
     base:new Mesh(gl,parts[0].geometry),
     walls:new Mesh(gl,parts[1].geometry),
     roof:new Mesh(gl,parts[2].geometry),
     details:new Mesh(gl,parts[3].geometry)
   };
 }
 pickGround(clientX,clientY){
   if(!this.pickVP||!this.groundPatchData)return null;
   const r=this.canvas.getBoundingClientRect();
   if(!r.width||!r.height)return null;
   const nx=((clientX-r.left)/r.width)*2-1,ny=1-((clientY-r.top)/r.height)*2;
   const hit=pickSurface(this.groundPatchData.vertices,this.groundPatchData.indices,this.pickVP,nx,ny);
   return hit?{x:hit[0]+this.cx,z:hit[2]+this.cz,elevationM:hit[1]}:null;
 }
 drawArticulated(vp,avatarTransform,s,light,dt=1/60){
   const motion=this.sceneActions?.getAnimation()||{action:"idle",progress:0};
   const face=this.expression.update(dt);
   const pose=this.animator.update(dt,{
      moving:s.moving,phase:s.totalDistanceM*2.7,
      speedMps:s.moving?s.walkSpeed:0,
      jumpHeight:s.jumpY||0,action:motion.action,progress:motion.progress,
      emotion:this.expression.preset,faceDirection:face.gazeX*.27
   });
   Object.assign(pose,expressionPoseValues(face));
   const joints=jointTransformsV2(pose,s.yaw);
   for(const {mesh,part} of this.rigParts){
     let m=matrixMultiply(avatarTransform,joints[part.pivot]);
     if(part.faceKind==="lid"){
       const openScale=Math.max(.015,Math.min(1,face.blink));
       m=matrixMultiply(m,[1,0,0,0,0,openScale,0,0,0,0,1,0,0,0,0,1]);
     }else if(part.faceKind==="leftBrow"||part.faceKind==="rightBrow"){
       const angle=face.brow*(part.faceKind==="leftBrow"?1:-1);
       m=matrixMultiply(m,rotZ(angle));
     }else if(part.faceKind==="mouth"){
       const x=Math.max(.5,Math.min(1.4,face.mouthWidth));
       m=matrixMultiply(m,[x,0,0,0,0,1,0,0,0,0,1,0,0,face.mouthHeight,0,1]);
     }
     this.drawMesh(mesh,multiply4(vp,m),light,1,.72);
   }
   if(pose.tool&&this.tools[pose.tool]){
     const held=matrixMultiply(avatarTransform,joints.rightWrist);
     this.drawMesh(this.tools[pose.tool],multiply4(vp,held),light,1,.68);
   }
 }
 drawBuildings(vp,light,s,radius){
   if(!this.sceneActions)return;
   for(const hut of this.sceneActions.structures){
     const offset=geoLocal(s.origin.lat,s.origin.lon,hut.lat,hut.lon,this.planet.radiusM);
     const bx=offset.eastM,bz=offset.northM;
     if(Math.abs(bx-s.x)>radius||Math.abs(bz-s.z)>radius)continue;
     const model=translate(bx-this.cx,hut.height,bz-this.cz);
     const mvp=multiply4(vp,model);
     this.drawMesh(this.buildingMeshes.base,mvp,light,1,.64);
     if(hut.progress>=.3)this.drawMesh(this.buildingMeshes.walls,mvp,light,1,.64);
     if(hut.progress>=.75)this.drawMesh(this.buildingMeshes.roof,mvp,light,1,.64);
     if(hut.progress>=.92)this.drawMesh(this.buildingMeshes.details,mvp,light,1,.64);
   }
 }
 drawMesh(mesh,mvp,light,alpha=1,ambient=.25){
  const gl=this.gl;gl.uniformMatrix4fv(this.uMvp,false,new Float32Array(mvp));
  gl.uniform3fv(this.uLight,new Float32Array(light));
  gl.uniform1f(this.uAlpha,alpha);gl.uniform1f(this.uAmbient,ambient);mesh.draw();
 }
 frame(state,dt=1/60){
  const gl=this.gl,dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const w=Math.max(1,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  gl.viewport(0,0,w,h);gl.clearColor(.011,.032,.071,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const asp=w/h;
  return state.altitudeM>23000?this.orbit(state,asp):this.ground(state,asp,dt);
 }
 orbit(s,asp){
  this.pickVP=null;
  const gl=this.gl,R=this.R,distance=R*(1+s.altitudeM/this.planet.radiusM);
  const offset=this.planet.rotationAngle*180/Math.PI*(s.altitudeM>400000?1:0);
  const n=geoNormal(s.lat,s.lon+offset),camera=n.map(v=>v*distance);
  const view=lookAt(camera,[0,0,0],Math.abs(n[1])>.95?[0,0,1]:[0,1,0]);
  const vp=multiply4(perspective(53*DEG,asp,Math.max(.01,(distance-R-110)*.3),distance+R*5),view);
  const spin=-this.planet.rotationAngle,tilt=-this.planet.axialTiltDeg*DEG,sun=this.planet.solarDirection;
  const cs=Math.cos(spin),ss=Math.sin(spin),x=cs*sun.x+ss*sun.z,z=-ss*sun.x+cs*sun.z;
  const ct=Math.cos(tilt),st=Math.sin(tilt),light=[x,ct*sun.y-st*z,st*sun.y+ct*z];
  this.drawMesh(this.globe,vp,light,1,.14);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  this.drawMesh(this.cloud,vp,light,.33,.32);gl.depthMask(true);gl.disable(gl.BLEND);
  return "orbit";
 }
 ground(s,asp,dt=1/60){
  const gl=this.gl,alt=s.altitudeM;
  const requestedRadius=clamp(alt*4+350,450,55000);
  const radius=clamp(450*Math.pow(2,Math.ceil(Math.log2(requestedRadius/450))),450,55000);
  const snap=radius<2200?110:radius<6500?600:3000;
  const cx=Math.round(s.x/snap)*snap,cz=Math.round(s.z/snap)*snap;
  const resolution=radius>8000?64:56,key=[cx,cz,Math.round(radius/90),resolution].join("/");
  if(key!==this.patchKey){
   const geo=geoOffset(s.origin.lat,s.origin.lon,cx,cz,this.planet.radiusM);
   this.patch?.destroy();this.trees?.destroy();
   this.groundPatchData=samplePatch(this.terrain,geo.lat,geo.lon,radius,resolution);
   this.patch=new Mesh(gl,this.groundPatchData);
   const shrubs=vegetation(this.terrain,this.planet,s.origin,cx,cz,radius);
   this.trees=shrubs.positions.length?new Mesh(gl,shrubs):null;
   this.patchKey=key;this.cx=cx;this.cz=cz;
  }
  const px=s.x-this.cx,pz=s.z-this.cz;
  const ground=terrainSurface(this.terrain,s.lat,s.lon).elevationM;
  const feet=Math.max(ground,0),close=alt<=12,yaw=s.yaw;
  const camera=close?[px-Math.sin(yaw)*8,feet+7,pz-Math.cos(yaw)*8]:[px,feet+alt,pz];
  const target=close?[px,feet+1,pz]:[px+Math.sin(yaw)*alt*.5,feet-alt*.8,pz+Math.cos(yaw)*alt*.5];
  const vp=multiply4(perspective(65*DEG,asp,.08,Math.max(radius*8,5000)),lookAt(camera,target));
  this.pickVP=close?vp:null;
  const light=[.4,Math.max(.3,this.planet.illumination(s.lat,s.lon)),.2];
  this.drawMesh(this.patch,vp,light,1,.58);
  if(this.trees)this.drawMesh(this.trees,vp,light,1,.58);
  this.drawBuildings(vp,light,s,radius);
  if(close){
    const transform=translate(px,feet+(s.jumpY||0),pz);
    this.drawArticulated(vp,transform,s,light,dt);
  }
  return "ground";
 }
 destroy(){
   for(const m of [this.globe,this.cloud,this.patch,this.trees,...this.rigParts.map(x=>x.mesh),...Object.values(this.tools),...Object.values(this.buildingMeshes)])m?.destroy();
   this.gl.deleteProgram(this.program);
 }
}
