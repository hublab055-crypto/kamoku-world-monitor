/* 10-part rig: per-character/direction calibration with pointer and keyboard controls. */
(function(){
"use strict";
const el=id=>document.getElementById(id);
const dirs={front:"正面",right:"右向き",left:"左向き（反転）",back:"背面"};
const labels={
 neck:"首・頭",body:"胴体",frontShoulder:"手前の肩",frontElbow:"手前の肘",frontHand:"手前の手",
 rearShoulder:"奥の肩",rearElbow:"奥の肘",rearHand:"奥の手",frontHip:"手前の股関節",
 frontKnee:"手前の膝",rearHip:"奥の股関節",rearKnee:"奥の膝",
 torso:"胴体",head:"頭",frontUpper:"手前の上腕",frontLower:"手前の前腕",
 rearUpper:"奥の上腕",rearLower:"奥の前腕",frontThigh:"手前の太もも",frontShin:"手前のすね",
 rearThigh:"奥の太もも",rearShin:"奥のすね"
};
const links=[["neck","body"],["frontShoulder","frontElbow"],["frontElbow","frontHand"],
 ["rearShoulder","rearElbow"],["rearElbow","rearHand"],["body","frontHip"],["body","rearHip"],
 ["frontHip","frontKnee"],["rearHip","rearKnee"]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const C={x:250,y:432,w:286,h:362};
const directionRow={front:0,left:1,right:2,back:3};
const equip=a=>a==="bow"?"bow":a==="block"?"block":a==="axe"?"axe":
 ["slash","thrust","combo","victory"].includes(a)?"sword":null;
function boot(){
 const rig=window.FWBattleRig,grid=document.querySelector(".grid"),characters=el("character");
 if(!rig||!grid||!characters||el("battleRigCalibration"))return;
 const section=document.createElement("section");section.className="pane full";section.id="battleRigCalibration";
 section.innerHTML=
 '<h2>🦴 キャラ別・関節の位置調整</h2>'+
 '<p class="note">肩・肘・手首・股関節・膝・頭などを、キャラ／向きごとに調整します。左の丸をドラッグしてください。右側で攻撃中の姿勢を確認できます。保存した値は同じブラウザーの本編にも反映されます。</p>'+
 '<div class="toolbar"><label for="fwRigDirection">向き</label><select id="fwRigDirection"></select>'+
 '<label for="fwRigAction">動作</label><select id="fwRigAction"></select>'+
 '<button id="fwRigPlay" type="button">▶ 再生</button>'+
 '<label for="fwRigTime">時点</label><input id="fwRigTime" type="range" min="0" max="100" value="42">'+
 '<output id="fwRigTimeOut">42%</output></div>'+
 '<div class="fw-rig-columns"><div><h3>調整用原画像</h3>'+
 '<canvas id="fwRigSource" width="500" height="480" tabindex="0" aria-label="関節をドラッグして調整"></canvas></div>'+
 '<div><h3>調整後の戦闘アニメーション</h3>'+
 '<canvas id="fwRigPose" width="500" height="480" role="img" aria-label="関節ポーズを表示"></canvas></div></div>'+
 '<div class="toolbar"><label for="fwRigMode">編集種別</label>'+
 '<select id="fwRigMode"><option value="joint">関節の基点</option><option value="part">各パーツの位置と倍率</option></select>'+
 '<label for="fwRigTarget">調整箇所</label><select id="fwRigTarget"></select></div>'+
 '<div class="fw-rig-fields"><label for="fwRigX">X座標</label><input type="number" id="fwRigX" step="1" value="0"><span class="note">px</span>'+
 '<label for="fwRigY">Y座標</label><input type="number" id="fwRigY" step="1" value="0"><span class="note">px</span>'+
 '<label for="fwRigScale">パーツ倍率</label><input type="range" id="fwRigScale" min=".65" max="1.45" step=".005" value="1">'+
 '<output id="fwRigScaleOut">1.000</output></div>'+
 '<div class="toolbar"><button type="button" id="fwRigResetOne">選択部位を初期値へ</button>'+
 '<button type="button" id="fwRigResetDir">この方向を初期値へ</button>'+
 '<button type="button" id="fwRigExport">⬇ JSONを保存</button>'+
 '<button type="button" id="fwRigImport">JSONを読み込む</button></div>'+
 '<textarea id="fwRigJson" class="jsonArea" rows="4" placeholder="共有するJSONをここに貼り付け"></textarea>'+
 '<div class="info" id="fwRigStatus" aria-live="polite">読み込み中…</div>'+
 '<p class="note">操作方法：丸をドラッグ、またはX/Yを入力。原画像の枠・手足のつなぎ目が合わない場合はパーツ位置と倍率を調整。矢印キー（Shift同時で5px）でも移動できます。調整は端末内で自動保存され、元画像は変更しません。別端末へはJSONで共有できます。</p>';
 const style=document.createElement("style");
 style.textContent=
 ".fw-rig-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}"+
 ".fw-rig-columns>div{min-width:0;border:1px solid #365b67;border-radius:12px;padding:8px;background:#142934}"+
 ".fw-rig-columns canvas{width:100%;height:auto;display:block;border-radius:8px;background:#203844}"+
 "#fwRigSource{cursor:crosshair;touch-action:none}"+
 ".fw-rig-fields{display:grid;grid-template-columns:130px minmax(90px,1fr) 65px;gap:8px;align-items:center;margin:12px 0}"+
 ".fw-rig-fields input{width:100%;min-width:0}"+
 "@media(max-width:720px){.fw-rig-columns{grid-template-columns:1fr}.fw-rig-fields{grid-template-columns:1fr 1fr 45px}}";
 document.head.appendChild(style);
 const before=[...grid.children].find(x=>x.querySelector("h2")?.textContent.includes("調整モード"));
 grid.insertBefore(section,before||null);
 const source=el("fwRigSource"),view=el("fwRigPose");
 const src=source.getContext("2d"),dst=view.getContext("2d");
 const d=el("fwRigDirection"),action=el("fwRigAction"),mode=el("fwRigMode"),target=el("fwRigTarget");
 const inpX=el("fwRigX"),inpY=el("fwRigY"),inpScale=el("fwRigScale");
 Object.entries(dirs).forEach(([id,label])=>d.add(new Option(label,id)));
 rig.actions.filter(a=>a!=="idle").forEach(a=>action.add(new Option(a,a)));
 action.value="slash";d.value="front";
 let currentId="boy2",facing="front",profile=null,manifest=null,images={},lastT=0,play=false,drag=null;
 function note(msg){el("fwRigStatus").textContent=msg}
 function refreshValue(){
  if(!profile)return;
  const id=target.value,isJoint=mode.value==="joint";
  const part=isJoint?profile.joints[id]:profile.parts[id];if(!part)return;
  inpX.min=isJoint?0:-48;inpX.max=isJoint?256:48;
  inpY.min=isJoint?0:-48;inpY.max=isJoint?324:48;
  inpX.value=isJoint?part[0]:part.x;inpY.value=isJoint?part[1]:part.y;
  inpScale.disabled=isJoint;inpScale.value=isJoint?1:part.scale;
  el("fwRigScaleOut").textContent=isJoint?"—":Number(part.scale).toFixed(3);
 }
 function targetList(){
  target.replaceChildren();
  const names=mode.value==="joint"?rig.jointNames:rig.partNames;
  names.forEach(id=>target.add(new Option(labels[id]||id,id)));
  refreshValue();
 }
 function load(){
  const candidate=characters.value;
  if(manifest&&manifest.characters[candidate])currentId=candidate;
  profile=rig.getProfile(currentId,facing);
  targetList();draw();
  note("キャラクター: "+(manifest?.characters[currentId]?.displayName||currentId)+" / "+dirs[facing]+"。補正値を編集できます。");
 }
 function commit(){
  if(!profile)return;
  const saved=rig.setProfile(currentId,facing,profile);
  note(saved?"端末に保存しました。この端末の本編の戦闘に反映されます。":"端末保存できません。JSONでエクスポートしてください。");
  draw();
 }
 function coords(obj){
  const scaleX=C.w/256,scaleY=C.h/324;
  return [C.x+(facing==="left"?-1:1)*(obj[0]-128)*scaleX,C.y+(obj[1]-314)*scaleY];
 }
 function reverse(x,y){
  return [128+(facing==="left"?-1:1)*(x-C.x)/(C.w/256),314+(y-C.y)/(C.h/324)];
 }
 function point(id){
  if(mode.value==="joint")return profile.joints[id];
  const center=rig.partCenters[id]||[128,160],part=profile.parts[id];
  return [center[0]+part.x,center[1]+part.y];
 }
 function onNumeric(){
  if(!profile)return;
  const id=target.value,x=Number(inpX.value),y=Number(inpY.value);
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  if(mode.value==="joint")profile.joints[id]=[clamp(x,0,256),clamp(y,0,324)];
  else profile.parts[id]={x:clamp(x,-48,48),y:clamp(y,-48,48),scale:clamp(Number(inpScale.value)||1,.65,1.45)};
  refreshValue();commit();
 }
 function atPointer(e){
  const rect=source.getBoundingClientRect();
  return [(e.clientX-rect.left)*500/rect.width,(e.clientY-rect.top)*480/rect.height];
 }
 function dragPosition(e){
  if(!drag||!profile)return;
  const pos=atPointer(e),coordinate=reverse(...pos),id=target.value;
  if(mode.value==="joint"){
   profile.joints[id]=[Math.round(clamp(coordinate[0],0,256)),Math.round(clamp(coordinate[1],0,324))];
  }else{
   const p=rig.partCenters[id]||[128,160];
   profile.parts[id].x=Math.round(clamp(coordinate[0]-p[0],-48,48));
   profile.parts[id].y=Math.round(clamp(coordinate[1]-p[1],-48,48));
  }
  refreshValue();draw();
 }
 source.addEventListener("pointerdown",e=>{
  if(!profile)return;
  const pos=atPointer(e),choices=mode.value==="joint"?rig.jointNames:rig.partNames;
  let nearest="",best=23;
  choices.forEach(id=>{const p=coords(point(id)),dist=Math.hypot(p[0]-pos[0],p[1]-pos[1]);
   if(dist<best){nearest=id;best=dist}});
  if(!nearest)return;
  target.value=nearest;refreshValue();
  drag=e.pointerId;source.setPointerCapture(e.pointerId);dragPosition(e);e.preventDefault();
 });
 source.addEventListener("pointermove",e=>{if(drag!==e.pointerId)return;dragPosition(e);e.preventDefault()});
 function dragEnd(e){if(drag!==e.pointerId)return;drag=null;commit();e.preventDefault()}
 source.addEventListener("pointerup",dragEnd);source.addEventListener("pointercancel",dragEnd);
 source.addEventListener("keydown",e=>{
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
  const unit=e.shiftKey?5:1;
  const dx=e.key==="ArrowLeft"?-unit:e.key==="ArrowRight"?unit:0;
  const dy=e.key==="ArrowUp"?-unit:e.key==="ArrowDown"?unit:0;
  inpX.value=Number(inpX.value)+dx*(facing==="left"?-1:1);
  inpY.value=Number(inpY.value)+dy;onNumeric();e.preventDefault();
 });
 function paintBg(ctx){
  ctx.clearRect(0,0,500,480);
  const bg=ctx.createLinearGradient(0,0,0,480);bg.addColorStop(0,"#274959");bg.addColorStop(1,"#3b594e");
  ctx.fillStyle=bg;ctx.fillRect(0,0,500,480);
  ctx.strokeStyle="rgba(220,249,240,.12)";ctx.lineWidth=1;
  for(let n=0;n<=500;n+=25){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,480);ctx.stroke()}
  for(let n=0;n<=480;n+=25){ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(500,n);ctx.stroke()}
  ctx.strokeStyle="rgba(255,220,140,.8)";ctx.beginPath();ctx.moveTo(0,C.y);ctx.lineTo(500,C.y);ctx.stroke();
 }
 function draw(){
  if(!profile)return;
  paintBg(src);paintBg(dst);
  const image=images[currentId];
  if(!image){src.fillStyle="#fff";src.fillText("スプライトを読み込み中",165,230);return}
  const atlasDir=facing==="left"?"right":facing,rect=[0,directionRow[atlasDir]*324,256,324];
  src.save();src.translate(C.x,C.y);src.scale(C.w/256*(facing==="left"?-1:1),C.h/324);
  src.drawImage(image,...rect,-128,-314,256,324);src.restore();
  src.strokeStyle="rgba(119,249,220,.78)";src.lineWidth=3;
  links.forEach(pair=>{const a=coords(profile.joints[pair[0]]),b=coords(profile.joints[pair[1]]);
   src.beginPath();src.moveTo(...a);src.lineTo(...b);src.stroke()});
  src.font="13px system-ui";
  const points=mode.value==="joint"?rig.jointNames:rig.partNames;
  points.forEach(id=>{
   const p=coords(point(id)),active=target.value===id;
   src.beginPath();src.arc(...p,active?9:6,0,Math.PI*2);src.fillStyle=active?"#ffeaa0":"#6cedd2";
   src.fill();src.strokeStyle="#1e2e36";src.lineWidth=2;src.stroke();
   if(active){src.fillStyle="#fff0ad";src.fillText(labels[id]||id,p[0]+12,p[1]-8)}
  });
  const t=Number(el("fwRigTime").value)/100;
  rig.render(dst,image,rect,C.x,C.y,C.w,C.h,{action:action.value,progress:t,
   equipment:equip(action.value),profile:profile,characterId:currentId,direction:facing,mirror:facing==="left"});
  dst.fillStyle="#fff";dst.font="14px system-ui";
  dst.fillText((manifest?.characters[currentId]?.displayName||currentId)+"　"+dirs[facing]+"　"+action.value+"　"+Math.round(t*100)+"%",12,22);
 }
 function tick(t){
  const dt=lastT?Math.min(t-lastT,70):0;lastT=t;
  if(play){
   const next=(Number(el("fwRigTime").value)+dt/11)%101;
   el("fwRigTime").value=next;
   el("fwRigTimeOut").textContent=Math.round(next)+"%";draw();
  }
  requestAnimationFrame(tick);
 }
 characters.addEventListener("change",load);
 d.addEventListener("change",()=>{
  facing=d.value;
  const batt=el("battleDirection");
  if(batt){batt.value=facing;batt.dispatchEvent(new Event("change"))}
  load();
 });
 mode.addEventListener("change",()=>{targetList();draw()});
 target.addEventListener("change",()=>{refreshValue();draw()});
 action.addEventListener("change",draw);
 el("fwRigTime").addEventListener("input",()=>{el("fwRigTimeOut").textContent=el("fwRigTime").value+"%";draw()});
 el("fwRigPlay").addEventListener("click",()=>{
  play=!play;el("fwRigPlay").textContent=play?"⏸ 停止":"▶ 再生";
 });
 [inpX,inpY,inpScale].forEach(input=>input.addEventListener("input",onNumeric));
 el("fwRigResetOne").addEventListener("click",()=>{
  if(!profile)return;
  const def=rig.defaultProfile(currentId,facing),id=target.value;
  if(mode.value==="joint")profile.joints[id]=def.joints[id].slice();
  else profile.parts[id]={...def.parts[id]};
  refreshValue();commit();
 });
 el("fwRigResetDir").addEventListener("click",()=>{
  if(!confirm("このキャラ・方向の関節補正を初期化しますか？"))return;
  profile=rig.resetProfile(currentId,facing);refreshValue();draw();note("この方向の補正を初期化しました。");
 });
 el("fwRigExport").addEventListener("click",()=>{
  const text=JSON.stringify(rig.exportProfiles(),null,2);el("fwRigJson").value=text;
  const blob=new Blob([text],{type:"application/json"}),url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="frontier-world-battle-rig-calibration.json";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  note("全キャラ・全方向の保存済み補正JSONを作成しました。");
 });
 el("fwRigImport").addEventListener("click",()=>{
  try{const n=rig.importProfiles(JSON.parse(el("fwRigJson").value));load();note(n+"方向の補正値を読み込みました。")}
  catch(error){note("JSON読み込み失敗: "+error.message)}
 });
 fetch("manifest.json").then(r=>{if(!r.ok)throw Error("manifest "+r.status);return r.json()})
  .then(m=>{
   manifest=m;
   return Promise.all(Object.values(m.characters).map(ch=>{
    const img=new Image();img.decoding="async";img.src=ch.walkAtlas;
    return img.decode().then(()=>{images[ch.id]=img}).catch(e=>console.warn("rig missing atlas",ch.id,e));
   }));
  }).then(()=>{
   currentId=manifest.characters[characters.value]?characters.value:
    (manifest.characters.boy2?"boy2":Object.keys(manifest.characters)[0]);
   load();
  }).catch(e=>note("元画像の読込失敗: "+e.message));
 requestAnimationFrame(tick);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();