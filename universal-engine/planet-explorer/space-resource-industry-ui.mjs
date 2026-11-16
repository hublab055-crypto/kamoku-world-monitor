import {ASTEROID_CONTACTS,RESOURCE_LABELS,SPACE_RECIPES} from "./space-resource-industry.mjs?v=20261116";
import {shipContactDistance,combatEligible} from "./space-combat.mjs?v=20261116-mining";

/** Compact optional screen; never removes or replaces the normal flight HUD. */
export function installSpaceIndustryUI({root,consolePanel,getCombat,getVoyage,notify,selectResource,fireMine}){
 const style=document.createElement("style");
 style.textContent=`
 #ship-resource-panel{position:absolute;z-index:340;right:8px;top:102px;width:min(380px,calc(100% - 16px));
  max-height:min(65vh,490px);overflow:auto;overscroll-behavior:contain;background:#0b2534f5;
  color:#e9faff;border:1px solid #76aab8;border-radius:10px;padding:10px;
  box-shadow:0 8px 28px #000b;font:12px/1.5 system-ui;pointer-events:auto}
 #ship-resource-panel[hidden]{display:none!important}
 #ship-resource-panel h3{font-size:14px;margin:0 0 5px}
 #ship-resource-panel h4{font-size:12px;margin:8px 0 3px}
 #ship-resource-panel button{background:#174255;color:white;border:1px solid #68b0c4;border-radius:5px;padding:5px 7px;margin:2px;min-height:30px}
 #ship-resource-panel button:disabled{opacity:.45}
 #ship-resource-panel .ore-line{display:flex;justify-content:space-between;gap:5px;align-items:center;border-bottom:1px solid #ffffff20}
 #ship-resource-panel .ore-line span{flex:1}
 #ship-resource-panel .cargo-list{display:flex;flex-wrap:wrap;gap:4px}
 #ship-resource-panel .cargo-list span{background:#24485a;border-radius:5px;padding:2px 4px}
 @media(max-width:590px){#ship-resource-panel{top:86px;max-height:64vh}}
 `;
 document.head.append(style);
 const button=document.createElement("button");button.type="button";
 button.textContent="⛏️ 採掘・精製";button.setAttribute("aria-expanded","false");
 consolePanel.append(button);
 const panel=document.createElement("section");panel.id="ship-resource-panel";panel.hidden=true;
 panel.setAttribute("role","region");panel.setAttribute("aria-label","小惑星採掘・精製・加工");
 const heading=document.createElement("h3");heading.textContent="⛏️ 宇宙資源ステーション";
 const close=document.createElement("button");close.type="button";close.textContent="× 閉じる";
 const info=document.createElement("p"),oreBox=document.createElement("div"),cargoBox=document.createElement("div"),recipes=document.createElement("div");
 const cargoTitle=document.createElement("h4");cargoTitle.textContent="船倉";
 const oreTitle=document.createElement("h4");oreTitle.textContent="鉱床をスキャン・ロックオン";
 const recipeTitle=document.createElement("h4");recipeTitle.textContent="精製・加工（船内設備）";
 const mine=document.createElement("button");mine.type="button";mine.textContent="🔴 ロック対象へ採掘射撃";
 mine.addEventListener("click",()=>{fireMine();refresh(true);});
 panel.append(heading,close,info,oreTitle,oreBox,mine,cargoTitle,cargoBox,recipeTitle,recipes);
 root.append(panel);
 let lastRender=0;
 const toggle=()=>{
  panel.hidden=!panel.hidden;button.setAttribute("aria-expanded",String(!panel.hidden));
  refresh(true);
 };
 button.addEventListener("click",toggle);
 close.addEventListener("click",toggle);
 const oreButtons=new Map();
 for(const ore of ASTEROID_CONTACTS){
  const line=document.createElement("div");line.className="ore-line";
  const name=document.createElement("span");name.textContent=ore.name;
  const choose=document.createElement("button");choose.type="button";choose.textContent="ロック";
  choose.addEventListener("click",()=>{selectResource(ore.id);refresh(true);});
  line.append(name,choose);oreBox.append(line);oreButtons.set(ore.id,{name,choose});
 }
 const recipeButtons=new Map();
 for(const recipe of SPACE_RECIPES){
  const row=document.createElement("div");row.className="ore-line";
  const label=document.createElement("span");
  label.textContent=recipe.label+" ／ "+Object.entries(recipe.inputs)
   .map(([key,amount])=>RESOURCE_LABELS[key]+" "+amount+"kg").join("＋");
  const doCraft=document.createElement("button");doCraft.type="button";doCraft.textContent="製造";
  doCraft.addEventListener("click",()=>{
   const model=getCombat(),voyage=getVoyage();
   if(!model)return;
   const result=model.industry.craft(recipe.id,{combat:model,voyage});
   if(result.ok)voyage.shipSystems=model.systemSnapshot();
   notify(result.message);refresh(true);
  });
  row.append(label,doCraft);recipes.append(row);recipeButtons.set(recipe.id,{label,doCraft});
 }
 function refresh(force=false){
  const voyage=getVoyage(),combat=getCombat();
  const visible=Boolean(voyage?.active);
  button.hidden=!visible;
  if(!visible){panel.hidden=true;button.setAttribute("aria-expanded","false");return;}
  if(panel.hidden)return;
  const now=Date.now();if(!force&&now-lastRender<700)return;lastRender=now;
  const industry=combat?.industry;if(!industry)return;
  const selected=voyage.navigationTarget?.id;
  const canFire=combatEligible(voyage);
  info.textContent="砲で破砕 → 自動回収 → 船内精製 ｜ 兵装："+combat.config.name+
   " ｜ 積載 "+industry.cargoKg.toFixed(1)+"/"+industry.capacityKg+"kg";
  mine.disabled=!canFire||!ASTEROID_CONTACTS.some(c=>c.id===selected);
  for(const ore of ASTEROID_CONTACTS){
   const row=oreButtons.get(ore.id),contact=combat.nonHostiles.find(c=>c.id===ore.id);
   const distance=contact?shipContactDistance(contact,voyage):Infinity;
   const remaining=Object.values(industry.remaining[ore.id]||{}).reduce((a,b)=>a+b,0);
   row.name.textContent=(selected===ore.id?"🎯 ":"")+ore.name+
    " ／ "+Math.round(distance)+"m ／ 残 "+remaining.toFixed(1)+"kg";
   row.choose.disabled=!canFire||distance>5000||remaining<=0;
   row.choose.textContent=selected===ore.id?"選択中":"ロック";
  }
  cargoBox.replaceChildren();
  const owned=Object.entries(industry.stock).filter(([,mass])=>mass>.00001);
  if(!owned.length)cargoBox.textContent="資源なし";
  else{
   cargoBox.className="cargo-list";
   for(const [key,mass] of owned){
    const tag=document.createElement("span");
    tag.textContent=RESOURCE_LABELS[key]+" "+(mass<.01?mass.toFixed(4):mass.toFixed(2))+" kg";
    cargoBox.append(tag);
   }
  }
  for(const recipe of SPACE_RECIPES){
   const row=recipeButtons.get(recipe.id);
   row.doCraft.disabled=industry.technologyLevel<recipe.tech||
    Object.entries(recipe.inputs).some(([key,amount])=>(industry.stock[key]||0)+.000001<amount);
   row.doCraft.title=industry.technologyLevel<recipe.tech?"技術レベル"+recipe.tech+"で解放":"材料を確認";
   row.label.title="必要工程エネルギー "+recipe.energy+"（現段階では表示のみ）";
  }
 }
 return {refresh};
}
