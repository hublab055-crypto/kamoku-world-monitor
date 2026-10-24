/**
 * Native WebGL2 equivalent of Three.VideoTexture for planet-explorer's custom
 * renderer. Runs in the EXISTING depth buffer: terrain/buildings occlude video.
 * No canvas readback, proxy, frame copying to a server, or DRM workarounds.
 */
import {geoLocal,terrainSurface} from "./geo.mjs";
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec2 aUV;
uniform mat4 uVP;
out vec2 vUV;
void main(){gl_Position=uVP*vec4(aPosition,1.);vUV=aUV;}`;
const FS=`#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uVideo;
uniform vec2 uContent;
out vec4 fragColor;
void main(){
  vec2 a=(vUV-.5)/uContent+.5;
  if(a.x<0.||a.x>1.||a.y<0.||a.y>1.)fragColor=vec4(0.,0.,0.,1.);
  else fragColor=vec4(texture(uVideo,a).rgb,1.);
}`;
function compile(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error("動画シェーダー: "+message);
 }return s;
}
export class VideoTextureRenderer {
 constructor(gl,{onError=()=>{}}={}){
  this.gl=gl;this.onError=onError;this.textures=new Map();
  this.program=gl.createProgram();
  const vs=compile(gl,gl.VERTEX_SHADER,VS),fs=compile(gl,gl.FRAGMENT_SHADER,FS);
  gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);
  gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error("動画描画プログラムを初期化できません");
  this.matrix=gl.getUniformLocation(this.program,"uVP");
  this.sampler=gl.getUniformLocation(this.program,"uVideo");
  this.content=gl.getUniformLocation(this.program,"uContent");
  this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER,30*4,gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
  gl.bindVertexArray(null);
 }
 release(id){
  const record=this.textures.get(id);if(record)this.gl.deleteTexture(record.texture);
  this.textures.delete(id);
 }
 renderGround(vp,renderer,controller,entries){
  const gl=this.gl;
  if(!entries?.length||renderer.xrView)return; // XR per-eye integration is a later step
  const prevProgram=gl.getParameter(gl.CURRENT_PROGRAM);
  const prevVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);
  const prevActive=gl.getParameter(gl.ACTIVE_TEXTURE);
  gl.activeTexture(gl.TEXTURE0);
  const prevTexture=gl.getParameter(gl.TEXTURE_BINDING_2D);
  const prevFlip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const prevCull=gl.isEnabled(gl.CULL_FACE),prevBlend=gl.isEnabled(gl.BLEND);
  const prevDepth=gl.isEnabled(gl.DEPTH_TEST);
  const prevDepthMask=gl.getParameter(gl.DEPTH_WRITEMASK);
  try{
   gl.useProgram(this.program);gl.bindVertexArray(this.vao);
   gl.uniformMatrix4fv(this.matrix,false,new Float32Array(vp));
   gl.uniform1i(this.sampler,0);
   gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
   for(const item of entries){
    const video=item.video;
    if(!video||video.readyState<2||video.videoWidth<1||video.videoHeight<1)continue;
    const point=geoLocal(controller.origin.lat,controller.origin.lon,item.lat,item.lon,
      renderer.terrain.planet.radiusM);
    const x=point.eastM-renderer.cx,z=point.northM-renderer.cz;
    if(Math.hypot(point.eastM-controller.x,point.northM-controller.z)>65)continue;
    const y=terrainSurface(renderer.terrain,item.lat,item.lon).elevationM+item.height;
    const width=item.width,height=width/(item.aspect||16/9),angle=item.rotation*Math.PI/180;
    const dx=Math.cos(angle)*width*.5,dz=-Math.sin(angle)*width*.5;
    // 2 triangles; a tiny forward offset reduces coincident wall Z-fighting.
    const offX=Math.sin(angle)*.025,offZ=Math.cos(angle)*.025;
    const x1=x-dx+offX,x2=x+dx+offX,z1=z-dz+offZ,z2=z+dz+offZ;
    const top=y+height/2,bottom=y-height/2;
    const vertex=new Float32Array([
     x1,top,z1,0,1,x1,bottom,z1,0,0,x2,top,z2,1,1,
     x2,top,z2,1,1,x1,bottom,z1,0,0,x2,bottom,z2,1,0]);
    let record=this.textures.get(item.id);
    if(!record){
     const texture=gl.createTexture();
     gl.bindTexture(gl.TEXTURE_2D,texture);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
     record={texture,failed:false,video:null,lastTime:-1};this.textures.set(item.id,record);
    }
    if(record.failed)continue;
    gl.bindTexture(gl.TEXTURE_2D,record.texture);
    if(record.video!==video||record.lastTime!==video.currentTime){
     try{
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
      record.lastTime=video.currentTime;record.video=video;
     }catch(_){
      record.failed=true;
      this.onError(item.id,"配信元がWebGLへの映像転送を許可していません（CORS/DRM）。");
      continue;
     }
    }
    const actual=video.videoWidth/video.videoHeight,target=width/height;
    gl.uniform2f(this.content,Math.min(1,actual/target),Math.min(1,target/actual));
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,vertex);
    gl.drawArrays(gl.TRIANGLES,0,6);
   }
  }finally{
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,prevFlip);
   gl.bindVertexArray(prevVao);gl.bindTexture(gl.TEXTURE_2D,prevTexture);
   gl.activeTexture(prevActive);gl.useProgram(prevProgram);
   gl.depthMask(prevDepthMask);
   if(prevCull)gl.enable(gl.CULL_FACE);else gl.disable(gl.CULL_FACE);
   if(prevBlend)gl.enable(gl.BLEND);else gl.disable(gl.BLEND);
   if(prevDepth)gl.enable(gl.DEPTH_TEST);else gl.disable(gl.DEPTH_TEST);
  }
 }
 destroy(){
  for(const id of this.textures.keys())this.release(id);
  const gl=this.gl;gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);
  gl.deleteProgram(this.program);
 }
}
