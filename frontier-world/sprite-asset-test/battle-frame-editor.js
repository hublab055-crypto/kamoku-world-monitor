/* Frontier World battle frame authoring UI v2 - player edits EVERY joint in EVERY frame. */
(function(){"use strict";
function boot(){
 const api=window.FWBattlePartsV2;
 if(!api){document.getElementById("status").textContent="パーツモジュールを読み込めません";return}
 const $=id=>document.getElementById(id),cv=$("poseCanvas"),ctx=cv.getContext("2d");
 const actor=$("actor"),dir=$("dir"),action=$("action"),strip=$("frameStrip"),value=$("jointValues");
 const jointList={body:"body",neck:"head",rShoulder:"rShoulder",rElbow:"rElbow",rWrist:"rWrist",
  lShoulder:"lShoulder",lElbow:"lElbow",lWrist:"lWrist",rHip:"rHip",rKnee:"rKnee",
  rAnkle:"rAnkle",lHip:"lHip",lKnee:"lKnee",lAnkle:"lAnkle"};
 const aNames={slash:"剣斬撃",thrust:"突き",axe:"斧振り下ろし",bow:"弓",combo:"三連撃",
  block:"盾防御",dodge:"回避",hit:"被弾",fall:"戦闘不能",victory:"勝利"};
 api.actions.forEach(id=>action.add(new Option(aNames[id]||id,id)));
 let motion=api.get(actor.value,dir.value,action.value),index=0,selected="rShoulder",pasteFrame=null;
 let playing=false,guides=true,onion=false,playPosition=0,lastTick=null,drag=null,thumbs=[];
 const status=msg=>{$("status").textContent=msg};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function frame(){return motion[index]}
 function save(){
  const ok=api.set(actor.value,dir.value,action.value,motion);
  status(ok?"保存しました："+actor.value+" / "+dir.value+" / "+(aNames[action.value]||action.value)+" / "+(index+1)+"コマ目":
    "端末の保存に失敗しました。JSONを保存してください。");
 }
 function selectedRange(){return selected==="rootX"||selected==="rootY"?[-100,100]:[-180,180]}
 function setAngle(k,v){
  const bounds=k==="rootX"||k==="rootY"?[-100,100]:[-180,180];
  const n=Number(v);if(!Number.isFinite(n))return;
  motion[index][k]=Math.round(clamp(n,...bounds)*10)/10;
  save();syncInputs();draw();redrawThumbs();
 }
 function selectKey(k){
  if(!api.keys.includes(k))return;
  selected=k;syncInputs();draw();
 }
 function syncInputs(){
  const v=frame()[selected],rng=selectedRange();
  $("selectedJoint").textContent=api.keyNames[selected]||selected;
  $("angleOut").textContent=selected==="rootX"||selected==="rootY"?"（px）":"（°）";
  $("angle").min=rng[0];$("angle").max=rng[1];$("angle").value=v;
  $("degree").min=rng[0];$("degree").max=rng[1];$("degree").value=v;
  value.querySelectorAll("input").forEach(input=>{
   input.value=frame()[input.dataset.key];
   input.classList.toggle("active",input.dataset.key===selected);
  });
 }
 api.keys.forEach(key=>{
  const label=document.createElement("label");label.textContent=api.keyNames[key]||key;
  const input=document.createElement("input");input.type="number";input.step=".1";input.dataset.key=key;
  const limit=key.startsWith("root")?100:180;input.min=-limit;input.max=limit;
  input.addEventListener("focus",()=>selectKey(key));
  input.addEventListener("change",()=>setAngle(key,input.value));
  value.append(label,input);
 });
 const floorY=452,scale=1.2,stageX=300;
 function screen(pos){return [stageX+(pos[0]-128)*(dir.value==="left"?-1:1)*scale,floorY+(pos[1]-314)*scale]}
 function unscreen(p){return [128+(p[0]-stageX)/(scale*(dir.value==="left"?-1:1)),314+(p[1]-floorY)/scale]}
 function renderPose(c,p,dim=false){
  c.save();c.globalAlpha=dim?.24:1;
  api.render(c,stageX,floorY,256*scale,324*scale,{characterId:actor.value,direction:dir.value,action:action.value,pose:p});
  c.restore();
 }
 function draw(){
  ctx.clearRect(0,0,600,510);
  const g=ctx.createLinearGradient(0,0,0,510);g.addColorStop(0,"#345564");g.addColorStop(1,"#456252");
  ctx.fillStyle=g;ctx.fillRect(0,0,600,510);
  ctx.strokeStyle="rgba(230,255,245,.1)";ctx.lineWidth=1;
  for(let x=0;x<600;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,510);ctx.stroke()}
  for(let y=0;y<510;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(600,y);ctx.stroke()}
  ctx.strokeStyle="#d1e2bc";ctx.beginPath();ctx.moveTo(35,floorY);ctx.lineTo(565,floorY);ctx.stroke();
  let shown=playing?api.sample(actor.value,dir.value,action.value,playPosition/(motion.length-1)):frame();
  if(onion&&index>0)renderPose(ctx,motion[index-1],true);
  renderPose(ctx,shown);
  if(guides){
   const pts=api.points(shown);
   const pairs=[["body","neck"],["rShoulder","rElbow"],["rElbow","rWrist"],["lShoulder","lElbow"],["lElbow","lWrist"],["rHip","rKnee"],["rKnee","rAnkle"],["lHip","lKnee"],["lKnee","lAnkle"]];
   ctx.lineWidth=3;ctx.strokeStyle="#99e9d0";
   for(const [a,b] of pairs){const start=screen(pts[a]),end=screen(pts[b]);ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();}
   for(const [key,name] of Object.entries(jointList)){
    const where=screen(pts[key]),active=name===selected;
    ctx.fillStyle=active?"#ffdb83":key.startsWith("r")?"#ed8d82":key.startsWith("l")?"#8edcf3":"#94f2b6";
    ctx.beginPath();ctx.arc(...where,active?9:6,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#263b46";ctx.lineWidth=2;ctx.stroke();
   }
  }
  ctx.fillStyle="#fff";ctx.font="bold 17px system-ui";
  ctx.fillText((aNames[action.value]||action.value)+"  |  "+dir.options[dir.selectedIndex].text+"  |  コマ "+(index+1)+" / "+motion.length,18,28);
  ctx.font="12px system-ui";ctx.fillStyle="#d9f2ed";ctx.fillText("選択: "+(api.keyNames[selected]||selected)+" "+frame()[selected]+(selected.startsWith("root")?"px":"°"),18,49);
 }
 function thumbnails(){
  strip.replaceChildren();thumbs=[];
  motion.forEach((p,n)=>{
   const btn=document.createElement("button");btn.type="button";btn.className="frame"+(index===n?" active":"");
   const label=document.createElement("div");label.textContent="コマ "+(n+1);
   const can=document.createElement("canvas");can.width=90;can.height=116;
   btn.append(label,can);btn.addEventListener("click",()=>choose(n));strip.appendChild(btn);
   thumbs.push({btn,can});
  });
  redrawThumbs();
  $("totalFrames").textContent=motion.length+"コマ / 編集中 "+(index+1);
 }
 function redrawThumbs(){
  thumbs.forEach(({btn,can},i)=>{
   btn.classList.toggle("active",index===i);
   const c=can.getContext("2d");c.clearRect(0,0,90,116);
   api.render(c,45,109,86,108,{characterId:actor.value,direction:dir.value,action:action.value,pose:motion[i]});
  });
  $("totalFrames").textContent=motion.length+"コマ / 編集中 "+(index+1);
  $("progress").max=motion.length-1;
  $("progress").value=index;
  $("progressValue").textContent=(index+1)+" / "+motion.length;
 }
 function choose(n){
  playing=false;$("play").textContent="▶ 再生";
  index=clamp(Math.round(n),0,motion.length-1);playPosition=index;
  syncInputs();draw();redrawThumbs();
  const card=thumbs[index]?.btn;
  if(card)card.scrollIntoView({block:"nearest",inline:"nearest"});
 }
 function load(){
  motion=api.get(actor.value,dir.value,action.value);
  index=0;playing=false;playPosition=0;$("play").textContent="▶ 再生";
  syncInputs();thumbnails();draw();
  status("読み込み完了。角度と位置はキャラ・方向・動作・コマごとに保存できます。");
 }
 function partShelf(){
  const shelf=$("partShelf"),caption={
   cape:"マント",rearUpper:"奥上腕",rearLower:"奥前腕",rearHand:"奥の手",
   rearThigh:"奥太もも",rearShin:"奥すね",rearFoot:"奥足",torso:"胴体",waist:"腰",
   head:"頭・髪",frontUpper:"手前上腕",frontLower:"手前前腕",frontHand:"手前の手",
   frontThigh:"手前太もも",frontShin:"手前すね",frontFoot:"手前足",sword:"剣",shield:"盾"
  };
  shelf.replaceChildren();
  api.parts.forEach(k=>{
   const box=document.createElement("div");box.className="part";
   const can=document.createElement("canvas");can.width=100;can.height=112;
   const text=document.createElement("span");text.textContent=caption[k]||k;
   box.append(can,text);shelf.appendChild(box);
   const c=can.getContext("2d");c.save();
   c.translate(50,87);c.scale(k==="head"?.49:k==="cape"?.65:.7,k==="head"?.49:k==="cape"?.65:.7);
   api.drawPart(c,k,actor.value,dir.value);c.restore();
  });
 }
 function localPointer(e){
  const r=cv.getBoundingClientRect();
  return [(e.clientX-r.left)*600/r.width,(e.clientY-r.top)*510/r.height];
 }
 cv.addEventListener("pointerdown",e=>{
  if(playing)return;
  const xy=localPointer(e),pts=api.points(frame());let candidate=null,best=23;
  Object.entries(jointList).forEach(([marker,k])=>{
   const p=screen(pts[marker]),distance=Math.hypot(xy[0]-p[0],xy[1]-p[1]);
   if(distance<best){candidate={marker,k,point:p};best=distance;}
  });
  if(!candidate)return;
  selectKey(candidate.k);
  drag={id:e.pointerId,origin:candidate.point,start:Math.atan2(xy[1]-candidate.point[1],xy[0]-candidate.point[0]),value:frame()[selected]};
  cv.setPointerCapture(e.pointerId);e.preventDefault();
 });
 cv.addEventListener("pointermove",e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const xy=localPointer(e),a=Math.atan2(xy[1]-drag.origin[1],xy[0]-drag.origin[0]);
  const delta=(a-drag.start)*180/Math.PI;
  const signed=dir.value==="left"?-delta:delta;
  setAngle(selected,drag.value+signed);e.preventDefault();
 });
 function endDrag(e){if(drag?.id===e.pointerId){drag=null;e.preventDefault()}}
 cv.addEventListener("pointerup",endDrag);cv.addEventListener("pointercancel",endDrag);
 cv.addEventListener("keydown",e=>{
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
  setAngle(selected,frame()[selected]+(e.key==="ArrowLeft"||e.key==="ArrowDown"?-1:1)*(e.shiftKey?10:1));e.preventDefault();
 });
 [actor,dir,action].forEach(control=>control.addEventListener("change",()=>{partShelf();load()}));
 $("angle").addEventListener("input",()=>setAngle(selected,$("angle").value));
 $("degree").addEventListener("change",()=>setAngle(selected,$("degree").value));
 $("prevFrame").addEventListener("click",()=>choose((index+motion.length-1)%motion.length));
 $("nextFrame").addEventListener("click",()=>choose((index+1)%motion.length));
 $("copy").addEventListener("click",()=>{pasteFrame={...frame()};status("現在のコマをコピーしました")});
 $("paste").addEventListener("click",()=>{if(!pasteFrame){status("まずコマをコピーしてください");return}motion[index]={...pasteFrame};save();syncInputs();draw();redrawThumbs()});
 $("insert").addEventListener("click",()=>{
  if(motion.length>=48){status("48コマまで追加できます");return}
  motion.splice(index+1,0,{...frame()});save();thumbnails();choose(index+1);
 });
 $("remove").addEventListener("click",()=>{
  if(motion.length<=2){status("最低2コマ必要です");return}
  motion.splice(index,1);index=Math.min(index,motion.length-1);
  save();syncInputs();thumbnails();draw();
 });
 $("defaultFrame").addEventListener("click",()=>{
  const baseline=api.defaults(action.value);
  motion[index]={...(baseline[Math.min(index,baseline.length-1)]||api.neutral())};
  save();syncInputs();draw();redrawThumbs();
 });
 $("defaultMotion").addEventListener("click",()=>{
  if(!confirm("このキャラクター・方向・動作のコマ編集をすべて初期値に戻しますか？"))return;
  api.reset(actor.value,dir.value,action.value);load();
 });
 $("guides").addEventListener("click",()=>{guides=!guides;$("guides").textContent="関節ガイド "+(guides?"ON":"OFF");draw()});
 $("onion").addEventListener("click",()=>{onion=!onion;$("onion").textContent="前のコマを重ねる "+(onion?"ON":"OFF");draw()});
 $("progress").addEventListener("input",()=>choose(Math.round(Number($("progress").value))));
 $("play").addEventListener("click",()=>{
  playing=!playing;$("play").textContent=playing?"⏸ 停止":"▶ 再生";
  if(playing)playPosition=index;else choose(Math.round(playPosition));
 });
 $("jsonExport").addEventListener("click",()=>{
  const text=api.exportJSON();$("dataJson").value=text;
  const blob=new Blob([text],{type:"application/json"}),url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="frontier-battle-frames.json";document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),12000);status("すべてのキャラの保存済み戦闘モーションをJSONで出力しました");
 });
 $("jsonImport").addEventListener("click",()=>{
  try{const count=api.importJSON($("dataJson").value);load();status(count+"モーションを読み込みました")}
  catch(e){status("読み込み失敗: "+e.message)}
 });
 $("pngExport").addEventListener("click",()=>{
  if(motion.length>16){status("PNGは16コマ以下で書き出してください（ブラウザーの描画サイズ制限対策）。JSONなら48コマ保存できます");return}
  const canvas=document.createElement("canvas");canvas.width=256*motion.length;canvas.height=324*4;
  const c=canvas.getContext("2d");if(!c){status("PNG用キャンバスの作成に失敗");return}
  ["front","left","right","back"].forEach((d,row)=>{
   const sequence=api.get(actor.value,d,action.value);
   for(let i=0;i<motion.length;i++){
    const at=sequence[Math.min(i,sequence.length-1)];
    api.render(c,256*i+128,324*row+314,256,324,{characterId:actor.value,direction:d,action:action.value,pose:at});
   }
  });
  canvas.toBlob(blob=>{
   if(!blob){status("PNGの生成に失敗");return}
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download="battle-"+actor.value+"-"+action.value+"-4dir-"+motion.length+"f.png";
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
   status("4方向×"+motion.length+"コマの透過PNGを作成しました。各方向の編集値を使用しています");
  },"image/png");
 });
 function step(t){
  if(lastTick===null)lastTick=t;
  const dt=Math.min(80,Math.max(0,t-lastTick));lastTick=t;
  if(playing){
   playPosition=(playPosition+dt/1000*Number($("fps").value))%motion.length;
   index=Math.floor(playPosition);
   $("progress").value=playPosition;
   $("progressValue").textContent=(index+1)+" / "+motion.length;
   draw();
   thumbs.forEach((x,i)=>x.btn.classList.toggle("active",i===index));
  }
  requestAnimationFrame(step);
 }
 partShelf();load();requestAnimationFrame(step);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();