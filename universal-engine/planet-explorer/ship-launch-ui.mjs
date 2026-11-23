/** PC/mobile fallback for the same ship procedure that the VR wrist terminal invokes. */
import {launchStatus} from './ship-launch-procedure.mjs';
export function installShipLaunchUI({getVoyage=()=>null,getVRActive=()=>false,execute=()=>({ok:false}),notify=()=>{}}={}){
 const host=document.getElementById('space-flight');
 if(!host)return {update:()=>{},dispose:()=>{}};
 const style=document.createElement('style');
 style.textContent=`
 #ship-launch-open[hidden],#ship-launch-console[hidden]{display:none!important}
 #ship-launch-open{position:absolute;z-index:3750;right:10px;top:64px;background:#163e51;color:#f0fbff;
  border:1px solid #77b4c5;border-radius:8px;padding:7px 11px;min-height:37px;font:600 12px system-ui}
 #ship-launch-console{position:absolute;z-index:3751;right:10px;top:108px;max-width:min(335px,calc(100vw - 20px));
  max-height:65vh;overflow:auto;background:#071c2af5;border:1px solid #90c5d4;border-radius:11px;
  box-shadow:0 10px 30px #000b;padding:11px;color:#e5f9ff;font:12px/1.5 system-ui}
 #ship-launch-console strong{font-size:13px}
 #ship-launch-console .launch-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:9px 0}
 #ship-launch-console button{min-height:38px;border-radius:7px;border:1px solid #6eacbf;
  background:#205469;color:#fff;font:12px system-ui;padding:6px}
 #ship-launch-console .launch-state{white-space:pre-line;line-height:1.7;color:#bee4ef}
 #ship-launch-console .launch-note{color:#b7c8d1;font-size:11px}`;
 document.head.append(style);
 const toggle=document.createElement('button');toggle.id='ship-launch-open';toggle.type='button';toggle.hidden=true;
 toggle.textContent='🛫 離陸・点呼';toggle.setAttribute('aria-expanded','false');
 const panel=document.createElement('section');panel.id='ship-launch-console';panel.hidden=true;
 panel.setAttribute('aria-label','宇宙艦発進手順');
 panel.innerHTML='<strong>🚀 BRIDGE · 発進手順</strong><button data-close type="button" style="float:right;min-height:26px">×</button><div data-state class="launch-state"></div><div class="launch-grid" data-buttons></div><small class="launch-note">VRでは左腕の腕時計 → SHIP。離陸後は左VOLレバーと主推進レバーを操作します。</small>';
 const actions=[['ship-hatch','🚪 ハッチ開閉'],['ship-crew','🪑 乗員着席'],
  ['ship-engine','🔘 主機始動'],['ship-rollcall','📻 全員点呼'],
  ['ship-launch','🚀 離陸準備完了'],['ship-combat','🎯 交戦許可']];
 for(const [id,label] of actions){
  const button=document.createElement('button');button.type='button';button.dataset.action=id;button.textContent=label;
  button.addEventListener('click',()=>{const r=execute(id);if(r?.message)notify(r.message);update(true);});
  panel.querySelector('[data-buttons]').append(button);
 }
 toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));update(true);});
 panel.querySelector('[data-close]').addEventListener('click',()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');});
 host.append(toggle,panel);
 let last='';
 function update(force=false){
  const v=getVoyage();const vr=getVRActive();
  const show=Boolean(v?.kind==='surface-to-surface'&&!vr&&!v.isCrewTest);
  toggle.hidden=!show;
  if(!show){panel.hidden=true;toggle.setAttribute('aria-expanded','false');return;}
  if(panel.hidden)return;
  const s=launchStatus(v);
  const stamp=[v.status,s.seated,s.hatchSecured,s.crewReady,s.engineStarted,s.engineReady,
   s.rollCalled,s.combatAuthorized,Math.round(s.altitudeMeters)].join('|');
  if(!force&&stamp===last)return;
  last=stamp;
  const ok=b=>b?'✅':'□';
  panel.querySelector('[data-state]').textContent=
    `${v.phase}\n${ok(s.seated)} 艦長着席　${ok(s.crewReady)} 全員着席\n${ok(s.hatchSecured)} 気密閉鎖　${ok(s.engineReady)} 主機正常\n${ok(s.rollCalled)} 点呼完了　${ok(s.combatAuthorized)} 交戦許可\n高度 ${Math.round(s.altitudeMeters).toLocaleString('ja-JP')} m`;
  panel.querySelector('[data-action="ship-combat"]').disabled=!s.active||s.grounded;
 }
 return {update,dispose:()=>{style.remove();toggle.remove();panel.remove();}};
}