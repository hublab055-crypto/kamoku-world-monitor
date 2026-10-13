/* Frontier World V52.0 — local publishing industry.
 * Publishing on the online market is deliberately not performed here.
 */
(function(){
'use strict';
const bridge=window.__fwFrontierBridge;
if(!bridge||window.__fw52PublishingLoaded)return;
window.__fw52PublishingLoaded=true;
const state=bridge.state;
const $=sel=>document.querySelector(sel);
const sites={
 paper_mill:{label:'🌿 製紙工房',cost:{wood:10,stone:5},icon:'📄'},
 printing_house:{label:'📚 印刷所',cost:{wood:14,stone:8},icon:'📚'}
};
const labels={fiber:'草の繊維',wood:'木材',water:'水',hide:'獣皮',paper:'紙',parchment:'羊皮紙',soot:'煤',ink:'インク'};
const clock=()=>Number(state.day||0)*24+Number(state.hour||0);
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensure(){
 let p=state.villagePublishing52;
 if(!p||typeof p!=='object')p=state.villagePublishing52={stock:{},works:[],sales:[],events:[],buyerBudget:40,lastBudgetDay:state.day,dailySales:0,allowPlayerBooks:false,seq:0};
 p.stock=p.stock||{};
 Object.keys(labels).forEach(k=>p.stock[k]=Math.max(0,Number(p.stock[k])||0));
 p.works=Array.isArray(p.works)?p.works:[];
 p.sales=Array.isArray(p.sales)?p.sales:[];
 p.events=Array.isArray(p.events)?p.events:[];
 p.buyerBudget=Math.max(0,Number(p.buyerBudget)||0);
 p.lastBudgetDay=Number.isFinite(Number(p.lastBudgetDay))?Number(p.lastBudgetDay):state.day;
 p.dailySales=Math.max(0,Number(p.dailySales)||0);
 p.seq=Math.max(0,Number(p.seq)||0);
 p.allowPlayerBooks=!!p.allowPlayerBooks;
 return p;
}
function notify(s){if(bridge.message)bridge.message(s);}
function save(){
 try{
  const snapshot=JSON.parse(JSON.stringify(state,function(k,v){
   if(['dialog','training','crafting'].includes(k))return null;
   if(k==='task'&&v&&typeof v==='object')return null;
   return v;
  }));
  localStorage.setItem('frontier_world_save_v10',JSON.stringify({version:10,savedAt:Date.now(),state:snapshot}));
 }catch(err){notify('⚠️ 出版業セーブ失敗: '+err.message);}
}
function log(kind,text,actor){
 const p=ensure();
 p.events.unshift({day:state.day,kind:kind,text:text,worker:actor&&actor.name||''});
 p.events.length=Math.min(p.events.length,50);
 if(typeof window.fw37Log==='function')try{window.fw37Log('action','📚 '+text,actor||state.player);}catch(e){}
}
function buildings(type){return (state.buildings||[]).filter(b=>b.type===type);}
function nearBuilding(){
 let target=null,distance=3;
 for(const b of state.buildings||[]){
  if(!sites[b.type])continue;
  const d=Math.hypot(state.player.x-b.x-1,state.player.y-b.y-2.1);
  if(d<distance){distance=d;target=b;}
 }
 return target;
}
function workerCandidates(){
 return (state.npcs||[]).filter(n=>n&&n.alive!==false&&!n.controlled&&!n.isChild&&n.id!=='priest43'&&!['merchant','guard','priest'].includes(n.role));
}
function construction(type,x,y){
 const spec=sites[type];
 if(!spec)return false;
 const p=ensure();
 if(buildings(type).length>=3){notify('🏭 同じ施設は最大3棟です。');return false;}
 const b={id:'fw52_'+type+'_'+(p.seq+1),x:x,y:y,ownerId:state.player.id,
  owner:state.player.name||'YOU',type:type,access:'owner',furniture:[]};
 if(!bridge.canPlacePublication52(b,x,y)){notify('🏭 建てられない場所です。空き地を選んでください。');return false;}
 if(!bridge.buildPayPublication52(spec.cost)){notify('📦 建築素材が足りません。');return false;}
 ++p.seq;(state.buildings||[]).push(b);
 log('build',spec.label+'が完成',state.player);save();
 notify(spec.label+'が完成しました。🔨から出版業の担当者を配置できます。');
 return true;
}
bridge.placePublicationFacility52=construction;
const previousMenu=bridge.fw43OutdoorConstruction;
bridge.fw43OutdoorConstruction=function(){
 previousMenu.apply(this,arguments);
 const body=$('#panelBody');if(!body)return;
 body.insertAdjacentHTML('beforeend',
  '<div class="tileCard"><b>🏭 出版産業</b>'+
  '<div class="note">製紙工房：木10＋石5／印刷所：木14＋石8。建物はマップ上で場所を選んで配置します。</div>'+
  '<button class="smallBtn" data-fw52="build" data-site="paper_mill">🌿 製紙工房を建てる</button> '+
  '<button class="smallBtn" data-fw52="build" data-site="printing_house">📚 印刷所を建てる</button> '+
  '<button class="smallBtn" data-fw52="manage">⚙️ 出版業・NPC配置</button></div>');
};
const previousDraw=bridge.drawBuilding;
bridge.drawBuilding=function(b){
 if(!b||!sites[b.type])return previousDraw.apply(this,arguments);
 const p=bridge.worldToScreen(b.x,b.y),drawing=bridge.getDrawingPublication52(),ctx=drawing.ctx,T=drawing.tile;
 const paper=b.type==='paper_mill';
 ctx.save();
 ctx.fillStyle=paper?'#b4c8af':'#c8b08b';ctx.fillRect(p.x+.15*T,p.y+.2*T,T*1.7,T*1.55);
 ctx.strokeStyle='#594735';ctx.lineWidth=3;ctx.strokeRect(p.x+.15*T,p.y+.2*T,T*1.7,T*1.55);
 ctx.fillStyle=paper?'#527c65':'#80634a';
 ctx.beginPath();ctx.moveTo(p.x,p.y+.2*T);ctx.lineTo(p.x+T,p.y-.55*T);ctx.lineTo(p.x+T*2,p.y+.2*T);ctx.closePath();ctx.fill();
 ctx.fillStyle='#453428';ctx.fillRect(p.x+T*.78,p.y+T*.95,T*.45,T*.8);
 ctx.font=(.55*T)+'px system-ui';ctx.textAlign='center';
 ctx.fillText(sites[b.type].icon,p.x+T,p.y+T*.76);
 ctx.font='bold 13px system-ui';ctx.fillStyle='#fff';
 ctx.fillText(paper?'製紙工房':'印刷所',p.x+T,p.y+T*1.96);
 ctx.restore();
};
const previousAction=bridge.action;
bridge.action=function(){
 if(!state.interior&&nearBuilding()){openPanel();return;}
 return previousAction.apply(this,arguments);
};
function openPanel(){
 const p=ensure(),body=$('#panelBody');if(!body)return;
 $('#panel').classList.remove('hidden');$('#panelTitle').textContent='🏭 出版産業・NPC作業管理';
 const staff=workerCandidates(),active=staff.filter(n=>n.publisher52);
 const stock=Object.entries(labels).map(([k,label])=>label+': '+p.stock[k]).join(' ／ ');
 const descriptions={paper:'紙・インク製造',press:'執筆・製本・販売',both:'全工程'};
 body.innerHTML=
 '<div class="tileCard"><b>🏠 設備</b><div class="note">製紙工房 '+buildings('paper_mill').length+'棟／印刷所 '+buildings('printing_house').length+'棟</div>'+
 (buildings('paper_mill').length===0||buildings('printing_house').length===0?'<div class="note">🔨屋外建築から必要な施設を建ててください。</div>':'')+'</div>'+
 '<div class="tileCard"><b>📦 共用材料庫</b><div class="note">'+esc(stock)+'</div>'+
 '<label>材料<select id="fw52Material">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>'+
 '<button class="smallBtn" data-fw52="deposit">所持品から1個入庫</button> '+
 '<button class="smallBtn" data-fw52="withdraw">所持品へ1個出庫</button>'+
 '<div class="note">担当NPCは村の備蓄から木材・水を取り、足りない原料は周辺の採集地点から探します。</div></div>'+
 '<div class="tileCard"><b>👷 担当者の配置</b>'+
 (staff.length?'<label>NPC<select id="fw52Worker">'+staff.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+'</select></label>'+
 '<label>役割<select id="fw52Role"><option value="both">全工程</option><option value="paper">製紙担当</option><option value="press">出版担当</option></select></label>'+
 '<button class="smallBtn" data-fw52="assign">✅ 配置する</button>':'<div class="note">配置できる成人NPCがいません。</div>')+
 active.map(n=>'<div class="note">'+esc(n.name)+'：'+esc(descriptions[n.publisher52.role])+' '+esc(n.status||'')+
 ' <button class="smallBtn" data-fw52="remove" data-id="'+esc(n.id)+'">配置解除</button></div>').join('')+
 '<div class="note">稼働時間：毎日8:00〜18:00。夜間は元の生活行動へ戻ります。</div></div>'+
 '<div class="tileCard"><b>💰 製本と販売</b><div class="note">NPC購入予算 '+p.buyerBudget+'G／本日の販売 '+p.dailySales+'/2冊</div>'+
 '<button class="smallBtn" data-fw52="optin">'+(p.allowPlayerBooks?'✅ 自分の著作物も自動印刷・販売する':'🔒 自分の原稿は自動販売しない')+'</button>'+
 '<div class="note">NPC作品は自動執筆。自分の原稿は明示的に許可するまで対象外。NPC購入はオフラインゲーム内Gのみ。作者へ80％、販売担当へ20％を分配。</div>'+
 (p.works.length?p.works.slice(-15).reverse().map(w=>'<div class="note">📖 '+esc(w.title)+'／著者 '+esc(w.author)+
 '／在庫 '+Number(w.copies||0)+'冊・販売 '+Number(w.sold||0)+'冊 <button class="smallBtn" data-fw52="read" data-id="'+esc(w.id)+'">読む</button></div>').join(''):'<div class="note">村人の書籍はまだありません。</div>')+'</div>'+
 '<div class="tileCard"><b>📋 最近の作業</b>'+
 (p.events.length?p.events.slice(0,10).map(e=>'<div class="note">Day '+e.day+' '+esc(e.worker)+'：'+esc(e.text)+'</div>').join(''):'<div class="note">記録なし</div>')+
 '</div><button class="smallBtn" data-fw52="close">閉じる</button>';
}
function showBook(id){
 const w=ensure().works.find(w=>w.id===id);if(!w)return;
 let modal=$('#fw52BookModal');
 if(!modal){modal=document.createElement('div');modal.id='fw52BookModal';
  modal.style.cssText='position:fixed;inset:0;z-index:300;background:#050608dd;padding:4vh 5vw;display:grid;place-items:center;';
  modal.innerHTML='<div style="background:#f1e7d4;color:#2b2319;width:min(750px,100%);max-height:90vh;overflow:auto;border-radius:12px;padding:22px"><div style="display:flex;justify-content:space-between"><h2 id="fw52BookTitle"></h2><button data-fw52="closeBook">閉じる</button></div><pre id="fw52BookText" style="white-space:pre-wrap;overflow-wrap:anywhere;font:17px/1.9 serif"></pre></div>';
  document.body.appendChild(modal);}
 $('#fw52BookTitle').textContent=w.title+'／'+w.author;
 $('#fw52BookText').textContent=w.body;modal.style.display='grid';
}
document.addEventListener('click',function(event){
 const button=event.target.closest('[data-fw52]');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 const act=button.dataset.fw52,p=ensure(),inv=state.player.inv||{},s=p.stock;
 if(act==='build'){
  const type=button.dataset.site;
  if(!sites[type]||buildings(type).length>=3){notify('この施設はこれ以上建設できません。');return;}
  if(!bridge.buildAffordPublication52(sites[type].cost)){notify('📦 '+sites[type].label+'の建材が不足しています。');return;}
  bridge.startPublicationPlacement52(type);
  notify('🏗️ '+sites[type].label+'を建てたいマップ上の空き地をタップしてください。');return;
 }
 if(act==='manage'){openPanel();return;}
 if(act==='close'){$('#panel').classList.add('hidden');return;}
 if(act==='closeBook'){$('#fw52BookModal').style.display='none';return;}
 if(act==='read'){showBook(button.dataset.id);return;}
 if(act==='deposit'||act==='withdraw'){
  const k=$('#fw52Material')&&$('#fw52Material').value;
  if(!labels[k])return;
  const from=act==='deposit'?inv:s,to=act==='deposit'?s:inv;
  if(Number(from[k]||0)<1){notify('📦 '+labels[k]+'が足りません。');return;}
  from[k]--;to[k]=(Number(to[k])||0)+1;save();openPanel();return;
 }
 if(act==='optin'){p.allowPlayerBooks=!p.allowPlayerBooks;save();openPanel();return;}
 if(act==='assign'){
  const n=workerCandidates().find(n=>n.id===$('#fw52Worker').value),role=$('#fw52Role').value;
  if(!n||!['paper','press','both'].includes(role))return;
  if((role==='paper'||role==='both')&&!buildings('paper_mill').length||
     (role==='press'||role==='both')&&!buildings('printing_house').length){
   notify('🏭 選んだ業務の建物がまだありません。');return;
  }
  n.publisher52={role:role,nextAt:0,lastWritingDay:-1};
  n.task=null;log('assignment',n.name+'を'+role+'担当に配置',n);save();openPanel();return;
 }
 if(act==='remove'){
  const n=state.npcs.find(n=>n.id===button.dataset.id);
  if(n){delete n.publisher52;delete n.publicationTrip52;log('assignment',n.name+'の配置を解除',n);}
  save();openPanel();
 }
},true);
function tickDemand(){
 const p=ensure(),day=Number(state.day)||0;
 if(day<=p.lastBudgetDay)return;
 const diff=Math.min(30,day-p.lastBudgetDay);
 p.buyerBudget=Math.min(80,p.buyerBudget+diff*20);
 p.lastBudgetDay=day;p.dailySales=0;save();
}
function acquire(n,site,dt){
 const p=ensure(),s=p.stock;
 if(n.publicationTrip52){
  const trip=n.publicationTrip52;
  const obj=state.objects.find(o=>o.gather===trip.kind&&o.x===trip.x&&o.y===trip.y);
  if(!obj){delete n.publicationTrip52;return true;}
  const d=Math.hypot(n.x-obj.x,n.y-obj.y);
  if(d>1.35){
   n.tx=obj.x;n.ty=obj.y;n.status='🧺 '+labels[trip.kind]+'を採集中';
   bridge.moveNpcPublication52(n,dt);return true;
  }
  s[trip.kind]++;state.objects=state.objects.filter(o=>o!==obj);
  delete n.publicationTrip52;log('gather',n.name+'が'+labels[trip.kind]+'を採集',n);save();return true;
 }
 for(const k of ['water','wood','fiber']){
  if(s[k]>=(k==='water'?5:k==='wood'?3:2))continue;
  const reserve=k==='fiber'?0:3,available=Math.max(0,(Number(state.camp[k])||0)-reserve);
  if(available>0){
   const take=Math.min(available,6);
   state.camp[k]-=take;s[k]+=take;
   log('supply',n.name+'が村の備蓄から'+labels[k]+' '+take+'を搬入',n);save();return true;
  }
  const nearby=state.objects.filter(o=>o.gather===k&&Math.hypot(o.x-site.x,o.y-site.y)<18)
    .sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y))[0];
  if(nearby){n.publicationTrip52={kind:k,x:nearby.x,y:nearby.y};return true;}
 }
 return false;
}
function craft(n,site,dt){
 const s=ensure().stock;
 if(acquire(n,site,dt))return true;
 const consume=(cost,out,qty,title)=>{
  Object.entries(cost).forEach(([k,num])=>s[k]-=num);
  s[out]+=qty;log('craft',n.name+'が'+title+'を'+qty+'個作成',n);save();return true;
 };
 if(s.paper<12){
  if(s.fiber>=2&&s.water>=1)return consume({fiber:2,water:1},'paper',4,'草紙');
  if(s.wood>=1&&s.water>=2)return consume({wood:1,water:2},'paper',6,'木紙');
 }
 if(s.ink<8){
  if(s.soot>=1&&s.water>=1)return consume({soot:1,water:1},'ink',4,'インク');
  if(s.wood>=1)return consume({wood:1},'soot',2,'煤');
 }
 n.status='📦 製紙原料待ち';return false;
}
const topics=[
 ['村の記録','森で集めた木や草が紙や家の材料になっている。暮らしを支える人の仕事をここに記す。'],
 ['畑の観察','畑では水と光が欠かせない。収穫を急がず、作物の色と土の状態を確かめたい。'],
 ['旅人への手紙','この村にたどり着いた人へ。まず井戸のそばで休み、広場で誰かに挨拶してみよう。'],
 ['職人の日誌','木の繊維を水に浸して薄くすき、乾いた紙を重ねると、記録の本が生まれる。'],
 ['市場の便り','紙があれば本が作れる。本があれば知識が伝わる。商いは働く人と人をつなぐ。']
];
function allWorks(){
 const p=ensure();
 const own=p.allowPlayerBooks?(state.player.authoredBooks||[]).filter(w=>w&&typeof w.body==='string'&&w.body&&w.type!=='advertisement'):[];
 return own.concat(p.works);
}
function price(w){return Math.max(6,Math.min(24,Math.floor(String(w.body||'').length/70)+5));}
function press(n){
 const p=ensure(),s=p.stock,day=Number(state.day)||0,job=n.publisher52;
 if(job.lastWritingDay!==day&&p.works.length<24&&s.paper>=1&&s.ink>=1){
  const [subject,paragraph]=topics[(day+p.works.length)%topics.length];
  const title=subject+' 第'+(p.works.length+1)+'号';
  const body='【'+title+'】\n\n執筆者：'+n.name+'\n村の日付：'+day+'日\n\n'+paragraph+
   '\n\n村の共通備蓄は木 '+(Number(state.camp.wood)||0)+'、水 '+(Number(state.camp.water)||0)+'。明日も村の記録を残そう。';
  s.paper--;s.ink--;job.lastWritingDay=day;
  p.works.push({id:'fw52_work_'+(++p.seq),type:'book',title:title,name:title,author:n.name,authorId:n.id,body:body,copies:0,sold:0,createdDay:day,npcGenerated:true});
  if(n.education47)n.education47.reading=Math.min(100,(Number(n.education47.reading)||0)+.2);
  log('writing',n.name+'が『'+title+'』を執筆',n);save();return true;
 }
 const books=allWorks();
 const sale=books.find(w=>Number(w.copies||0)>0&&price(w)<=p.buyerBudget&&p.dailySales<2);
 if(sale){
  const gross=price(sale),royalty=Math.floor(gross*.8),commission=gross-royalty;
  p.buyerBudget-=gross;p.dailySales++;
  sale.copies--;sale.sold=(Number(sale.sold)||0)+1;
  if(sale.npcGenerated){
   const author=state.npcs.find(actor=>actor.id===sale.authorId);
   if(author)author.coins=(Number(author.coins)||0)+royalty;
  }else state.player.coins=(Number(state.player.coins)||0)+royalty;
  n.coins=(Number(n.coins)||0)+commission;
  p.sales.unshift({day:day,title:sale.title,workId:sale.id,gross:gross,royalty:royalty,workerId:n.id});
  p.sales.length=Math.min(p.sales.length,60);
  log('sale','『'+sale.title+'』を'+gross+'Gで販売、作者へ'+royalty+'G',n);save();return true;
 }
 const todo=books.find(w=>w&&w.body&&Number(w.copies||0)<1);
 if(todo){
  const pages=Math.max(1,Math.ceil(String(todo.body).length/420)),ink=Math.ceil(pages/2),paper=Math.min(pages,s.paper);
  if(paper+s.parchment>=pages&&s.ink>=ink){
   s.paper-=paper;s.parchment-=pages-paper;s.ink-=ink;
   todo.copies=(Number(todo.copies)||0)+1;
   log('print',n.name+'が『'+todo.title+'』を'+pages+'頁で製本',n);save();return true;
  }
  n.status='📦 製本用紙・インク不足';return false;
 }
 n.status='📚 需要・原稿待ち';return false;
}
const previousNpc=bridge.updateNPC;
bridge.updateNPC=function(n,dt){
 const job=n&&n.publisher52;
 if(!job||n.alive===false||n.controlled||state.gameOver||state.hour<8||state.hour>=18||n.walkPrevious43)
  return previousNpc.apply(this,arguments);
 const p=ensure(),mill=buildings('paper_mill')[0],printer=buildings('printing_house')[0];
 const paper=job.role==='paper'||job.role==='both'&&(p.stock.paper<7||p.stock.ink<4);
 const site=(paper?mill:printer)||(job.role==='both'?(mill||printer):null);
 if(!site){n.status='🏭 担当施設なし';return previousNpc.apply(this,arguments);}
 if(n.inside20){return previousNpc.apply(this,arguments);}
 if(n.publicationTrip52){acquire(n,site,dt);return;}
 const x=site.x+1,y=site.y+2.55,d=Math.hypot(n.x-x,n.y-y);
 if(d>1.25){n.tx=x;n.ty=y;n.status=paper?'🌿 製紙工房へ移動':'📚 印刷所へ移動';bridge.moveNpcPublication52(n,dt);return;}
 n.status=paper?'🧻 製紙・インク製造':'📖 執筆・製本・販売';
 n.st=Math.max(10,(Number(n.st)||75)-dt*.06);
 if(clock()<(Number(job.nextAt)||0))return;
 tickDemand();
 if(paper)craft(n,site,dt);
 else press(n);
 job.nextAt=clock()+.33;
};
const previousLoad=bridge.fw10LoadGame;
bridge.fw10LoadGame=function(){const out=previousLoad.apply(this,arguments);ensure();return out;};
const previousActionUpdate=bridge.openInventory;
bridge.openInventory=function(){const out=previousActionUpdate.apply(this,arguments);const body=$('#panelBody');
 if(body&&!body.querySelector('[data-fw52="manage"]'))body.insertAdjacentHTML('beforeend',
 '<button class="smallBtn" data-fw52="manage">🏭 出版業・NPC管理</button>');
 return out;
};
ensure();
console.info('[FW52] publishing industry ready');
})();