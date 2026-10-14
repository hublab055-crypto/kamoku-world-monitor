/* Frontier World battle-motion preview V1.0
 * Procedural preview based on existing 4-direction walk atlases.
 * No authoritative combat, save-state or damage calculation is changed.
 */
(function () {
  "use strict";
  var ACTIONS = [
    {id:"slash", label:"⚔️ 斬撃", duration:820, damage:16},
    {id:"thrust",label:"🗡️ 突き", duration:740, damage:13},
    {id:"axe",label:"🪓 斧振り下ろし", duration:990, damage:20},
    {id:"bow",label:"🏹 弓射撃", duration:1050, damage:11},
    {id:"combo",label:"⚡ 3連撃", duration:1520, damage:24},
    {id:"block",label:"🛡️ 防御", duration:1000, damage:0},
    {id:"dodge",label:"💨 回避", duration:850, damage:0},
    {id:"hit",label:"💥 被弾", duration:820, damage:0},
    {id:"fall",label:"💤 戦闘不能", duration:1150, damage:0},
    {id:"victory",label:"✨ 勝利", duration:1050, damage:0}
  ];
  var LABELS = {right:"右",left:"左",front:"正面",back:"背面"};
  var ROWS = ["front","left","right","back"];
  var ease = function(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
  var pulse = function(t,start,end){return ease((t-start)/Math.max(.001,end-start))};
  var shape = function(t,a,b,c,d){return pulse(t,a,b)*(1-pulse(t,c,d))};
  var lerp = function(a,b,t){return a+(b-a)*t};
  function poseFor(type,p) {
    p = Math.max(0,Math.min(1, Number(p)||0));
    var q={dx:0,dy:0,tilt:0,lean:0,scaleX:1,scaleY:1,weapon:0,shield:0,ghost:0};
    if(type==="slash"){
      q.dx=-24*shape(p,0,.24,.30,.44)+147*shape(p,.34,.57,.72,1);
      q.tilt=-.12*shape(p,.12,.33,.42,.52)+.18*shape(p,.45,.57,.75,1);
      q.weapon=-1.2*shape(p,.12,.37,.44,.50)+2.4*shape(p,.45,.60,.75,1);
    }else if(type==="axe"){
      q.dx=-27*shape(p,.09,.25,.31,.44)+110*shape(p,.42,.68,.80,1);
      q.tilt=-.24*shape(p,.14,.38,.45,.53)+.27*shape(p,.57,.70,.79,1);
      q.weapon=-1.3*shape(p,.15,.43,.51,.58)+2.75*shape(p,.59,.73,.79,.93);
    }else if(type==="thrust"){
      q.dx=-22*shape(p,0,.28,.31,.39)+170*shape(p,.36,.62,.77,1);
      q.tilt=-.10*shape(p,.10,.28,.34,.40)+.15*shape(p,.38,.57,.70,.90);
      q.weapon=.24*shape(p,.30,.42,.66,.84);
    }else if(type==="bow"){
      q.dx=-10*shape(p,.15,.30,.72,.94);
      q.lean=-.06*shape(p,.18,.30,.66,.95);
      q.weapon=-.3*shape(p,.15,.28,.55,.85);
    }else if(type==="combo"){
      q.dx=63*shape(p,.11,.23,.27,.42)+118*shape(p,.41,.53,.59,.72)+145*shape(p,.68,.78,.84,1);
      q.tilt=.17*shape(p,.17,.24,.29,.38)-.16*shape(p,.44,.51,.57,.66)+.22*shape(p,.73,.80,.86,1);
      q.weapon=1.9*shape(p,.18,.28,.33,.42)-1.75*shape(p,.44,.54,.60,.69)+2.2*shape(p,.73,.81,.86,1);
    }else if(type==="block"){
      q.dx=-8*shape(p,.11,.30,.77,1);
      q.scaleY=1-.12*shape(p,.11,.31,.78,1);
      q.shield=shape(p,.09,.29,.77,.99);
    }else if(type==="dodge"){
      q.dx=-116*shape(p,.18,.42,.63,.91);
      q.dy=-23*shape(p,.24,.38,.48,.70);
      q.tilt=-.23*shape(p,.25,.40,.55,.78);
      q.ghost=shape(p,.23,.40,.57,.72);
    }else if(type==="hit"){
      q.dx=-68*shape(p,.32,.50,.72,.99);
      q.tilt=-.27*shape(p,.32,.47,.66,.98);
    }else if(type==="fall"){
      q.dx=-36*pulse(p,.28,.65);
      q.dy=14*pulse(p,.38,.75);
      q.tilt=-1.22*pulse(p,.30,.70);
      q.scaleY=1-.18*pulse(p,.50,.84);
    }else if(type==="victory"){
      q.dy=-38*shape(p,.17,.35,.48,.65)-27*shape(p,.66,.74,.83,.98);
      q.tilt=.09*Math.sin(p*18)*shape(p,.18,.35,.78,.98);
      q.weapon=.7*shape(p,.12,.30,.80,.99);
    }
    return q;
  }

  /* Export sampling for later game-renderer integration. */
  window.FWBattleMotion = Object.freeze({
    version:"1.0.0",
    actions:ACTIONS.map(function(x){return x.id}),
    samplePose:poseFor
  });
  function make(tag,cls,txt){
    var el=document.createElement(tag);
    if(cls)el.className=cls;
    if(txt!==undefined)el.textContent=txt;
    return el;
  }
  function image(url) {
    var img=new Image();
    img.decoding="async";
    img.src=url;
    return img.decode().then(function(){return img});
  }
  function boot(){
    var grid=document.querySelector(".grid");
    var character=document.getElementById("character");
    if(!grid||!character||!document.getElementById("walkCanvas")||document.getElementById("battleMotionPreview"))return;
    var section=make("section","pane full");
    section.id="battleMotionPreview";
    section.innerHTML =
      '<h2>⚔️ バトルモーション・プレビュー</h2>'+
      '<p class="note">画像を頭・胴体・腕4部位・脚4部位に分け、関節を動かす10分割の戦闘リグを追加しました。剣・斧・盾・弓と、従来の全身画像変形を比較できます。</p>'+
      '<canvas id="battleMotionCanvas" width="800" height="390" role="img" aria-label="既存キャラクターを使った戦闘モーションプレビュー"></canvas>'+
      '<div class="toolbar" id="battleActionButtons"></div>'+
      '<div class="toolbar"><label for="battleRigMode">アニメ方式</label><select id="battleRigMode"><option value="rig">関節リグ（10分割）</option><option value="legacy">従来の全身変形</option></select><button type="button" id="battleRigGuides" aria-pressed="false">関節位置 OFF</button></div>'+
      '<div class="toolbar"><label for="battleDirection">向き</label>'+
      '<select id="battleDirection"><option value="right">右</option><option value="left">左</option><option value="front">正面</option><option value="back">背面</option></select>'+
      '<label for="battleSpeed">再生速度</label><input id="battleSpeed" type="range" min="50" max="180" value="100" step="10"><output id="battleSpeedText">1.0倍</output>'+
      '<button type="button" id="battleReset">HPと演出をリセット</button></div>'+
      '<div class="info" aria-live="polite" id="battleMotionStatus">画像を読み込み中…</div>'+
      '<p class="note">関節リグは既存画像を領域分割した暫定素材です。切り抜き位置はキャラごとに追加調整が必要です。ダメージ・HPはテスト専用で、ゲーム本編の戦闘判定・セーブには影響しません。</p>';
    var before=Array.from(grid.children).find(function(child){
      var h=child.querySelector("h2");return h&&h.textContent.indexOf("調整モード")>=0;
    });
    grid.insertBefore(section,before||null);
    var css=make("style");
    css.textContent =
      "#battleMotionCanvas{display:block;width:100%;height:auto;max-height:470px;object-fit:contain;border-radius:12px;border:1px solid #547585;background:#182934;touch-action:manipulation}"+
      "#battleActionButtons button{min-width:95px}#battleMotionPreview button.active{background:#0b7883;border-color:#83eee5}"+
      "#battleMotionPreview .note{margin:7px 0 10px;line-height:1.65}#battleSpeed{max-width:115px}";
    document.head.appendChild(css);
    var c=document.getElementById("battleMotionCanvas"),ctx=c.getContext("2d");
    var dirSel=document.getElementById("battleDirection"),speed=document.getElementById("battleSpeed");
    var status=document.getElementById("battleMotionStatus"),btns=document.getElementById("battleActionButtons");
    var chars={},roster={},selected=character.value,poseType=null,elapsed=0,hitMarks={},enemyHp=100,heroHp=100;
    var hitTimer=0,heroFlash=0,lastTime=null,clock=0,loaded=false;
    var actionDuration=0;
    var dir="right",rigGuides=false;
    function refreshAdjustments(){
      try{
        var saved=JSON.parse(localStorage.getItem("frontierWorldSpriteAdjustmentsV1")||"{}");
        return saved.characters||{};
      }catch(e){return {}}
    }
    var adjStore={},adjStamp=-99999;
    function charAdjust(id,d){
      if(clock-adjStamp>600){adjStore=refreshAdjustments();adjStamp=clock}
      var entries=adjStore[id]&&adjStore[id].walk&&adjStore[id].walk[d];
      var a=entries&&entries[0];
      return a&&typeof a==="object"?{
        x:Math.max(-80,Math.min(80,Number(a.x)||0)),
        y:Math.max(-80,Math.min(80,Number(a.y)||0)),
        scale:Math.max(.80,Math.min(1.20,Number(a.scale)||1))
      }:{x:0,y:0,scale:1};
    }
    function oponentId(){
      var options=Object.keys(chars);
      return options.find(function(id){return id!==selected})||selected;
    }
    function setStatus(text){status.textContent=text}
    function play(id){
      if(!loaded){setStatus("画像の読み込みが完了していません");return}
      var a=ACTIONS.find(function(x){return x.id===id});if(!a)return;
      poseType=id;elapsed=0;hitMarks={};hitTimer=0;heroFlash=0;
      actionDuration=a.duration;
      btns.querySelectorAll("button").forEach(function(btn){btn.classList.toggle("active",btn.dataset.action===id)});
      setStatus(a.label+"｜再生中｜方向: "+LABELS[dir]+"｜ゲームの当たり判定とは別のプレビュー");
      draw();
    }
    ACTIONS.forEach(function(a){
      var btn=make("button","",a.label);
      btn.type="button";btn.dataset.action=a.id;
      btn.addEventListener("click",function(){play(a.id)});
      btns.appendChild(btn);
    });
    dirSel.addEventListener("change",function(){dir=dirSel.value;draw()});
    document.getElementById("battleRigMode").addEventListener("change",function(){draw()});
    document.getElementById("battleRigGuides").addEventListener("click",function(){rigGuides=!rigGuides;this.textContent="関節位置 "+(rigGuides?"ON":"OFF");this.setAttribute("aria-pressed",String(rigGuides));draw()});
    speed.addEventListener("input",function(){document.getElementById("battleSpeedText").textContent=(Number(speed.value)/100).toFixed(1)+"倍"});
    character.addEventListener("change",function(){
      selected=character.value;poseType=null;hitTimer=0;heroFlash=0;hitMarks={};btns.querySelectorAll("button").forEach(function(b){b.classList.remove("active")});
      setStatus((roster[selected]&&roster[selected].displayName||selected)+"でテストできます");draw();
    });
    document.getElementById("battleReset").addEventListener("click",function(){
      heroHp=100;enemyHp=100;poseType=null;elapsed=0;hitTimer=0;heroFlash=0;hitMarks={};
      btns.querySelectorAll("button").forEach(function(b){b.classList.remove("active")});
      setStatus("演出をリセットしました");draw();
    });
    function damage(key,amount){
      if(hitMarks[key])return;
      hitMarks[key]=true;
      if(amount>0){enemyHp=Math.max(0,enemyHp-amount);hitTimer=390}
    }
    function update(dt){
      clock+=dt;hitTimer=Math.max(0,hitTimer-dt);heroFlash=Math.max(0,heroFlash-dt);
      if(!poseType)return;
      elapsed+=dt*Number(speed.value)/100;
      var p=Math.min(1,elapsed/actionDuration);
      if(poseType==="slash"&&p>=.56)damage("slash",16);
      if(poseType==="thrust"&&p>=.62)damage("thrust",13);
      if(poseType==="axe"&&p>=.70)damage("axe",20);
      if(poseType==="bow"&&p>=.78)damage("bow",11);
      if(poseType==="combo"){
        if(p>=.27)damage("combo1",7);
        if(p>=.54)damage("combo2",8);
        if(p>=.80)damage("combo3",9);
      }
      if(poseType==="hit"&&p>=.44&&!hitMarks.hero){hitMarks.hero=true;heroHp=Math.max(0,heroHp-12);heroFlash=340}
      if(p>=1){
        var finished=ACTIONS.find(function(x){return x.id===poseType});
        poseType=null;
        btns.querySelectorAll("button").forEach(function(b){b.classList.remove("active")});
        setStatus(finished.label+"｜再生完了。別の動作を選んでください");
      }
    }
    function stage(){
      var w=c.width,h=c.height;
      var sky=ctx.createLinearGradient(0,0,0,h);
      sky.addColorStop(0,"#183947");sky.addColorStop(.67,"#647a78");sky.addColorStop(1,"#57604b");
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      ctx.fillStyle="#263d42";ctx.beginPath();ctx.moveTo(0,244);ctx.lineTo(118,163);ctx.lineTo(245,244);ctx.lineTo(380,169);ctx.lineTo(510,248);ctx.lineTo(676,172);ctx.lineTo(800,238);ctx.lineTo(800,295);ctx.lineTo(0,295);ctx.fill();
      ctx.fillStyle="#728569";ctx.fillRect(0,295,w,95);
      ctx.strokeStyle="rgba(238,242,219,.32)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,317);ctx.lineTo(w,317);ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,.06)";ctx.fillRect(20,16,760,63);
    }
    function healthBar(x,y,hp,name,fill){
      ctx.save();
      ctx.font="bold 14px system-ui,sans-serif";ctx.fillStyle="#f7faf9";ctx.fillText(name,x,y);
      ctx.fillStyle="rgba(4,19,25,.8)";ctx.fillRect(x,y+9,176,12);
      ctx.fillStyle=fill;ctx.fillRect(x+2,y+11,172*Math.max(0,hp)/100,8);
      ctx.strokeStyle="#c2d7d0";ctx.strokeRect(x,y+9,176,12);
      ctx.font="12px system-ui,sans-serif";ctx.fillStyle="#dce8e4";ctx.fillText(Math.floor(hp)+" / 100",x+183,y+20);ctx.restore();
    }
    function shadow(x,range){
      ctx.save();ctx.fillStyle="rgba(13,29,26,.45)";ctx.beginPath();ctx.ellipse(x,317,range||72,13,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    function actor(id,x,y,d,pose,flash,alpha,anim){
      var img=chars[id];if(!img)return false;
      var a=charAdjust(id,d),row=ROWS.indexOf(d);
      var width=156*a.scale,height=220*a.scale;
      var useRig=document.getElementById("battleRigMode").value==="rig"&&!!window.FWBattleRig;
      ctx.save();ctx.globalAlpha=alpha===undefined?1:alpha;
      ctx.translate(x+pose.dx+a.x*.65,y+pose.dy+a.y*.65);
      ctx.rotate((pose.tilt||0)*(useRig?.28:1));ctx.scale(pose.scaleX||1,pose.scaleY||1);
      var rigDrawn=false;
      if(useRig){
        var sourceDirection=d==="left"?"right":d;
        var sourceRow=ROWS.indexOf(sourceDirection);
        rigDrawn=window.FWBattleRig.render(ctx,img,[0,Math.max(0,sourceRow)*324,256,324],0,0,width,height,{
          action:anim&&anim.action||"idle",
          progress:anim&&anim.progress||0,
          mirror:d==="left",
          equipment:anim&&anim.equipment||null,
          guides:rigGuides&&id===selected
        });
      }
      if(!rigDrawn)ctx.drawImage(img,0,Math.max(0,row)*324,256,324,-width/2,-height,width,height);
      if(flash>0){
        ctx.fillStyle="rgba(255,83,68,"+(flash/340*.18).toFixed(3)+")";
        ctx.fillRect(-width/2,-height,width,height);
      }
      ctx.restore();return rigDrawn;
    }
    function sword(x,y,p,enemy,action){
      var ang=(p.weapon||0);ctx.save();ctx.translate(x+76+p.dx, y-150+p.dy);ctx.rotate(ang);
      ctx.lineCap="round";ctx.lineWidth=6;ctx.strokeStyle="#c5a06b";ctx.beginPath();ctx.moveTo(-12,9);ctx.lineTo(11,-4);ctx.stroke();
      ctx.lineWidth=5;ctx.strokeStyle="#e0edf4";ctx.beginPath();ctx.moveTo(9,-6);ctx.lineTo(78,-69);ctx.stroke();
      ctx.lineWidth=2;ctx.strokeStyle="#fff7d0";ctx.beginPath();ctx.moveTo(13,-10);ctx.lineTo(78,-69);ctx.stroke();
      ctx.restore();
      if(action==="slash"||action==="combo")slashArc(x+p.dx+113,y-184,ang,enemy);
      if(action==="thrust"&&ang>.025){
        ctx.save();ctx.globalAlpha=.65;ctx.strokeStyle="#d8fff3";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+p.dx+120,y-180);ctx.lineTo(x+p.dx+202,y-198);ctx.stroke();ctx.restore();
      }
    }
    function slashArc(x,y,ang,enemy){
      var trigger=Math.abs(ang)>0.45;if(!trigger)return;
      ctx.save();ctx.strokeStyle="rgba(175,242,247,.78)";ctx.lineWidth=9;ctx.lineCap="round";
      ctx.beginPath();ctx.arc(x,y,88,-1.10,1.04);ctx.stroke();
      ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    function axe(x,y,p){
      ctx.save();ctx.translate(x+75+p.dx,y-151+p.dy);ctx.rotate(p.weapon||0);
      ctx.lineWidth=8;ctx.lineCap="round";ctx.strokeStyle="#936f49";ctx.beginPath();ctx.moveTo(-15,15);ctx.lineTo(70,-76);ctx.stroke();
      ctx.fillStyle="#c8d9dc";ctx.strokeStyle="#f0f6ee";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(61,-88);ctx.lineTo(88,-84);ctx.quadraticCurveTo(123,-57,103,-34);ctx.lineTo(76,-51);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      if(Math.abs(p.weapon)>1.3)slashArc(x+p.dx+104,y-180,p.weapon);
    }
    function bow(x,y,p,prog){
      var px=x+p.dx+53,py=y-147;
      ctx.save();ctx.strokeStyle="#b58b58";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(px+15,py-70);ctx.quadraticCurveTo(px+76,py-11,px+18,py+52);ctx.stroke();
      ctx.strokeStyle="#e8ddd4";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+15,py-70);ctx.lineTo(px+18,py+52);ctx.stroke();
      if(prog>.44&&prog<.87){var t=(prog-.44)/.43;arrow(lerp(px+31,568,t),lerp(py-4,175,t));}
      ctx.restore();
    }
    function arrow(x,y){
      ctx.save();ctx.lineCap="round";ctx.strokeStyle="#ffefbb";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-24,y);ctx.lineTo(x+20,y-4);ctx.stroke();
      ctx.fillStyle="#c4f5ec";ctx.beginPath();ctx.moveTo(x+26,y-5);ctx.lineTo(x+15,y-11);ctx.lineTo(x+16,y+2);ctx.fill();ctx.restore();
    }
    function shield(x,y,a){
      if(a<=.01)return;
      ctx.save();ctx.globalAlpha=a;ctx.translate(x+62,y-145);
      ctx.fillStyle="rgba(68,145,168,.52)";ctx.strokeStyle="#d7f1e8";ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(0,-50);ctx.quadraticCurveTo(44,-47,42,-10);ctx.quadraticCurveTo(38,36,0,56);ctx.quadraticCurveTo(-35,30,-40,-9);ctx.quadraticCurveTo(-40,-45,0,-50);ctx.fill();ctx.stroke();ctx.restore();
    }
    function effect(x,y,time,color){
      ctx.save();ctx.globalAlpha=.4+.5*time;ctx.strokeStyle=color;ctx.lineWidth=5;
      for(var i=0;i<6;i++){var angle=i*Math.PI/3;var dist=21+17*(1-time);
        ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*dist,y+Math.sin(angle)*dist);
        ctx.lineTo(x+Math.cos(angle)*(dist+23),y+Math.sin(angle)*(dist+23));ctx.stroke();}
      ctx.restore();
    }
    function draw(){
      ctx.clearRect(0,0,c.width,c.height);stage();
      if(!loaded){ctx.fillStyle="#eaf1ee";ctx.font="18px system-ui";ctx.fillText("戦闘素材を読み込み中…",292,183);return}
      var progress=poseType?Math.min(1,elapsed/actionDuration):0;
      var heroPose=poseType?poseFor(poseType,progress):poseFor("idle",0);
      var enemyPose={dx:0,dy:0,tilt:0,scaleX:1,scaleY:1};
      var counter=["block","dodge","hit"].indexOf(poseType)>=0;
      if(counter){var drive=shape(progress,.23,.43,.50,.85);enemyPose.dx=-102*drive;enemyPose.tilt=-.13*drive;}
      if(hitTimer>0){var strength=hitTimer/390;enemyPose.dx-=38*strength;enemyPose.tilt+=.19*strength}
      var opponent=oponentId();
      var idle=Math.sin(clock/340)*1.5;
      shadow(255+heroPose.dx);
      shadow(545+enemyPose.dx);
      actor(opponent,545,317,"left",enemyPose,hitTimer,1,{action:"idle",equipment:"sword"});
      if(heroPose.ghost>0)actor(selected,255+32,317,dir,{dx:0,dy:0,tilt:0,scaleX:1,scaleY:1},0,.23*heroPose.ghost,{action:"idle"});
      var equip=poseType==="bow"?"bow":poseType==="axe"?"axe":poseType==="block"?"block":
        ["slash","thrust","combo","victory"].includes(poseType)?"sword":null;
      var isRig=actor(selected,255,317+idle,dir,heroPose,heroFlash,1,{action:poseType||"idle",progress:progress,equipment:equip});
      if(isRig){
        if(poseType==="bow"&&progress>.45&&progress<.87){
          var flight=(progress-.45)/.42;
          arrow(lerp(320+heroPose.dx,571,flight),lerp(176,170,flight));
        }
      }else{
        if(poseType==="bow")bow(255,317,heroPose,progress);
        else if(poseType==="axe")axe(255,317,heroPose);
        else if(poseType!=="fall")sword(255,317,heroPose,enemyPose,poseType);
        if(poseType==="block")shield(255+heroPose.dx,317,heroPose.shield);
      }
      if(counter){ctx.save();ctx.strokeStyle="#e9e2d1";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(510+enemyPose.dx,168);ctx.lineTo(462+enemyPose.dx,120);ctx.stroke();ctx.restore();}
      if(poseType==="block"&&progress>.34&&progress<.56)effect(320,175,1,"#9df4fc");
      if(poseType==="dodge"&&progress>.33&&progress<.6)effect(330,196,.6,"#c6fff6");
      if(heroFlash>0)effect(255+heroPose.dx,155,heroFlash/340,"#ffc6a6");
      if(hitTimer>0)effect(545+enemyPose.dx,177,hitTimer/390,"#ffdb9e");
      if(poseType==="victory"&&progress>.25&&progress<.9){effect(254,110,.6,"#ffe4a3");}
      if(poseType==="fall"&&progress>.72){ctx.font="23px system-ui";ctx.fillStyle="#ffdf9e";ctx.fillText("戦闘不能",179,89);}
      healthBar(32,27,heroHp,roster[selected]&&roster[selected].displayName||"キャラクター","#6fd9bd");
      healthBar(503,27,enemyHp,roster[opponent]&&roster[opponent].displayName||"相手","#eaa58e");
      ctx.fillStyle="#ecf4ef";ctx.font="13px system-ui";
      ctx.fillText("プレビュー専用 / HPは仮表示",303,372);
    }
    function tick(t){
      if(lastTime===null)lastTime=t;
      var dt=Math.max(0,Math.min(50,t-lastTime));lastTime=t;
      update(dt);draw();requestAnimationFrame(tick);
    }
    draw();requestAnimationFrame(tick);
    fetch("manifest.json",{cache:"no-cache"})
      .then(function(response){if(!response.ok)throw Error("manifest "+response.status);return response.json()})
      .then(function(m){
        roster=m.characters||{};
        return Promise.all(Object.keys(roster).map(function(id){
          return image(roster[id].walkAtlas).then(function(img){chars[id]=img}).catch(function(e){console.warn("battle motion atlas",id,e)});
        }));
      }).then(function(){
        loaded=!!Object.keys(chars).length;
        selected=character.value||Object.keys(chars)[0];
        if(loaded)setStatus("読み込み完了｜動作ボタンをタップして試してください。");
        else setStatus("画像を読み込めませんでした。再読み込みしてください。");
        draw();
      }).catch(function(error){setStatus("戦闘プレビューの読込失敗: "+error.message);});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();