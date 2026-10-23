/** Non-invasive mobile law panel. The host owns save, battle HP and clock. */
export function installLawUI({get,notify,onChange,onDetain,onSuccession,onGameOver}){
 const toolbar=document.getElementById("viewport-toolbar");
 const toggle=document.createElement("button");
 toggle.type="button";toggle.id="law-toggle";toggle.textContent="🚨 治安・手配";toggle.setAttribute("aria-controls","law-panel");
 toolbar.append(toggle);
 const panel=document.createElement("section");panel.id="law-panel";panel.hidden=true;
 panel.setAttribute("aria-label","治安・衛兵・世代継承");panel.setAttribute("role","dialog");
 panel.innerHTML='<header><strong>🚨 治安・手配・一族</strong><button type="button" data-action="close">× 閉じる</button></header><div data-role="summary"></div><div data-role="buttons"></div><div data-role="history"></div>';
 const style=document.createElement("style");style.textContent=`
 #law-panel[hidden]{display:none!important}
 #law-panel{position:fixed;inset:auto 10px max(10px,env(safe-area-inset-bottom)) auto;z-index:60;
 width:min(380px,calc(100vw - 20px));max-height:min(72vh,560px);overflow:auto;box-sizing:border-box;
 background:#132534f5;color:#eff9ff;border:1px solid #88b2c2;border-radius:13px;padding:12px;
 box-shadow:0 8px 36px #0009;font:13px/1.55 system-ui,sans-serif}
 #law-panel header{display:flex;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:-12px;background:#132534;padding:5px 0}
 #law-panel button{border-radius:7px;border:1px solid #7c9aa9;background:#243e4c;color:#f5faff;padding:7px;cursor:pointer;margin:3px}
 #law-panel button:disabled{opacity:.4;cursor:default}
 #law-panel small{opacity:.85}
 #law-panel .law-actions{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0}
 #law-panel p{margin:6px 0}
 #law-panel .law-separator{border-top:1px solid #627b87;padding-top:8px;margin-top:10px}
 `;
 document.head.append(style);document.body.append(panel);
 const summary=panel.querySelector('[data-role="summary"]'),buttons=panel.querySelector('[data-role="buttons"]'),history=panel.querySelector('[data-role="history"]');
 const makeButton=(label,handler,disabled=false)=>{
  const b=document.createElement("button");b.type="button";b.textContent=label;b.disabled=disabled;b.addEventListener("click",()=>{const result=handler();if(result?.message)notify(result.message);onChange?.();refresh();});return b;
 };
 const text=(parent,tag,content)=>{const el=document.createElement(tag);el.textContent=content;parent.append(el);return el;};
 const actionRow=()=>{const div=document.createElement("div");div.className="law-actions";buttons.append(div);return div;};
 const safeGet=()=>get();
 function refresh(){
  const {law,settlementId,squad}=safeGet();
  if(!law)return;
  const faction=law.district(settlementId),post=law.constructor===Object?null:undefined;
  const level=law.level(settlementId),actor=law.people.find(p=>p.id===law.activePersonId);
  summary.replaceChildren();buttons.replaceChildren();history.replaceChildren();
  text(summary,"p","現在："+(actor?.name||"後継者不在")+" ／ "+(actor?.generation||"—")+"代目");
  if(faction){
   text(summary,"p","管轄："+settlementId+" ／ 手配 "+("★".repeat(level)||"なし")+" ／ ポイント "+Math.round(faction.heat));
   text(summary,"p","守備兵：詰所 "+faction.current+"名・派遣 "+faction.deployed.length+"名 ／ 支配："+faction.owner);
   text(summary,"small",faction.pursuit?"衛兵が追跡中。支配エリアから出ると追跡は中断します。":"手配度は逃走だけでは消えません。");
  }else text(summary,"p","支配エリア外（手配情報は各国に残っています）");
  if(law.gameOver){text(buttons,"h3","一族が断絶しました — GAME OVER");}
  else if(law.pendingDeath){
   text(buttons,"h3","後継者を選択");
   const heirs=law.people.filter(p=>p.alive&&law.heirs.includes(p.id));
   for(const heir of heirs)buttons.append(makeButton("👑 "+heir.name+"（第"+heir.generation+"代）",()=>onSuccession(heir.id)));
  }else if(law.custody){
   text(buttons,"p","🔒 勾留中："+law.custody.faction+" ／ 罰金 "+law.custody.fine+"G");
   buttons.append(makeButton("罰金を払って釈放",()=>{const {law,payFine}=safeGet();return law.payFine(law.custody.faction,payFine);}));
  }else{
   if(faction&&level>0){
    const row=actionRow();
    row.append(makeButton("🙌 投降する",()=>{const r=law.respond(settlementId,"surrender");if(r?.type==="detained")onDetain?.();return r;}));
    row.append(makeButton("✋ 投降しない",()=>law.respond(settlementId,"refuse")));
    row.append(makeButton("🏃 逃走",()=>law.respond(settlementId,"flee")));
    if(faction.deployed.length){
     const attack=actionRow(),guard=faction.deployed[0];
     attack.append(makeButton("⚔ 衛兵に攻撃",()=>law.attackGuard(settlementId,guard.id)));
     attack.append(makeButton("💀 衛兵撃破（テスト）",()=>law.attackGuard(settlementId,guard.id,{defeat:true})));
    }
   }
   const candidates=(squad?.agents||[]).filter(p=>p.id!=="player"&&p.hp>0&&!law.people.some(a=>a.id===p.id));
   if(candidates.length){
    text(buttons,"p","後継者の登録（仲間から指名）");
    const row=actionRow();for(const c of candidates)
     row.append(makeButton("👪 "+c.name+"を指名",()=>law.designateHeir({id:c.id,name:c.name,role:"companion"})));
   }
   if(faction?.owner==="crown"){
    const row=actionRow();
    row.append(makeButton("🏴 詰所を占拠",()=>law.occupyPost(settlementId,
      (squad?.agents||[]).filter(a=>a.id!=="player"&&a.hp>0).map(a=>a.id))));
   }
   const test=actionRow();
   if(faction)test.append(makeButton("🧪 盗難通報を試す",()=>law.reportCrime(settlementId,"theft")));
   if(faction)test.append(makeButton("🧪 手配NPCを登録",()=>{const id=settlementId+":outlaw:1";
    const ok=law.registerWantedNPC({id,name:"模擬手配犯",faction:settlementId,reward:100});
    return {ok,message:ok?"テスト用の手配NPCを登録しました":"登録済みです"};}));
  }
  text(history,"h4","手配書・賞金");
  for(const wanted of law.wantedPeople.filter(p=>!p.delivered)){
   const row=document.createElement("p");row.textContent="📜 "+wanted.name+" ／ "+wanted.reward+"G ";
   // A bounty can only be claimed after an external capture event, never by viewing a poster.
   const hint=document.createElement("small");hint.textContent="（拘束・引渡し連携は今後実装）";
   row.append(hint);history.append(row);
  }
  text(history,"h4","一族・歴史");
  for(const p of law.people)text(history,"p",(p.alive?"🧑 ":"🪦 ")+p.name+"（"+p.generation+"代）"+(law.heirs.includes(p.id)?"・後継候補":""));
  for(const event of law.history.slice(-4).reverse())text(history,"small",Math.floor(event.day)+"日目 "+event.type+" "+(event.id||event.personId||"")+"　");
 }
 toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden));refresh();});
 panel.querySelector('[data-action="close"]').addEventListener("click",()=>{panel.hidden=true;toggle.setAttribute("aria-expanded","false");});
 return {refresh,close(){panel.hidden=true;},destroy(){panel.remove();toggle.remove();style.remove();}};
}
