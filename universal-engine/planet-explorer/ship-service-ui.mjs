export function installShipService({root,panel,getCombat,getVoyage,notify}){
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='🔧 整備・補給';panel.append(toggle);
 const editor=document.createElement('section');editor.className='ship-dashboard-editor';editor.hidden=true;
 const title=document.createElement('strong');title.textContent='機体整備・補給';editor.append(title);
 const close=document.createElement('button');close.type='button';close.textContent='✕';editor.append(close);
 const status=document.createElement('p');editor.append(status);
 function action(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;
 b.onclick=()=>{const m=getCombat(),v=getVoyage();if(!m||!v)return;const r=fn(m,v);v.shipSystems=m.systemSnapshot();notify(r.message);refresh(true);};editor.append(b);}
 action('⛽ 予備燃料＋35%',(m,v)=>m.refuel(v));action('🚚 燃料切れ：救援補給',(m,v)=>m.refuel(v,true));
 const parts={engine:'推進機',hull:'船体',weapons:'兵装',shield:'バリア発生器'};
 for(const [key,label] of Object.entries(parts))action('🔧 '+label+'を修理',m=>m.repairPart(key));
 action('📦 着陸地で整備物資を補充',(m,v)=>{if(!['landed','docked'].includes(v.status))return {message:'着陸してから物資を補充してください'};
 m.supplies={fuel:3,kits:12};return {message:'予備燃料3本・修理キット12個を補充しました'};});
 const hint=document.createElement('p');hint.textContent='被弾後8秒でバリア再充電。損傷した箇所はキットで修理できます。';editor.append(hint);root.append(editor);
 toggle.onclick=()=>{editor.hidden=!editor.hidden;refresh(true);};close.onclick=()=>editor.hidden=true;
 function refresh(visible){toggle.hidden=!visible;if(!visible)editor.hidden=true;if(editor.hidden)return;
 const m=getCombat();if(!m)return;status.textContent='予備燃料 '+m.supplies.fuel+'／キット '+m.supplies.kits+'｜'+Object.entries(parts).map(([k,n])=>n+' '+Math.round(m.parts[k])+'%').join('・');}
 return {refresh};
}
