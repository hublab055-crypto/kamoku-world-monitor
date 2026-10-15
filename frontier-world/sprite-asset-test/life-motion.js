/* Frontier World: procedural daily-life animations v1.
 * Uses existing battle rig pixels and locally drawn temporary props.
 * Visual-only: does not change inventory, health, or game time.
 */
(function(global){
 'use strict';
 const rig=global.FWBattleRig;
 if(!rig||typeof rig.registerTracks!=='function')return;
 const k=(t,values)=>({t,values});
 const motions={
  chop:[k(0,{frontUpper:-32,rearUpper:-10}),k(.25,{torso:-16,frontUpper:-135,frontLower:-22,rearUpper:-99,head:8,bodyY:-8}),k(.43,{torso:-17,frontUpper:-143,rearUpper:-103,bodyY:-6}),k(.65,{torso:25,frontUpper:65,frontLower:26,rearUpper:20,bodyY:8}),k(1,{frontUpper:-32,rearUpper:-10})],
  sweep:[k(0,{frontUpper:23,frontLower:-20,rearUpper:20}),k(.25,{torso:11,frontUpper:53,frontLower:-35,rearUpper:3,bodyY:7}),k(.50,{torso:-5,frontUpper:10,frontLower:-39,rearUpper:34,bodyY:5}),k(.75,{torso:12,frontUpper:49,frontLower:-35,rearUpper:14,bodyY:8}),k(1,{frontUpper:23,frontLower:-20,rearUpper:20})],
  sit:[k(0,{torso:3,frontThigh:-72,frontShin:92,rearThigh:-70,rearShin:90,frontUpper:18,bodyY:24}),k(.5,{torso:7,head:-3,frontThigh:-72,frontShin:92,rearThigh:-70,rearShin:90,frontUpper:21,bodyY:25}),k(1,{torso:3,frontThigh:-72,frontShin:92,rearThigh:-70,rearShin:90,frontUpper:18,bodyY:24})],
  read:[k(0,{torso:5,head:14,frontThigh:-72,frontShin:92,rearThigh:-70,rearShin:90,frontUpper:-30,frontLower:-40,rearUpper:-29,rearLower:40,bodyY:24}),k(.55,{torso:7,head:20,frontThigh:-72,frontShin:92,rearThigh:-70,rearShin:90,frontUpper:-40,frontLower:-45,rearUpper:-36,rearLower:30,bodyY:25}),k(1,{torso:5,head:14,frontThigh:-72,frontShin:92,rearThigh:-70,rearShin:90,frontUpper:-30,frontLower:-40,rearUpper:-29,rearLower:40,bodyY:24})],
  write:[k(0,{torso:15,head:18,frontThigh:-73,frontShin:90,rearThigh:-73,rearShin:90,frontUpper:-20,frontLower:-39,rearUpper:-24,bodyY:23}),k(.24,{torso:17,head:21,frontThigh:-73,frontShin:90,rearThigh:-73,rearShin:90,frontUpper:-34,frontLower:-42,rearUpper:-21,bodyY:23}),k(.52,{torso:15,head:18,frontThigh:-73,frontShin:90,rearThigh:-73,rearShin:90,frontUpper:-12,frontLower:-36,rearUpper:-24,bodyY:23}),k(.78,{torso:18,head:20,frontThigh:-73,frontShin:90,rearThigh:-73,rearShin:90,frontUpper:-36,frontLower:-43,rearUpper:-21,bodyY:24}),k(1,{torso:15,head:18,frontThigh:-73,frontShin:90,rearThigh:-73,rearShin:90,frontUpper:-20,frontLower:-39,rearUpper:-24,bodyY:23})],
  eatHands:[k(0,{frontUpper:5}),k(.36,{head:11,frontUpper:-70,frontLower:-52}),k(.6,{head:14,frontUpper:-73,frontLower:-50}),k(.82,{frontUpper:-38,frontLower:-27}),k(1,{frontUpper:5})],
  eatUtensils:[k(0,{frontUpper:8,frontLower:-22}),k(.3,{head:8,frontUpper:-46,frontLower:-47}),k(.54,{head:15,frontUpper:-76,frontLower:-59}),k(.72,{head:10,frontUpper:-62,frontLower:-50}),k(1,{frontUpper:8,frontLower:-22})],
  washHands:[k(0,{torso:10,frontUpper:18,frontLower:-44,rearUpper:22,rearLower:32}),k(.35,{torso:12,frontUpper:38,frontLower:-51,rearUpper:31,rearLower:23}),k(.68,{torso:8,frontUpper:7,frontLower:-36,rearUpper:10,rearLower:40}),k(1,{torso:10,frontUpper:18,frontLower:-44,rearUpper:22,rearLower:32})],
  washDishes:[k(0,{torso:12,frontUpper:18,frontLower:-38,rearUpper:-18,rearLower:40}),k(.28,{torso:18,frontUpper:44,frontLower:-43,rearUpper:-14,rearLower:35}),k(.55,{torso:14,frontUpper:5,frontLower:-25,rearUpper:-20,rearLower:42}),k(.78,{torso:18,frontUpper:40,frontLower:-44,rearUpper:-15,rearLower:36}),k(1,{torso:12,frontUpper:18,frontLower:-38,rearUpper:-18,rearLower:40})],
  laundry:[k(0,{torso:12,frontUpper:32,frontLower:-30,rearUpper:15,rearLower:32}),k(.3,{torso:18,frontUpper:55,frontLower:-47,rearUpper:39,rearLower:26}),k(.6,{torso:13,frontUpper:15,frontLower:-28,rearUpper:21,rearLower:36}),k(1,{torso:12,frontUpper:32,frontLower:-30,rearUpper:15,rearLower:32})],
  bathe:[k(0,{frontUpper:30,frontLower:-28,rearUpper:18,rearLower:28,frontThigh:-64,frontShin:85,rearThigh:-65,rearShin:85,bodyY:40}),k(.25,{head:-7,frontUpper:-38,frontLower:-48,rearUpper:25,rearLower:25,frontThigh:-64,frontShin:85,rearThigh:-65,rearShin:85,bodyY:40}),k(.52,{head:4,frontUpper:18,frontLower:-33,rearUpper:-34,rearLower:20,frontThigh:-64,frontShin:85,rearThigh:-65,rearShin:85,bodyY:42}),k(.78,{head:-8,frontUpper:-42,frontLower:-49,rearUpper:16,rearLower:22,frontThigh:-64,frontShin:85,rearThigh:-65,rearShin:85,bodyY:40}),k(1,{frontUpper:30,frontLower:-28,rearUpper:18,rearLower:28,frontThigh:-64,frontShin:85,rearThigh:-65,rearShin:85,bodyY:40})]
 };
 // Symmetric knees prevent both legs swinging to the same side while seated.
 const seat={frontThigh:-43,frontShin:46,rearThigh:43,rearShin:-46};
 for(const name of ['sit','read','write','eatUtensils'])
  motions[name].forEach(frame=>Object.assign(frame.values,seat,{bodyY:23}));
 motions.bathe.forEach(frame=>Object.assign(frame.values,{frontThigh:-27,frontShin:31,rearThigh:27,rearShin:-31}));
 const added=rig.registerTracks(motions);
 const ACTIONS=Object.freeze([
  {id:'chop',label:'🪓 木を切る',duration:1200},
  {id:'sweep',label:'🧹 掃除する',duration:1550},
  {id:'sit',label:'🪑 椅子に座る',duration:2400},
  {id:'read',label:'📖 本を読む',duration:2100},
  {id:'write',label:'✍️ 紙に書く',duration:1100},
  {id:'eatHands',label:'🥖 手で食べる',duration:1600},
  {id:'eatUtensils',label:'🥄 食器で食べる',duration:1550},
  {id:'washHands',label:'🫧 手を洗う',duration:1250},
  {id:'washDishes',label:'🧽 食器を洗う',duration:1450},
  {id:'laundry',label:'🧺 洗濯する',duration:1600},
  {id:'bathe',label:'🛁 風呂に入る',duration:2300}
 ]);
 const IDs=new Set(added);
 const RAD=Math.PI/180;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 const chopKeys=[
  [0,175,194,125,191],[.28,168,156,125,157],[.43,170,151,124,155],
  [.65,190,210,133,194],[.84,186,209,131,194],[1,175,194,125,191]
 ];
 function handTargets(id,t,profile){
  const v=Math.sin(2*Math.PI*t),shift=Math.max(-18,Math.min(20,(profile.joints.frontShoulder[1]-143)*.35));
  let f,r;
  if(id==='chop'){
   let a=chopKeys[0],b=chopKeys.at(-1);
   for(let i=0;i<chopKeys.length-1;i++)if(t<=chopKeys[i+1][0]){a=chopKeys[i];b=chopKeys[i+1];break;}
   const m=ease((t-a[0])/(b[0]-a[0]));
   f=[lerp(a[1],b[1],m),lerp(a[2],b[2],m)];r=[lerp(a[3],b[3],m),lerp(a[4],b[4],m)];
  }else if(id==='sweep'){f=[174+v*8,209];r=[129+v*4,192];}
  else if(id==='sit'){f=[173,210];r=[107,205];}
  else if(id==='read'){f=[162+2*Math.sin(t*Math.PI),202];r=[111,204];}
  else if(id==='write'){f=[160+4*v,212+2*Math.sin(4*Math.PI*t)];r=[104,208];}
  else if(id==='eatHands'){f=[151,202-61*ease(Math.sin(t*Math.PI)**2)];r=[108,208];}
  else if(id==='eatUtensils'){f=[153,200-48*ease(Math.sin(t*Math.PI)**2)];r=[109,205];}
  else if(id==='washHands'){f=[157+7*v,212];r=[119-5*v,205];}
  else if(id==='washDishes'){f=[158+7*v,212];r=[119,204];}
  else if(id==='laundry'){f=[158+8*v,212+2*Math.cos(4*Math.PI*t)];r=[121-6*v,206];}
  else {f=[169+3*v,212];r=[121,200+4*v];}
  // Project requested grips into each character's actual two-bone reach.
  // This also prevents pop-through at the elbow when the short child rig animates.
  const reachable=(side,point)=>{
   const joints=profile.joints,shoulder=joints[side+'Shoulder'],elbow=joints[side+'Elbow'],hand=joints[side+'Hand'];
   const l1=Math.hypot(elbow[0]-shoulder[0],elbow[1]-shoulder[1]);
   const l2=Math.hypot(hand[0]-elbow[0],hand[1]-elbow[1]);
   const dx=point[0]-shoulder[0],dy=point[1]-shoulder[1],d=Math.hypot(dx,dy);
   if(d<.0001)return [shoulder[0],shoulder[1]+Math.abs(l1-l2)+.4];
   const min=Math.abs(l1-l2)+.4,max=l1+l2-.4;
   const length=Math.max(min,Math.min(max,d)),scale=length/d;
   return [shoulder[0]+dx*scale,shoulder[1]+dy*scale];
  };
  return {front:reachable('front',[f[0],f[1]+shift]),rear:reachable('rear',[r[0],r[1]+shift])};
 }
 function ellipse(ctx,x,y,rx,ry,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
 }
 function scenery(ctx,id){
  ctx.save();
  if(['sit','read','write','eatUtensils'].includes(id)){
   ctx.fillStyle='#7c5435';ctx.fillRect(73,245,115,14);ctx.fillStyle='#59402d';
   ctx.fillRect(82,259,13,56);ctx.fillRect(174,259,13,56);
   ctx.fillStyle='#98704b';ctx.fillRect(73,196,18,54);
  }
  if(['write','eatUtensils','washDishes'].includes(id)){
   ctx.fillStyle='#8f6545';ctx.fillRect(31,227,203,12);ctx.fillStyle='#5b3d2b';ctx.fillRect(40,239,12,74);ctx.fillRect(214,239,12,74);
  }
  if(id==='chop'){ctx.fillStyle='#80532e';ctx.fillRect(176,271,64,39);ctx.fillStyle='#bc925d';ctx.fillRect(179,271,58,9);}
  if(['washHands','washDishes','laundry'].includes(id)){
   ellipse(ctx,143,240,85,29,'#769fac');ellipse(ctx,143,234,76,18,'#c5e7e8');
  }
  if(id==='bathe'){ellipse(ctx,134,273,116,47,'#b9d7df');ellipse(ctx,134,265,111,34,'#81adb9');}
  ctx.restore();
 }
 function props(ctx,id,pose,front,rear,t){
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  const hand=front||[180,210],w=Math.sin(t*Math.PI*2);
  if(id==='chop'||id==='sweep'){
   ctx.translate(hand[0],hand[1]);ctx.rotate((id==='chop'?-0.12+2.52*ease((t-.43)/.26)*(1-ease((t-.83)/.17)):w*.08)+(pose.weapon||0)*RAD);
   ctx.strokeStyle='#98683b';ctx.lineWidth=id==='chop'?9:6;
   ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(id==='chop'?5:8,id==='chop'?-72:76);ctx.stroke();
   if(id==='chop'){
    ctx.fillStyle='#a8bcc4';ctx.strokeStyle='#edf5fa';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-13,-83);ctx.lineTo(26,-89);ctx.lineTo(41,-65);ctx.lineTo(-12,-66);ctx.closePath();ctx.fill();ctx.stroke();
   }else{
    ctx.fillStyle='#d6b478';ctx.fillRect(-11,74,40,8);
    for(let i=0;i<8;i++){ctx.strokeStyle='#ddc995';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-8+i*5,82);ctx.lineTo(-11+i*5,103+w*3);ctx.stroke();}
   }
  }else if(id==='read'){
   ctx.translate((hand[0]+rear[0])/2,(hand[1]+rear[1])/2);ctx.rotate(w*.02);
   ctx.fillStyle='#755037';ctx.fillRect(-43,-17,86,64);
   ctx.fillStyle='#f4e8d0';ctx.fillRect(-39,-14,37,55);ctx.fillRect(2,-14,37,55);
   ctx.strokeStyle='#b9aa8d';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-34,i*9);ctx.lineTo(-8,i*9);ctx.moveTo(8,i*9);ctx.lineTo(34,i*9);ctx.stroke();}
  }else if(id==='write'){
   ctx.fillStyle='#f4e5c7';ctx.fillRect(94,207,96,49);
   ctx.strokeStyle='#b1a58e';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(103,215+i*8);ctx.lineTo(181,215+i*8);ctx.stroke();}
   ctx.strokeStyle='#413329';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hand[0],hand[1]-20);ctx.lineTo(hand[0]+w*3,hand[1]+10);ctx.stroke();
  }else if(id==='eatHands'){
   ellipse(ctx,hand[0],hand[1]-9,18,11,'#d9aa62');
  }else if(id==='eatUtensils'){
   ctx.translate(hand[0],hand[1]);ctx.strokeStyle='#b6c8d1';ctx.lineWidth=5;
   ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(5,-25);ctx.stroke();ellipse(ctx,7,-31,8,12,'#d3e3eb');
  }else if(['washHands','washDishes','laundry'].includes(id)){
   if(id==='washDishes'){ctx.strokeStyle='#f1f4f0';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(135,249,41,17,0,0,Math.PI*2);ctx.stroke();}
   if(id==='laundry'){ctx.fillStyle='#d4c2aa';ctx.fillRect((hand[0]+rear[0])/2-35,(hand[1]+rear[1])/2,70,34);}
   for(let i=0;i<9;i++)ellipse(ctx,(hand[0]+rear[0])/2-30+(i%5)*15+w*4,(hand[1]+rear[1])/2+Math.floor(i/5)*17+Math.sin(t*15+i)*5,3+i%3,3+i%3,'#eefaff');
  }else if(id==='bathe'){
   ctx.fillStyle='#c3e0e8';ctx.strokeStyle='#668c9c';ctx.lineWidth=5;
   ctx.beginPath();ctx.moveTo(20,242);ctx.quadraticCurveTo(22,320,129,316);ctx.quadraticCurveTo(231,321,239,242);ctx.closePath();ctx.fill();ctx.stroke();
   for(let i=0;i<12;i++)ellipse(ctx,32+i*18,237+Math.sin(t*8+i)*6,8+i%3,8+i%3,'#f2fbff');
   for(let i=0;i<5;i++)ellipse(ctx,59+i*29,195+Math.sin(t*7+i)*9,4+i%3,4+i%3,'#eefaff');
  }
  ctx.restore();
 }
 function render(ctx,img,rect,x,y,w,h,opts){
  opts=opts||{};
  if(!IDs.has(opts.action))return false;
  const type=opts.action,t=Math.max(0,Math.min(1,Number(opts.progress)||0));
  const profile=opts.profile||rig.getProfile(opts.characterId||'default',opts.direction||'front');
  const targets=handTargets(type,t,profile);
  return rig.render(ctx,img,rect,x,y,w,h,{
   action:type,progress:t,characterId:opts.characterId||'default',
   direction:opts.direction||'front',mirror:!!opts.mirror,profile:profile,handTargets:opts.pose?null:targets,
    pose:opts.pose||null,partAtlases:opts.partAtlases||null,
   guides:!!opts.guides,mode:opts.mode,
   drawBehind:opts.environment?function(c){scenery(c,type)}:null,
   drawFront:function(c,p,front,rear){
    props(c,type,p,front,rear,t);
    if(opts.gripGuides){c.save();c.fillStyle='#75f9cb';c.strokeStyle='#183038';c.lineWidth=2;
     [front,rear].forEach(pt=>{c.beginPath();c.arc(pt[0],pt[1],6,0,Math.PI*2);c.fill();c.stroke();});c.restore();}
   }
  });
 }
 global.FWLifeMotion=Object.freeze({
  version:'2.0.0',actions:ACTIONS.filter(a=>IDs.has(a.id)),render:render,
  handTargets:handTargets,
  has:function(id){return IDs.has(id)},
  duration:function(id){const a=ACTIONS.find(a=>a.id===id);return a?a.duration:1000}
 });
})(window);
