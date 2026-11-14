import {COCKPIT_HOLOGRAM_ACTIONS,applyCockpitHologramAction} from "./ship-cockpit-hologram.mjs?v=20261114-armrest";

/** Two compact touch panels over the first-person cockpit. The 3D/XR pads
 * invoke the same action dispatcher through space-combat-ui.mjs.
 */
export function installCockpitHologramUI({host,getVoyage,getCombat,switchWeapon,commands,notify=()=>{},isCockpit=()=>true}){
 const style=document.createElement("style");
 style.textContent=`
 .ship-armrest-holograms[hidden]{display:none!important}
 .ship-armrest-holograms{position:absolute;inset:0;z-index:3511;pointer-events:none;display:flex;
  align-items:flex-end;justify-content:space-between;padding:0 8px clamp(118px,18vh,200px);
  box-sizing:border-box;gap:8px;overflow:hidden}
 .ship-armrest-holograms details{pointer-events:auto;width:clamp(138px,20vw,216px);max-height:min(46vh,370px);
  overflow:auto;color:#c9faff;border:1px solid #4ddcecbd;border-radius:12px;
  background:linear-gradient(145deg,#0a3b588c,#061c35b9);
  backdrop-filter:blur(3px);box-shadow:0 0 16px #1fd8ff2b,inset 0 0 14px #16d8ff18;
  font:11px/1.35 system-ui;touch-action:pan-y}
 .ship-armrest-holograms summary{padding:7px 9px;font-weight:700;cursor:pointer;color:#a5f5ff}
 .ship-armrest-holograms output{display:block;margin:0 8px 6px;font:10px/1.5 ui-monospace,monospace}
 .ship-armrest-holograms .holo-buttons{padding:0 6px 8px;display:grid;grid-template-columns:1fr 1fr;gap:5px}
 .ship-armrest-holograms button{min-height:34px;min-width:0;padding:4px 2px;background:#15506cbb;
  border:1px solid #6ac8e6;border-radius:7px;color:#e1fbff;font:10px/1.25 system-ui}
 .ship-armrest-holograms button[aria-pressed=true]{background:#2b797c;color:white;border-color:#affff7}
 .ship-armrest-holograms button:focus-visible{outline:2px solid #fff;outline-offset:1px}
 @media(max-width:700px){.ship-armrest-holograms{padding:0 4px max(155px,30vh);gap:4px}
  .ship-armrest-holograms details{width:clamp(114px,42vw,170px);max-height:32vh}
  .ship-armrest-holograms button{min-height:32px;font-size:9px}}
 `;
 document.head.append(style);
 const root=document.createElement("div");
 root.className="ship-armrest-holograms";root.hidden=true;
 root.setAttribute("aria-label","操縦席の左右ホログラムタッチパネル");
 const buttons=new Map(),outputs=new Map();
 for(const [side,title] of [["left","左｜推進・兵装・整備"],["right","右｜航法・通信"]]){
  const details=document.createElement("details");details.dataset.side=side;
  details.open=typeof window==="undefined"||window.innerWidth>700;
  const summary=document.createElement("summary");summary.textContent="◈ "+title;
  const output=document.createElement("output");output.setAttribute("aria-live","off");
  const body=document.createElement("div");body.className="holo-buttons";
  const actions=side==="left"?COCKPIT_HOLOGRAM_ACTIONS.slice(0,8):COCKPIT_HOLOGRAM_ACTIONS.slice(8);
  for(const action of actions){
   const button=document.createElement("button");button.type="button";
   button.dataset.action=action.id;button.textContent=action.label;
   button.addEventListener("click",()=>{
    const result=applyCockpitHologramAction(action.id,{
     voyage:getVoyage(),combat:getCombat(),switchWeapon,
     scan:commands?.scan,radio:commands?.radio
    });
    if(result.message)notify(result.message);
    update(true);
   });
   buttons.set(action.id,button);body.append(button);
  }
  details.append(summary,output,body);root.append(details);outputs.set(side,output);
 }
 host.append(root);
 function update(visible){
  const v=getVoyage(),m=getCombat();
  const show=Boolean(visible&&v?.seated&&isCockpit());
  root.hidden=!show;if(!show)return;
  const throttle=Math.round((v.throttle||0)*100),fuel=Math.round(v.fuel||0);
  const speed=Number.isFinite(v.airSpeed)&&v.status==="atmosphere"
   ?"／対気 "+Math.round(v.airSpeed)+"m/s":"";
  outputs.get("left").textContent="推力 "+throttle+"%"+speed+"／燃料 "+fuel+"%\n"+
   "ロック "+(m?.fireControl?"AUTO":"手動")+"／射撃 "+(m?.autoFire?"AUTO":"手動");
  outputs.get("right").textContent="バリア "+Math.round(m?.player.shield??100)+"%"+
   "／整備キット "+(m?.supplies.kits??0)+"個";
  buttons.get("weapon").textContent=m?"兵装 "+m.config.name:"兵装";
  for(const [id,enabled] of [["auto-fire",m?.autoFire],["auto-lock",m?.fireControl]]){
   buttons.get(id).setAttribute("aria-pressed",String(Boolean(enabled)));
  }
  buttons.get("horizon").setAttribute("aria-pressed",String(Boolean(v.horizon)));
  buttons.get("horizon").disabled=v.status!=="atmosphere";
  buttons.get("gear").textContent="脚 "+({auto:"AUTO",up:"格納",down:"展開"}[v.gearMode]||"AUTO");
  buttons.get("repair").disabled=!m||m.supplies.kits<=0||(!Object.values(m.parts).some(value=>value<100)&&m.player.hp>=m.player.maxHp);
  buttons.get("fuel").disabled=!m||m.supplies.fuel<=0;
  buttons.get("shield").disabled=!m||(m.player.shield>=m.player.maxShield&&m.parts.shield>=100);
 }
 return {update};
}
