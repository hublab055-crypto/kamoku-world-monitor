/* Frontier World Monster Joint Editor MON2
 * Frame-local rig posing. Standalone authoring only; game combat is not modified.
 */
(function () {
"use strict";
var MONS={thief:"盗賊",goblin:"ゴブリン",slime:"スライム"};
var ACTS=["idle","walk","chase","attack","hurt","death"];
var DIRS=["front","left","right","back"],DIRN={front:"正面",left:"左",right:"右",back:"背面"};
var HUM=[
 ["head","頭"],["neck","首"],["shoulderL","左肩"],["elbowL","左肘"],["handL","左手首"],
 ["shoulderR","右肩"],["elbowR","右肘"],["handR","右手首"],
 ["waist","腰"],["hipL","左股関節"],["kneeL","左膝"],["footL","左足首"],["hipR","右股関節"],["kneeR","右膝"],["footR","右足首"]
];
var GEL=[
 ["top","頂点"],["center","中心"],["left","左側面"],["right","右側面"],
 ["baseL","左下"],["baseC","底面中央"],["baseR","右下"]
];
var COLORS=["#ff607e","#edab4a","#e4c45b","#7fd07d","#5be0be","#4ca8de","#b2a0ed","#ff87d3"];
function $(id){return document.getElementById(id)}
var stage=$("stage"),ctx=stage.getContext("2d"),timeline=$("timeline"),tl=timeline.getContext("2d");
if(!ctx||!tl){$("status").textContent="Canvasが利用できません。";return}
var state={monster:"thief",action:"idle",direction:"front",frame:0,count:4,selected:"head",playing:false,frameClock:0,showDots:true,onion:true,guide:true,autoSave:true,refEdit:false};
var storageKey="frontierMonsterPoseEditorV1";
var data={schemaVersion:1,poses:{},count:4}, undo=[],redo=[],refs={},db=null,imageUrl={};
function clone(v){return JSON.parse(JSON.stringify(v))}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function joints(){return state.monster==="slime"?GEL:HUM}
function key(mon,act,dir,frame,count){return [mon,act,dir,count,frame].join(":")}
function currentKey(){return key(state.monster,state.action,state.direction,state.frame,state.count)}
function safeNum(v){return typeof v==="number"&&Number.isFinite(v)&&v>=-200&&v<=400}
function checkPose(p,mon){var defs=(mon==="slime"?GEL:HUM).map(function(x){return x[0]});if(!p||typeof p!=="object")return false;return defs.every(function(k){return Array.isArray(p[k])&&p[k].length===2&&safeNum(p[k][0])&&safeNum(p[k][1])})}
function defaults(mon,act,dir,n,count){
 var p;
 if(mon==="slime"){
   p={top:[100,40],center:[100,125],left:[51,102],right:[149,102],baseL:[39,195],baseC:[100,203],baseR:[161,195]};
   var s=Math.sin(Math.PI*2*n/count),q=Math.max(0,Math.sin(Math.PI*n/Math.max(1,count-1)));
   if(act==="idle"){p.top[1]+=s*5;p.left[0]+=s*3;p.right[0]-=s*3}
   if(act==="walk"||act==="chase"){var fast=act==="chase"?17:10;p.center[0]+=s*fast;p.top[0]+=s*fast;p.top[1]+=Math.abs(s)*-12;p.baseL[0]+=s*7;p.baseR[0]+=s*7}
   if(act==="attack"){p.top[0]+=q*24;p.top[1]+=q*25;p.center[0]+=q*34;p.right[0]+=q*43;p.right[1]-=q*12;p.left[0]+=q*11}
   if(act==="hurt"){p.top[1]+=q*34;p.center[1]+=q*14;p.left[0]-=q*13;p.right[0]+=q*13}
   if(act==="death"){p.top[1]+=q*128;p.center[1]+=q*65;p.left[1]+=q*88;p.right[1]+=q*88;p.baseL[0]-=q*9;p.baseR[0]+=q*9}
 }else{
   p={head:[100,35],neck:[100,57],shoulderL:[78,69],elbowL:[68,107],handL:[64,144],shoulderR:[122,69],elbowR:[136,107],handR:[141,144],waist:[100,128],
      hipL:[87,136],kneeL:[78,175],footL:[71,216],hipR:[113,136],kneeR:[122,175],footR:[132,216]};
   if(mon==="goblin"){p.head[1]=32;p.neck[1]=56;p.shoulderL[0]=72;p.shoulderR[0]=128}
   if(dir==="left"||dir==="right"){
     var side=dir==="right"?1:-1;p.head[0]+=side*8;p.neck[0]+=side*4;
     p.shoulderL[0]+=10;p.shoulderR[0]-=10;p.elbowL[0]+=6;p.elbowR[0]-=6;
     p.hipL[0]+=8;p.hipR[0]-=8;p.kneeL[0]+=5;p.kneeR[0]-=5;
   }
   var wave=Math.sin(2*Math.PI*n/count),fall=Math.max(0,n/Math.max(1,count-1));
   var attack=Math.sin(Math.PI*fall);
   if(act==="idle"){p.head[1]+=wave*1.6;p.shoulderL[1]+=wave*.7;p.shoulderR[1]+=wave*.7}
   if(act==="walk"||act==="chase"){
     var v=act==="chase"?25:14;p.head[1]-=Math.abs(wave)*5;p.waist[1]-=Math.abs(wave)*4;
     p.kneeL[0]+=wave*v;p.kneeR[0]-=wave*v;p.footL[0]+=wave*v*1.3;p.footR[0]-=wave*v*1.3;
     p.footL[1]-=Math.max(0,wave)*16;p.footR[1]-=Math.max(0,-wave)*16;
     p.elbowL[0]-=wave*v*.6;p.elbowR[0]+=wave*v*.6;
     p.handL[0]-=wave*v;p.handR[0]+=wave*v;
   }
   if(act==="attack"){
     p.handR[0]+=attack*30;p.handR[1]-=attack*89;p.elbowR[0]+=attack*29;p.elbowR[1]-=attack*40;
     p.head[0]-=attack*9;p.waist[0]+=attack*10;p.kneeL[0]-=attack*12;p.footL[0]-=attack*13;
   }
   if(act==="hurt"){p.head[0]-=attack*24;p.neck[0]-=attack*12;p.waist[0]-=attack*9;p.handL[0]-=attack*13;p.handR[0]+=attack*18}
   if(act==="death"){
      Object.keys(p).forEach(function(k){var a=p[k];a[0]+=(a[1]<138?-46:6)*fall;a[1]+=(204-a[1])*fall*.89});
      p.head[0]-=17*fall;p.handL[0]-=28*fall;
   }
 }
 return p;
}
function pose(mon,act,dir,n,count){
 var k=key(mon,act,dir,n,count);
 return data.poses[k]?clone(data.poses[k]):defaults(mon,act,dir,n,count);
}
function get(){return pose(state.monster,state.action,state.direction,state.frame,state.count)}
function pushHistory(){undo.push({key:currentKey(),previous:data.poses[currentKey()]?clone(data.poses[currentKey()]):null});if(undo.length>100)undo.shift();redo=[]}
function restoreEntry(entry,other){
 var now=data.poses[entry.key]?clone(data.poses[entry.key]):null;
 other.push({key:entry.key,previous:now});
 if(entry.previous)data.poses[entry.key]=clone(entry.previous);else delete data.poses[entry.key];
 save();draw();updateInspector();
}
function save(){data.count=state.count;if(!state.autoSave)return;try{localStorage.setItem(storageKey,JSON.stringify(data));show("この端末に自動保存しました。")}catch(e){show("自動保存が使えません。JSON保存をご利用ください。",true)}}
function show(s,err){var el=$("status");el.textContent=s;el.classList.toggle("error",!!err)}
function setPose(p){if(!checkPose(p,state.monster))return;data.poses[currentKey()]=clone(p);save();draw();updateInspector()}
function title(){return MONS[state.monster]+" / "+$("action").selectedOptions[0].text+" / "+DIRN[state.direction]+" / "+(state.frame+1)+"/"+state.count+"コマ"}
function rgba(c,a){return c}
function line(c,a,b,w,col){
 c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineWidth=w;c.lineCap="round";c.strokeStyle=col;c.stroke();
}
function poly(c,pts,color,edge){
 c.beginPath();c.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(function(p){c.lineTo(p[0],p[1])});c.closePath();c.fillStyle=color;c.fill();
 if(edge){c.strokeStyle=edge;c.lineWidth=2.3;c.lineJoin="round";c.stroke()}
}
function ellipse(c,x,y,rx,ry,fill,stroke,angle){
 c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),angle||0,0,Math.PI*2);c.fillStyle=fill;c.fill();
 if(stroke){c.lineWidth=2;c.strokeStyle=stroke;c.stroke()}
}
function grad(c,x,y,rx,ry,colors){
 var g=c.createRadialGradient(x-rx*.35,y-ry*.48,2,x,y,Math.max(rx,ry)*1.22);
 g.addColorStop(0,colors[0]);g.addColorStop(.52,colors[1]);g.addColorStop(1,colors[2]);return g;
}
function creature(c,mon,p,dir){
 var human=mon!=="slime",back=dir==="back",side=dir==="left"||dir==="right";
 c.save();
 ellipse(c,104,222,55,7,"#171d2445");
 if(!human){
   var top=p.top,left=p.left,right=p.right,a=p.baseL,b=p.baseR,z=p.baseC,mid=p.center;
   c.beginPath();c.moveTo(a[0],a[1]);c.bezierCurveTo(left[0]-8,left[1]+18,left[0]+5,left[1]-34,top[0],top[1]);
   c.bezierCurveTo(right[0]-7,right[1]-38,right[0]+12,right[1]+5,b[0],b[1]);
   c.quadraticCurveTo(z[0],z[1]+11,a[0],a[1]);c.closePath();
   var fill=c.createLinearGradient(top[0]-35,top[1],b[0]+40,b[1]);
   fill.addColorStop(0,"#b4f8ff");fill.addColorStop(.28,"#68ccef");fill.addColorStop(.75,"#2479c6");fill.addColorStop(1,"#12458a");
   c.fillStyle=fill;c.fill();c.strokeStyle="#144b94";c.lineWidth=3;c.stroke();
   ellipse(c,mid[0]-25,mid[1]-34,14,29,"#d3ffffa0",null,-.55);ellipse(c,mid[0]-35,mid[1]-4,8,5,"#d1ffff82");
   ellipse(c,mid[0]+24,mid[1]+35,18,10,"#144a9690");
   if(!back){
     ellipse(c,mid[0]-19,mid[1]+13,5,10,"#10295a");
     if(!side)ellipse(c,mid[0]+20,mid[1]+13,5,10,"#10295a");
     ellipse(c,mid[0]-20,mid[1]+10,1.7,3,"#fff");if(!side)ellipse(c,mid[0]+18,mid[1]+10,1.7,3,"#fff");
   }
   ellipse(c,a[0]+10,a[1],10,3,"#99effb70");ellipse(c,b[0]-8,b[1],10,3,"#99effb70");
 }else{
   var gob=mon==="goblin";
   var skin=gob?"#839f43":"#ae875f",skinD=gob?"#415a30":"#5c4736",cloth=gob?"#78502f":"#423946";
   var shoulderL=p.shoulderL,shoulderR=p.shoulderR,waist=p.waist;
   if(!gob){
     poly(c,[[shoulderL[0]-11,shoulderL[1]-8],[shoulderR[0]+11,shoulderR[1]-12],[waist[0]+32,waist[1]+58],[waist[0]-32,waist[1]+63]],"#373544","#211e2f");
     poly(c,[[shoulderL[0]-13,shoulderL[1]+5],[waist[0]-18,waist[1]],[waist[0]-33,waist[1]+61],[waist[0]-50,waist[1]+31]],"#33303d","#1e1c2c");
   }
   [["hipL","kneeL","footL"],["hipR","kneeR","footR"]].forEach(function(keys,idx){
     line(c,p[keys[0]],p[keys[1]],gob?16:21,cloth);line(c,p[keys[1]],p[keys[2]],gob?14:20,gob?"#657737":"#493b36");
     ellipse(c,p[keys[2]][0]+(idx?5:-5),p[keys[2]][1],gob?15:18,7,gob?skinD:"#49392f","#242126");
     ellipse(c,p[keys[1]][0],p[keys[1]][1],7,8,gob?"#657f37":"#765c43","#3d3333");
   });
   poly(c,[[shoulderL[0]-11,shoulderL[1]],[shoulderR[0]+11,shoulderR[1]],[waist[0]+22,waist[1]+23],[waist[0]-19,waist[1]+20]],cloth,"#332b2b");
   if(gob){
     poly(c,[[waist[0]-17,waist[1]+3],[waist[0]+18,waist[1]+3],[waist[0]+8,waist[1]+43],[waist[0]-13,waist[1]+39]],"#8a5d32","#46352b");
   }else{
     line(c,[waist[0]-17,waist[1]],[waist[0]+17,waist[1]],7,"#b99055");
     poly(c,[[waist[0]-10,waist[1]-8],[waist[0]+7,waist[1]-13],[waist[0]+28,waist[1]-50],[waist[0]+16,waist[1]-59]],"#a27b53");
   }
   [["shoulderL","elbowL","handL"],["shoulderR","elbowR","handR"]].forEach(function(keys){
     line(c,p[keys[0]],p[keys[1]],gob?17:20,gob?skin:"#48404b");
     line(c,p[keys[1]],p[keys[2]],gob?14:16,gob?skin:"#695044");
     ellipse(c,p[keys[2]][0],p[keys[2]][1],gob?8:9,9,skin,skinD);
   });
   if(gob){
     if(!side){poly(c,[[p.head[0]-14,p.head[1]+8],[p.head[0]-48,p.head[1]-2],[p.head[0]-29,p.head[1]+24]],skin,skinD);
     poly(c,[[p.head[0]+14,p.head[1]+8],[p.head[0]+50,p.head[1]-2],[p.head[0]+30,p.head[1]+25]],skin,skinD);}
     else{poly(c,[[p.head[0]-8,p.head[1]+12],[p.head[0]-37,p.head[1]-2],[p.head[0]-19,p.head[1]+25]],skin,skinD)}
     ellipse(c,p.head[0],p.head[1],30,27,grad(c,p.head[0],p.head[1],30,27,["#c2d976","#86a347","#4d6836"]),skinD);
     if(!back){
       ellipse(c,p.head[0]-(side?0:13),p.head[1]-1,7,5,"#eac06d","#504b2b");
       if(!side)ellipse(c,p.head[0]+13,p.head[1]-1,7,5,"#eac06d","#504b2b");
       poly(c,[[p.head[0]-10,p.head[1]+14],[p.head[0]+13,p.head[1]+14],[p.head[0]+7,p.head[1]+21]],"#553c2a");
       ellipse(c,p.head[0],p.head[1]+12,9,6,"#78933b");
     }
   }else{
     poly(c,[[p.head[0]-33,p.head[1]-3],[p.head[0]-19,p.head[1]-34],[p.head[0]+7,p.head[1]-43],[p.head[0]+34,p.head[1]-9],[p.head[0]+21,p.head[1]+25],[p.head[0]-25,p.head[1]+23]],"#35313e","#221e2d");
     if(!back){
       poly(c,[[p.head[0]-20,p.head[1]+3],[p.head[0]+24,p.head[1]-3],[p.head[0]+15,p.head[1]+19],[p.head[0]-15,p.head[1]+19]],"#17191e");
       ellipse(c,p.head[0]-9,p.head[1]+8,4,2,"#f1cf83");if(!side)ellipse(c,p.head[0]+10,p.head[1]+8,4,2,"#f1cf83");
     }else{poly(c,[[p.head[0]-18,p.head[1]-5],[p.head[0]+16,p.head[1]-6],[p.head[0]+15,p.head[1]+31],[p.head[0]-18,p.head[1]+30]],"#51495c");}
   }
   var hand=p.handR,el=p.elbowR;
   c.save();c.translate(hand[0],hand[1]);
   var ang=Math.atan2(hand[1]-el[1],hand[0]-el[0]);c.rotate(ang);
   if(gob){
     poly(c,[[-1,-6],[24,-9],[32,2],[24,10],[-1,4]],"#875f32","#443422");
     ellipse(c,30,0,11,15,"#9f7743","#503a24");
     [-9,0,9].forEach(function(y){ellipse(c,34,y,2,3,"#453426")});
   }else{
     poly(c,[[0,-4],[16,-4],[44,-18],[42,-7],[16,5],[0,4]],"#b4b0b5","#5b5360");
     line(c,[0,0],[12,0],6,"#533e35");
   }
   c.restore();
 }
 c.restore();
}
function strokeSkeleton(c,mon,p,selected,alpha){
 var con=mon==="slime"?[["top","center"],["center","left"],["center","right"],["left","baseL"],["right","baseR"],["baseL","baseC"],["baseC","baseR"]]:
 [["head","neck"],["neck","shoulderL"],["neck","shoulderR"],["neck","waist"],
 ["shoulderL","elbowL"],["elbowL","handL"],["shoulderR","elbowR"],["elbowR","handR"],
 ["waist","hipL"],["waist","hipR"],["hipL","kneeL"],["kneeL","footL"],["hipR","kneeR"],["kneeR","footR"]];
 c.save();c.globalAlpha=alpha===undefined?1:alpha;
 con.forEach(function(a){line(c,p[a[0]],p[a[1]],1.6,"#3bd3c8")});
 (mon==="slime"?GEL:HUM).forEach(function(a,i){var v=p[a[0]],is=selected===a[0];
 ellipse(c,v[0],v[1],is?7:4.6,is?7:4.6,is?"#fff6ad":COLORS[i%COLORS.length],"#1b252b");
 if(is){c.font="bold 10px sans-serif";c.textAlign="left";c.fillStyle="#ffffff";c.fillText(a[1]+" ("+Math.round(v[0])+","+Math.round(v[1])+")",v[0]+9,v[1]-11)}
 });c.restore();
}
function drawPuppet(c,mon,p,dir,x,y,scale,showDots,selected){
 c.save();c.translate(x,y);c.scale(scale,scale);creature(c,mon,p,dir);
 if(showDots)strokeSkeleton(c,mon,p,selected);
 c.restore();
}
function cropFrame(im){
 var ac=state.action==="chase"?"walk":state.action;
 var m={idle:[341,564],walk:[564,790],attack:[790,1015],hurt:[1015,1220],death:[1220,1445]};
 var rows={front:[125,229],left:[281,385],right:[429,537],back:[583,693]};
 var bounds=m[ac],row=rows[state.direction],f=Math.floor(state.frame*4/state.count);
 var sx=bounds[0]+f*(bounds[1]-bounds[0])/4,sw=(bounds[1]-bounds[0])/4,sy=row[0],sh=row[1]-row[0];
 return [sx*im.naturalWidth/1491,sy*im.naturalHeight/1055,sw*im.naturalWidth/1491,sh*im.naturalHeight/1055];
}
function drawRefArt(c,x,y,w,h,dots){
 var im=refs[state.monster];if(!im)return;
 c.save();c.fillStyle="#f8f0dc";c.fillRect(x-3,y-3,w+6,h+6);
 var cr=cropFrame(im);c.drawImage(im,cr[0],cr[1],cr[2],cr[3],x,y,w,h);
 if(dots){c.translate(x,y);c.scale(w/200,h/220);strokeSkeleton(c,state.monster,get(),state.selected)}
 c.restore();
}
function drawReference(){
 ctx.save();ctx.fillStyle="#30373a";ctx.fillRect(0,0,230,570);
 ctx.fillStyle="#f5e6c9";ctx.font="bold 17px serif";ctx.textAlign="left";ctx.fillText("参考イラスト",17,31);
 ctx.fillStyle="#b9c5bb";ctx.font="12px sans-serif";ctx.fillText(MONS[state.monster]+" / "+DIRN[state.direction],17,51);
 var im=refs[state.monster];
 if(im){
   var ac=state.action==="chase"?"walk":state.action;
   var m={idle:[341,564],walk:[564,790],attack:[790,1015],hurt:[1015,1220],death:[1220,1445]};
   var rows={front:[125,229],left:[281,385],right:[429,537],back:[583,693]};
   var bounds=m[ac],row=rows[state.direction],f=Math.floor(state.frame*4/state.count),sw=(bounds[1]-bounds[0])/4,sx=bounds[0]+f*sw;
   var sy=row[0],sh=row[1]-row[0];
   if(im.naturalWidth!==1491||im.naturalHeight!==1055){
     sx=sx/1491*im.naturalWidth;sw=sw/1491*im.naturalWidth;sy=sy/1055*im.naturalHeight;sh=sh/1055*im.naturalHeight;
   }
   ctx.fillStyle="#f4e8cb";ctx.fillRect(13,69,203,365);
   ctx.imageSmoothingEnabled=true;
   ctx.drawImage(im,sx,sy,sw,sh,20,113,190,282);
   if(state.showDots&&!state.refEdit){ctx.save();ctx.translate(20,113);ctx.scale(190/200,282/220);strokeSkeleton(ctx,state.monster,get(),state.selected,.9);ctx.restore()};
   ctx.fillStyle="#d2c5a6";ctx.textAlign="center";ctx.fillText("参考シート / "+(f+1)+"コマ",116,419);
 }else{
   ctx.strokeStyle="#778083";ctx.setLineDash([7,6]);ctx.strokeRect(14,69,202,363);ctx.setLineDash([]);
   ctx.font="56px sans-serif";ctx.textAlign="center";ctx.fillStyle="#a3aa9e";ctx.fillText(state.monster==="slime"?"💧":state.monster==="goblin"?"👺":"🗡️",115,225);
   ctx.font="14px sans-serif";ctx.fillText("参考画像を読み込むと",115,280);ctx.fillText("ここに表示されます",115,302);
 }
 ctx.textAlign="left";ctx.fillStyle="#d3ddd6";ctx.font="13px sans-serif";ctx.fillText("● 黄: 選択中の関節",17,469);
 ctx.fillText("● 色点: 関節／輪郭の制御点",17,490);
 ctx.fillText("1コマごとに配置を保存",17,523);
 ctx.fillText("4方向で別のポーズにできます",17,544);
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,1000,570);
 ctx.fillStyle="#e8dfc9";ctx.fillRect(0,0,1000,570);
 drawReference();
 ctx.fillStyle="#e4dac1";ctx.fillRect(230,0,770,570);
 ctx.fillStyle="#292b2c";ctx.textAlign="left";ctx.font="bold 23px serif";ctx.fillText(title(),251,33);
 ctx.fillStyle="#6b6253";ctx.font="14px sans-serif";ctx.fillText(state.playing?"アニメーション再生中":"ドラッグで関節を指定 • 位置はコマごとに記録",253,54);
 if(state.guide){ctx.save();ctx.strokeStyle="#bfb39e";ctx.lineWidth=1;ctx.setLineDash([5,8]);for(var x=270;x<=980;x+=46) {ctx.beginPath();ctx.moveTo(x,66);ctx.lineTo(x,566);ctx.stroke()}for(var y=66;y<=565;y+=46){ctx.beginPath();ctx.moveTo(245,y);ctx.lineTo(995,y);ctx.stroke()}ctx.restore()}
 var p=get(),x=350,y=60,scale=2.1;
 if(state.refEdit&&refs[state.monster]){
   ctx.save();ctx.fillStyle="#d4c3a6";ctx.fillRect(323,76,364,463);
   drawRefArt(ctx,340,84,328,447,state.showDots);
   ctx.fillStyle="#4e4336";ctx.font="bold 15px sans-serif";ctx.fillText("参考イラストの関節位置を直接指定",716,125);
   ctx.font="12px sans-serif";ctx.fillText("イラストは変形しません",716,149);
   ctx.fillText("右下: 仮リグの連動プレビュー",716,177);
   drawPuppet(ctx,state.monster,p,state.direction,765,184,.95,false,"");
   ctx.restore();
 }else{
   if(state.onion&&state.frame>0){
     var prev=pose(state.monster,state.action,state.direction,state.frame-1,state.count);
     ctx.save();ctx.globalAlpha=.18;drawPuppet(ctx,state.monster,prev,state.direction,x,y,scale,false,"");ctx.restore();
   }
   drawPuppet(ctx,state.monster,p,state.direction,x,y,scale,state.showDots,state.selected);
 }
 ctx.save();ctx.strokeStyle="#8a806e";ctx.strokeRect(955,78,29,35);ctx.fillStyle="#49443c";ctx.font="12px sans-serif";ctx.textAlign="center";ctx.fillText("↑",970,101);
 ctx.fillStyle="#484842";ctx.textAlign="left";ctx.fillText("関節数: "+joints().length,802,514);ctx.fillText("保存済み: "+Object.keys(data.poses).length+"コマ",802,537);ctx.restore();
 drawTimeline();
}
function drawTimeline(){
 tl.clearRect(0,0,1000,146);tl.fillStyle="#1b292d";tl.fillRect(0,0,1000,146);
 for(var i=0;i<state.count;i++){
   var width=1000/state.count,l=i*width;
   tl.fillStyle=i===state.frame?"#615638":"#293b3c";tl.fillRect(l+4,4,width-8,138);
   tl.strokeStyle=i===state.frame?"#f5dfab":"#586965";tl.lineWidth=i===state.frame?3:1;tl.strokeRect(l+4,4,width-8,138);
   var t=pose(state.monster,state.action,state.direction,i,state.count);
   var s=state.count===8?.47:.53;
   drawPuppet(tl,state.monster,t,state.direction,l+width/2-100*s,5,s,false,"");
   tl.textAlign="center";tl.fillStyle="#fff2cf";tl.font="bold 14px sans-serif";tl.fillText((i+1)+"コマ",l+width/2,129);
   if(data.poses[key(state.monster,state.action,state.direction,i,state.count)]){tl.fillStyle="#aaf0bc";tl.beginPath();tl.arc(l+width-15,18,5,0,Math.PI*2);tl.fill()}
 }
}
var dragging=null;
function coords(e){var r=stage.getBoundingClientRect();return [(e.clientX-r.left)*1000/r.width,(e.clientY-r.top)*570/r.height]}
function point(e){var xy=coords(e);return state.refEdit&&refs[state.monster]?[(xy[0]-340)*200/328,(xy[1]-84)*220/447]:[(xy[0]-350)/2.1,(xy[1]-60)/2.1]}
function selectJoint(k){state.selected=k;updateInspector();draw()}
stage.addEventListener("pointerdown",function(e){
 if(state.playing)stopPlay();
 var px=coords(e);if(state.refEdit&&refs[state.monster]&&(px[0]<335||px[0]>673||px[1]<80||px[1]>534))return;
 var pt=point(e),p=get(),chosen="",dist=Infinity;
 joints().forEach(function(j){var k=j[0],d=Math.hypot(p[k][0]-pt[0],p[k][1]-pt[1]);if(d<dist){dist=d;chosen=k}});
 if(dist>18)return;
 pushHistory();dragging=chosen;state.selected=chosen;stage.setPointerCapture(e.pointerId);updateInspector();onMove(e);
});
function onMove(e){
 if(!dragging)return;var pt=point(e),p=get();p[dragging]=[Math.round(clamp(pt[0],-200,400)),Math.round(clamp(pt[1],-200,400))];
 data.poses[currentKey()]=p;draw();updateInspector();
}
stage.addEventListener("pointermove",onMove);
function stopDrag(){if(dragging){dragging=null;save();draw()}}
stage.addEventListener("pointerup",stopDrag);stage.addEventListener("pointercancel",stopDrag);
stage.addEventListener("lostpointercapture",stopDrag);
function updateInspector(){
 var el=$("jointList");el.textContent="";
 joints().forEach(function(j){var b=document.createElement("button");b.textContent=j[1];b.type="button";b.className=state.selected===j[0]?"active":"";b.onclick=function(){selectJoint(j[0])};el.appendChild(b)});
 var chosen=joints().find(function(j){return j[0]===state.selected});
 if(!chosen){state.selected=joints()[0][0];chosen=joints()[0]}
 var p=get()[state.selected];$("selectedJoint").textContent=chosen[1]+"（"+state.selected+"）";$("jointX").value=p[0];$("jointY").value=p[1];
}
["jointX","jointY"].forEach(function(id,axis){
 $(id).addEventListener("change",function(){
  var v=Number(this.value);if(!Number.isFinite(v))return;pushHistory();var p=get();p[state.selected][axis]=clamp(v,-200,400);setPose(p);
 });
});
function change(){
 state.monster=$("monster").value;state.action=$("action").value;state.direction=$("direction").value;
 state.count=Number($("frameCount").value)===8?8:4;state.frame=clamp(state.frame,0,state.count-1);
 if(!joints().some(function(j){return j[0]===state.selected}))state.selected=joints()[0][0];
 stopPlay();updateInspector();draw();loadRef(state.monster);show("編集中: "+title()+"。色付きの関節点を動かしてください。");
}
["monster","action","direction","frameCount"].forEach(function(id){$(id).addEventListener("change",change)});
["joints","onion","guide","autoSave","refEdit"].forEach(function(id){
 $(id).addEventListener("change",function(){var map={joints:"showDots",onion:"onion",guide:"guide",autoSave:"autoSave",refEdit:"refEdit"};state[map[id]]=this.checked;draw()});
});
timeline.addEventListener("pointerdown",function(e){
 var rect=timeline.getBoundingClientRect(),px=(e.clientX-rect.left)*1000/rect.width;
 state.frame=clamp(Math.floor(px/(1000/state.count)),0,state.count-1);stopPlay();updateInspector();draw();show(title());
});
function go(n){stopPlay();state.frame=(state.frame+n+state.count)%state.count;updateInspector();draw();show(title())}
$("prev").onclick=function(){go(-1)};$("next").onclick=function(){go(1)};
$("reset").onclick=function(){pushHistory();delete data.poses[currentKey()];save();updateInspector();draw();show("このコマだけ初期ポーズへ戻しました。")};
$("copy").onclick=function(){var next=(state.frame+1)%state.count;var old=state.frame;state.frame=next;pushHistory();data.poses[currentKey()]=pose(state.monster,state.action,state.direction,old,state.count);save();updateInspector();draw();show((old+1)+"コマを"+(next+1)+"コマへ複製しました。")};
$("undo").onclick=function(){if(undo.length)restoreEntry(undo.pop(),redo);else show("戻す履歴がありません。")};
$("redo").onclick=function(){if(redo.length)restoreEntry(redo.pop(),undo);else show("やり直す履歴がありません。")};
function stopPlay(){state.playing=false;$("play").textContent="▶ 再生"}
$("play").onclick=function(){state.playing=!state.playing;state.frameClock=0;$("play").textContent=state.playing?"⏸ 停止":"▶ 再生";draw()};
var lastTime=0;
function tick(t){
 if(state.playing){if(lastTime){state.frameClock+=Math.min(75,t-lastTime);if(state.frameClock>200){state.frame=(state.frame+1)%state.count;state.frameClock%=200;updateInspector();draw()}}}
 lastTime=t;requestAnimationFrame(tick);
}
function downloadBlob(blob,name){
 var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(url)},2500);
}
function exportPng(all){
 var cols=8,cell=128,rowCount=4*(all?ACTS.length:1),c=document.createElement("canvas");c.width=cols*cell;c.height=rowCount*cell;
 var g=c.getContext("2d");
 var actions=all?ACTS:[state.action];
 actions.forEach(function(act,ai){
   DIRS.forEach(function(dir,di){
     for(var frame=0;frame<state.count;frame++){
       var p=pose(state.monster,act,dir,frame,state.count);
       drawPuppet(g,state.monster,p,dir,frame*cell+12,(ai*4+di)*cell+4,.49,false,"");
     }
   });
 });
 c.toBlob(function(blob){
  if(!blob){show("PNG書き出しに失敗しました。",true);return}
  var name="frontier-"+state.monster+"-"+(all?"all6":state.action)+"-"+state.count+"frames.png";
  downloadBlob(blob,name);show("PNGを書き出しました: "+name+"（"+c.width+"×"+c.height+"px）。透明背景・各128×128pxです。");
 },"image/png");
}
$("exportPng").onclick=function(){exportPng(false)};
$("exportAllPng").onclick=function(){exportPng(true)};
$("exportJson").onclick=function(){
 var output=clone(data);output.count=state.count;output.meta={project:"Frontier World",note:"MON2 user-authored joint coordinates, not game runtime art",monsters:Object.keys(MONS),actions:ACTS,directions:DIRS,spriteCell:[128,128],framesPerAction:state.count,exportedAt:new Date().toISOString()};
 downloadBlob(new Blob([JSON.stringify(output,null,2)],{type:"application/json"}),"frontier-monster-joints-v1.json");show("全モンスターの変更ポーズをJSONで保存しました。");
};
$("importJson").onclick=function(){$("jsonFile").click()};
$("jsonFile").addEventListener("change",function(e){
 var f=e.target.files[0];if(!f)return;
 if(f.size>2*1024*1024){show("2MBを超えるJSONは読み込めません。",true);this.value="";return}
 var reader=new FileReader();reader.onload=function(){
  try{
   var obj=JSON.parse(reader.result);
   if(obj.schemaVersion!==1||!obj.poses||typeof obj.poses!=="object"||Array.isArray(obj.poses))throw Error("形式が一致しません");
   var input=obj.poses,clean=Object.create(null),keys=Object.keys(input);
   if(keys.length>1000)throw Error("ポーズ数が多すぎます");
   keys.forEach(function(k){
    var parts=k.split(":");
    if(parts.length!==5||!(parts[0] in MONS)||ACTS.indexOf(parts[1])<0||DIRS.indexOf(parts[2])<0||!["4","8"].includes(parts[3])||!(/^\d+$/.test(parts[4]))||+parts[4]>=+parts[3])throw Error("キーが不正です: "+k);
    if(!checkPose(input[k],parts[0]))throw Error("関節座標が不正です: "+k);
    clean[k]=clone(input[k]);
   });
   if(!confirm("現在の編集データを読み込んだJSONで置き換えますか？"))return;
   data.poses=clean;undo=[];redo=[];save();updateInspector();draw();show(keys.length+"コマ分の関節ポーズを読み込みました。");
  }catch(error){show("JSON読込エラー: "+error.message,true)}
 };reader.readAsText(f);this.value="";
});
function dbOpen(){
 if(!("indexedDB" in window))return;
 try{
  var req=indexedDB.open("fw-monster-reference-v1",1);
  req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains("sheets"))req.result.createObjectStore("sheets")};
  req.onsuccess=function(){db=req.result;loadRef(state.monster)};
 }catch(e){}
}
function assignImage(mon,blob){
 if(imageUrl[mon])URL.revokeObjectURL(imageUrl[mon]);
 var url=URL.createObjectURL(blob),im=new Image();
 imageUrl[mon]=url;
 im.onload=function(){refs[mon]=im;if(state.monster===mon){state.refEdit=true;$("refEdit").checked=true}draw();if(state.monster===mon)$("imageStatus").textContent=MONS[mon]+"の参考画像を表示中（"+im.naturalWidth+"×"+im.naturalHeight+"px）"};
 im.onerror=function(){if(state.monster===mon)$("imageStatus").textContent="画像の読み込みに失敗しました"};
 im.src=url;
}
function loadRef(mon){
 if(refs[mon]){$("imageStatus").textContent=MONS[mon]+"の参考画像を読み込み済み";return}
 $("imageStatus").textContent="参考画像は未登録です。";
 if(!db)return;
 try{
  var r=db.transaction("sheets","readonly").objectStore("sheets").get(mon);
  r.onsuccess=function(){if(r.result)assignImage(mon,r.result)};
 }catch(e){}
}
$("imageFile").addEventListener("change",function(){
 var f=this.files[0];if(!f)return;
 if(f.size>15*1024*1024||!/^image\/(png|jpeg|webp)$/.test(f.type)){show("画像は15MB以下のPNG/JPEG/WebPにしてください。",true);this.value="";return}
 var m=state.monster;assignImage(m,f);
 try{if(db)db.transaction("sheets","readwrite").objectStore("sheets").put(f,m)}catch(e){show("参考画像の永続保存には失敗しました。現在のページでは使用できます。",true)}
 this.value="";
});
$("clearImage").onclick=function(){var m=state.monster;delete refs[m];if(imageUrl[m])URL.revokeObjectURL(imageUrl[m]);delete imageUrl[m];state.refEdit=false;$("refEdit").checked=false;try{if(db)db.transaction("sheets","readwrite").objectStore("sheets").delete(m)}catch(e){}$("imageStatus").textContent="参考画像を解除しました。";draw()};
try{
 var existing=JSON.parse(localStorage.getItem(storageKey)||"null");
 if(existing&&existing.schemaVersion===1&&existing.poses&&typeof existing.poses==="object"){
  var good=Object.create(null);Object.keys(existing.poses).slice(0,1000).forEach(function(k){
   var parts=k.split(":");if(parts.length===5&&(parts[0] in MONS)&&ACTS.includes(parts[1])&&DIRS.includes(parts[2])&&["4","8"].includes(parts[3])&&Number.isInteger(+parts[4])&&+parts[4]>=0&&+parts[4]<+parts[3]&&checkPose(existing.poses[k],parts[0]))good[k]=existing.poses[k];
  });
  data.poses=good;
  if(existing.count===8){state.count=8;$("frameCount").value="8"}
 }
}catch(e){show("既存の保存データを読み込めませんでした。",true)}
state.selected="head";updateInspector();draw();dbOpen();loadRef(state.monster);requestAnimationFrame(tick);
show("準備完了。モーション・方向・コマを選び、関節をドラッグしてください。JSON出力で端末外へ保存できます。");
})();
