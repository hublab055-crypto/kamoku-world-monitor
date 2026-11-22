/** Local-only strategy UI; states are simulated NPC realms, NOT online players. */
import {DESTINATIONS} from "./settlements.mjs?v=0.8r-towns";
import {stanceOf,RECRUIT_COST,RECRUIT_SIZE} from "./faction-strategy.mjs?v=0.9g-strategy";

const $=id=>document.getElementById(id);
const coins=n=>Math.floor(n||0).toLocaleString("ja-JP")+" G";
const opt=(value,name)=>{const node=document.createElement("option");node.value=value;node.textContent=name;return node;};
export function installStrategyUI({get,save,notify}){
 const panel=$("strategy-panel"),button=$("viewport-strategy");
 if(!panel||!button)return null;
 const own=$("strategy-own"),target=$("strategy-target"),troops=$("strategy-force");
 const status=$("strategy-status"),list=$("strategy-summary");
 for(const d of DESTINATIONS.filter(x=>x.id!=="pioneer"))
  target.append(opt(d.id,d.name));
 for(const n of [5,10,20,30,40,60,80,120])
  troops.append(opt(String(n),n+"人"));
 function message(r){
  status.textContent=r.message;
  notify?.(r.message);
  if(r.ok){save();refresh();}
 }
 function selected(){
  const {strategy}=get();
  return {from:own.value,to:target.value,strategy,
   pair:strategy?.relation(target.value)};
 }
 function refresh(){
  const {strategy,economy,planet}=get();
  if(!strategy||!economy)return;
  const old=own.value;own.replaceChildren();
  for(const row of strategy.summary().filter(x=>x.player))
   own.append(opt(row.id,row.name));
  if([...own.options].some(o=>o.value===old))own.value=old;
  const home=economy.town(own.value);
  const countries=strategy.summary().filter(x=>!x.player&&x.id!=="pioneer");
  const previous=target.value;target.replaceChildren();
  for(const c of countries)target.append(opt(c.id,c.name));
  if([...target.options].some(o=>o.value===previous))target.value=previous;
  const enemy=economy.town(target.value),r=strategy.relation(target.value);
  $("strategy-month").textContent="惑星第"+strategy.monthOfDay(planet.timeDays)+"月";
  $("strategy-own-stats").textContent=home?"国庫 "+coins(home.treasury)+
    " / 駐屯軍 "+strategy.armies[own.value]+"人 / 民心 "+home.support+"/100":
    "自領がありません";
  $("strategy-target-stats").textContent=enemy&&r?
    "国庫 "+coins(enemy.treasury)+" / 守備隊 "+strategy.armies[target.value]+
    "人 / 関係 "+r.trust+" / "+stanceOf(r):"外交対象がありません";
  $("strategy-trade-hint").textContent=r?
   "交易："+(r.trade?"開通":"未開通")+" / 不可侵："+(r.pact?"締結":"未締結")+
   " / 同盟："+(r.alliance?"締結":"未締結"):"";
  $("strategy-recruit").disabled=!home||strategy.armies[own.value]>245||home.treasury<RECRUIT_COST;
  $("strategy-recruit-hint").textContent="駐屯兵"+RECRUIT_SIZE+"人の募集："+RECRUIT_COST+"G（維持費は毎月1人2G）";
  const buttons={
   "strategy-envoy":!r||r.war||r.envoyMonth===strategy.lastMonth,
   "strategy-trade":!r||r.war||r.trade||r.trust<0,
   "strategy-pact":!r||r.war||r.pact||r.trust<40,
   "strategy-alliance":!r||r.war||r.alliance||!r.pact||r.trust<70,
   "strategy-withdraw":!r||r.war||!(r.trade||r.pact||r.alliance),
   "strategy-war":!r||r.war||r.trade||r.pact||r.alliance||strategy.lastMonth<r.truceUntil,
   "strategy-peace":!r||!r.war,
   "strategy-campaign":!r||!r.war||!home||strategy.armies[own.value]<=5
  };
  for(const [id,disabled] of Object.entries(buttons))$(id).disabled=disabled;
  list.replaceChildren();
  for(const row of strategy.summary()){
   const item=document.createElement("li");
   item.textContent=(row.player?"🏡 ":"🏛️ ")+row.name+"：国庫 "+coins(row.treasury)+
    " / 兵 "+row.army+"人 / 民心 "+row.support;
   list.append(item);
  }
  $("strategy-journal").replaceChildren(...strategy.ledger.slice(-5).reverse().map(x=>{
   const item=document.createElement("li");item.textContent=x.text;return item;
  }));
 }
 button.addEventListener("click",()=>{
  panel.hidden=!panel.hidden;
  button.setAttribute("aria-expanded",String(!panel.hidden));
  if(!panel.hidden)refresh();
 });
 $("strategy-close").addEventListener("click",()=>{
  panel.hidden=true;button.setAttribute("aria-expanded","false");
 });
 own.addEventListener("change",refresh);
 target.addEventListener("change",refresh);
 $("strategy-envoy").addEventListener("click",()=>{
  const {strategy,to}=selected();message(strategy.sendEnvoy(to));
 });
 $("strategy-trade").addEventListener("click",()=>{
  const {strategy,to}=selected();message(strategy.startTrade(to));
 });
 $("strategy-pact").addEventListener("click",()=>{
  const {strategy,to}=selected();message(strategy.signPact(to));
 });
 $("strategy-alliance").addEventListener("click",()=>{
  const {strategy,to}=selected();message(strategy.signAlliance(to));
 });
 $("strategy-withdraw").addEventListener("click",()=>{
  const {strategy,to}=selected();
  if(window.confirm("通商・不可侵・同盟の条約を破棄しますか？友好度が下がります。"))
   message(strategy.withdraw(to));
 });
 $("strategy-war").addEventListener("click",()=>{
  const {strategy,to}=selected();
  if(window.confirm("宣戦布告しますか？領地の民心が下がります。実戦の3D戦闘ではなく戦略演算です。"))
   message(strategy.declareWar(to));
 });
 $("strategy-peace").addEventListener("click",()=>{
  const {strategy,to}=selected();message(strategy.seekPeace(to));
 });
 $("strategy-recruit").addEventListener("click",()=>{
  const {strategy,from}=selected();message(strategy.recruit(from));
 });
 $("strategy-campaign").addEventListener("click",()=>{
  const {strategy,from,to}=selected(),n=Number(troops.value);
  if(window.confirm(to+"へ"+n+"人を遠征させますか？兵の損失が発生します。"))
   message(strategy.campaign(from,to,n));
 });
 return {refresh:()=>{if(!panel.hidden)refresh();},close:()=>{
  panel.hidden=true;button.setAttribute("aria-expanded","false");
 }};
}
