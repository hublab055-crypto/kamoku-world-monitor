import {Shape,buildOriginalModel} from "../original-assets/original-models.mjs";
import {samplePose,jointTransforms,matrixMultiply,identity} from "../planet-explorer/rig.mjs";
import {perspective,lookAt,multiply4} from "../planet-explorer/render.mjs";

const VERT=["#version 300 es","precision highp float;",
 "layout(location=0) in vec3 aPosition;","layout(location=1) in vec3 aNormal;",
 "layout(location=2) in vec3 aColor;","uniform mat4 uMVP;",
 "out vec3 vNormal;out vec3 vColor;",
 "void main(){gl_Position=uMVP*vec4(aPosition,1.0);vNormal=aNormal;vColor=aColor;}"].join("\n");
const FRAG=["#version 300 es","precision highp float;",
 "in vec3 vNormal;in vec3 vColor;out vec4 frag;",
 "void main(){float light=.54+max(0.,dot(normalize(vNormal),normalize(vec3(.38,.85,1.))))*.46;",
 "frag=vec4(vColor*light,1.0);}"].join("\n");
function makeShader(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error("3D preview shader: "+gl.getShaderInfoLog(s));
 return s;
}
class GLPart {
 constructor(gl,geometry){
  this.gl=gl;this.vao=gl.createVertexArray();this.buffers=[];
  gl.bindVertexArray(this.vao);
  for(const [location,items]of [[0,geometry.positions],[1,geometry.normals],[2,geometry.colors]]){
   const b=gl.createBuffer();this.buffers.push(b);
   gl.bindBuffer(gl.ARRAY_BUFFER,b);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(items),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
  }
  this.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(geometry.indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);this.count=geometry.indices.length;
 }
 draw(){this.gl.bindVertexArray(this.vao);this.gl.drawElements(this.gl.TRIANGLES,this.count,this.gl.UNSIGNED_SHORT,0);}
 destroy(){for(const b of this.buffers)this.gl.deleteBuffer(b);this.gl.deleteBuffer(this.ib);this.gl.deleteVertexArray(this.vao);}
}
export class OriginalModelViewer {
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext("webgl2",{antialias:true,alpha:false});
  if(!gl)throw Error("WebGL2に対応したブラウザが必要です。");
  this.gl=gl;const p=gl.createProgram();
  gl.attachShader(p,makeShader(gl,gl.VERTEX_SHADER,VERT));
  gl.attachShader(p,makeShader(gl,gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error("3D preview shader link failed");
  this.program=p;this.mvp=gl.getUniformLocation(p,"uMVP");
  this.parts=[];this.model=null;this.modelId="";
  this.yaw=.1;this.pitch=.14;this.distance=6.2;this.target=[0,1,0];
  this.clip="walk";this.elapsed=0;this.autoRotate=true;
  gl.enable(gl.DEPTH_TEST);
  // Floor appears in preview only; not part of any exported model.
  const base=new Shape();
  base.box(0,-.17,0,8,.13,8,[.15,.25,.29]);
  this.floor=new GLPart(gl,base);
 }
 load(id){
  const model=buildOriginalModel(id);
  for(const p of this.parts)p.gl.destroy();
  this.model=model;this.modelId=id;
  this.parts=model.parts.map(part=>({part,gl:new GLPart(this.gl,part.geometry)}));
  this.distance=model.kind==="nature"?(id==="boulder"?5.0:13):
    model.kind==="building"?14:model.kind==="equipment"?5.0:5.3;
  this.target=[0,model.kind==="avatar"?1.06:model.kind==="nature"?(id==="boulder"?.6:3.4):
    model.kind==="building"?2.4:model.kind==="equipment"?1.1:1];
  this.yaw=.24;this.pitch=.16;this.elapsed=0;
  return model;
 }
 setClip(clip){
  this.clip=clip;this.elapsed=0;
 }
 setOrientation(dx,dy){
  this.yaw+=dx*.008;
  this.pitch=Math.max(-.25,Math.min(.80,this.pitch+dy*.005));
 }
 zoom(delta){
  this.distance=Math.max(2.5,Math.min(45,this.distance*(delta>0?1.15:.87)));
 }
 pose(){
  if(this.model?.kind!=="avatar")return null;
  if(this.clip==="idle")return samplePose();
  if(this.clip==="walk")return samplePose({moving:true,phase:this.elapsed*6.6});
  if(this.clip==="jump")return samplePose({jumpHeight:.25+.7*Math.max(0,Math.sin(this.elapsed*4.3))});
  if(["sword","axe","mine","build"].includes(this.clip)){
    const duration=this.clip==="build"?1.9:1.2;
    return samplePose({action:this.clip,progress:(this.elapsed%duration)/duration});
  }
  return samplePose();
 }
 render(dt=0){
  if(!this.model)return;
  this.elapsed+=Math.min(Math.max(dt,0),.1);
  if(this.autoRotate)this.yaw+=Math.min(.008,dt*.11);
  const gl=this.gl,dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const width=Math.max(1,Math.floor(this.canvas.clientWidth*dpr)),height=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  gl.viewport(0,0,width,height);gl.clearColor(.037,.091,.127,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const target=this.target;
  const camera=[
    target[0]+Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,
    target[1]+Math.sin(this.pitch)*this.distance,
    target[2]+Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance];
  const vp=multiply4(perspective(.80,width/height,.05,500),lookAt(camera,target));
  gl.uniformMatrix4fv(this.mvp,false,new Float32Array(vp));
  this.floor.draw();
  const joints=this.model.kind==="avatar"?jointTransforms(this.pose()):null;
  for(const {part,gl:mesh}of this.parts){
    const transform=part.pivot?joints[part.pivot]:identity();
    gl.uniformMatrix4fv(this.mvp,false,new Float32Array(multiply4(vp,transform)));
    mesh.draw();
  }
 }
 destroy(){
  for(const item of this.parts)item.gl.destroy();
  this.floor.destroy();this.gl.deleteProgram(this.program);
 }
}
