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
 function drawPart(ctx,img,rect,part,pivot,angle,elbow,elbowAngle){
  ctx.save();
  if(pivot){
   ctx.translate(pivot[0],pivot[1]);ctx.rotate(angle*RAD);ctx.translate(-pivot[0],-pivot[1]);
  }
  if(elbow){
   ctx.translate(elbow[0],elbow[1]);ctx.rotate(elbowAngle*RAD);ctx.translate(-elbow[0],-elbow[1]);
  }
  polygon(ctx,CLIPS[part]);
  ctx.drawImage(img,rect[0],rect[1],rect[2],rect[3],0,0,256,324);
  ctx.restore();
 }
 function hand(p,front){
  const part=front?'frontUpper':'rearUpper',j=JOINTS[part];
  const upper=(p[front?'frontUpper':'rearUpper']||0)*RAD;
  const lower=(p[front?'frontLower':'rearLower']||0)*RAD;
  const grip=front?[207,226]:[63,225];
  const shifted=rot(grip,j.elbow,lower);
  return rot(shifted,j.shoulder,upper);
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
  try{p=sample(opts.action||"idle",opts.progress||0)}catch(e){return false}
  const mirror=!!opts.mirror,rotation=Number(opts.rotation)||0;
  const mode=opts.mode==="legacy"?"legacy":"cutout";
  ctx.save();
  try{
   ctx.translate(centerX,feetY);ctx.scale(width/256*(mirror?-1:1),height/324);
   ctx.rotate(rotation);ctx.translate(-128,-314+(p.bodyY||0));
   if(mode==="legacy"){
    ctx.drawImage(img,rect[0],rect[1],rect[2],rect[3],0,0,256,324);
    return true;
   }
   // Back -> front painter order. Each piece uses the unmodified source pixels
   // with a polygonal mask, not invented recoloring or a second copy of the body.
   const r=JOINTS;
   drawPart(ctx,img,rect,"rearShin",r.rearShin.hip,p.rearThigh,r.rearShin.knee,p.rearShin);
   drawPart(ctx,img,rect,"rearThigh",r.rearThigh.hip,p.rearThigh);
   drawPart(ctx,img,rect,"rearUpper",r.rearUpper.shoulder,p.rearUpper);
   drawPart(ctx,img,rect,"rearLower",r.rearLower.shoulder,p.rearUpper,r.rearLower.elbow,p.rearLower);
   ctx.save();ctx.translate(128,222);ctx.rotate((p.torso||0)*RAD);ctx.translate(-128,-222);
   drawPart(ctx,img,rect,"torso");
   drawPart(ctx,img,rect,"frontShin",r.frontShin.hip,p.frontThigh,r.frontShin.knee,p.frontShin);
   drawPart(ctx,img,rect,"frontThigh",r.frontThigh.hip,p.frontThigh);
   ctx.save();ctx.translate(128,128);ctx.rotate((p.head||0)*RAD);ctx.translate(-128,-128);
   drawPart(ctx,img,rect,"head");ctx.restore();
   drawPart(ctx,img,rect,"frontUpper",r.frontUpper.shoulder,p.frontUpper);
   drawPart(ctx,img,rect,"frontLower",r.frontLower.shoulder,p.frontUpper,r.frontLower.elbow,p.frontLower);
   ctx.restore();
   const front=hand(p,true),rear=hand(p,false);
   if(opts.equipment)equipment(ctx,opts.equipment,p,front,rear,opts.progress||0);
   if(opts.guides){
    const points=[[128,129],[128,220],[r.frontUpper.shoulder[0],r.frontUpper.shoulder[1]],
     front,[r.rearUpper.shoulder[0],r.rearUpper.shoulder[1]],rear,[148,224],[108,224]];
    ctx.save();ctx.fillStyle="#72f8e1";ctx.strokeStyle="#16313c";ctx.lineWidth=2;
    points.forEach(x=>{ctx.beginPath();ctx.arc(x[0],x[1],4,0,Math.PI*2);ctx.fill();ctx.stroke()});ctx.restore();
   }
  }finally{ctx.restore()}
  return true;
 }
 global.FWBattleRig=Object.freeze({
  version:"1.0.0",actions:Object.freeze(Object.keys(TRACKS)),sample:sample,render:render,
  profile:Object.freeze({sourceWidth:256,sourceHeight:324,partCount:Object.keys(CLIPS).length})
 });
})(window);
