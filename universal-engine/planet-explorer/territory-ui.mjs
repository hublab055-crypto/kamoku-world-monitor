/** Local property/territory panel; server authorization is a separate future step. */
import {DESTINATIONS} from "./settlements.mjs?v=0.8r-towns";

const $=id=>document.getElementById(id);
const format=n=>Math.floor(n||0).toLocaleString("ja-JP");
export function installTerritoryUI({get,save,notify}){
 const panel=$("territory-panel"),button=$("viewport-territory");
 const town=$("territory-town"),rate=$("territory-tax-rate");
 const status=$("territory-status"),deeds=$("territory-deeds");
 if(!panel||!button)return null;
 for(const d of DESTINATIONS){
  const o=document.createElement("option");o.value=d.id;o.textContent=d.name;town.append(o);
 }
 const option=(value,label)=>{const o=document.createElement("option");
  o.value=value;o.textContent=label;return o;};
 const message=r=>{
  status.textContent=r.message;
  if(r.ok){save();refresh();}
  notify?.(r.message);
 };
 function refresh(){
  const {economy,ownerWorld,activeSettlementId,planet,wallet}=get();
  if(!economy)return;
  if(!town.value||!economy.town(town.value))town.value=activeSettlementId==="wilderness"?"pioneer":activeSettlementId;
  const t=economy.town(town.value);
  const leader=economy.ruler(t.id,"player");
  rate.value=String(t.taxRate);
  $("territory-tax-value").textContent=t.taxRate+"%";
  $("territory-tax-rate").disabled=!leader;
  $("territory-tax-apply").disabled=!leader;
  $("territory-spend").disabled=!leader;
  $("territory-treasury").textContent=format(t.treasury)+" G";
  $("territory-wallet").textContent=format(wallet?.coins)+" G";
  $("territory-debt").textContent=format(economy.bonds.debt(t.id))+" G";
  $("territory-bond-create").disabled=!leader;
  const bondSelect=$("territory-bond-issue"),selectedBond=bondSelect.value;
  bondSelect.replaceChildren();
  const bonds=economy.bonds.issues.filter(b=>b.townId===t.id).reverse();
  for(const b of bonds){
   const label=b.id+" / "+b.face+"G×"+b.sold+"口保有 / "+
    economy.bonds.status(b,planet.timeDays)+" / 満期 第"+b.maturityMonth+"月";
   bondSelect.append(option(b.id,label));
  }
  if(bonds.some(b=>b.id===selectedBond))bondSelect.value=selectedBond;
  const selected=bonds.find(b=>b.id===bondSelect.value);
  const left=selected?selected.units-selected.sold:0;
  const remainingDays=selected?Math.max(0,Math.ceil(selected.maturityMonth*30-planet.timeDays)):0;
  $("territory-bond-buy").disabled=!selected||!!selected.closed||remainingDays===0||left===0;
  $("territory-bond-info").textContent=selected?
   "発行 "+selected.units+"口 / 募集残 "+left+"口 / 満期まで "+remainingDays+"日 / 利率 "+
    selected.interestPercent+"%（満期一括） / 償還見込 "+
    format(economy.bonds.outstanding(selected))+"G"+
    (remainingDays===0&&!selected.closed?" / 返済待ち":""):
   "債券はまだ発行されていません。";

  $("territory-support").textContent=t.support+"/100";
  $("territory-ruler").textContent=leader?"あなた（ローカル試作）":"自治評議会・NPC";
  const bill=economy.monthlyAssessment(t.id);
  $("territory-estimate").textContent="試算："+bill.residents+"人、課税対象所得 "+
    format(bill.income-bill.residents*t.exemption)+" G/月、徴収見込 "+format(bill.collected)+" G/月";
  const last=t.lastReport;
  $("territory-last-tax").textContent=(last?"最終徴収：第"+last.month+"月 "+format(last.collected)+" G":"最終徴収：未実施")+" / 次回徴税まで "+(30-(Math.floor(planet.timeDays)%30))+"日（ゲーム内30日ごと）";
  const owned=economy.assets.filter(a=>a.ownerId==="player"&&!a.destroyed);
  const previous=deeds.value;deeds.replaceChildren();
  for(const a of owned.slice(0,150)){
   const label=(a.kind==="land"?"🌳 土地":"🏠 建物")+" "+a.id+
    (a.tenantId?"（賃借人："+a.tenantId+"）":"");
   deeds.append(option(a.id,label));
  }
  if([...deeds.options].some(o=>o.value===previous))deeds.value=previous;
  $("territory-transfer").disabled=!owned.length;
  $("territory-lease").disabled=!owned.length;
  $("territory-claim").disabled=!leader||town.value!==activeSettlementId;
  $("territory-asset-count").textContent="登録資産 "+economy.assets.filter(a=>!a.destroyed).length+
   "件／あなた名義 "+owned.length+"件";
  $("territory-date").textContent="惑星日 "+Math.floor(planet.timeDays)+" / 登記した建物 "+
   ownerWorld.buildings.length+"件";
  $("territory-log").replaceChildren(...economy.ledger.slice(-6).reverse().map(e=>{
   const li=document.createElement("li");li.textContent=e.text;return li;
  }));
 }
 button.addEventListener("click",()=>{
  panel.hidden=!panel.hidden;button.setAttribute("aria-expanded",String(!panel.hidden));
  if(!panel.hidden){
   const {activeSettlementId}=get();
   town.value=activeSettlementId==="wilderness"?"pioneer":activeSettlementId;
   refresh();
  }
 });
 $("territory-close").addEventListener("click",()=>{
  panel.hidden=true;button.setAttribute("aria-expanded","false");
 });
 town.addEventListener("change",refresh);
 rate.addEventListener("input",()=>{$("territory-tax-value").textContent=rate.value+"%";});
 $("territory-tax-apply").addEventListener("click",()=>{
  const {economy}=get();message(economy.setTaxRate(town.value,Number(rate.value),"player"));
 });
 $("territory-claim").addEventListener("click",()=>{
  const {economy,controller,activeSettlementId}=get();
  if(!controller?.nearGround)return message({ok:false,message:"地表へ降りてから土地を登録してください"});
  if(town.value!==activeSettlementId)return message({ok:false,message:"現在地の領地を選んでください"});
  message(economy.claimLand(town.value,{lat:controller.lat,lon:controller.lon},
   Number($("territory-radius").value),"player"));
 });
 $("territory-transfer").addEventListener("click",()=>{
  const {economy}=get();
  message(economy.transfer(deeds.value,"player",$("territory-recipient").value));
 });
 $("territory-lease").addEventListener("click",()=>{
  const {economy}=get();
  message(economy.lease(deeds.value,"player",$("territory-recipient").value));
 });
 $("territory-spend").addEventListener("click",()=>{
  const {economy}=get();
  message(economy.spend(town.value,$("territory-purpose").value,100,"player"));
 });
 $("territory-bond-issue").addEventListener("change",refresh);
 $("territory-bond-create").addEventListener("click",()=>{
  const {economy}=get();
  message(economy.bonds.issue(town.value,{
   face:Number($("territory-bond-face").value),
   units:Number($("territory-bond-units").value),
   termMonths:Number($("territory-bond-term").value),
   interestPercent:Number($("territory-bond-rate").value)
  },"player"));
 });
 $("territory-bond-buy").addEventListener("click",()=>{
  const {economy,wallet}=get();
  message(economy.bonds.buy($("territory-bond-issue").value,
   Number($("territory-bond-buy-units").value),wallet));
 });
 return {refresh:()=>{if(!panel.hidden)refresh();},close:()=>{
  panel.hidden=true;button.setAttribute("aria-expanded","false");
 }};
}
