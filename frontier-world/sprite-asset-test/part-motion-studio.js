/* Frontier World — joint-by-joint sprite and stop-motion editor, V1.
 * Source silhouettes and calibrated anchor points are stored by FWBattleRig.
 * Authored motion frames are stored separately; editing has no gameplay side effects.
 */
(function(global){
 "use strict";
 const rig=global.FWBattleRig,life=global.FWLifeMotion;
 const $=id=>document.getElementById(id);
 const WIDTH=560,HEIGHT=590,C={cx:280,fy:526,w:350,h:443};
 const SOURCE={girl1:"./full-walk.webp",boy2:"./assets/boy2/full-walk.webp"};
 const NAME={girl1:"Mio",boy2:"冒険好きの男の子"};
 const DIR={front:"正面",right:"右",back:"背面",left:"左（右の反転）"};
 const ROW={front:0,right:2,left:2,back:3};
 const PART_LABELS={head:"頭",torso:"胴体",frontUpper:"手前の上腕",frontLower:"手前の前腕",rearUpper:"奥の上腕",rearLower:"奥の前腕",frontThigh:"手前の太もも",frontShin:"手前のすね",rearThigh:"奥の太もも",rearShin:"奥のすね"};
 const JOINT_LABELS={neck:"首",body:"腰",frontShoulder:"手前の肩",frontElbow:"手前の肘",frontHand:"手前の手首",rearShoulder:"奥の肩",rearElbow:"奥の肘",rearHand:"奥の手首",frontHip:"手前の股関節",frontKnee:"手前の膝",rearHip:"奥の股関節",rearKnee:"奥の膝",frontFoot:"手前の足先",rearFoot:"奥の足先",headAim:"頭の回転"};
 const KEYS=rig&&rig.poseKeys||[];
 const PRIMARY=["torso","head","frontUpper","frontLower","rearUpper","rearLower","frontThigh","frontShin","rearThigh","rearShin","bodyY"];
 const KEY_LABELS={torso:"腰を回す",head:"頭",frontUpper:"手前の肩",frontLower:"手前の肘",rearUpper:"奥の肩",rearLower:"奥の肘",frontThigh:"手前の股関節",frontShin:"手前の膝",rearThigh:"奥の股関節",rearShin:"奥の膝",frontStep:"手前の歩幅",rearStep:"奥の歩幅",bodyY:"上下位置",weapon:"道具の回転"};
 const HANDLE_NAMES=["headAim","body","frontElbow","frontHand","rearElbow","rearHand","frontKnee","frontFoot","rearKnee","rearFoot"];
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const copy=obj=>JSON.parse(JSON.stringify(obj));
 const rad=Math.PI/180;
 const at=(p,pivot,a)=>{const x=p[0]-pivot[0],y=p[1]-pivot[1],co=Math.cos(a),si=Math.sin(a);return [pivot[0]+x*co-y*si,pivot[1]+x*si+y*co]};
 const angle=(a,b)=>Math.atan2(a[1]-b[1],a[0]-b[0])/rad;
 const wrap=n=>(n+540)%360-180;
 let character="girl1",direction="front",action="chop",frameIndex=0;
 let profile,frames=[],images=new Map(),partAtlases=null;
 let chosenPart="frontUpper",selectedVertex=0,editMode="outline";
 let isPlaying=false,clock=0,prevTime=0,selectedHandle="frontHand",drag=null;
 let errors="",inited=false;
 let store={version:1,motions:{}};
 const cssKey=(id,dir,anim)=>[id,dir,anim].join("|");
 function status(text,error){
  const el=$("editorStatus");if(!el)return;el.textContent=text;el.classList.toggle("error",!!error);
 }
 function loadStore(){
  try{const data=JSON.parse(localStorage.getItem("frontierWorldPartMotionStudioV1")||"{}");
   if(data.version===1&&data.motions&&typeof data.motions==="object")store={version:1,motions:data.motions};
  }catch(e){status("以前の編集データを読み込めません: "+e.message,true)}
 }
 function saveStore(){
  try{localStorage.setItem("frontierWorldPartMotionStudioV1",JSON.stringify(store));return true;}
  catch(e){status("自動保存ができません。JSONを書き出して保管してください: "+e.message,true);return false;}
 }
 function safePose(p){
  const out={};
  for(const key of KEYS){
   const n=Number(p&&p[key]);
   out[key]=p&&p[key]!==undefined&&Number.isFinite(n)?clamp(n,key==="bodyY"?-80:-180,key==="bodyY"?100:180):0;
  }
  return out;
 }
 function actionNames(){
  const result=(rig.actions||[]).filter(x=>x!=="idle").map(x=>({id:x,label:"⚔️ "+x,group:"combat"}));
  for(const a of life&&life.actions||[])result.push({id:a.id,label:a.label,group:"life"});
  return result;
 }
 let actions=[];
 function loadClip(){
  const key=cssKey(character,direction,action),saved=store.motions[key];
  frames=Array.isArray(saved)&&saved.length>=2&&saved.length<=32?
   saved.map(safePose):Array.from({length:8},(_,i)=>safePose(rig.sample(action,i/8)));
  frameIndex=clamp(frameIndex,0,frames.length-1);clock=0;isPlaying=false;
  $("play").textContent="▶ 再生";
  buildFrames();syncSliders();draw();
 }
 function saveClip(){
  store.motions[cssKey(character,direction,action)]=frames.map(safePose);
  if(saveStore())status(NAME[character]+" / "+DIR[direction]+" / "+action+" / "+(frameIndex+1)+"コマ目を端末に保存しました");
 }
 function image(){
  return images.get(character);
 }
 function rect(){return [0,ROW[direction]*324,256,324];}
 function pointFromSource(p,pose){
  const x=(p[0]-128)*C.w/256*(direction==="left"?-1:1)+C.cx;
  const y=(p[1]-314+(pose&&pose.bodyY||0))*C.h/324+C.fy;
  return [x,y];
 }
 function sourceFromPoint(x,y,pose){
  return [128+(x-C.cx)/(C.w/256)*(direction==="left"?-1:1),
    314+(y-C.fy)/(C.h/324)-(pose&&pose.bodyY||0)];
 }
 function eventPoint(ev,canvas){
  const b=canvas.getBoundingClientRect();
  return [(ev.clientX-b.left)*WIDTH/b.width,(ev.clientY-b.top)*HEIGHT/b.height];
 }
 function painter(ctx){
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  const g=ctx.createLinearGradient(0,0,0,HEIGHT);
  g.addColorStop(0,"#20414b");g.addColorStop(.75,"#3b655f");g.addColorStop(1,"#465747");
  ctx.fillStyle=g;ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.lineWidth=1;ctx.strokeStyle="rgba(220,245,240,.08)";
  for(let x=0;x<=WIDTH;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
  for(let y=0;y<=HEIGHT;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
  ctx.strokeStyle="#b3b284";ctx.beginPath();ctx.moveTo(25,C.fy);ctx.lineTo(WIDTH-25,C.fy);ctx.stroke();
 }
 function overlayPoint(ctx,xy,text,active,color){
  ctx.beginPath();ctx.arc(xy[0],xy[1],active?9:6,0,Math.PI*2);
  ctx.fillStyle=active?"#ffe09a":(color||"#6aedd1");ctx.fill();ctx.strokeStyle="#15363b";ctx.lineWidth=2;ctx.stroke();
  if(active&&text){ctx.font="bold 13px system-ui";ctx.fillStyle="#ffecab";ctx.fillText(text,xy[0]+13,xy[1]-12);}
 }
 function setPartAtlas(){
  partAtlases=null;const img=image();if(!img||!profile)return;
  try{partAtlases=rig.bakeParts(img,rect(),profile);}
  catch(e){status("パーツ切り出しに失敗: "+e.message,true)}
  makeGallery();
 }
 function makeGallery(){
  const outer=$("partGallery");if(!outer)return;
  outer.replaceChildren();
  const masks=rig.partMasks(character,direction,profile);
  for(const name of rig.partNames){
   const button=document.createElement("button");button.type="button";
   button.className="partTile"+(chosenPart===name?" selected":"");
   button.title=PART_LABELS[name];button.dataset.part=name;
   const thumb=document.createElement("canvas");thumb.width=112;thumb.height=90;
   thumb.setAttribute("aria-label",PART_LABELS[name]);
   const ctx=thumb.getContext("2d");
   const poly=masks[name],x=Math.max(0,Math.min(...poly.map(p=>p[0]))-6),y=Math.max(0,Math.min(...poly.map(p=>p[1]))-6);
   const right=Math.min(256,Math.max(...poly.map(p=>p[0]))+6),bottom=Math.min(324,Math.max(...poly.map(p=>p[1]))+6);
   const w=Math.max(1,right-x),h=Math.max(1,bottom-y),scale=Math.min(103/w,79/h);
   const dx=(112-w*scale)/2,dy=(90-h*scale)/2;
   if(partAtlases&&partAtlases[name]){
    ctx.drawImage(partAtlases[name],x,y,w,h,dx,dy,w*scale,h*scale);
   }
   button.appendChild(thumb);
   const span=document.createElement("span");span.textContent=PART_LABELS[name];button.appendChild(span);
   button.addEventListener("click",()=>{chosenPart=name;selectedVertex=0;makeGallery();fillPartFields();draw()});
   outer.appendChild(button);
  }
 }
 function maskOfPart(){
  const masks=rig.partMasks(character,direction,profile);
  return masks[chosenPart];
 }
 function fillPartFields(){
  $("currentPart").textContent=PART_LABELS[chosenPart];
  $("currentVertex").textContent="頂点 "+(selectedVertex+1)+" / "+maskOfPart().length;
  const data=profile.parts[chosenPart];
  $("partX").value=data.x;$("partY").value=data.y;$("partScale").value=data.scale;
 }
 function updateMask(poly,commit){
  profile.masks[chosenPart]=poly.map(p=>[Math.round(clamp(p[0],0,256)*10)/10,Math.round(clamp(p[1],0,324)*10)/10]);
  if(commit){rig.setProfile(character,direction,profile);setPartAtlas();status(PART_LABELS[chosenPart]+"の輪郭を保存しました");}
  fillPartFields();drawSource();drawPose();
 }
 function sourceHandles(){
  const masks=rig.partMasks(character,direction,profile);
  const result=[];
  if(editMode==="outline"){
   masks[chosenPart].forEach((p,i)=>result.push({key:i,source:p}));
  }else{
   for(const name of rig.jointNames)result.push({key:name,source:profile.joints[name]});
  }
  return result;
 }
 function drawSource(){
  const cv=$("sourceCanvas");if(!cv)return;
  const ctx=cv.getContext("2d");painter(ctx);
  const img=image();if(!img){ctx.fillStyle="#fff";ctx.fillText("キャラクターの元画像を読込中",85,270);return;}
  ctx.save();ctx.translate(C.cx,C.fy);
  ctx.scale(C.w/256*(direction==="left"?-1:1),C.h/324);
  ctx.drawImage(img,...rect(),-128,-314,256,324);ctx.restore();
  const masks=rig.partMasks(character,direction,profile);
  const poly=masks[chosenPart];ctx.save();ctx.beginPath();
  poly.forEach((p,i)=>{const point=pointFromSource(p);if(i===0)ctx.moveTo(...point);else ctx.lineTo(...point)});
  ctx.closePath();ctx.fillStyle="rgba(72,230,181,.18)";ctx.fill();ctx.strokeStyle="#79ffcb";ctx.lineWidth=3;ctx.stroke();
  if(editMode==="outline"){
   poly.forEach((p,i)=>overlayPoint(ctx,pointFromSource(p),"頂点 "+(i+1),i===selectedVertex));
  }else{
   const joints=profile.joints,links=[
    ["frontShoulder","frontElbow"],["frontElbow","frontHand"],
    ["rearShoulder","rearElbow"],["rearElbow","rearHand"],
    ["frontHip","frontKnee"],["rearHip","rearKnee"]];
   ctx.strokeStyle="rgba(236,250,195,.8)";ctx.lineWidth=2;
   links.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(...pointFromSource(joints[a]));ctx.lineTo(...pointFromSource(joints[b]));ctx.stroke()});
   for(const [name,point] of Object.entries(joints))overlayPoint(ctx,pointFromSource(point),JOINT_LABELS[name],selectedHandle===name);
  }
  ctx.restore();
 }
 function overlayHandles(ctx,pose){
  const j=rig.poseJoints(profile,pose);
  const head=at([profile.joints.neck[0],profile.joints.neck[1]-55],profile.joints.neck,(pose.head||0)*rad);
  j.headAim=at(head,profile.joints.body,(pose.torso||0)*rad);
  const highlight=$("showHandles").checked;
  if(highlight){
   const pairs=[["frontShoulder","frontElbow"],["frontElbow","frontHand"],["rearShoulder","rearElbow"],
    ["rearElbow","rearHand"],["frontHip","frontKnee"],["frontKnee","frontFoot"],
    ["rearHip","rearKnee"],["rearKnee","rearFoot"],["neck","headAim"]];
   ctx.strokeStyle="rgba(247,231,172,.84)";ctx.lineWidth=2;
   pairs.forEach(([a,b])=>{const aa=pointFromSource(j[a],pose),bb=pointFromSource(j[b],pose);
    ctx.beginPath();ctx.moveTo(...aa);ctx.lineTo(...bb);ctx.stroke()});
   for(const key of HANDLE_NAMES)overlayPoint(ctx,pointFromSource(j[key],pose),JOINT_LABELS[key],selectedHandle===key,key.startsWith("rear")?"#6cc1ff":"#84f5b0");
  }
  return j;
 }
 function renderPose(progressPose,showOverlays){
  const cv=$("poseCanvas"),ctx=cv.getContext("2d");painter(ctx);
  const img=image();if(!img){ctx.fillStyle="#fff";ctx.fillText("元画像を読込中",195,275);return;}
  const opts={characterId:character,direction,mirror:direction==="left",
   profile,pose:progressPose,partAtlases,mode:"partsV2",environment:$("showProps").checked,
   progress:frameIndex/frames.length,action,showHandles:false};
  try{
   if(life&&life.has(action))life.render(ctx,img,rect(),C.cx,C.fy,C.w,C.h,opts);
   else rig.render(ctx,img,rect(),C.cx,C.fy,C.w,C.h,
    {...opts,equipment:action==="axe"?"axe":action==="bow"?"bow":action==="block"?"block":
      ["slash","thrust","combo","victory"].includes(action)?"sword":null});
   if(showOverlays)overlayHandles(ctx,progressPose);
  }catch(e){errors=e.message||String(e);status("描画エラー: "+errors,true);}
 }
 function drawPose(){if(!frames.length)return;renderPose(frames[frameIndex],true)}
 function draw(){if(!profile)return;drawSource();drawPose();}
 function frameControls(){
  const region=$("frameButtons");region.replaceChildren();
  frames.forEach((f,i)=>{
   const button=document.createElement("button");button.type="button";button.textContent=String(i+1);
   button.className="frameButton"+(frameIndex===i?" selected":"");
   button.title="第"+(i+1)+"コマ";
   button.setAttribute("aria-pressed",String(frameIndex===i));
   button.addEventListener("click",()=>chooseFrame(i));
   region.appendChild(button);
  });
  $("frameStatus").textContent=(frameIndex+1)+" / "+frames.length+" コマ";
  $("frameSlider").max=frames.length-1;$("frameSlider").value=frameIndex;
 }
 function buildFrames(){frameControls();}
 function syncSliders(){
  for(const key of KEYS){
   const slide=$("pose_"+key),num=$("value_"+key);
   if(slide)slide.value=frames[frameIndex][key]||0;
   if(num)num.value=frames[frameIndex][key]||0;
  }
  frameControls();
 }
 function chooseFrame(i){
  isPlaying=false;clock=0;$("play").textContent="▶ 再生";
  frameIndex=clamp(i,0,frames.length-1);syncSliders();drawPose();
 }
 function buildPoseSliders(){
  const table=$("poseSliders");table.replaceChildren();
  for(const key of KEYS){
   const row=document.createElement("label");row.className="poseRow";
   const name=document.createElement("span");name.textContent=KEY_LABELS[key]||key;
   const slider=document.createElement("input");slider.id="pose_"+key;slider.type="range";
   slider.min=key==="bodyY"?-80:-180;slider.max=key==="bodyY"?100:180;slider.step="1";slider.value="0";
   slider.setAttribute("aria-label",name.textContent);
   const number=document.createElement("input");number.id="value_"+key;number.type="number";
   number.min=slider.min;number.max=slider.max;number.step="1";number.value="0";
   function apply(value){
    if(isPlaying){isPlaying=false;$("play").textContent="▶ 再生";}
    const v=Number(value);if(!Number.isFinite(v))return;
    const next=clamp(v,Number(slider.min),Number(slider.max));
    frames[frameIndex][key]=next;slider.value=next;number.value=next;
    drawPose();saveClip();
   }
   slider.addEventListener("input",()=>apply(slider.value));
   number.addEventListener("change",()=>apply(number.value));
   row.append(name,slider,number);table.appendChild(row);
  }
 }
 function updatePartPosition(){
  if(!profile)return;
  const x=Number($("partX").value),y=Number($("partY").value),scale=Number($("partScale").value);
  if(![x,y,scale].every(Number.isFinite))return;
  profile.parts[chosenPart]={x:clamp(x,-48,48),y:clamp(y,-48,48),scale:clamp(scale,.65,1.45)};
  rig.setProfile(character,direction,profile);drawPose();
  status("パーツの位置と大きさを保存しました");
 }
 function changedCharacter(){
  profile=rig.getProfile(character,direction);
  if(!image()){status("元画像を読込中…");drawSource();return;}
  setPartAtlas();fillPartFields();loadClip();
  status(NAME[character]+" / "+DIR[direction]+" / 切り出し10パーツを読込済み");
 }
 function loadImage(char){
  if(images.has(char))return Promise.resolve(images.get(char));
  return new Promise((resolve,reject)=>{
   const img=new Image();img.onload=()=>{images.set(char,img);resolve(img)};
   img.onerror=()=>reject(Error("元画像がありません: "+SOURCE[char]));
   img.src=SOURCE[char];
   if(img.complete&&img.naturalWidth) {images.set(char,img);resolve(img)}
  });
 }
 function nearestSourceHandle(point){
  let best=18,choice=null;
  for(const a of sourceHandles()){
   const p=pointFromSource(a.source);
   const d=Math.hypot(point[0]-p[0],point[1]-p[1]);
   if(d<best){best=d;choice=a.key;}
  }
  return choice;
 }
 function nearestPoseHandle(point){
  const j=rig.poseJoints(profile,frames[frameIndex]);
  const pose=frames[frameIndex];
  const head=at([profile.joints.neck[0],profile.joints.neck[1]-55],profile.joints.neck,(pose.head||0)*rad);
  j.headAim=at(head,profile.joints.body,(pose.torso||0)*rad);
  let best=24,key=null;
  for(const name of HANDLE_NAMES){
   const coords=pointFromSource(j[name],pose),dist=Math.hypot(point[0]-coords[0],point[1]-coords[1]);
   if(dist<best){best=dist;key=name;}
  }
  return key;
 }
 function movePoseHandle(key,coordinates,priorY){
  const pose=frames[frameIndex],j=profile.joints;
  const desired=sourceFromPoint(...coordinates,pose);
  const raw=key.startsWith("front")?"front":"rear";
  const old=rig.poseJoints(profile,pose);
  if(key==="body"){
   const dy=(coordinates[1]-priorY)/(C.h/324);
   pose.bodyY=clamp(Math.round(pose.bodyY+dy),-80,100);
   return coordinates[1];
  }
  if(key==="headAim"){
   const pivot=old.neck;
   pose.head=clamp(wrap(angle(desired,pivot)+90-pose.torso),-180,180);
  }else if(key.endsWith("Elbow")){
   const base=j[raw+"Shoulder"],elbow=j[raw+"Elbow"];
   const withoutTorso=at(desired,j.body,-(pose.torso||0)*rad);
   pose[raw+"Upper"]=clamp(wrap(angle(withoutTorso,base)-angle(elbow,base)),-180,180);
  }else if(key.endsWith("Hand")){
   const withoutTorso=at(desired,j.body,-(pose.torso||0)*rad);
   rig.aimHands(pose,profile,{[raw]:withoutTorso});
  }else if(key.endsWith("Knee")){
   pose[raw+"Thigh"]=clamp(wrap(angle(desired,j[raw+"Hip"])-angle(j[raw+"Knee"],j[raw+"Hip"])),-180,180);
  }else if(key.endsWith("Foot")){
   const hip=j[raw+"Hip"],knee=j[raw+"Knee"],foot=[knee[0],Math.min(324,knee[1]+43)];
   const upper=[knee[0]-hip[0],knee[1]-hip[1]];
   const lower=[foot[0]-knee[0],foot[1]-knee[1]];
   const l1=Math.hypot(...upper),l2=Math.hypot(...lower);
   const dx=desired[0]-hip[0],dy=desired[1]-hip[1],d=Math.max(.001,Math.hypot(dx,dy));
   const length=clamp(d,Math.abs(l1-l2)+.2,l1+l2-.2);
   const along=(l1*l1-l2*l2+length*length)/(2*length);
   const across=Math.sqrt(Math.max(0,l1*l1-along*along)),ux=dx/d,uy=dy/d;
   const candidates=[1,-1].map(sign=>{
    const mid=[hip[0]+ux*along-sign*uy*across,hip[1]+uy*along+sign*ux*across];
    const end=[hip[0]+ux*length,hip[1]+uy*length];
    const thigh=wrap(angle(mid,hip)-angle(knee,hip));
    const shin=wrap(angle(end,mid)-angle(foot,knee)-thigh);
    const dist=Math.hypot(mid[0]-old[raw+"Knee"][0],mid[1]-old[raw+"Knee"][1]);
    return {thigh,shin,dist};
   });
   candidates.sort((a,b)=>a.dist-b.dist);
   pose[raw+"Thigh"]=clamp(candidates[0].thigh,-180,180);
   pose[raw+"Shin"]=clamp(candidates[0].shin,-180,180);
  }
  return priorY;
 }
 function attachPointers(){
  const a=$("sourceCanvas"),b=$("poseCanvas");
  a.addEventListener("pointerdown",ev=>{
   const point=eventPoint(ev,a),hit=nearestSourceHandle(point);
   if(hit===null){status("丸い編集点をタップしてください");return;}
   drag={panel:"source",pointerId:ev.pointerId,key:hit};
   if(editMode==="outline")selectedVertex=hit;else selectedHandle=hit;
   a.setPointerCapture(ev.pointerId);fillPartFields();drawSource();ev.preventDefault();
  });
  a.addEventListener("pointermove",ev=>{
   if(!drag||drag.panel!=="source"||drag.pointerId!==ev.pointerId)return;
   const p=sourceFromPoint(...eventPoint(ev,a));
   if(editMode==="outline"){
    const mask=maskOfPart();mask[drag.key]=[clamp(p[0],0,256),clamp(p[1],0,324)];
    updateMask(mask,false);
   }else{
    profile.joints[drag.key]=[clamp(p[0],0,256),clamp(p[1],0,324)];draw();
   }
   ev.preventDefault();
  });
  const sourceStop=ev=>{
   if(!drag||drag.panel!=="source"||drag.pointerId!==ev.pointerId)return;
   drag=null;rig.setProfile(character,direction,profile);
   setPartAtlas();fillPartFields();draw();
   status("切り出し境界と関節位置を保存しました");
   ev.preventDefault();
  };
  a.addEventListener("pointerup",sourceStop);a.addEventListener("pointercancel",sourceStop);
  b.addEventListener("pointerdown",ev=>{
   if(isPlaying){isPlaying=false;$("play").textContent="▶ 再生";}
   const p=eventPoint(ev,b),hit=nearestPoseHandle(p);
   if(!hit){status("色付きの関節点を指で動かしてください");return;}
   selectedHandle=hit;drag={panel:"pose",pointerId:ev.pointerId,key:hit,lastY:p[1]};
   b.setPointerCapture(ev.pointerId);drawPose();ev.preventDefault();
  });
  b.addEventListener("pointermove",ev=>{
   if(!drag||drag.panel!=="pose"||drag.pointerId!==ev.pointerId)return;
   const p=eventPoint(ev,b);drag.lastY=movePoseHandle(drag.key,p,drag.lastY);
   syncSliders();drawPose();ev.preventDefault();
  });
  const poseStop=ev=>{
   if(!drag||drag.panel!=="pose"||drag.pointerId!==ev.pointerId)return;
   drag=null;saveClip();ev.preventDefault();
  };
  b.addEventListener("pointerup",poseStop);b.addEventListener("pointercancel",poseStop);
  b.addEventListener("keydown",ev=>{
   if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(ev.key))return;
   const pose=frames[frameIndex],m=ev.shiftKey?5:1;
   const key=selectedHandle;
   let source=rig.poseJoints(profile,pose)[key];if(!source)return;
   const p=pointFromSource(source,pose);p[0]+=(ev.key==="ArrowLeft"?-m:ev.key==="ArrowRight"?m:0);
   p[1]+=(ev.key==="ArrowUp"?-m:ev.key==="ArrowDown"?m:0);
   movePoseHandle(key,p,p[1]);syncSliders();drawPose();saveClip();ev.preventDefault();
  });
 }
 function updateSelection(){
  const a=$("character"),b=$("direction"),c=$("action");
  character=a.value;direction=b.value;action=c.value;frameIndex=0;
  profile=rig.getProfile(character,direction);partAtlases=null;
  loadClip();
  loadImage(character).then(()=>{
   if(character!==a.value)return;
   changedCharacter();
  }).catch(e=>status("キャラクター画像の読み込みエラー: "+e.message,true));
 }
 function addVertex(){
  if(editMode!=="outline")return;
  const mask=maskOfPart();if(mask.length>=28){status("頂点は28個までです",true);return;}
  const a=mask[selectedVertex],b=mask[(selectedVertex+1)%mask.length];
  mask.splice(selectedVertex+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);
  selectedVertex++;updateMask(mask,true);
 }
 function removeVertex(){
  if(editMode!=="outline")return;
  const mask=maskOfPart();if(mask.length<=3){status("頂点は最低3個必要です",true);return;}
  mask.splice(selectedVertex,1);selectedVertex=clamp(selectedVertex,0,mask.length-1);
  updateMask(mask,true);
 }
 function exportJSON(){
  const data={version:1,kind:"FrontierWorldPartMotionProject",
   rigProfiles:rig.exportProfiles(),motions:store.motions,
   selected:{character,direction,action,frameIndex}};
  return JSON.stringify(data,null,2);
 }
 function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 function exportProject(){
  const data=exportJSON();
  download(new Blob([data],{type:"application/json"}),"frontier-world-part-motion-project.json");
  status("関節・輪郭と全コマのプロジェクトJSONを書き出しました");
 }
 function importProject(data){
  if(!data||data.version!==1||data.kind!=="FrontierWorldPartMotionProject"||!data.motions||typeof data.motions!=="object")
   throw Error("このエディタ用のJSONではありません");
  const known=new Set(actions.map(a=>a.id)),motion={},entries=Object.entries(data.motions);
  if(entries.length>300)throw Error("アニメーションの登録数が多すぎます");
  for(const [id,value] of entries){
   const fields=id.split("|");
   if(fields.length!==3||!SOURCE[fields[0]]||!DIR[fields[1]]||!known.has(fields[2])||!Array.isArray(value)||value.length<2||value.length>32)continue;
   motion[id]=value.map(safePose);
  }
  if(data.rigProfiles)rig.importProfiles(data.rigProfiles);
  store={version:1,motions:motion};if(!saveStore())throw Error("端末への保存に失敗しました");
  profile=rig.getProfile(character,direction);setPartAtlas();loadClip();
  status("JSONから "+Object.keys(motion).length+" アニメーションを読み込みました。");
 }
 function exportParts(){
  if(!image()||!partAtlases){status("パーツを先に読み込んでください",true);return;}
  const c=document.createElement("canvas");c.width=1280;c.height=648;const g=c.getContext("2d");
  rig.partNames.forEach((id,i)=>g.drawImage(partAtlases[id],(i%5)*256,Math.floor(i/5)*324));
  c.toBlob(blob=>{
   if(!blob){status("画像の書き出しができません",true);return;}
   download(blob,"frontier-"+character+"-"+direction+"-10parts.png");
   status("10個の独立パーツを透明PNG（5列×2行）で書き出しました");
  },"image/png");
 }
 function exportFrames(){
  if(!image()||!partAtlases){status("パーツを先に読み込んでください",true);return;}
  const c=document.createElement("canvas");c.width=frames.length*256;c.height=324;const g=c.getContext("2d");
  const img=image(),r=rect();
  frames.forEach((pose,i)=>{
   rig.render(g,img,r,i*256+128,314,256,324,{action,progress:i/frames.length,
    profile,pose,mode:"partsV2",partAtlases,direction,mirror:direction==="left",characterId:character});
  });
  c.toBlob(blob=>{
   if(!blob){status("コマ画像の書き出しに失敗しました",true);return;}
   download(blob,"frontier-"+character+"-"+direction+"-"+action+"-"+frames.length+"frames.png");
   status(frames.length+"コマの透明スプライトPNGを書き出しました");
  },"image/png");
 }
 function buildActionSelect(){
  actions=actionNames();
  const select=$("action");select.replaceChildren();
  const groups={life:document.createElement("optgroup"),combat:document.createElement("optgroup")};
  groups.life.label="生活モーション";groups.combat.label="戦闘モーション";
  actions.forEach(a=>{const opt=document.createElement("option");opt.value=a.id;opt.textContent=a.label;groups[a.group].appendChild(opt)});
  select.append(groups.life,groups.combat);
  select.value="chop";
 }
 function setShowTabs(mode){
  editMode=mode;$("editOutline").setAttribute("aria-pressed",String(mode==="outline"));
  $("editAnchors").setAttribute("aria-pressed",String(mode==="joint"));
  $("editOutline").classList.toggle("selected",mode==="outline");
  $("editAnchors").classList.toggle("selected",mode==="joint");
  $("sourceHelp").textContent=mode==="outline"?
   "選択パーツの多角形の頂点をドラッグ。追加・削除もできます。":"元画像の肩・肘・膝などの丸をドラッグし、関節の基準位置を調整します。";
  $("addVertex").disabled=mode!=="outline";$("removeVertex").disabled=mode!=="outline";
  drawSource();
 }
 function bind(){
  $("character").addEventListener("change",updateSelection);
  $("direction").addEventListener("change",updateSelection);
  $("action").addEventListener("change",updateSelection);
  $("editOutline").addEventListener("click",()=>setShowTabs("outline"));
  $("editAnchors").addEventListener("click",()=>setShowTabs("joint"));
  $("addVertex").addEventListener("click",addVertex);
  $("removeVertex").addEventListener("click",removeVertex);
  $("resetMask").addEventListener("click",()=>{
   if(!confirm(PART_LABELS[chosenPart]+"の切り出し輪郭を初期化しますか？"))return;
   delete profile.masks[chosenPart];rig.setProfile(character,direction,profile);
   selectedVertex=0;setPartAtlas();fillPartFields();draw();status("選択パーツの輪郭を初期化しました");
  });
  ["partX","partY","partScale"].forEach(id=>$(id).addEventListener("change",updatePartPosition));
  $("play").addEventListener("click",()=>{
   isPlaying=!isPlaying;clock=0;prevTime=0;
   $("play").textContent=isPlaying?"⏸ 停止":"▶ 再生";
  });
  $("first").addEventListener("click",()=>chooseFrame(0));
  $("prev").addEventListener("click",()=>chooseFrame((frameIndex-1+frames.length)%frames.length));
  $("next").addEventListener("click",()=>chooseFrame((frameIndex+1)%frames.length));
  $("frameSlider").addEventListener("input",ev=>chooseFrame(Number(ev.target.value)));
  $("addFrame").addEventListener("click",()=>{
   if(frames.length>=32){status("最大32コマまでです",true);return;}
   frames.splice(frameIndex+1,0,copy(frames[frameIndex]));frameIndex++;
   buildFrames();syncSliders();saveClip();drawPose();
  });
  $("deleteFrame").addEventListener("click",()=>{
   if(frames.length<=2){status("最低2コマ必要です",true);return;}
   frames.splice(frameIndex,1);frameIndex=clamp(frameIndex,0,frames.length-1);
   buildFrames();syncSliders();saveClip();drawPose();
  });
  $("copyPrev").addEventListener("click",()=>{
   const from=(frameIndex-1+frames.length)%frames.length;
   frames[frameIndex]=copy(frames[from]);syncSliders();saveClip();drawPose();
  });
  $("resetFrame").addEventListener("click",()=>{
   frames[frameIndex]=safePose(rig.sample(action,frameIndex/frames.length));
   syncSliders();saveClip();drawPose();
  });
  $("showProps").addEventListener("change",drawPose);
  $("showHandles").addEventListener("change",drawPose);
  $("exportJSON").addEventListener("click",exportProject);
  $("exportParts").addEventListener("click",exportParts);
  $("exportFrames").addEventListener("click",exportFrames);
  $("importJSON").addEventListener("change",event=>{
   const file=event.target.files&&event.target.files[0];if(!file)return;
   if(file.size>2_000_000){status("JSONが大きすぎます（上限2 MB）",true);event.target.value="";return;}
   file.text().then(text=>importProject(JSON.parse(text)))
    .catch(e=>status("読み込みエラー: "+e.message,true));
   event.target.value="";
  });
  attachPointers();
 }
 function tick(now){
  const delta=prevTime?clamp(now-prevTime,0,100):0;prevTime=now;
  if(isPlaying&&document.visibilityState!=="hidden"&&frames.length){
   clock+=delta;const fps=Number($("fps").value)||6;
   const indexF=(clock*fps/1000)%frames.length,index=Math.floor(indexF);
   let pose=frames[index];
   if($("interpolate").checked){
    const b=frames[(index+1)%frames.length],ratio=indexF-index;
    const eased=ratio*ratio*(3-2*ratio);pose={};
    for(const key of KEYS)pose[key]=frames[index][key]*(1-eased)+b[key]*eased;
   }
   renderPose(pose,false);
   $("frameStatus").textContent=(index+1)+" / "+frames.length+" コマ（再生中）";
  }
  requestAnimationFrame(tick);
 }
 function boot(){
  if(!rig||!life||typeof rig.bakeParts!=="function"){
   status("編集プログラムを読み込めませんでした。ページを再読み込みしてください。",true);return;
  }
  if(inited)return;inited=true;loadStore();
  buildActionSelect();buildPoseSliders();bind();
  $("fps").addEventListener("input",()=>$("fpsVal").textContent=$("fps").value+" fps");
  profile=rig.getProfile(character,direction);frames=Array.from({length:8},(_,i)=>safePose(rig.sample(action,i/8)));
  fillPartFields();loadClip();
  loadImage(character).then(changedCharacter).catch(e=>status("画像読込エラー: "+e.message,true));
  requestAnimationFrame(tick);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
 global.FWPartMotionStudio=Object.freeze({version:"1.0",getCurrent:()=>({character,direction,action,frameIndex,frames:copy(frames)}),exportProject:exportJSON});
})(window);
