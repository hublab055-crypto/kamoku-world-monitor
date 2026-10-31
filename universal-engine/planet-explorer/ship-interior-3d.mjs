import {SHIP_CREW,SHIP_STATIONS} from "./ship-interior.mjs?v=4";
import {bodyById} from "./solar-system.mjs";
const rad=Math.PI/180;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function color(hex){const h=hex.replace("#","");return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];}
const palette={
 wall:[.15,.25,.33],dark:[.045,.085,.12],floor:[.17,.25,.29],
 roof:[.11,.16,.23],line:[.15,.58,.68],seat:[.16,.28,.38],
 crate:[.31,.32,.27],screen:[.13,.69,.67],frame:[.35,.47,.51],
 skin:[.83,.61,.43],uniform:[.18,.4,.56],uniform2:[.43,.29,.42],light:[.72,.91,.88]
};
const cubeFaces=[
 // corners given clockwise as observed from outside: normal
 {n:[0,0,1],p:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},
 {n:[0,0,-1],p:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]},
 {n:[1,0,0],p:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]},
 {n:[-1,0,0],p:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]},
 {n:[0,1,0],p:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]},
 {n:[0,-1,0],p:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]}
];
function box(data,x,y,z,w,h,d,c){
 const col=Array.isArray(c)?c:palette[c]||palette.wall;
 for(const f of cubeFaces){
  const order=[0,1,2,0,2,3];
  for(const i of order){
   const p=f.p[i];
   data.push(x+p[0]*w/2,y+p[1]*h/2,z+p[2]*d/2,...f.n,...col);
  }
 }
}
function sphere(data,x,y,z,r,c){
 const col=Array.isArray(c)?c:palette[c]||palette.wall;
 const rings=17,sectors=26;
 function v(a,b){
  const phi=Math.PI*a/rings,theta=Math.PI*2*b/sectors;
  const nx=Math.sin(phi)*Math.cos(theta),ny=Math.cos(phi),nz=Math.sin(phi)*Math.sin(theta);
  return [x+nx*r,y+ny*r,z+nz*r,nx,ny,nz,...col];
 }
 for(let a=0;a<rings;a++)for(let b=0;b<sectors;b++){
  for(const vtx of [v(a,b),v(a+1,b+1),v(a+1,b),v(a,b),v(a,b+1),v(a+1,b+1)])data.push(...vtx);
 }
}
function createShipGeometry(open=false){
 const a=[];
 // Main pressure hull: 26m long, 8m wide, 3.5m ceiling
 box(a,0,-.17,0,8,.36,26.2,"floor");
 box(a,0,3.67,0,8,.26,26.2,"roof");
 box(a,-4.08,1.71,0,.23,3.5,26.2,"wall");
 box(a,4.08,1.71,0,.23,3.5,26.2,"wall");
 // Genuine rear opening and airlock ramp in the same cabin mesh.
 for(const side of [-1,1])box(a,side*2.65,1.7,13.08,2.68,3.5,.27,"wall");
 box(a,0,3.13,13.08,2.65,.62,.28,"wall");
 for(const side of [-1,1])box(a,side*1.31,1.71,13.1,.08,2.78,.24,"frame");
 if(open){
  for(let j=0;j<7;j++)box(a,0,-.15-j*.25,13.1+j*.85,2.46,.12,.87,"frame");
  for(const side of [-1,1])box(a,side*1.24,-.65,15.9,.09,.15,5.6,"line");
 }else box(a,0,1.47,13.17,2.42,2.83,.28,"dark");
 // Front observation glazing is open to the view of the approaching world.
 box(a,-3.6,1.7,-13.08,.85,3.5,.32,"wall");
 box(a,3.6,1.7,-13.08,.85,3.5,.32,"wall");
 box(a,0,.53,-13.08,6.4,1.1,.32,"wall");
 box(a,0,3.18,-13.08,6.4,.96,.32,"wall");
 box(a,0,2.61,-13.1,6.25,.085,.19,"frame");
 box(a,0,1.1,-13.1,6.25,.10,.19,"frame");
 box(a,0,1.9,-13.09,.10,1.72,.12,"frame");
 // Cockpit/corridor and cargo partitions have a central 2.6m doorway.
 for(const z of [-4.8,4.5]){
  box(a,-2.7,1.72,z,2.55,3.48,.26,"wall");
  box(a,2.7,1.72,z,2.55,3.48,.26,"wall");
  box(a,0,3.23,z,2.85,.50,.32,"frame");
  box(a,-1.37,1.75,z,.13,2.75,.20,"frame");
  box(a,1.37,1.75,z,.13,2.75,.20,"frame");
 }
 // Corridor strips guide player to the sections.
 for(const x of [-1.52,1.52]){
  box(a,x,.025,0,.055,.05,25.5,"line");
  box(a,x,3.48,0,.075,.09,25.5,"line");
 }
 // Cockpit consoles, pilot chair, controls and status screens
 box(a,0,.82,-12.08,2,1.05,1.35,"dark");
 box(a,0,1.48,-12.1,1.48,.18,.48,"screen");
 box(a,0,.53,-9.8,.82,.26,.9,"seat");
 box(a,0,1.05,-9.34,.80,1.1,.18,"seat");
 box(a,0,.47,-9.8,.18,.65,.2,"frame");
 for(const x of [-3.36,3.36]){
  box(a,x,.75,-10.85,.95,1.48,3.45,"dark");
  box(a,x,1.51,-10.85,.78,.08,2.70,"screen");
  for(let j=0;j<3;j++)box(a,x,2.5,-12+j,.08,1.65,.08,"line");
 }
 // Crew bunks in the corridor and separate utilities.
 for(const x of [-3.2,3.2]){
  box(a,x,.36,-.5,1.33,.45,2.25,"seat");
  box(a,x,1.02,-.5,1.33,.08,2.25,"frame");
  box(a,x,1.9,1.85,.95,1.75,.50,"dark");
  box(a,x,1.9,1.56,.80,1.05,.08,"screen");
 }
 // Cargo bay: crate rows and manifest station.
 for(const x of [-3.06,3.06])for(const z of [6.0,8.45,10.7]){
  box(a,x,.45,z,1.45,.9,1.55,"crate");
  box(a,x,.92,z,1.48,.09,1.60,"frame");
  box(a,x,.46,z,.11,.87,1.61,"line");
 }
 box(a,0,.62,12.16,2,1.2,.75,"dark");
 box(a,0,1.4,12.10,1.64,.13,.54,"screen");
 // Engine room panels and reactor housing at aft wall.
 box(a,2.9,1.26,12.2,1.45,2.5,.65,"dark");
 for(let j=0;j<4;j++)box(a,2.75,1.0+j*.35,11.83,.65,.09,.08,j%2?"line":"light");
 for(let j=0;j<9;j++){
  const z=-11.1+j*2.7;
  box(a,-3.98,3.05,z,.1,.18,1.5,"line");
  box(a,3.98,3.05,z,.1,.18,1.5,"line");
 }
 // Exterior star field is visible through the forward observation window.
 for(let i=0;i<65;i++){
  const sx=((i*7919)%101-50)*.82,sy=((i*1597)%47-14)*.72;
  const sz=-45-(i*2377%73);
  box(a,sx,sy,sz,.10+i%3*.045,.10+i%3*.045,.10+i%3*.045,[.69+i%3*.09,.78+i%4*.055,.88]);
 }
 // Crew are simplified stand-in models, each at a fixed station.
 for(const crew of SHIP_CREW){
  const c=crew.id==="engineer"?"uniform2":"uniform";
  box(a,crew.x,.93,crew.z,.58,1.10,.35,c);
  sphere(a,crew.x,1.74,crew.z,.31,"skin");
  box(a,crew.x-.18,.29,crew.z,.18,.56,.19,"dark");
  box(a,crew.x+.18,.29,crew.z,.18,.56,.19,"dark");
  box(a,crew.x-.39,1.10,crew.z,.18,.83,.19,c);
  box(a,crew.x+.39,1.10,crew.z,.18,.83,.19,c);
 }
 return new Float32Array(a);
}
const vs=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;
uniform mat4 uVP;varying vec3 vColor;varying vec3 vNormal;varying float vDist;
void main(){gl_Position=uVP*vec4(aPos,1.);vColor=aColor;vNormal=aNormal;vDist=gl_Position.w;}`;
const fs=`precision mediump float;varying vec3 vColor,vNormal;varying float vDist;
void main(){vec3 n=normalize(vNormal);float light=.60+.35*max(0.,dot(n,normalize(vec3(-.4,.8,-.3))));
vec3 c=vColor*light;float fog=clamp((vDist-22.)/55.,0.,.76);gl_FragColor=vec4(mix(c,vec3(.025,.05,.085),fog),1.);}`;
function compile(gl,type,source){
 const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||"Shader compile failed");
 return shader;
}
function program(gl){
 const p=gl.createProgram();
 const a=compile(gl,gl.VERTEX_SHADER,vs),b=compile(gl,gl.FRAGMENT_SHADER,fs);
 gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||"Shader link failed");
 gl.deleteShader(a);gl.deleteShader(b);return p;
}
function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2),nf=1/(near-far);
 return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
function view(x,y,z,yaw,pitch){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const f=[sy*cp,sp,-cy*cp],right=[cy,0,sy],up=[-sy*sp,cp,cy*sp];
 return new Float32Array([
 right[0],up[0],-f[0],0, right[1],up[1],-f[1],0,
 right[2],up[2],-f[2],0,
 -right[0]*x-right[1]*y-right[2]*z,
 -up[0]*x-up[1]*y-up[2]*z,f[0]*x+f[1]*y+f[2]*z,1
 ]);
}
function multiply(a,b){
 const o=new Float32Array(16);
 for(let col=0;col<4;col++)for(let row=0;row<4;row++){
  let n=0;for(let k=0;k<4;k++)n+=a[k*4+row]*b[col*4+k];o[col*4+row]=n;
 }return o;
}
export function installShipInterior3D(canvas,{get}){
 if(!canvas)return {render:()=>false,destroy:()=>{}};
 let gl=null,p=null,buf=null,sceneCount=0,loc=null,planetBuffer=null,openBuffer=null,openSceneCount=0;
 try{
  gl=canvas.getContext("webgl",{alpha:false,antialias:true,depth:true});
  if(!gl)throw Error("WebGL not available");
  p=program(gl);
  const geometry=createShipGeometry();
  buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
  sceneCount=geometry.length/9;
  const openGeometry=createShipGeometry(true);
  openBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,openBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,openGeometry,gl.STATIC_DRAW);
  openSceneCount=openGeometry.length/9;
  planetBuffer=gl.createBuffer();
  loc={pos:gl.getAttribLocation(p,"aPos"),normal:gl.getAttribLocation(p,"aNormal"),
   color:gl.getAttribLocation(p,"aColor"),vp:gl.getUniformLocation(p,"uVP")};
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 }catch(e){console.warn("Ship 3D display unavailable:",e);gl=null;}
 function bind(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [attr,offset] of [[loc.pos,0],[loc.normal,12],[loc.color,24]]){
   if(attr<0)continue;
   gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,36,offset);
  }
 }
 function render(){
  const state=get();if(!gl||!state?.voyage||!state?.interior)return false;
  const {voyage,interior}=state;
  const dpr=Math.min(1.5,window.devicePixelRatio||1);
  const width=Math.max(1,Math.floor(canvas.clientWidth*dpr));
  const height=Math.max(1,Math.floor(canvas.clientHeight*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  // Atmosphere visibly thins during liftoff and reappears during reentry.
  const skyIntensity=["docked","landed"].includes(voyage.status)?1:
   voyage.status==="ascent"?1-(voyage.stageProgress||0):
   voyage.status==="entry"?(voyage.stageProgress||0):0;
  gl.viewport(0,0,width,height);
  gl.clearColor(.018+.29*skyIntensity,.04+.49*skyIntensity,.071+.60*skyIntensity,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(p);
  const vp=multiply(perspective(74*rad,width/height,.08,180),view(interior.x,1.62,interior.z,interior.yaw,interior.pitch));
  gl.uniformMatrix4fv(loc.vp,false,vp);
  // The target and origin are actual perspective spheres behind the forward observation pane.
  // Their visible angular size changes as the voyage progresses.
  const target=bodyById(voyage.destinationId),origin=bodyById(voyage.originId);
  const planetData=[];
  if(target){
   const approaching=voyage.status==="entry"?Math.max(voyage.progress,voyage.stageProgress||0):voyage.progress;
   sphere(planetData,0,2,-43,1.8+Math.pow(approaching,2.5)*15,color(target.color));
  }else if(origin){
   sphere(planetData,0,-2,-50,["docked","landed"].includes(voyage.status)?11:4,color(origin.color));
  }
  if(target&&origin&&voyage.progress<.78)
   sphere(planetData,-22,4,-70,5*Math.pow(1-voyage.progress,2),color(origin.color));
  gl.bindBuffer(gl.ARRAY_BUFFER,planetBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(planetData),gl.DYNAMIC_DRAW);
  bind(planetBuffer);gl.drawArrays(gl.TRIANGLES,0,planetData.length/9);
  if(voyage.hatchOpen){bind(openBuffer);gl.drawArrays(gl.TRIANGLES,0,openSceneCount);}
  else{bind(buf);gl.drawArrays(gl.TRIANGLES,0,sceneCount);}
  return true;
 }
 function destroy(){if(!gl)return;if(buf)gl.deleteBuffer(buf);if(openBuffer)gl.deleteBuffer(openBuffer);if(planetBuffer)gl.deleteBuffer(planetBuffer);if(p)gl.deleteProgram(p);}
 return {render,destroy,supported:Boolean(gl)};
}
