import {deformAvatarV10Face} from "./avatar-v10-face.mjs?v=1";
import {deformAvatarReviewFace} from "./avatar-review-face.mjs?v=20261114-original";
import {reviewShaderParams,reviewHairPreset} from "./avatar-review-adapter.mjs?v=20261114-original";
import {shaderBodyParams,shaderSwimParams,isBodySurface} from "./avatar-v10-body.mjs?v=20261114-body";
import {createAvatarV10BodyMesh} from "./avatar-v10-body-mesh.mjs?v=20261114";
import {parseFrontierRig,poseFrontierRig,matIdentity,matMultiply} from "./frontier-animated.mjs?v=20261114-crew-social-base-swim";
const VS=`#version 300 es\nprecision highp float;\nprecision highp int;\nlayout(location=0) in vec3 aPos;\nlayout(location=1) in vec3 aNormal;\nlayout(location=2) in vec3 aColor;\nlayout(location=3) in vec2 aUv;\nlayout(location=4) in vec4 aJoints;\nlayout(location=5) in vec4 aWeights;\nlayout(location=6) in vec3 aMorph0;\nlayout(location=7) in vec3 aMorph1;\nuniform mat4 uVP,uAvatar,uNode;\nuniform sampler2D uBones;\nuniform bool uSkin;\nuniform vec2 uMorph;\nuniform vec3 uCenter;\nuniform float uScale;\nuniform vec3 uBodyTop,uBodyMid,uBodyLow;
uniform vec3 uReviewA,uReviewB,uReviewC,uReviewD;
uniform vec3 uReviewVol,uReviewShape,uReviewFirm;
uniform vec2 uReviewHair;
uniform float uReviewMotion,uReviewHairMesh;
out vec3 vColor,vNormal;\nout vec2 vUv;\nout vec3 vBodyCoord;\nmat4 bone(int j){\n return mat4(texelFetch(uBones,ivec2(0,j),0),texelFetch(uBones,ivec2(1,j),0),texelFetch(uBones,ivec2(2,j),0),texelFetch(uBones,ivec2(3,j),0));\n}\nvoid main(){\n vec4 p=vec4(aPos+aMorph0*uMorph.x+aMorph1*uMorph.y,1.0);\n mat4 m=uNode;\n if(uSkin){\n  float w=aWeights.x+aWeights.y+aWeights.z+aWeights.w;\n  m=w>.001?bone(int(aJoints.x))*aWeights.x+\n             bone(int(aJoints.y))*aWeights.y+\n             bone(int(aJoints.z))*aWeights.z+\n             bone(int(aJoints.w))*aWeights.w:mat4(1.0);\n }\n vec4 posed=m*p;\n vec3 v=(posed.xyz-uCenter)*uScale;
 float y=v.y;
 float shoulders=exp(-pow((y-1.42)/.20,2.));
 float chest=exp(-pow((y-1.22)/.20,2.));
 float waist=exp(-pow((y-.99)/.20,2.));
 float hips=exp(-pow((y-.83)/.18,2.));
 float arms=smoothstep(.27,.49,abs(v.x))*smoothstep(.67,.91,y)*(1.0-smoothstep(1.57,1.72,y));
 float hands=smoothstep(.52,.75,abs(v.x))*smoothstep(.65,.81,y)*(1.0-smoothstep(1.24,1.44,y));
 float legs=1.0-smoothstep(.65,.89,y);
 float feet=1.0-smoothstep(.07,.22,y);
 float xWidth=1.0+uBodyTop.y*.19*shoulders+uBodyTop.z*.12*chest+
   uBodyMid.x*.16*waist+uBodyMid.y*.17*hips+uBodyMid.z*.13*arms+
   uBodyLow.x*.14*hands+uBodyLow.y*.14*legs+uBodyLow.z*.15*feet;
 float zWidth=1.0+uBodyTop.z*.14*chest+uBodyMid.x*.10*waist+
   uBodyMid.y*.12*hips+uBodyMid.z*.10*arms+uBodyLow.y*.10*legs;
 vBodyCoord=v;
 v.x*=xWidth;v.z*=zWidth;v.y*=1.0+uBodyTop.x*.16;
 // Original Avatar Review percent scales: head, torso, arms, legs, hands, feet.
 float ay=abs(v.x);
 float head=smoothstep(1.45,1.62,y);
 float torso=smoothstep(.69,.89,y)*(1.0-smoothstep(1.43,1.58,y))*(1.0-smoothstep(.29,.52,ay));
 float arm=smoothstep(.24,.45,ay)*smoothstep(.66,.93,y)*(1.0-smoothstep(1.47,1.62,y));
 float hand=smoothstep(.53,.73,ay)*smoothstep(.65,.81,y)*(1.0-smoothstep(1.16,1.39,y));
 float leg=(1.0-smoothstep(.70,.94,y))*(1.0-smoothstep(.15,.28,y));
 float foot=(1.0-smoothstep(.07,.25,y));
 arm*=1.0-hand;
 leg*=1.0-foot;
 float wX=1.0+uReviewA.y*head+uReviewB.x*torso+
  uReviewB.z*arm+uReviewC.y*leg+uReviewD.x*hand+uReviewD.z*foot;
 float wZ=1.0+uReviewA.y*head+uReviewB.x*torso+
  uReviewB.z*arm+uReviewC.y*leg+uReviewD.x*hand+uReviewD.z*foot;
 v.x*=wX;v.z*=wZ;
 v.y+=uReviewC.x*clamp(y-.13,0.0,.67)+
  uReviewA.z*clamp(y-.80,0.0,.68)+uReviewA.x*clamp(y-1.48,0.0,.26);
 v.x+=sign(v.x)*(uReviewB.y*.13*arm+uReviewC.z*.11*hand);
 v.y+=uReviewB.y*.075*arm+uReviewC.z*.045*hand+uReviewD.y*.028*foot;
 // Original localized volume sculpt (avatar-deformation.js), adapted from
 // head-relative metres to the 1.8m compact avatar.
 float h=y-.84,ax=ay;
 float front=smoothstep(.018,.089,vBodyCoord.z);
 float back=smoothstep(.021,.084,-vBodyCoord.z);
 float lateral=1.0-smoothstep(.181,.247,ax);
 float chest=exp(-pow((ax-.085)/.092,2.)-pow((h-.326)/.078,2.));
 float abdomen=exp(-pow(ax/.116,2.)-pow((h-.141)/.106,2.));
 float glutes=exp(-pow((ax-.076)/.093,2.)-pow((h+.035)/.108,2.));
 float breastBias=clamp((.326-h)/.083,-1.,1.);
 float bellyBias=clamp((.170-h)/.11,-1.,1.);
 float seatBias=clamp((h+.051)/.102,-1.,1.);
 float bumpX=v.x*lateral*(.14*uReviewVol.x*chest*front+
  .19*uReviewVol.y*abdomen*front+
  glutes*back*(.22*uReviewVol.z+.073*uReviewShape.z));
 float bumpY=lateral*(-.018*chest*front*uReviewShape.x-
  .014*abdomen*front*uReviewShape.y+.017*glutes*back*uReviewShape.z);
 float bumpZ=lateral*(front*(chest*(.057*uReviewVol.x+
  .029*uReviewShape.x*(.40+.77*breastBias))+
  abdomen*(.073*uReviewVol.y+.032*uReviewShape.y*(.50+.64*bellyBias)))-
  back*glutes*(.068*uReviewVol.z+.038*uReviewShape.z*(.48+.62*seatBias)));
 v+=vec3(bumpX,bumpY,bumpZ);
 // Three.js editor uses additional skinned soft-bones. The WebGL renderer
 // approximates their motion without changing the shared rig topology.
 float motion=sin(uReviewMotion*13.0)*smoothstep(.01,.16,uReviewMotion);
 float softness=dot(vec3(chest*front,abdomen*front,glutes*back),
  (1.0-uReviewFirm)*.0035)*lateral*motion;
 v.z+=softness*sign(v.z);
 if(uReviewHairMesh>.5){
  float ends=1.0-smoothstep(1.48,1.66,y);
  v.x*=1.0+uReviewHair.y*(.32+.44*ends);
  v.z*=1.0+uReviewHair.y*(.32+.44*ends);
  v.y+=uReviewHair.x*ends*.22;
 }
 gl_Position=uVP*uAvatar*vec4(v,1.0);\n vNormal=normalize(mat3(uAvatar)*mat3(m)*aNormal);\n vColor=aColor;\n vUv=aUv;\n}`;
const FS=`#version 300 es\nprecision highp float;\nin vec3 vColor,vNormal;\nin vec2 vUv;\nin vec3 vBodyCoord;\nuniform vec3 uLight;\nuniform sampler2D uColorTexture;\nuniform bool uTextured,uLinearColor,uGloves;\nuniform vec3 uGloveColor;\nuniform bool uSwimBody,uSwimFabric;\nuniform int uSwimStyle;\nuniform vec3 uSwimColor;\nout vec4 fragColor;\nvoid main(){\n vec4 texel=uTextured?texture(uColorTexture,vUv):vec4(1.0);\n if(texel.a<.1)discard;\n float sun=max(dot(normalize(vNormal),normalize(uLight)),0.0);\n vec3 color=(uGloves?uGloveColor:vColor)*texel.rgb*(.6+.4*sun);
 // Procedural skin-fitting swimwear: works for every V10 body without
 // hiding the body mesh or showing the unrelated casual outfit.
 if(uSwimFabric)color=mix(color,uSwimColor*(.7+.3*sun),.92);\n if(uSwimBody){
  float y=vBodyCoord.y,x=abs(vBodyCoord.x);
  float torso=1.0-smoothstep(.30,.45,x);
  float hip=1.0-smoothstep(.30,.49,x);
  float upper=smoothstep(1.07,1.15,y)*(1.0-smoothstep(1.34,1.43,y))*torso;
  float lower=smoothstep(.68,.74,y)*(1.0-smoothstep(.90,.97,y))*hip;
  float onepiece=smoothstep(.72,.82,y)*(1.0-smoothstep(1.35,1.44,y))*torso;
  float coverage=uSwimStyle==1?max(onepiece,lower):(uSwimStyle==2?max(upper,lower):lower);
  color=mix(color,uSwimColor*(.7+.3*sun),clamp(coverage,0.0,1.0));
 }
 if(uLinearColor)color=mix(color*12.92,1.055*pow(color,vec3(1.0/2.4))-.055,step(vec3(.0031308),color));
 fragColor=vec4(color,1.0);\n}`;
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
  const body=createAvatarV10BodyMesh(this.rig);
  if(body)this.rig.primitives.push(body);
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
   this.u=Object.fromEntries(["uVP","uAvatar","uNode","uBones","uSkin","uMorph","uScale","uCenter","uLight","uColorTexture","uTextured","uLinearColor","uGloves","uGloveColor","uBodyTop","uBodyMid","uBodyLow","uReviewA","uReviewB","uReviewC","uReviewD","uReviewVol","uReviewShape","uReviewFirm","uReviewHair","uReviewMotion","uReviewHairMesh","uSwimBody","uSwimFabric","uSwimStyle","uSwimColor"].map(k=>[k,gl.getUniformLocation(this.program,k)]));
  }catch(error){this.destroy();throw error;}
 }
 get triangles(){return this.rig.triangles;}
 pose(id,dt,{moving=false,motion="idle",talking=false,giving=false,motionProgress=null,variant="overhead",hand="right",time=null,gesture=null,lookAt=null}={}){
  let state=this.instances.get(id);
  if(!state){state={elapsed:0,face:0,kind:"idle",previous:null,fade:0};this.instances.set(id,state);}
  const kind=giving?"gift":talking?"talk":motion!=="idle"?motion:moving?"walk":"idle";
  if(kind!==state.kind){state.kind=kind;state.elapsed=0;state.fade=.12;}
  const step=Math.min(.12,Math.max(0,dt));state.elapsed+=step;state.face+=step;
  const body=gesture?"idle":kind;
  const options={motionProgress,variant,hand,moving};
  if(lookAt)options.lookAt=lookAt;
  if(gesture)options.gesture=gesture;
  const pose=poseFrontierRig(this.rig,body,time??state.elapsed,talking||giving?"faceTalking":"faceIdle",state.face,options);
  if(time!==null)state.fade=0;
  if(time===null&&state.fade>0&&state.previous){
   const blend=Math.max(0,Math.min(1,1-state.fade/.12));
   pose.world=pose.world.map((matrix,i)=>matrix.map((value,j)=>(state.previous.world?.[i]?.[j]??value)*(1-blend)+value*blend));
   state.fade=Math.max(0,state.fade-step);
  }
  state.previous=pose;
  return pose;
 }
 applyFace(mesh,fit){
  const rig=this.rig,shape=fit?.appearance||fit?.face;
  if(fit?.preserveOriginal){
   // Face morphs update GPU buffers in place. Switching back to the original
   // must also restore those buffers, not merely disable new deformation.
   if(mesh.appliedFace){
    const attrs=["positions","normals","colors","uv","joints","weights","morph0","morph1"];
    for(let i=0;i<attrs.length;i++){
     this.gl.bindBuffer(this.gl.ARRAY_BUFFER,mesh.buffers[i]);
     this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,mesh.source.arrays[attrs[i]]);
    }
    mesh.appliedFace=null;
   }
   return;
  }
  if(!rig.isV10||!shape||!rig.faceLandmarks||mesh.appliedFace===shape)return;
  const female=["lyra","mina","sera"].includes(fit?.model);
  const data=fit?.appearance?deformAvatarReviewFace(mesh.source,shape,rig.faceLandmarks,female):
   deformAvatarV10Face(mesh.source,shape,rig.faceLandmarks);
  if(!data)return;
  const attributes=["positions","normals","colors","uv","joints","weights","morph0","morph1"];
  for(const [attribute,values] of Object.entries(data)){
   this.gl.bindBuffer(this.gl.ARRAY_BUFFER,mesh.buffers[attributes.indexOf(attribute)]);
   this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,values);
  }
  mesh.appliedFace=shape;
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
  gl.uniform1i(this.u.uLinearColor,rig.isV10?1:0);
  const body=rig.isV10&&!opts.fit?.appearance?shaderBodyParams(opts.fit?.body):Array(9).fill(0);
  gl.uniform3fv(this.u.uBodyTop,asFloat(body.slice(0,3)));
  gl.uniform3fv(this.u.uBodyMid,asFloat(body.slice(3,6)));
  gl.uniform3fv(this.u.uBodyLow,asFloat(body.slice(6,9)));
  const review=reviewShaderParams(rig.isV10&&!opts.fit?.preserveOriginal?opts.fit?.appearance:null);
  const a=review.ratios;
  gl.uniform3fv(this.u.uReviewA,asFloat(a.slice(0,3)));
  gl.uniform3fv(this.u.uReviewB,asFloat(a.slice(3,6)));
  gl.uniform3fv(this.u.uReviewC,asFloat(a.slice(6,9)));
  gl.uniform3fv(this.u.uReviewD,asFloat(a.slice(9,12)));
  gl.uniform3fv(this.u.uReviewVol,asFloat(review.volume));
  gl.uniform3fv(this.u.uReviewShape,asFloat(review.shape));
  gl.uniform3fv(this.u.uReviewFirm,asFloat(review.firmness));
  const preset=opts.fit?.preserveOriginal?[1,1]:reviewHairPreset(review.appearance.hairStyle);
  gl.uniform2fv(this.u.uReviewHair,asFloat([
   (preset[0]-1)+review.hair[0],(preset[1]-1)+review.hair[1]
  ]));
  const motion=opts.moving||["walk","run","crouch","sit"].includes(opts.motion);
  gl.uniform1f(this.u.uReviewMotion,!opts.fit?.preserveOriginal&&motion?(this.instances.get(id)?.elapsed||0):0);
  const swim=shaderSwimParams(opts.fit);
  gl.uniform1i(this.u.uSwimStyle,swim.style);
  gl.uniform3fv(this.u.uSwimColor,asFloat(swim.color));
  const palettes=rig.skins.map(skin=>{
   const palette=new Float32Array(skin.joints.length*16);
   skin.joints.forEach((joint,j)=>palette.set(matMultiply(pose.world[joint]||matIdentity(),skin.inverseBind?.[j]||matIdentity()),j*16));
   return palette;
  });
  let boundSkin=null;
  const outfit=opts.fit?.outfit||"work";
  const hasDedicatedSwim=this.meshes.some(m=>m.source.wardrobe?.includes("swim")&&
   !m.source.wardrobe?.includes("base")&&/(?:swim|suit|trunk)/i.test(m.source.name||""));
  const useOriginalSwim=outfit==="swim"&&swim.style===0&&hasDedicatedSwim;
  const renderedOutfit=outfit==="swim"&&!useOriginalSwim?"base":outfit;
  for(let i=0;i<this.meshes.length;i++){
   const m=this.meshes[i],source=m.source;
   // First-person cabin view keeps the fitted body/arms/legs, not the
   // wearer’s face and hair in front of the headset cameras.
   if(opts.firstPerson&&/(?:head|face|hair|eyebrow|eyelash|eye|nose|mouth|ear|neck)/i.test(source.name||""))continue;
   if(review.hideHair&&/(?:layered hair|hair)/i.test(source.name||""))continue;
   // Neutral base-body mannequin excludes removable wardrobe geometry.
   if(source.wardrobe&&!source.wardrobe.includes(renderedOutfit))continue;
   const surface=rig.isV10&&isBodySurface(source.name,source.wardrobe);
   gl.uniform1i(this.u.uSwimBody,Boolean(outfit==="swim"&&!useOriginalSwim&&surface&&source.name==="V10 generated full body skin")?1:0);
   gl.uniform1i(this.u.uSwimFabric,Boolean(useOriginalSwim&&source.wardrobe?.includes("swim")&&/(?:suit|swim|trunk)/i.test(source.name||""))?1:0);
   gl.uniform1f(this.u.uReviewHairMesh,source.name==="Layered hair"?1:0);
   this.applyFace(m,opts.fit);
   const glove=outfit==="space"&&source.gloveColor;
   gl.uniform1i(this.u.uGloves,glove?1:0);
   if(glove)gl.uniform3fv(this.u.uGloveColor,asFloat(glove));
   gl.uniformMatrix4fv(this.u.uNode,false,asFloat(pose.world[source.node]||matIdentity()));
   const face=pose.morphs[i]||[0,0];
   const indexes=source.names.map(n=>n.toLowerCase());
   const ey=indexes.findIndex(n=>n.includes("eye")||n==="blink"),mouth=indexes.findIndex(n=>n.includes("mouth")||n==="smile");
   gl.uniform2fv(this.u.uMorph,asFloat(indexes.map((_,j)=>j===ey?face[0]:j===mouth?face[1]:0).concat([0,0]).slice(0,2)));
   const skin=Number.isInteger(source.skin)?rig.skins[source.skin]:null;
   if(skin?.joints?.length){
    if(boundSkin!==source.skin){
     boundSkin=source.skin;
     gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.boneTexture);
     gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,skin.joints.length,0,gl.RGBA,gl.FLOAT,palettes[source.skin]);
    }
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
