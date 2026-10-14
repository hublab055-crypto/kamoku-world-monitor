/* Frontier World life motion standalone showcase (v1). */
(function(){
  "use strict";
  const ASSETS = Object.freeze({
    girl1: {src:"./full-walk.webp",name:"Mio"},
    boy2: {src:"./assets/boy2/full-walk.webp",name:"冒険好きの男の子"}
  });
  const DIRECTIONS = Object.freeze(["front","right","back","left"]);
  const LABELS = {front:"正面",right:"右",back:"背面",left:"左"};
  const $ = id => document.getElementById(id);
  let api,rig,canvas,ctx,status,selected="girl1",direction="front",action="chop";
  let lastTime=0,timeMs=0,playing=true,speed=1,showJoints=false,showGrips=false,showFurniture=true;
  let loaded=new Map(),loading=new Map(),currentError="",rafId=0;
  function info(message,isError){
    status.textContent=message;status.classList.toggle("error",!!isError);
  }
  function getImage(id){
    if(loaded.has(id))return Promise.resolve(loaded.get(id));
    if(loading.has(id))return loading.get(id);
    const def=ASSETS[id];if(!def)return Promise.reject(Error("キャラクターが不明です"));
    const img=new Image();
    const promise=new Promise((resolve,reject)=>{
      let settled=false;
      function finish(ok,e){
        if(settled)return;settled=true;loading.delete(id);
        if(ok){loaded.set(id,img);resolve(img)}
        else reject(Error("キャラ画像を読めません: "+def.src+" "+(e&&e.message||"")));
      }
      img.onload=()=>finish(true);
      img.onerror=e=>finish(false,e);
      img.src=def.src;
      if(img.complete&&img.naturalWidth>0)finish(true);
    });
    loading.set(id,promise);
    return promise;
  }
  function currentDuration(){
    return api&&api.duration?action in (actionMap||{})?api.duration(action):1700:1700;
  }
  const actionMap=Object.create(null);
  function scene(){
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,"#678d8b");grad.addColorStop(.68,"#aac5b5");
    grad.addColorStop(.69,"#ab9878");grad.addColorStop(1,"#796e56");
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    ctx.fillStyle="rgba(30,38,29,.28)";ctx.beginPath();ctx.ellipse(w/2,418,137,20,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.14)";
    for(let i=0;i<10;i++){ctx.fillRect(i*104+30,40+(i%4)*9,42,3);}
  }
  function centeredMessage(value){
    ctx.save();ctx.fillStyle="#f4faf8";ctx.font="bold 21px system-ui,sans-serif";
    ctx.textAlign="center";ctx.fillText(value,canvas.width/2,220);ctx.restore();
  }
  function draw(){
    if(!ctx||!api)return;
    scene();
    const img=loaded.get(selected);
    if(!img){centeredMessage(currentError?"画像を表示できません":"キャラ画像を読込中…");return;}
    const source=direction==="left"?"right":direction;
    const row={front:0,left:1,right:2,back:3}[source];
    const progress=(timeMs%currentDuration())/currentDuration();
    let ok=false;
    try{
      ok=api.render(ctx,img,[0,row*324,256,324],canvas.width/2,418,298,377,{
        action,progress,characterId:selected,direction,mirror:direction==="left",
        environment:showFurniture,guides:showJoints,gripGuides:showGrips
      });
    }catch(error){
      currentError=String(error&&error.message||error);
      info("描画エラー: "+currentError,true);
      centeredMessage("描画エラー（詳細は下に表示）");
      return;
    }
    if(!ok){info("描画ができません。画像・関節リグを確認してください。",true);return;}
    const title=actionMap[action]&&actionMap[action].label||action;
    let grip="";
    if(showGrips&&rig&&api.handTargets){
      const profile=rig.getProfile(selected,direction);
      const sampled=rig.sample(action,progress);
      const joints=rig.aimHands(sampled,profile,api.handTargets(action,progress,profile));
      const err=Math.max(joints.front.reachError,joints.rear.reachError);
      grip=" / 手先誤差 "+err.toFixed(2)+"px";
    }
    info(ASSETS[selected].name+" / "+title+" / "+LABELS[direction]+
      " / "+(playing?"再生中":"一時停止")+" / "+Math.round(progress*100)+"%"+grip,false);
  }
  function selectAction(id){
    if(!api||!actionMap[id])return;
    action=id;timeMs=0;lastTime=0;
    document.querySelectorAll("[data-life-action]").forEach(b=>{
      const active=b.dataset.lifeAction===id;
      b.setAttribute("aria-pressed",String(active));
      b.classList.toggle("selected",active);
    });
    draw();
  }
  function update(dt){
    if(playing)timeMs+=Math.max(0,Math.min(dt,80))*speed;
  }
  function tick(now){
    const dt=lastTime?now-lastTime:0;lastTime=now;
    if(document.visibilityState!=="hidden"){update(dt);draw();}
    rafId=requestAnimationFrame(tick);
  }
  function setupControls(){
    const area=$("actionButtons");
    api.actions.forEach(def=>{
      actionMap[def.id]=def;
      const b=document.createElement("button");
      b.type="button";b.dataset.lifeAction=def.id;
      b.textContent=def.label;b.addEventListener("click",()=>selectAction(def.id));
      area.appendChild(b);
    });
    $("character").addEventListener("change",event=>{
      selected=event.target.value;timeMs=0;currentError="";info("キャラクターを読込中…");
      getImage(selected).then(()=>{currentError="";draw()})
        .catch(e=>{currentError=e.message;info(currentError,true);draw()});
    });
    $("direction").addEventListener("change",event=>{direction=event.target.value;draw()});
    $("playPause").addEventListener("click",()=>{
      playing=!playing;lastTime=0;
      $("playPause").textContent=playing?"⏸ 一時停止":"▶ 再生";
      draw();
    });
    $("restart").addEventListener("click",()=>{timeMs=0;lastTime=0;draw()});
    $("oneFrame").addEventListener("click",()=>{
      playing=false;$("playPause").textContent="▶ 再生";
      timeMs+=api.duration(action)/8;lastTime=0;draw();
    });
    $("speed").addEventListener("input",event=>{
      speed=Number(event.target.value)/100;
      $("speedValue").textContent=speed.toFixed(1)+"倍";
    });
    $("joints").addEventListener("change",event=>{showJoints=event.target.checked;draw()});
    $("grips").addEventListener("change",event=>{showGrips=event.target.checked;draw()});
    $("furniture").addEventListener("change",event=>{showFurniture=event.target.checked;draw()});
    $("export").addEventListener("click",exportSheet);
    selectAction("chop");
  }
  function exportSheet(){
    const img=loaded.get(selected);
    if(!img){info("キャラクターの読込が終わっていません",true);return;}
    const sheet=document.createElement("canvas");sheet.width=2048;sheet.height=1296;
    const c=sheet.getContext("2d");if(!c){info("PNGを生成できません",true);return;}
    const original=["front","left","right","back"];
    try{
      original.forEach((dir,row)=>{
        const source=dir==="left"?"right":dir;
        const sourceRow={front:0,left:1,right:2,back:3}[source];
        for(let i=0;i<8;i++){
          c.save();
          try{
            c.translate(i*256,row*324);
            api.render(c,img,[0,sourceRow*324,256,324],128,314,256,324,{
              action,progress:i/8,characterId:selected,direction:dir,mirror:dir==="left",
              environment:false
            });
          }finally{c.restore();}
        }
      });
    }catch(error){info("PNG作成エラー: "+error.message,true);return;}
    if(!sheet.toBlob){info("この端末ではPNGファイル出力を利用できません",true);return;}
    sheet.toBlob(blob=>{
      if(!blob){info("PNG生成に失敗しました",true);return;}
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download="frontier-life-"+selected+"-"+action+"-4dir-8frames.png";
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      info("4方向×8コマのPNGを生成しました");
    },"image/png");
  }
  function boot(){
    status=$("status");canvas=$("stage");
    if(!status||!canvas)return;
    ctx=canvas.getContext("2d");
    if(!ctx){info("Canvasを利用できないブラウザです",true);return;}
    api=window.FWLifeMotion;rig=window.FWBattleRig;
    if(!api||!rig||!Array.isArray(api.actions)||api.actions.length===0){
      info("生活モーションの読込に失敗しました。ページを更新してください。",true);
      centeredMessage("アニメーションプログラムを読込できません");return;
    }
    try{setupControls();}
    catch(error){info("操作画面エラー: "+error.message,true);return;}
    getImage(selected).then(()=>{currentError="";draw()})
      .catch(error=>{currentError=error.message;info(currentError,true);draw()});
    rafId=requestAnimationFrame(tick);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
