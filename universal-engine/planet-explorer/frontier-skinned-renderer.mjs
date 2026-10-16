import {parseFrontierRig,poseFrontierRig,matIdentity,matMultiply} from "./frontier-animated.mjs";
const VS="#version 300 es\nprecision highp float;\nprecision highp int;\nlayout(location=0) in vec3 aPos;\nlayout(location=1) in vec3 aNormal;\nlayout(location=2) in vec3 aColor;\nlayout(location=3) in vec2 aUv;\nlayout(location=4) in vec4 aJoints;\nlayout(location=5) in vec4 aWeights;\nlayout(location=6) in vec3 aMorph0;\nlayout(location=7) in vec3 aMorph1;\nuniform mat4 uVP,uAvatar,uNode;\nuniform sampler2D uBones;\nuniform bool uSkin;\nuniform vec2 uMorph;\nuniform vec3 uCenter;\nuniform float uScale;\nout vec3 vColor,vNormal;\nout vec2 vUv;\nmat4 bone(int j){\n return mat4(texelFetch(uBones,ivec2(0,j),0),texelFetch(uBones,ivec2(1,j),0),texelFetch(uBones,ivec2(2,j),0),texelFetch(uBones,ivec2(3,j),0));\n}\nvoid main(){\n vec4 p=vec4(aPos+aMorph0*uMorph.x+aMorph1*uMorph.y,1.0);\n mat4 m=uNode;\n if(uSkin){\n  float w=aWeights.x+aWeights.y+aWeights.z+aWeights.w;\n  m=w>.001?bone(int(aJoints.x))*aWeights.x+\n             bone(int(aJoints.y))*aWeights.y+\n             bone(int(aJoints.z))*aWeights.z+\n             bone(int(aJoints.w))*aWeights.w:mat4(1.0);\n }\n vec4 posed=m*p;\n vec3 v=(posed.xyz-uCenter)*uScale;\n gl_Position=uVP*uAvatar*vec4(v,1.0);\n vNormal=normalize(mat3(uAvatar)*mat3(m)*aNormal);\n vColor=aColor;\n vUv=aUv;\n}";
const FS="#version 300 es\nprecision highp float;\nin vec3 vColor,vNormal;\nin vec2 vUv;\nuniform vec3 uLight;\nuniform sampler2D uColorTexture;\nuniform bool uTextured;\nout vec4 fragColor;\nvoid main(){\n vec4 texel=uTextured?texture(uColorTexture,vUv):vec4(1.0);\n if(texel.a<.1)discard;\n float sun=max(dot(normalize(vNormal),normalize(uLight)),0.0);\n fragColor=vec4(vColor*texel.rgb*(.6+.4*sun),1.0);\n}";
function compile(gl,type,src){
 const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
  const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error("GLB shader: "+reason);
 }
 return shader;
}
function createProgram(gl){
 const vert=compile(gl,gl.VERTEX_SHADER,VS),frag=compile(gl,gl.FRAGMENT_SHADER,FS);
 const program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);
 gl.linkProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
  const reason=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error("GLB program: "+reason);
 }
 return program;
}
function mesh(gl,prim){
 const vao=gl.createVertexArray(),buffers=[];
 gl.bindVertexArray(vao);
 for(const [name,at,size] of [["positions",0,3],["normals",1,3],["colors",2,3],["uv",3,2],
  ["joints",4,4],["weights",5,4],["morph0",6,3],["morph1",7,3]]){
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
  gl.bufferData(gl.ARRAY_BUFFER,prim.arrays[name],gl.STATIC_DRAW);
  gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,0,0);
  buffers.push(b);
 }
 const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);
 gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,prim.indices,gl.STATIC_DRAW);
 gl.bindVertexArray(null);
 return {vao,buffers,indices,count:prim.indices.length,source:prim};
}
function loadTexture(gl,image,owner){
 if(!image?.bytes)return null;
 const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 const result={tex,ready:false};
 if(typeof createImageBitmap==="function"){
  void createImageBitmap(new Blob([image.bytes],{type:image.mimeType})).then(bitmap=>{
   if(owner.disposed){bitmap.close?.();return;}
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
   result.ready=true;bitmap.close?.();
  }).catch(e=>console.warn("GLB texture decode:",e));
 }else if(typeof Image!=="undefined"){
  const url=URL.createObjectURL(new Blob([image.bytes],{type:image.mimeType})),im=new Image();
  im.onload=()=>{
   if(!owner.disposed){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);result.ready=true;}
   URL.revokeObjectURL(url);
  };
  im.onerror=()=>URL.revokeObjectURL(url);im.src=url;
 }
 return result;
}
const asFloat=m=>new Float32Array(m);
export class SkinnedFrontierAsset{
 constructor(gl,raw){
  this.gl=gl;this.rig=parseFrontierRig(raw);this.disposed=false;this.instances=new Map();
  this.meshes=[];this.textures=new Map();this.boneTexture=null;this.program=null;
  try{
   this.program=createProgram(gl);
   this.rig.images.forEach((img,i)=>{if(img)this.textures.set(i,loadTexture(gl,img,this));});
   this.meshes=this.rig.primitives.map(pr=>({...mesh(gl,pr),texture:this.textures.get(pr.textureImage)||null}));
   this.boneTexture=gl.createTexture();
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.boneTexture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   this.u=Object.fromEntries(["uVP","uAvatar","uNode","uBones","uSkin","uMorph","uScale","uCenter","uLight","uColorTexture","uTextured"].map(k=>[k,gl.getUniformLocation(this.program,k)]));
  }catch(error){this.destroy();throw error;}
 }
 get triangles(){return this.rig.triangles;}
 pose(id,dt,{moving=false,motion="idle",talking=false,giving=false}={}){
  let state=this.instances.get(id);
  if(!state){state={elapsed:0,face:0,kind:"idle",previous:null,fade:0};this.instances.set(id,state);}
  const kind=giving?"gift":talking?"talk":motion!=="idle"?motion:moving?"walk":"idle";
  if(kind!==state.kind){state.kind=kind;state.elapsed=0;state.fade=.12;}
  const step=Math.min(.12,Math.max(0,dt));state.elapsed+=step;state.face+=step;
  const pose=poseFrontierRig(this.rig,kind,state.elapsed,talking||giving?"faceTalking":"faceIdle",state.face);
  if(state.fade>0&&state.previous){
   const blend=Math.max(0,Math.min(1,1-state.fade/.12));
   pose.world=pose.world.map((matrix,i)=>matrix.map((value,j)=>(state.previous.world?.[i]?.[j]??value)*(1-blend)+value*blend));
   state.fade=Math.max(0,state.fade-step);
  }
  state.previous=pose;
  return pose;
 }
 draw(vp,avatar,light,id,dt,opts={}){
  const gl=this.gl,rig=this.rig,pose=this.pose(id,dt,opts);
  gl.useProgram(this.program);
  gl.uniformMatrix4fv(this.u.uVP,false,asFloat(vp));
  gl.uniformMatrix4fv(this.u.uAvatar,false,asFloat(avatar));
  gl.uniform1f(this.u.uScale,rig.scale);
  gl.uniform3fv(this.u.uCenter,asFloat(rig.center));
  gl.uniform3fv(this.u.uLight,asFloat(light));
  gl.uniform1i(this.u.uBones,0);gl.uniform1i(this.u.uColorTexture,1);
  for(let i=0;i<this.meshes.length;i++){
   const m=this.meshes[i],source=m.source;
   gl.uniformMatrix4fv(this.u.uNode,false,asFloat(pose.world[source.node]||matIdentity()));
   const face=pose.morphs[i]||[0,0];
   const indexes=source.names.map(n=>n.toLowerCase());
   const ey=indexes.findIndex(n=>n.includes("eye")),mouth=indexes.findIndex(n=>n.includes("mouth"));
   gl.uniform2fv(this.u.uMorph,asFloat(indexes.map((_,j)=>j===ey?face[0]:j===mouth?face[1]:0).concat([0,0]).slice(0,2)));
   const skin=Number.isInteger(source.skin)?rig.skins[source.skin]:null;
   if(skin?.joints?.length){
    const palette=new Float32Array(skin.joints.length*16);
    skin.joints.forEach((joint,j)=>palette.set(matMultiply(pose.world[joint]||matIdentity(),skin.inverseBind?.[j]||matIdentity()),j*16));
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.boneTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,skin.joints.length,0,gl.RGBA,gl.FLOAT,palette);
    gl.uniform1i(this.u.uSkin,1);
   }else gl.uniform1i(this.u.uSkin,0);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,m.texture?.tex||null);
   gl.uniform1i(this.u.uTextured,m.texture?.ready?1:0);
   gl.bindVertexArray(m.vao);
   gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);
  }
  gl.bindVertexArray(null);
 }
 destroy(){
  this.disposed=true;const gl=this.gl;
  for(const m of this.meshes||[]){
   for(const b of m.buffers)gl.deleteBuffer(b);
   gl.deleteBuffer(m.indices);gl.deleteVertexArray(m.vao);
  }
  for(const t of this.textures?.values()||[])gl.deleteTexture(t.tex);
  if(this.boneTexture)gl.deleteTexture(this.boneTexture);
  if(this.program)gl.deleteProgram(this.program);
  this.meshes=[];this.instances?.clear();
 }
}
