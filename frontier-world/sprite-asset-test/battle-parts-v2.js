/* Frontier World independent vector body parts and frame-keyed battle motion V2 */
(function(G){"use strict";
const keys=["body","head","rShoulder","rElbow","rWrist","lShoulder","lElbow","lWrist","rHip","rKnee","rAnkle","lHip","lKnee","lAnkle","rootX","rootY","weapon"];
const names={body:"腰・胴",head:"首",rShoulder:"右肩",rElbow:"右肘",rWrist:"右手",lShoulder:"左肩",lElbow:"左肘",lWrist:"左手",rHip:"右股関節",rKnee:"右膝",rAnkle:"右足",lHip:"左股関節",lKnee:"左膝",lAnkle:"左足",rootX:"前後移動",rootY:"上下移動",weapon:"剣の角度"};
const neutral={body:0,head:0,rShoulder:-12,rElbow:12,rWrist:0,lShoulder:14,lElbow:-12,lWrist:0,rHip:-4,rKnee:4,rAnkle:0,lHip:4,lKnee:-4,lAnkle:0,rootX:0,rootY:0,weapon:0};
const actions=["slash","thrust","axe","bow","combo","block","dodge","hit","fall","victory"];
const parts=["cape","rearUpper","rearLower","rearHand","rearThigh","rearShin","rearFoot","torso","waist","head","frontUpper","frontLower","frontHand","frontThigh","frontShin","frontFoot","sword","shield"];
const cap=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const fix=p=>Object.fromEntries(keys.map(k=>[k,cap(Number(p&&p[k]!==undefined?p[k]:neutral[k]),k.startsWith("root")?-100:-180,k.startsWith("root")?100:180)]));
const K=(i,p)=>[i,p];
const guides={
 slash:[K(1,{body:-15,rShoulder:-75,rElbow:-30}),K(2,{body:-25,rShoulder:-138,rElbow:-48,rHip:-24,rootY:-9}),K(3,{body:12,rShoulder:-105,rHip:24,lHip:-22,rootX:8}),K(4,{body:26,rShoulder:78,rElbow:34,rootX:18,rHip:30}),K(5,{body:18,rShoulder:95,rElbow:12,rootX:20}),K(6,{body:7,rShoulder:28,rootX:6})],
 thrust:[K(1,{body:-15,rShoulder:-55,rElbow:-45}),K(2,{body:-21,rShoulder:-89,rElbow:-72,rootX:-8}),K(3,{body:21,rShoulder:-96,rElbow:-85,rHip:33,lHip:-24,rootX:18}),K(4,{body:23,rShoulder:-102,rElbow:-85,rootX:22}),K(5,{body:9,rShoulder:-54,rootX:11})],
 axe:[K(1,{body:-18,rShoulder:-80,lShoulder:-43}),K(2,{body:-28,rShoulder:-146,rElbow:-48,lShoulder:-100,rootY:-8}),K(3,{body:-30,rShoulder:-154,lShoulder:-102,rootY:-9}),K(4,{body:31,rShoulder:95,rElbow:43,lShoulder:13,rHip:34,rootX:17,rootY:9}),K(5,{body:27,rShoulder:99,rootX:17})],
 bow:[K(1,{rShoulder:-57,rElbow:-47,lShoulder:-38,lElbow:-69}),K(2,{body:-7,rShoulder:-82,rElbow:-88,lShoulder:-54,lElbow:-100}),K(3,{body:-7,rShoulder:-82,rElbow:-98,lShoulder:-54,lElbow:-105}),K(4,{body:-7,rShoulder:-82,rElbow:-98,lShoulder:-54,lElbow:-105}),K(5,{body:8,rShoulder:-37,rElbow:-21,lShoulder:-30,lElbow:-17})],
 combo:[K(1,{body:-17,rShoulder:-130}),K(2,{body:23,rShoulder:70,rHip:26,rootX:14}),K(3,{body:-20,rShoulder:-120,rootX:11}),K(4,{body:28,rShoulder:90,rootX:22}),K(5,{body:-24,rShoulder:-140,rootX:14}),K(6,{body:34,rShoulder:106,rHip:36,rootX:32})],
 block:[K(1,{body:-14,lShoulder:-85,lElbow:-45,rHip:20,rKnee:-29}),K(2,{body:-18,lShoulder:-120,lElbow:-52,rHip:27,rootY:10}),K(3,{body:-26,lShoulder:-120,rHip:29,rootY:14}),K(4,{body:-16,lShoulder:-111,rHip:25,rootY:9}),K(5,{body:-11,lShoulder:-92,rHip:16})],
 dodge:[K(1,{body:-15,rShoulder:33,rHip:19,rootY:7}),K(2,{body:-33,rShoulder:80,lShoulder:-75,rHip:-55,rKnee:67,lHip:53,lKnee:-50,rootX:-24,rootY:-24}),K(3,{body:-34,rShoulder:85,lShoulder:-67,rHip:-55,rKnee:65,lHip:60,lKnee:-48,rootX:-39,rootY:-36}),K(4,{body:-25,rShoulder:51,rootX:-28,rootY:-15})],
 hit:[K(1,{body:-15,head:12,rShoulder:25}),K(2,{body:-31,head:15,rShoulder:50,lShoulder:-61,rootX:-14,rootY:9}),K(3,{body:-36,head:18,rShoulder:53,lShoulder:-69,rootX:-22,rootY:12}),K(4,{body:-24,head:10,rootX:-14})],
 fall:[K(1,{body:-22,rShoulder:49}),K(2,{body:-46,rShoulder:69,rHip:27,rootY:19}),K(3,{body:-72,rShoulder:91,rHip:66,lHip:-59,rootY:38}),K(4,{body:-88,rShoulder:95,rHip:78,lHip:-74,rootY:51}),K(5,{body:-88,rShoulder:95,rHip:78,lHip:-74,rootY:51}),K(6,{body:-88,rShoulder:95,rHip:78,lHip:-74,rootY:51}),K(7,{body:-88,rShoulder:95,rHip:78,lHip:-74,rootY:51})],
 victory:[K(1,{body:-7,rShoulder:-85,lShoulder:-60,rootY:-7}),K(2,{body:-12,rShoulder:-154,lShoulder:-137,rootY:-27}),K(3,{body:7,rShoulder:-146,lShoulder:-130}),K(4,{body:-9,rShoulder:-154,lShoulder:-138,rootY:-24}),K(5,{body:3,rShoulder:-142,lShoulder:-120})]
};
const defaults=a=>Array.from({length:8},(_,i)=>({...neutral,...((guides[a]||[]).find(v=>v[0]===i)||[0,{}])[1]}));
const valid=f=>{if(!Array.isArray(f)||f.length<2||f.length>48)throw Error("2〜48コマの配列が必要です");return f.map(fix)};
const key=(id,dir,a)=>[String(id||"girl1").replace(/[^\w-]/g,"").slice(0,60),["front","back","left","right"].includes(dir)?dir:"front",actions.includes(a)?a:"slash"].join("/");
const store="frontierWorldBattleFramesV2";let state;
function read(){if(state)return state;try{const d=JSON.parse(localStorage.getItem(store)||"{}");state=d&&d.version===2&&d.motions?d:{version:2,motions:{}}}catch(e){state={version:2,motions:{}}}return state}
function get(id,dir,a){const v=read().motions[key(id,dir,a)];return v?valid(v):defaults(a)}
function set(id,dir,a,frames){read().motions[key(id,dir,a)]=valid(frames);try{localStorage.setItem(store,JSON.stringify(state));return true}catch(e){return false}}
function reset(id,dir,a){delete read().motions[key(id,dir,a)];try{localStorage.setItem(store,JSON.stringify(state))}catch(e){}}
function importJSON(raw){const d=typeof raw==="string"?JSON.parse(raw):raw;if(!d||d.version!==2||typeof d.motions!=="object"||!d.motions)throw Error("データ形式が異なります");const items=Object.entries(d.motions);if(items.length>200)throw Error("モーション数の上限です");const x={version:2,motions:{}};for(const [k,v] of items){if(!/^[\w-]{1,60}\/(front|back|left|right)\/(slash|thrust|axe|bow|combo|block|dodge|hit|fall|victory)$/.test(k))throw Error("不正なキー");x.motions[k]=valid(v)}const old=state;state=x;try{localStorage.setItem(store,JSON.stringify(x));return items.length}catch(e){state=old;throw e}}
function sample(id,dir,a,t){const f=get(id,dir,a),v=cap(Number(t)||0,0,1)*(f.length-1),i=Math.min(f.length-2,Math.floor(v));return Object.fromEntries(keys.map(k=>[k,f[i][k]+(f[i+1][k]-f[i][k])*(v-i)]))}
const colors={girl1:["#966644","#f0c49e","#466d57","#745147","#d8c38c","#7e4244"],boy2:["#655042","#f5c8a7","#537b52","#ad713b","#d7b47a","#52735e"],knight:["#e0bb82","#f2d0b7","#466ba7","#667ea5","#f5cf80","#305195"]};
const col=id=>colors[id]||colors.knight;
function poly(c,color,pts,line="#483d3b"){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=color;c.fill();c.lineWidth=2;c.strokeStyle=line;c.stroke()}
function oval(c,x,y,rx,ry,color,line="#483d3b"){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();c.lineWidth=2;c.strokeStyle=line;c.stroke()}
function stroke(c,coords,color,w=3){c.beginPath();coords.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineCap="round";c.lineWidth=w;c.stroke()}
function piece(c,p,id,dir){const [hair,skin,coat,boots,trim,cape]=col(id);
 switch(p){
 case "cape":poly(c,cape,[[-36,-84],[32,-84],[51,9],[36,44],[-40,43],[-53,11]]);stroke(c,[[-41,34],[35,34]],trim,2);break;
 case "torso":poly(c,coat,[[-34,-91],[36,-91],[45,-68],[37,-20],[25,4],[-23,4],[-40,-20],[-44,-65]]);poly(c,"#efe5ca",[[-18,-88],[18,-88],[23,-21],[-23,-21]]);stroke(c,[[-35,-34],[34,-34]],trim,5);break;
 case "waist":poly(c,coat,[[-29,-9],[30,-9],[38,24],[8,29],[-9,29],[-39,24]]);stroke(c,[[-27,-7],[27,-7]],trim,5);break;
 case "head":
 oval(c,0,-40,54,54,hair);
 if(dir!=="back"){oval(c,0,-28,43,43,skin);oval(c,-18,-31,7,9,boots);oval(c,18,-31,7,9,boots);oval(c,-17,-33,2,3,"white");oval(c,19,-33,2,3,"white");stroke(c,[[-6,-8],[0,-6],[6,-8]],"#995f5b",2);}
 poly(c,hair,[[-49,-58],[-44,-88],[-13,-107],[31,-100],[52,-70],[39,-51],[29,-68],[8,-70],[-8,-60],[-28,-68],[-37,-47]]);
 oval(c,45,-40,9,8,trim);break;
 case "frontUpper":case "rearUpper":poly(c,coat,[[-17,-8],[17,-8],[20,30],[11,46],[-11,46],[-21,30]]);stroke(c,[[-17,30],[17,30]],trim,3);break;
 case "frontLower":case "rearLower":poly(c,trim,[[-12,-5],[12,-5],[17,39],[8,49],[-10,49],[-17,39]]);poly(c,coat,[[-13,-5],[13,-5],[14,9],[-14,9]]);break;
 case "frontHand":case "rearHand":oval(c,0,8,12,16,skin);break;
 case "frontThigh":case "rearThigh":poly(c,boots,[[-18,-5],[18,-5],[21,45],[14,51],[-17,51],[-21,42]]);stroke(c,[[-13,43],[15,43]],trim,3);break;
 case "frontShin":case "rearShin":poly(c,boots,[[-15,-6],[15,-6],[18,46],[11,52],[-14,52],[-18,44]]);stroke(c,[[-15,6],[15,6]],trim,4);break;
 case "frontFoot":case "rearFoot":oval(c,1,0,22,12,boots);stroke(c,[[-17,7],[18,7]],trim,3);break;
 case "sword":poly(c,"#d8e8f4",[[-7,7],[-7,-99],[0,-124],[8,-99],[7,7]],"#607589");stroke(c,[[-23,7],[23,7]],trim,7);stroke(c,[[0,8],[0,38]],boots,7);break;
 case "shield":poly(c,coat,[[-38,-57],[38,-57],[39,0],[0,52],[-39,0]],trim);stroke(c,[[0,-39],[0,28]],trim,7);stroke(c,[[-24,-14],[24,-14]],trim,6);break;
 }}
const rotate=(p,a)=>[p[0]*Math.cos(a*Math.PI/180)-p[1]*Math.sin(a*Math.PI/180),p[0]*Math.sin(a*Math.PI/180)+p[1]*Math.cos(a*Math.PI/180)];
const plus=(a,b)=>[a[0]+b[0],a[1]+b[1]];
function points(p){p=fix(p);const o=[128+p.rootX,214+p.rootY],r={body:o,root:o,neck:plus(o,rotate([0,-98],p.body))};
 for(const [side,x] of [["r",36],["l",-36]]){
  const a=plus(o,rotate([x,-80],p.body)),v=p.body+p[side+"Shoulder"];
  r[side+"Shoulder"]=a;r[side+"Elbow"]=plus(a,rotate([0,45],v));r[side+"Wrist"]=plus(r[side+"Elbow"],rotate([0,43],v+p[side+"Elbow"]));
  r[side+"Hip"]=plus(o,[side==="r"?22:-22,0]);r[side+"Knee"]=plus(r[side+"Hip"],rotate([0,48],p[side+"Hip"]));
  r[side+"Ankle"]=plus(r[side+"Knee"],rotate([0,46],p[side+"Hip"]+p[side+"Knee"]));
 }return r}
function render(c,x,y,w,h,opts={}){
 if(!c||!(w>0)||!(h>0))return false;
 const id=opts.characterId||"girl1",dir=opts.direction||"front",a=actions.includes(opts.action)?opts.action:"slash",p=fix(opts.pose||sample(id,dir,a,opts.progress||0));
 c.save();
 try{
 c.translate(x,y);c.scale((dir==="left"?-1:1)*w/256,h/324);
 c.translate(-128,-314);c.translate(128+p.rootX,214+p.rootY);
 const draw=(name,xy,deg,children)=>{
  c.save();c.translate(...xy);c.rotate(deg*Math.PI/180);
  if(name)piece(c,name,id,dir);
  if(children)children();c.restore();
 };
 const leg=(s,xv)=>{
  const v=s==="l"?"rear":"front";
  draw(null,[xv,0],p[s+"Hip"],()=>{
   piece(c,v+"Thigh",id,dir);
   draw(null,[0,48],p[s+"Knee"],()=>{
    piece(c,v+"Shin",id,dir);draw(v+"Foot",[0,46],p[s+"Ankle"]);
   });
  });
 };
 leg("l",-22);leg("r",22);
 draw(null,[0,0],p.body,()=>{
  piece(c,"cape",id,dir);
  function arm(s,xv){
   const v=s==="l"?"rear":"front";
   draw(null,[xv,-80],p[s+"Shoulder"],()=>{
    piece(c,v+"Upper",id,dir);
    draw(null,[0,45],p[s+"Elbow"],()=>{
     piece(c,v+"Lower",id,dir);
     draw(null,[0,43],p[s+"Wrist"],()=>{
      piece(c,v+"Hand",id,dir);
      if(s==="r"&&["slash","thrust","axe","combo","victory"].includes(a))draw("sword",[2,12],p.weapon);
      if(s==="l"&&a==="block")draw("shield",[3,25],0);
      if(s==="r"&&a==="bow"){stroke(c,[[19,-52],[44,0],[19,52]],col(id)[4],6);stroke(c,[[19,-52],[-14,0],[19,52]],"#fff8da",2);}
     });
    });
   });
  }
  arm("l",-36);piece(c,"torso",id,dir);piece(c,"waist",id,dir);
  draw("head",[0,-98],p.head);arm("r",36);
 });
 if(opts.guides){
  const ps=points(p);c.save();c.translate(-(128+p.rootX),-(214+p.rootY));
  for(const [key,v] of Object.entries(ps)){if(key==="root")continue;c.beginPath();c.arc(...v,5,0,Math.PI*2);c.fillStyle=key.startsWith("r")?"#f58170":key.startsWith("l")?"#79e2ff":"#80f1a8";c.fill();c.lineWidth=2;c.strokeStyle="#243e4b";c.stroke();}
  c.restore();
 }
 }finally{c.restore()}return true;
}
G.FWBattlePartsV2=Object.freeze({version:"2.0.0",parts,keys,keyNames:names,neutral:()=>({...neutral}),actions,defaults,get,set,reset,fix,sample,points,render,drawPart:piece,exportJSON:()=>JSON.stringify(read(),null,2),importJSON,storageKey:store});
})(window);