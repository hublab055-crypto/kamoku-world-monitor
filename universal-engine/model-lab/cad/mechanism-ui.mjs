import {MECHANISM_FORMAT,evaluateMechanism,validateMechanism,mechanismSample} from "./mechanism-core.mjs";
const api=window.UEAssembly;
if(!api)throw Error("Assembly API is unavailable");
const panel=document.createElement("section");
panel.className="group";
panel.innerHTML='<h3>⚙ 機構シミュレーション</h3><p class="muted">回転・直動・歯車比の運動学プレビュー。B-rep面/エッジでの軸参照と併用可能。接触力・衝突は未計算です。</p><label>駆動部品<select id="ue-motion-part" class="full"></select></label><label>機構の種類<select id="ue-motion-type" class="full"><option value="revolute">回転軸 / シャフト</option><option value="slider">直動 / スライダー</option><option value="gear">歯車連動</option></select></label><label>連動元（歯車）<select id="ue-motion-driver" class="full"></select></label><div class="field"><label>回転数 rpm<input type="number" id="ue-motion-rpm" value="30"></label><label>ストローク mm<input type="number" id="ue-motion-stroke" value="40" min="0"></label><label>歯数<input type="number" id="ue-motion-teeth" value="40" min="4" max="300"></label></div><div class="btnrow" style="margin-top:8px"><button id="ue-motion-add" class="small">+ 機構登録</button><button id="ue-motion-remove" class="small">削除</button><button id="ue-motion-demo" class="small">サンプル</button></div><div class="line"></div><div class="btnrow"><button id="ue-motion-play" class="small primary">▶ 再生</button><button id="ue-motion-reset" class="small">↶ 原点復帰</button></div><label>再生速度<input id="ue-motion-speed" type="range" value="1" min=".1" max="3" step=".1" style="width:100%"></label><div id="ue-motion-time" class="muted">t = 0.00 s</div><div id="ue-motion-list" class="muted">機構は未登録です</div><p id="ue-motion-status" class="status" aria-live="polite"></p>';
const aside=document.querySelector("main aside:last-child");
if(!aside)throw Error("Assembly controls not found");
aside.appendChild(panel);
const $=id=>document.getElementById(id);
let config={format:MECHANISM_FORMAT,joints:[]},playing=false,t=0,last=0,baseline=null;
const status=text=>$("ue-motion-status").textContent=text;
const opts=(select,rows,keep)=>{
 select.replaceChildren(...rows.map(([id,label])=>{const opt=document.createElement("option");opt.value=id;opt.textContent=label;return opt}));
 if(rows.some(([id])=>id===keep))select.value=keep;
};
function sync(){
 const originals=api.getObjects(),eligible=originals.filter(o=>o.kind!=="assembly");
 const chosen=$("ue-motion-part").value,driver=$("ue-motion-driver").value;
 opts($("ue-motion-part"),eligible.map(o=>[o.id,o.name]),chosen);
 opts($("ue-motion-driver"),eligible.filter(o=>o.id!==$("ue-motion-part").value).map(o=>[o.id,o.name]),driver);
 $("ue-motion-list").textContent=config.joints.map(j=>{
  const label=originals.find(o=>o.id===j.part)?.name||j.part;
  return label+": "+j.type+(j.type==="gear"?" ← "+j.driver+" / "+j.teeth+"歯":j.type==="slider"?" "+j.stroke+"mm":" "+j.speed+"rpm");
 }).join(" / ")||"機構は未登録です";
}
function stop(reset=false){
 playing=false;last=0;$("ue-motion-play").textContent="▶ 再生";
 if(reset){t=0;if(baseline)api.applyPoses(baseline);baseline=null;api.render();}
 $("ue-motion-time").textContent="t = "+t.toFixed(2)+" s";
}
function update(){
 try{config=validateMechanism(config,api.getObjects());}
 catch(err){status(err.message);return false;}
 sync();return true;
}
function start(){
 if(!update()||!config.joints.length){status("先に機構を登録してください");return;}
 baseline=api.getObjects();t=0;playing=true;last=0;$("ue-motion-play").textContent="⏸ 停止";status("機構運動のプレビュー再生中");
}
$("ue-motion-add").onclick=()=>{
 stop(true);
 const o=$("ue-motion-part").value,type=$("ue-motion-type").value,driver=$("ue-motion-driver").value;
 if(!o){status("部品を選択してください");return;}
 const joint={type,part:o,axis:"z",speed:Number($("ue-motion-rpm").value),stroke:Number($("ue-motion-stroke").value),phase:0,teeth:Number($("ue-motion-teeth").value)};
 if(type==="gear")joint.driver=driver;
 const next={format:MECHANISM_FORMAT,joints:[...config.joints.filter(j=>j.part!==o),joint]};
 try{config=validateMechanism(next,api.getObjects());update();status("機構を登録しました。▶で再生できます");}
 catch(err){status(err.message);}
};
$("ue-motion-remove").onclick=()=>{stop(true);config.joints=config.joints.filter(j=>j.part!==$("ue-motion-part").value);update();status("機構を削除しました")};
$("ue-motion-demo").onclick=()=>{stop(true);config=mechanismSample(api.getObjects());update();status("シャフトの回転機構を設定しました")};
$("ue-motion-play").onclick=()=>playing?stop(true):start();
$("ue-motion-reset").onclick=()=>stop(true);
$("ue-motion-part").onchange=()=>{
 sync();const j=config.joints.find(j=>j.part===$("ue-motion-part").value);
 if(j){$("ue-motion-type").value=j.type;$("ue-motion-rpm").value=j.speed;$("ue-motion-stroke").value=j.stroke;$("ue-motion-teeth").value=j.teeth||40;}
};
function animate(now){
 requestAnimationFrame(animate);
 if(!playing)return;
 if(!last)last=now;
 const dt=Math.min(.05,(now-last)/1000);
 last=now;t+=dt*Number($("ue-motion-speed").value);
 try{
  const result=evaluateMechanism(baseline,config,t);
  api.applyPoses(result);api.render();
  $("ue-motion-time").textContent="t = "+t.toFixed(2)+" s";
 }catch(err){stop(true);status(err.message);}
}
requestAnimationFrame(animate);
window.UEAssemblyMechanism={
 get(){return structuredClone(config)},
 load(input){stop(true);config=validateMechanism(input,api.getObjects());update();},
 reset(){stop(true);config={format:MECHANISM_FORMAT,joints:[]};update();},
 pause(){stop(true);},
 refresh(){if(playing)stop(true);update();}
};
update();
