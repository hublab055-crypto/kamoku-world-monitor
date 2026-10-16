/* Frontier World - reusable articulated battle cutout rig
 * V1: joint-animated parts from a character's existing pose atlas.
 * No animation state is saved. Rendering has no combat side effects.
 */
(function(global){
 "use strict";
 const RAD=Math.PI/180;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
 const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
 const lerp=(a,b,t)=>a+(b-a)*t;
 const KEYS=["torso","head","frontUpper","frontLower","rearUpper","rearLower","frontThigh","frontShin","rearThigh","rearShin","frontStep","rearStep","bodyY","weapon"];
 const ZERO={torso:0,head:0,frontUpper:0,frontLower:0,rearUpper:0,rearLower:0,frontThigh:0,frontShin:0,rearThigh:0,rearShin:0,frontStep:0,rearStep:0,bodyY:0,weapon:0};
 const k=(t,values)=>({t,values});
 // Angles are in degrees until interpolated. Each action has wind-up, attack/impact, recovery.
 // Timings are normalized; can be driven by player/NPC existing weaponAnim or preview.
 const CLIPS={
   rearShin:[[91,266],[117,265],[121,315],[83,319],[80,296]],
   rearThigh:[[91,218],[126,217],[119,280],[91,282],[86,248]],
   rearUpper:[[76,134],[115,132],[110,165],[92,204],[61,202],[61,174]],
   rearLower:[[61,184],[99,186],[92,219],[84,244],[49,237],[46,213]],
   torso:[[88,111],[159,108],[183,133],[177,204],[172,244],[84,243],[78,204],[73,138]],
   frontThigh:[[132,219],[168,217],[176,265],[162,283],[133,277]],
   frontShin:[[141,264],[176,264],[184,318],[145,319],[137,293]],
   head:[[56,7],[200,7],[210,70],[198,124],[168,140],[89,141],[59,121],[51,71]],
   frontUpper:[[144,128],[188,127],[209,165],[204,206],[170,206],[161,174]],
   frontLower:[[170,187],[212,187],[226,223],[218,248],[179,239],[169,220]]
 };

 // Mask silhouettes calibrated against the original boy2 256x324 idle image.
 // Existing girl1 CLIPS remain the fallback. These are visual defaults, not final authored sprites.
 const CHARACTER_CLIPS={
  boy2:{
   head:[[49,20],[177,18],[213,51],[217,109],[203,154],[175,177],[89,179],[53,153],[40,105],[43,61]],
   torso:[[86,163],[167,163],[190,186],[190,235],[175,271],[85,267],[66,226],[72,186]],
   rearUpper:[[71,174],[104,169],[110,199],[100,231],[68,228],[65,205]],
   rearLower:[[64,215],[102,213],[104,242],[90,262],[65,256],[58,239]],
   frontUpper:[[161,174],[196,172],[209,202],[209,230],[175,237],[161,207]],
   frontLower:[[168,215],[207,214],[211,244],[193,262],[165,251],[161,233]],
   rearThigh:[[97,255],[129,253],[139,279],[127,293],[102,288],[92,271]],
   rearShin:[[97,276],[130,278],[136,320],[97,322],[90,296]],
   frontThigh:[[129,253],[165,252],[174,279],[166,291],[135,291],[122,274]],
   frontShin:[[131,277],[172,277],[179,320],[130,322],[125,299]]
  }
 };
 const JOINTS={
  rearThigh:{hip:[108,224],knee:[108,267]},
  rearShin:{hip:[108,224],knee:[106,270]},
  frontThigh:{hip:[148,224],knee:[153,268]},
  frontShin:{hip:[148,224],knee:[156,270]},
  rearUpper:{shoulder:[89,142],elbow:[71,187]},
  rearLower:{shoulder:[89,142],elbow:[70,189]},
  frontUpper:{shoulder:[170,143],elbow:[191,189]},
  frontLower:{shoulder:[170,143],elbow:[193,189]}
 };
 const TRACKS={
  idle:[k(0,{})],
  slash:[
   k(0,{}),k(.18,{torso:-7,head:3,frontUpper:-50,frontLower:-40,rearUpper:25,frontThigh:-12,rearThigh:12,weapon:-25}),
   k(.39,{torso:-16,frontUpper:-100,frontLower:-52,rearUpper:36,frontThigh:-24,frontShin:13,bodyY:-5,weapon:-38}),
   k(.56,{torso:19,head:-9,frontUpper:67,frontLower:37,rearUpper:-15,frontThigh:27,frontShin:-22,rearThigh:-19,bodyY:3,weapon:36}),
   k(.70,{torso:14,frontUpper:48,frontLower:15,frontThigh:21,frontShin:-17,weapon:25}),
   k(1,{})
  ],
  thrust:[
   k(0,{}),k(.25,{torso:-9,frontUpper:-37,frontLower:-52,rearUpper:24,frontThigh:-12,weapon:-22}),
   k(.45,{torso:-13,frontUpper:-42,frontLower:-62,frontThigh:-24,frontShin:15,bodyY:-6,weapon:-12}),
   k(.65,{torso:18,frontUpper:-64,frontLower:-78,frontThigh:25,frontShin:-18,rearThigh:-10,weapon:12}),
   k(.83,{torso:10,frontUpper:-58,frontLower:-60,weapon:10}),k(1,{})
  ],
  axe:[
   k(0,{}),k(.18,{torso:-10,frontUpper:-55,frontLower:-14,rearUpper:-38,rearLower:-20,frontThigh:-16,weapon:-27}),
   k(.43,{torso:-21,head:10,frontUpper:-131,frontLower:-40,rearUpper:-95,rearLower:-28,frontThigh:-27,frontShin:18,bodyY:-8,weapon:-49}),
   k(.49,{torso:-21,frontUpper:-129,frontLower:-40,rearUpper:-96,bodyY:-8,weapon:-49}),
   k(.68,{torso:30,head:-11,frontUpper:84,frontLower:38,rearUpper:18,rearLower:9,frontThigh:34,frontShin:-26,rearThigh:-24,bodyY:10,weapon:55}),
   k(.84,{torso:24,frontUpper:75,frontLower:31,rearUpper:8,frontThigh:29,weapon:46}),k(1,{})
  ],
  bow:[
   k(0,{}),k(.21,{torso:-3,frontUpper:-65,frontLower:-55,rearUpper:-36,rearLower:-75,frontThigh:-5,weapon:-20}),
   k(.44,{torso:-8,frontUpper:-81,frontLower:-68,rearUpper:-53,rearLower:-99,frontThigh:-11,weapon:-16}),
   k(.67,{torso:-8,frontUpper:-81,frontLower:-68,rearUpper:-53,rearLower:-110,weapon:-16}),
   k(.78,{torso:7,frontUpper:-62,frontLower:-50,rearUpper:-12,rearLower:-16,bodyY:-2,weapon:5}),
   k(1,{})
  ],
  combo:[
   k(0,{}),k(.15,{torso:-7,frontUpper:-75,frontLower:-20,rearUpper:22,frontThigh:-14,weapon:-35}),
   k(.28,{torso:17,frontUpper:63,frontLower:28,frontThigh:25,rearThigh:-17,weapon:29}),
   k(.37,{torso:-10,frontUpper:-47,frontLower:-36,frontThigh:-12,weapon:-28}),
   k(.53,{torso:-19,frontUpper:-96,frontLower:-50,rearUpper:31,frontThigh:-22,weapon:-39}),
   k(.62,{torso:15,frontUpper:54,frontLower:23,frontThigh:22,weapon:30}),
   k(.70,{torso:-9,frontUpper:-56,frontLower:-38,rearUpper:25,frontThigh:-17,weapon:-20}),
   k(.82,{torso:27,frontUpper:82,frontLower:40,frontThigh:32,frontShin:-20,weapon:49}),
   k(1,{})
  ],
  block:[
   k(0,{}),k(.20,{torso:-11,head:8,frontUpper:-71,frontLower:-48,rearUpper:-13,frontThigh:14,frontShin:-26,rearThigh:-15,bodyY:8}),
   k(.47,{torso:-13,head:6,frontUpper:-73,frontLower:-49,rearUpper:-19,frontThigh:17,frontShin:-24,rearThigh:-15,bodyY:10}),
   k(.55,{torso:-19,head:8,frontUpper:-78,frontLower:-52,bodyY:14,frontThigh:19,frontShin:-24}),
   k(.82,{torso:-11,frontUpper:-71,frontLower:-48,frontThigh:14,frontShin:-25,bodyY:8}),k(1,{})
  ],
  dodge:[
   k(0,{}),k(.17,{torso:-9,frontUpper:30,rearUpper:-30,frontThigh:18,frontShin:-30,rearThigh:-20,bodyY:10}),
   k(.39,{torso:-22,frontUpper:80,frontLower:30,rearUpper:-55,rearLower:45,frontThigh:-46,frontShin:60,rearThigh:50,rearShin:-54,bodyY:-28}),
   k(.57,{torso:-17,frontUpper:50,frontLower:25,rearUpper:-24,frontThigh:-32,frontShin:35,rearThigh:28,bodyY:-16}),
   k(.79,{torso:9,frontUpper:-20,rearUpper:20,frontThigh:16,rearThigh:-16,bodyY:7}),k(1,{})
  ],
  hit:[
   k(0,{}),k(.25,{torso:-10,head:10,frontUpper:15,rearUpper:-12,bodyY:-2}),
   k(.45,{torso:-28,head:15,frontUpper:38,frontLower:15,rearUpper:-35,rearLower:20,frontThigh:-19,frontShin:16,bodyY:9}),
   k(.70,{torso:-23,head:8,frontUpper:23,rearUpper:-30,frontThigh:-19,bodyY:9}),k(1,{})
  ],
  fall:[
   k(0,{}),k(.22,{torso:-18,head:12,frontUpper:50,rearUpper:-30,frontThigh:-20,bodyY:4}),
   k(.54,{torso:-53,head:12,frontUpper:79,frontLower:35,rearUpper:-35,frontThigh:55,rearThigh:-52,frontShin:37,rearShin:-15,bodyY:28}),
   k(.83,{torso:-84,head:21,frontUpper:85,frontLower:55,rearUpper:-50,frontThigh:77,rearThigh:-72,frontShin:32,bodyY:43}),
   k(1,{torso:-84,head:21,frontUpper:85,frontLower:55,rearUpper:-50,frontThigh:77,rearThigh:-72,frontShin:32,bodyY:43})
  ],
  victory:[
   k(0,{}),k(.18,{torso:-5,frontUpper:-55,rearUpper:-45,frontLower:-20,rearLower:10,bodyY:-7}),
   k(.36,{torso:-10,frontUpper:-143,rearUpper:-125,frontLower:-42,rearLower:-35,head:9,frontThigh:-12,rearThigh:12,bodyY:-27,weapon:-31}),
   k(.51,{torso:3,frontUpper:-135,rearUpper:-119,bodyY:1,weapon:-23}),
   k(.75,{torso:-7,frontUpper:-146,rearUpper:-133,bodyY:-23,weapon:-30}),k(1,{})
  ]
 };

 // Character/direction-specific editable calibration. All coordinates use the original 256x324 atlas cell.
 const STORE="frontierWorldBattleRigAdjustmentsV1";
 const DEFAULT_JOINTS={
  neck:[128,125],body:[128,222],
  frontShoulder:[170,143],frontElbow:[193,189],frontHand:[207,226],
  rearShoulder:[89,142],rearElbow:[70,189],rearHand:[63,225],
  frontHip:[148,224],frontKnee:[156,270],
  rearHip:[108,224],rearKnee:[106,270]
 };
 const JOINT_NAMES=Object.keys(DEFAULT_JOINTS);
 const PART_NAMES=Object.keys(CLIPS);
 const PRESET_DELTAS={
  girl1:{
   front:{frontShoulder:[-7,3],frontElbow:[-14,-4],frontHand:[-18,-13],rearShoulder:[3,5],rearElbow:[7,-5],rearHand:[14,-13],frontHip:[2,5],frontKnee:[-3,5],rearHip:[3,6],rearKnee:[2,3]},
   right:{frontShoulder:[-16,3],frontElbow:[-18,-3],frontHand:[-17,-4],rearShoulder:[15,3],rearElbow:[13,-2],rearHand:[13,-4]},
   back:{frontShoulder:[-2,1],frontElbow:[-4,-2],rearShoulder:[2,1],rearElbow:[4,-2]}
  },
  boy2:{
   front:{
    neck:[0,42],body:[0,40],
    frontShoulder:[-1,41],frontElbow:[-13,32],frontHand:[-20,21],
    rearShoulder:[-2,43],rearElbow:[9,34],rearHand:[15,23],
    frontHip:[1,44],frontKnee:[-5,23],rearHip:[0,43],rearKnee:[2,22]
   },
   right:{
    neck:[-1,43],body:[-2,41],
    frontShoulder:[-16,40],frontElbow:[-18,32],frontHand:[-20,24],
    rearShoulder:[12,41],rearElbow:[13,31],rearHand:[14,23],
    frontHip:[-8,42],frontKnee:[-8,22],rearHip:[-3,43],rearKnee:[-4,21]
   },
   back:{
    neck:[0,41],body:[0,40],
    frontShoulder:[-3,43],frontElbow:[-8,34],frontHand:[-12,23],
    rearShoulder:[3,43],rearElbow:[8,34],rearHand:[12,23],
    frontHip:[1,43],frontKnee:[-4,22],rearHip:[0,44],rearKnee:[3,22]
   }
  }
 };
 const VALID_DIRECTIONS=["front","right","left","back"];
 const copy=o=>JSON.parse(JSON.stringify(o));
 function positive(v,fallback){const n=Number(v);return Number.isFinite(n)?n:fallback}
 function directionOf(dir){return VALID_DIRECTIONS.includes(dir)?dir:"front"}
 function basicProfile(id,dir){
  const actual=dir==="left"?"right":directionOf(dir);
  const p={profileKind:id==="boy2"?"boy2":id==="girl1"?"girl1":"default",joints:copy(DEFAULT_JOINTS),parts:{},masks:{}};
  for(const part of PART_NAMES)p.parts[part]={x:0,y:0,scale:1};
  const shifts=PRESET_DELTAS[id]&&PRESET_DELTAS[id][actual]||{};
  for(const key of JOINT_NAMES){
   const delta=shifts[key]||[0,0];
   p.joints[key]=[p.joints[key][0]+delta[0],p.joints[key][1]+delta[1]];
  }
  return p;
 }
 function validated(id,dir,input){
  const profile=basicProfile(id,dir),o=input&&typeof input==="object"?input:{};
  for(const key of JOINT_NAMES){
   const x=o.joints&&o.joints[key];
   if(Array.isArray(x)&&x.length===2){
    profile.joints[key]=[
     Math.round(clamp(positive(x[0],profile.joints[key][0]),0,256)*10)/10,
     Math.round(clamp(positive(x[1],profile.joints[key][1]),0,324)*10)/10
    ];
   }
  }
  for(const key of PART_NAMES){
   const part=o.parts&&o.parts[key];if(!part)continue;
   profile.parts[key]={
    x:Math.round(clamp(positive(part.x,0),-48,48)*10)/10,
    y:Math.round(clamp(positive(part.y,0),-48,48)*10)/10,
    scale:Math.round(clamp(positive(part.scale,1),.65,1.45)*1000)/1000
   };
  }
  // Custom editable source-pixel silhouettes for independently movable limbs.
  for(const name of PART_NAMES){
   const polygon=o.masks&&o.masks[name];
   if(!Array.isArray(polygon)||polygon.length<3||polygon.length>28)continue;
   const points=[];
   for(const point of polygon){
    if(!Array.isArray(point)||point.length!==2||!point.every(v=>Number.isFinite(v))){points.length=0;break;}
    points.push([Math.round(clamp(point[0],0,256)*10)/10,Math.round(clamp(point[1],0,324)*10)/10]);
   }
   if(points.length>=3)profile.masks[name]=points;
  }
  return profile;
 }
 let edits={characters:{}},lastRead=-Infinity;
 function loadEdits(){
  const now=Date.now();if(now-lastRead<650)return;
  lastRead=now;
  try{
   const data=JSON.parse(localStorage.getItem(STORE)||"{}");
   if(data&&data.characters&&typeof data.characters==="object")edits={characters:data.characters};
  }catch(error){edits={characters:{}}}
 }
 function getProfile(id,dir){
  id=String(id||"default");dir=directionOf(dir);loadEdits();
  const input=edits.characters[id]&&edits.characters[id][dir];
  return validated(id,dir,input);
 }
 function saveEdits(){
  try{localStorage.setItem(STORE,JSON.stringify({version:1,characters:edits.characters}));lastRead=Date.now();return true;}
  catch(e){return false}
 }
 function setProfile(id,dir,p){
  id=String(id||"default");if(id.length>80)throw Error("Invalid character id");
  dir=directionOf(dir);loadEdits();
  const next=validated(id,dir,p);
  if(!edits.characters[id])edits.characters[id]={};
  edits.characters[id][dir]=next;
  return saveEdits();
 }
 function resetProfile(id,dir){
  id=String(id||"default");dir=directionOf(dir);loadEdits();
  if(edits.characters[id])delete edits.characters[id][dir];
  saveEdits();return getProfile(id,dir);
 }
 function exportProfiles(){
  loadEdits();return {version:1,characters:copy(edits.characters)};
 }
 function importProfiles(input){
  if(!input||!input.characters||typeof input.characters!=="object"||Array.isArray(input.characters))throw Error("Invalid profile JSON");
  const next={};let count=0;
  for(const [id,dirs] of Object.entries(input.characters)){
   if(!/^[\w-]{1,80}$/.test(id)||!dirs||typeof dirs!=="object")continue;
   const chosen={};
   for(const dir of VALID_DIRECTIONS){
    if(dirs[dir]){chosen[dir]=validated(id,dir,dirs[dir]);count++}
   }
   if(Object.keys(chosen).length)next[id]=chosen;
   if(count>200)throw Error("Too many character profiles");
  }
  edits={characters:next};saveEdits();
  return count;
 }

 function registerTracks(definitions){
  if(!definitions||typeof definitions!=="object"||Array.isArray(definitions))return [];
  const added=[];
  for(const [id,frames] of Object.entries(definitions)){
   if(!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(id)||Object.prototype.hasOwnProperty.call(TRACKS,id)||!Array.isArray(frames)||frames.length<2||frames.length>32)continue;
   let previous=-1,valid=true;
   const checked=frames.map(frame=>{
    const t=Number(frame&&frame.t),values=frame&&frame.values;
    if(!Number.isFinite(t)||t<0||t>1||t<=previous||!values||typeof values!=="object"){valid=false;return null;}
    previous=t;
    const out={};
    for(const [key,value] of Object.entries(values)){
     if(!KEYS.includes(key)||!Number.isFinite(value)||Math.abs(value)>200){valid=false;continue;}
     out[key]=value;
    }
    return {t,values:out};
   });
   if(valid&&checked[0].t===0&&checked[checked.length-1].t===1){TRACKS[id]=checked;added.push(id);}
  }
  return added;
 }
 function sample(action,time){
  const arr=TRACKS[action]||TRACKS.idle;
  const p=clamp(time);let a=arr[0],b=arr[arr.length-1];
  for(let i=0;i<arr.length-1;i++){if(p<=arr[i+1].t){a=arr[i];b=arr[i+1];break}}
  const ratio=a===b?0:ease((p-a.t)/Math.max(.0001,b.t-a.t));
  const out={};
  for(const key of KEYS)out[key]=lerp(a.values[key]||0,b.values[key]||0,ratio);
  return out;
 }
 function polygon(ctx,coords){
  ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.clip();
 }
 function rot(pt,pivot,angle){
  const x=pt[0]-pivot[0],y=pt[1]-pivot[1],co=Math.cos(angle),si=Math.sin(angle);
  return [pivot[0]+x*co-y*si,pivot[1]+x*si+y*co];
 }
 function drawPart(ctx,img,rect,part,pivot,angle,elbow,elbowAngle,profile,partAtlases){
  const offset=profile.parts[part]||{x:0,y:0,scale:1};
  ctx.save();
  ctx.translate(offset.x,offset.y);
  ctx.translate(128,160);ctx.scale(offset.scale,offset.scale);ctx.translate(-128,-160);
  if(pivot){
   ctx.translate(pivot[0],pivot[1]);ctx.rotate(angle*RAD);ctx.translate(-pivot[0],-pivot[1]);
  }
  if(elbow){
   ctx.translate(elbow[0],elbow[1]);ctx.rotate(elbowAngle*RAD);ctx.translate(-elbow[0],-elbow[1]);
  }
  if(partAtlases&&partAtlases[part]){
   ctx.drawImage(partAtlases[part],0,0,256,324);
  }else{
   polygon(ctx,profile.masks&&profile.masks[part]||((CHARACTER_CLIPS[profile.profileKind]||CLIPS)[part]||CLIPS[part]));
   ctx.drawImage(img,rect[0],rect[1],rect[2],rect[3],0,0,256,324);
  }
  ctx.restore();
 }
 function partMasks(id,dir,profile){
  const p=profile||getProfile(id,dir);
  const base=CHARACTER_CLIPS[p.profileKind]||CLIPS,output={};
  for(const key of PART_NAMES)output[key]=copy(p.masks&&p.masks[key]||base[key]||CLIPS[key]);
  return output;
 }
 // Split the original atlas into truly independent transparent canvas images.
 // All derived pixels come from the source art; custom silhouette control points
 // permit rebuilding each limb without baking artifacts into the original file.
 function bakeParts(img,rect,profile){
  if(typeof document==="undefined"||!document.createElement)throw Error("Canvas document required");
  if(!img||!rect||rect.length!==4)throw Error("Source image and four-part rect required");
  const p=profile||getProfile("default","front"),masks=partMasks("", "",p),out={};
  for(const part of PART_NAMES){
   const canvas=document.createElement("canvas");canvas.width=256;canvas.height=324;
   const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas 2D required");
   ctx.save();polygon(ctx,masks[part]);
   ctx.drawImage(img,rect[0],rect[1],rect[2],rect[3],0,0,256,324);ctx.restore();
   out[part]=canvas;
  }
  return out;
 }
 function poseJoints(profile,pose){
  const j=profile.joints,p=Object.assign({},ZERO,pose||{}),r=angle=>angle*RAD;
  const transformed=point=>rot(point,j.body,r(p.torso));
  const limb=(side,type)=>{
   const hip=j[side+(type==="arm"?"Shoulder":"Hip")];
   const bend=j[side+(type==="arm"?"Elbow":"Knee")];
   const upper=p[side+(type==="arm"?"Upper":"Thigh")];
   const lower=p[side+(type==="arm"?"Lower":"Shin")];
   const extremity=type==="arm"?j[side+"Hand"]:[bend[0],Math.min(324,bend[1]+43)];
   const second=rot(bend,hip,r(upper));
   const third=rot(rot(extremity,bend,r(lower)),hip,r(upper));
   const step=type==="leg"?(p[side+"Step"]||0):0;
   return {base:type==="arm"?transformed(hip):[hip[0]+step,hip[1]],
    middle:type==="arm"?transformed(second):[second[0]+step,second[1]],
    end:type==="arm"?transformed(third):[third[0]+step,third[1]]};
  };
  const fArm=limb("front","arm"),bArm=limb("rear","arm");
  const fLeg=limb("front","leg"),bLeg=limb("rear","leg");
  return {
   neck:transformed(j.neck),body:j.body.slice(),
   frontShoulder:fArm.base,frontElbow:fArm.middle,frontHand:fArm.end,
   rearShoulder:bArm.base,rearElbow:bArm.middle,rearHand:bArm.end,
   frontHip:fLeg.base,frontKnee:fLeg.middle,frontFoot:fLeg.end,
   rearHip:bLeg.base,rearKnee:bLeg.middle,rearFoot:bLeg.end
  };
 }
 function drawV2(ctx,img,rect,p,profile,parts){
  const j=profile.joints;
  const draw=(id,pivot,a,second,b)=>drawPart(ctx,img,rect,id,pivot,a,second,b,profile,parts);
  ctx.save();ctx.translate(p.rearStep||0,0);
  draw("rearShin",j.rearHip,p.rearThigh,j.rearKnee,p.rearShin);
  draw("rearThigh",j.rearHip,p.rearThigh);ctx.restore();
  ctx.save();
  ctx.translate(...j.body);ctx.rotate((p.torso||0)*RAD);ctx.translate(-j.body[0],-j.body[1]);
  draw("rearUpper",j.rearShoulder,p.rearUpper);
  draw("rearLower",j.rearShoulder,p.rearUpper,j.rearElbow,p.rearLower);
  draw("torso");
  ctx.restore();
  ctx.save();ctx.translate(p.frontStep||0,0);
  draw("frontShin",j.frontHip,p.frontThigh,j.frontKnee,p.frontShin);
  draw("frontThigh",j.frontHip,p.frontThigh);ctx.restore();
  ctx.save();
  ctx.translate(...j.body);ctx.rotate((p.torso||0)*RAD);ctx.translate(-j.body[0],-j.body[1]);
  ctx.save();ctx.translate(...j.neck);ctx.rotate((p.head||0)*RAD);
  ctx.translate(-j.neck[0],-j.neck[1]);draw("head");ctx.restore();
  draw("frontUpper",j.frontShoulder,p.frontUpper);
  draw("frontLower",j.frontShoulder,p.frontUpper,j.frontElbow,p.frontLower);
  ctx.restore();
 }
 function hand(p,front,profile){
  const j=profile.joints,elbow=front?j.frontElbow:j.rearElbow,shoulder=front?j.frontShoulder:j.rearShoulder;
  const upper=(p[front?'frontUpper':'rearUpper']||0)*RAD;
  const lower=(p[front?'frontLower':'rearLower']||0)*RAD;
  const grip=front?j.frontHand:j.rearHand;
  const shifted=rot(grip,elbow,lower);
  return rot(shifted,shoulder,upper);
 }
 // Solve shoulder and elbow rotations so the hand meets an intended prop grip.
 // The source rig has different bone lengths for children and adults.
 function solveHandTarget(p,profile,isFront,target){
  if(!Array.isArray(target)||target.length!==2||!target.every(Number.isFinite))return null;
  const j=profile.joints,side=isFront?"front":"rear";
  const shoulder=j[side+"Shoulder"],elbow=j[side+"Elbow"],grip=j[side+"Hand"];
  const u=[elbow[0]-shoulder[0],elbow[1]-shoulder[1]];
  const v=[grip[0]-elbow[0],grip[1]-elbow[1]];
  const l1=Math.hypot(...u),l2=Math.hypot(...v);
  if(l1<2||l2<2)return null;
  let dx=target[0]-shoulder[0],dy=target[1]-shoulder[1];
  let distance=Math.hypot(dx,dy);
  if(distance<.001){dx=0;dy=1;distance=1;}
  const reachable=clamp(distance,Math.abs(l1-l2)+.01,l1+l2-.01);
  const ux=dx/distance,uy=dy/distance;
  const along=(l1*l1-l2*l2+reachable*reachable)/(2*reachable);
  const across=Math.sqrt(Math.max(0,l1*l1-along*along));
  // A stable elbow-side sign avoids an abrupt reversal between loop frames.
  const sideSign=isFront?-1:1;
  const ex=shoulder[0]+ux*along-sideSign*uy*across;
  const ey=shoulder[1]+uy*along+sideSign*ux*across;
  const end=[shoulder[0]+ux*reachable,shoulder[1]+uy*reachable];
  const originalUpper=Math.atan2(u[1],u[0]);
  const originalLower=Math.atan2(v[1],v[0]);
  const upper=(Math.atan2(ey-shoulder[1],ex-shoulder[0])-originalUpper)/RAD;
  const lower=(Math.atan2(end[1]-ey,end[0]-ex)-originalLower)/RAD-upper;
  const normalized=n=>(n+540)%360-180;
  p[side+"Upper"]=normalized(upper);
  p[side+"Lower"]=normalized(lower);
  return {target:target.slice(),achieved:hand(p,isFront,profile),reachError:Math.abs(distance-reachable)};
 }
 function aimHands(p,profile,targets){
  if(!p||!profile||!targets)return {};
  return {front:solveHandTarget(p,profile,true,targets.front),rear:solveHandTarget(p,profile,false,targets.rear)};
 }
 function equipment(ctx,kind,p,front,rear,progress){
  const hit=progress>.47&&progress<.74;
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
  if(kind==="bow"){
   const angle=-.05+(p.weapon||0)*RAD;
   ctx.translate(front[0],front[1]);ctx.rotate(angle);
   ctx.strokeStyle="#a97945";ctx.lineWidth=7;
   ctx.beginPath();ctx.moveTo(15,-57);ctx.quadraticCurveTo(73,1,16,64);ctx.stroke();
   ctx.strokeStyle="#f9e7d1";ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(15,-57);ctx.lineTo((progress<.71?-29:15),0);ctx.lineTo(16,64);ctx.stroke();
   if(progress>.26&&progress<.73){ctx.strokeStyle="#ebedd9";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-28,1);ctx.lineTo(64,1);ctx.stroke();}
  }else if(kind==="block"){
   ctx.translate(front[0]+5,front[1]-6);ctx.rotate(-p.torso*.012);
   ctx.fillStyle="#3c6b83";ctx.strokeStyle="#d8e3d8";ctx.lineWidth=5;
   ctx.beginPath();ctx.moveTo(0,-38);ctx.quadraticCurveTo(42,-35,42,0);ctx.quadraticCurveTo(40,34,0,53);
   ctx.quadraticCurveTo(-40,32,-42,-1);ctx.quadraticCurveTo(-39,-36,0,-38);ctx.fill();ctx.stroke();
   ctx.strokeStyle="#95cbd2";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(0,30);ctx.moveTo(-24,0);ctx.lineTo(24,0);ctx.stroke();
   if(progress>.43&&progress<.62){ctx.strokeStyle="rgba(190,247,255,.85)";ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,57,-1.7,1.7);ctx.stroke();}
  }else if(kind!=="hit"&&kind!=="fall"&&kind!=="dodge"){
   const isAxe=kind==="axe",angle=(-23+p.weapon*.95)*RAD;
   ctx.translate(front[0],front[1]);ctx.rotate(angle);
   ctx.strokeStyle="#8e5b39";ctx.lineWidth=isAxe?9:6;ctx.beginPath();ctx.moveTo(-10,12);ctx.lineTo(18,-18);ctx.stroke();
   if(isAxe){
    ctx.strokeStyle="#875c37";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(18,-18);ctx.lineTo(95,-106);ctx.stroke();
    ctx.fillStyle="#b4c8d0";ctx.strokeStyle="#e1f3f5";ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(81,-115);ctx.lineTo(106,-125);ctx.quadraticCurveTo(139,-105,135,-79);ctx.lineTo(107,-88);ctx.closePath();ctx.fill();ctx.stroke();
   }else{
    ctx.strokeStyle="#e4f1f7";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(19,-23);ctx.lineTo(88,-112);ctx.stroke();
    ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(23,-28);ctx.lineTo(84,-109);ctx.stroke();
    ctx.strokeStyle="#c9a16c";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(5,-29);ctx.lineTo(31,-19);ctx.stroke();
   }
   if(hit&&(kind==="slash"||kind==="axe"||kind==="combo")){
    ctx.strokeStyle="rgba(174,237,246,.68)";ctx.lineWidth=isAxe?11:7;ctx.beginPath();ctx.arc(32,-36,isAxe?100:83,-1.25,.95);ctx.stroke();
   }
  }
  ctx.restore();
 }
 function render(ctx,img,rect,centerX,feetY,width,height,opts){
  opts=opts||{};if(!ctx||!img||!rect||rect.length<4||!(width>0)||!(height>0))return false;
  if(img.complete===false||img.naturalWidth===0)return false;
  let p;
  try{
   p=sample(opts.action||"idle",opts.progress||0);
   if(opts.pose&&typeof opts.pose==="object"){
    for(const key of KEYS)if(Number.isFinite(opts.pose[key]))
     p[key]=clamp(opts.pose[key],key==="bodyY"?-80:-180,key==="bodyY"?100:180);
   }
  }catch(e){return false}
  const profile=opts.profile?validated(opts.characterId||"default",opts.direction||"front",opts.profile):
    getProfile(opts.characterId||"default",opts.direction||"front");
  if(opts.handTargets)aimHands(p,profile,opts.handTargets);
  const mirror=!!opts.mirror,rotation=Number(opts.rotation)||0;
  const mode=opts.mode==="legacy"?"legacy":opts.mode==="partsV2"?"partsV2":"cutout";
  ctx.save();
  try{
   ctx.translate(centerX,feetY);ctx.scale(width/256*(mirror?-1:1),height/324);
   ctx.rotate(rotation);ctx.translate(-128,-314+(p.bodyY||0));
   if(mode==="legacy"){
    ctx.drawImage(img,rect[0],rect[1],rect[2],rect[3],0,0,256,324);
    return true;
   }
   if(typeof opts.drawBehind==="function")opts.drawBehind(ctx,p,profile);
   if(mode==="partsV2"){
    drawV2(ctx,img,rect,p,profile,opts.partAtlases);
    const anchors=poseJoints(profile,p);
    if(opts.equipment)equipment(ctx,opts.equipment,p,anchors.frontHand,anchors.rearHand,opts.progress||0);
    if(typeof opts.drawFront==="function")opts.drawFront(ctx,p,anchors.frontHand,anchors.rearHand,profile);
    if(opts.guides){
     ctx.save();ctx.fillStyle="#72f8e1";ctx.strokeStyle="#16313c";ctx.lineWidth=2;
     Object.values(anchors).forEach(point=>{ctx.beginPath();ctx.arc(point[0],point[1],4,0,Math.PI*2);ctx.fill();ctx.stroke();});
     ctx.restore();
    }
    return true;
   }
   // Back -> front painter order. Each piece uses the unmodified source pixels
   // with a polygonal mask, not invented recoloring or a second copy of the body.
   const j=profile.joints;
   // Rig uses per-character joints (not the generic default). Hip rotations carry the shin pivot.
   drawPart(ctx,img,rect,"rearShin",j.rearHip,p.rearThigh,j.rearKnee,p.rearShin,profile);
   drawPart(ctx,img,rect,"rearThigh",j.rearHip,p.rearThigh,null,null,profile);
   drawPart(ctx,img,rect,"rearUpper",j.rearShoulder,p.rearUpper,null,null,profile);
   drawPart(ctx,img,rect,"rearLower",j.rearShoulder,p.rearUpper,j.rearElbow,p.rearLower,profile);
   ctx.save();ctx.translate(j.body[0],j.body[1]);ctx.rotate((p.torso||0)*RAD);ctx.translate(-j.body[0],-j.body[1]);
   drawPart(ctx,img,rect,"torso",null,null,null,null,profile);
   drawPart(ctx,img,rect,"frontShin",j.frontHip,p.frontThigh,j.frontKnee,p.frontShin,profile);
   drawPart(ctx,img,rect,"frontThigh",j.frontHip,p.frontThigh,null,null,profile);
   ctx.save();ctx.translate(j.neck[0],j.neck[1]);ctx.rotate((p.head||0)*RAD);ctx.translate(-j.neck[0],-j.neck[1]);
   drawPart(ctx,img,rect,"head",null,null,null,null,profile);ctx.restore();
   drawPart(ctx,img,rect,"frontUpper",j.frontShoulder,p.frontUpper,null,null,profile);
   drawPart(ctx,img,rect,"frontLower",j.frontShoulder,p.frontUpper,j.frontElbow,p.frontLower,profile);
   ctx.restore();
   const front=hand(p,true,profile),rear=hand(p,false,profile);
   if(opts.equipment)equipment(ctx,opts.equipment,p,front,rear,opts.progress||0);
   if(typeof opts.drawFront==="function")opts.drawFront(ctx,p,front,rear,profile);
   if(opts.guides){
    const points=Object.values(j).concat([front,rear]);
    ctx.save();ctx.fillStyle="#72f8e1";ctx.strokeStyle="#16313c";ctx.lineWidth=2;
    points.forEach(x=>{ctx.beginPath();ctx.arc(x[0],x[1],4,0,Math.PI*2);ctx.fill();ctx.stroke()});ctx.restore();
   }
  }finally{ctx.restore()}
  return true;
 }
 global.FWBattleRig=Object.freeze({
  version:"2.0.0",actions:Object.freeze(Object.keys(TRACKS)),registerTracks:registerTracks,sample:sample,render:render,
  aimHands:aimHands,handPosition:hand,partMasks:partMasks,bakeParts:bakeParts,poseJoints:poseJoints,poseKeys:Object.freeze(KEYS.slice()),
  getProfile:getProfile,setProfile:setProfile,resetProfile:resetProfile,
  exportProfiles:exportProfiles,importProfiles:importProfiles,defaultProfile:basicProfile,
  jointNames:Object.freeze(JOINT_NAMES),partNames:Object.freeze(PART_NAMES),
  partCenters:Object.freeze(Object.fromEntries(Object.entries(CLIPS).map(([id,vertices])=>[
   id,[vertices.reduce((a,p)=>a+p[0],0)/vertices.length,vertices.reduce((a,p)=>a+p[1],0)/vertices.length]
  ]))),
  profile:Object.freeze({sourceWidth:256,sourceHeight:324,partCount:Object.keys(CLIPS).length,storageKey:STORE})
 });
})(window);
