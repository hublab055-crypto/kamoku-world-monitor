import {FAMILY_GROWTH_STAGES,OVERLORD_COVENANT} from "./family-life.mjs?v=20261117-family-covenant";
/** Single-player family UI. No intimate content is rendered. The adult-only
 * unlock is a local content gate, not a real-world age-verification system.
 */
export function installFamilyLifeUI({world,crew,notify=()=>{},inherit=()=>{},onCarePose=()=>{},onAdultPose=()=>{}}={}){
 if(typeof document==="undefined")return {refresh(){},destroy(){}};
 const button=document.createElement("button");button.id="family-life-open";button.type="button";
 button.textContent="👪 家族";button.setAttribute("aria-controls","family-life-panel");
 button.style.cssText="position:fixed;right:12px;bottom:85px;z-index:118;padding:8px;background:#205069;color:#fff;border:1px solid #81b5c2;border-radius:7px";
 const panel=document.createElement("section");panel.id="family-life-panel";panel.hidden=true;
 panel.style.cssText="position:fixed;right:12px;bottom:130px;z-index:122;width:min(380px,94vw);max-height:75dvh;overflow:auto;padding:12px;color:#effaff;background:#102b3af5;border:1px solid #79b2bf;border-radius:10px;font:13px/1.5 system-ui";
 const row="display:flex;gap:6px;flex-wrap:wrap;margin:5px 0;align-items:center";
 panel.innerHTML='<div style="display:flex;justify-content:space-between"><strong>👪 家族・世代・守護契約</strong><button type="button" data-close>× 閉じる</button></div>'+
 '<small>恋人・結婚は既存クルーの親密度と連動します。子どもは攻撃・負傷・死亡の対象になりません。</small>'+
 '<h4>成人同士の交際・アクション</h4>'+
 '<label>相手 <select data-partner></select></label>'+
 '<div data-relationship></div>'+
 '<label><input type="checkbox" data-consent> 双方の明示的な同意を確認</label>'+
 '<div data-gate style="display:flex;flex-wrap:wrap;gap:5px"><label>成人向け表示コード <input data-code type="password" inputmode="numeric" autocomplete="off" maxlength="4" style="width:75px"></label><label><input type="checkbox" data-adult> 私は成人です</label><button type="button" data-unlock>9876で解禁</button><button type="button" data-lock>閉じる</button></div>'+
 '<div data-adult-actions style="display:flex;flex-wrap:wrap;gap:5px"></div>'+
 '<div data-private-screen hidden style="padding:24px;text-align:center;border-radius:8px;background:#03080f;color:#d5e5f4">🌌 ふたりの時間<br><small>画面暗転／内容は描写しません</small><div><button type="button" data-private-close>戻る</button></div></div>'+
 '<h4>妊娠・胎児</h4><label>妊娠する保護者 <select data-gestational></select></label><input data-baby-name placeholder="赤ちゃんの名前（任意）" maxlength="48">'+
 '<div data-pregnancies>妊娠中の家族はいません</div>'+
 '<h4>育児・成長</h4><label>子ども <select data-child></select></label>'+
 '<div data-child-status>まだ子どもはいません</div>'+
 '<div data-child-actions style="display:flex;flex-wrap:wrap;gap:5px"></div>'+
 '<small>安全機構：高次元のオーバーロードが脅威を検知すると、被害判定前に庇護界へ退避。親が不在なら保護官が育てます。</small>'+
 '<div data-result role="status" aria-live="polite"></div>';
 panel.querySelectorAll("button").forEach(b=>{
  b.style.cssText="padding:5px 8px;border-radius:5px;background:#27546b;color:white;border:1px solid #81b5c2";
 });
 panel.querySelectorAll("input,select").forEach(x=>{
  x.style.background="#d9ecf5";x.style.color="#112b38";x.style.borderRadius="4px";x.style.minHeight="27px";
 });
 document.body.append(button,panel);
 const el=s=>panel.querySelector(s);
 const partner=el("[data-partner]"),childSelect=el("[data-child]");
 const names={navigator:"副官",engineer:"機関士",companion:"乗員"};
 const actions=el("[data-adult-actions]"),care=el("[data-child-actions]");
 const buttonAction=(target,label,run)=>{
  const b=document.createElement("button");b.type="button";b.textContent=label;
  b.style.cssText="padding:5px 8px;border-radius:5px;background:#27546b;color:white;border:1px solid #81b5c2";
  b.addEventListener("click",run);target.append(b);
 };
 for(const [id,name] of Object.entries(names)){
  const o=document.createElement("option");o.value=id;o.textContent=name;partner.append(o);
 }
 const see=w=>world?.()||null;
 const conn=()=>crew?.()||null;
 const currentRelation=()=>conn()?.social?.status?.(partner.value)||null;
 const together=()=>{
  const interior=conn(),id=partner.value;
  return Boolean(interior&&!interior.seated&&
   interior.nearCrew?.().some(member=>member.id===id));
 };
 const execute=(f,{requiresProximity=false}={})=>{
  const w=see();if(!w)return;
  const result=requiresProximity&&!together()?
   {ok:false,message:"相手の近くで、立った状態から交流してください"}:f(w);
  const message=result?.message||"操作できませんでした";
  el("[data-result]").textContent=message;
  if(result?.ok)notify(message);
  refresh();return result;
 };
 const agreed=()=>el("[data-consent]").checked===true;
 buttonAction(actions,"交際",()=>execute(w=>w.beginDating(partner.value,{
  mutualConsent:agreed(),relationship:currentRelation()}),{requiresProximity:true}));
 buttonAction(actions,"結婚",()=>execute(w=>w.marry(partner.value,{
  mutualConsent:agreed(),relationship:currentRelation()}),{requiresProximity:true}));
 for(const [kind,label] of [["handhold","手をつなぐ"],["hug","ハグ"],["kiss","キス"],["private","🌙 ふたりの時間"]]){
  buttonAction(actions,label,()=>{
   const result=execute(w=>w.action(partner.value,kind,{mutualConsent:agreed()}),{requiresProximity:true});
   if(result?.ok&&kind==="private")el("[data-private-screen]").hidden=false;
   if(result?.ok&&["handhold","hug","kiss"].includes(kind)){
    const motion=onAdultPose(kind,partner.value);
    if(motion?.ok===false)el("[data-result]").textContent=motion.message+"（関係の記録は保存されています）";
   }
  });
 }
 const gestation=el("[data-gestational]");
 function gestationalOptions(){
  const current=gestation.value;gestation.replaceChildren();
  for(const [id,name] of [["player","プレイヤー"],[partner.value,names[partner.value]||"パートナー"]]){
   gestation.add(new Option(name,id));
  }
  if(["player",partner.value].includes(current))gestation.value=current;
 }
 buttonAction(actions,"家族計画・妊娠",()=>execute(w=>w.planPregnancy(partner.value,{
  mutualConsent:agreed(),gestationalParent:gestation.value,name:el("[data-baby-name]").value||"赤ちゃん"
 }),{requiresProximity:true}));
 for(const [kind,label] of [["hold","抱っこ"],["feed","授乳・食事"],["sleep","寝かしつけ"],["play","遊ぶ"],["learn","学ぶ"]]){
  buttonAction(care,label,()=>{
   const result=execute(w=>w.careFor(childSelect.value,kind));
   if(result?.ok)onCarePose(kind);
  });
 }
 buttonAction(care,"🛡️ 守護契約を確認",()=>execute(w=>w.guardChild(childSelect.value,{threat:"danger"})));
 buttonAction(care,"🏠 安全な帰還",()=>execute(w=>w.returnFromSanctuary(childSelect.value,{homeSafe:true})));
 buttonAction(care,"👤 代替保護者",()=>execute(w=>w.appointGuardian(childSelect.value,"navigator")));
 buttonAction(care,"🌱 世代継承",()=>execute(w=>{
  const id=childSelect.value;
  if(!w.canInherit(id))return {ok:false,message:"成人して安全に暮らせる後継者を選択してください"};
  const result=w.markInherited(id);
  if(result.ok)inherit(id);
  return result;
 }));
 el("[data-unlock]").addEventListener("click",()=>execute(w=>w.unlock(el("[data-code]").value,{
  adultConfirmation:el("[data-adult]").checked})));
 el("[data-lock]").addEventListener("click",()=>execute(w=>w.lock()));
 el("[data-private-close]").addEventListener("click",()=>{el("[data-private-screen]").hidden=true;});
 el("[data-close]").addEventListener("click",()=>{panel.hidden=true;});
 button.addEventListener("click",()=>{panel.hidden=!panel.hidden;refresh();});
 partner.addEventListener("change",refresh);
 childSelect.addEventListener("change",refresh);
 function refresh(){
  const w=see();if(!w)return;
  gestationalOptions();
  const relation=currentRelation();
  el("[data-relationship]").textContent=relation?
   "既存の関係："+relation.label+" / 親密度 "+relation.points+
   "｜家族ステータス："+(w.partners[partner.value]?.status==="married"?"結婚":w.partners[partner.value]?"交際":"未交際"):
   "クルーとの関係は乗船して確認できます";
  el("[data-code]").disabled=w.privateUnlocked;
  const active=w.privateUnlocked;
  for(const b of [...actions.querySelectorAll("button")]){
   if(/ハグ|キス|手をつなぐ|ふたりの時間|家族計画/.test(b.textContent))b.disabled=!active;
  }
  const old=childSelect.value;childSelect.replaceChildren();
  if(!w.children.length)childSelect.add(new Option("まだいません",""));
  for(const c of w.children)childSelect.add(new Option(c.name+"（"+(FAMILY_GROWTH_STAGES.find(x=>x.id===c.growthStage)?.label||"成長中")+"）",c.id));
  if(w.children.some(c=>c.id===old))childSelect.value=old;
  el("[data-pregnancies]").replaceChildren();
  if(!w.pregnancies.length)el("[data-pregnancies]").textContent="妊娠中の家族はいません";
  for(const pregnancy of w.pregnancies){
   const f=w.fetus(pregnancy.id),p=document.createElement("p");
   p.textContent=pregnancy.name+"：妊娠"+f.week+"週（"+f.status+"）/ 出産予定まで"+Math.ceil(f.dueInDays)+"ゲーム日";
   el("[data-pregnancies]").append(p);
  }
  const child=w.childStatus(childSelect.value);
  el("[data-child-status]").textContent=child?
   child.name+" / "+(FAMILY_GROWTH_STAGES.find(x=>x.id===child.growthStage)?.label||"")+
   " / "+child.ageYears.toFixed(1)+"歳｜養育："+Math.round(child.care.nutrition)+
   " 栄養・"+Math.round(child.care.comfort)+" 安心・"+Math.round(child.care.learning)+
   " 学習｜"+(child.location==="sanctuary"?OVERLORD_COVENANT.sanctuary:child.location==="foster"?"保護者宅":"家族の家"):
   "子どもが生まれると、ここで成長や育児を管理できます";
  care.querySelectorAll("button").forEach(b=>{b.disabled=!child;});
 }
 refresh();
 return {refresh,destroy(){button.remove();panel.remove();},open(){panel.hidden=false;refresh();}};
}
