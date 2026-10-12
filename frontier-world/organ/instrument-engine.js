/* Frontier World FW48.5: lightweight original Web Audio instruments.
 * No borrowed samples, no external audio assets. These are approximate tones,
 * not realistic sampled performances. Shared by organ editor and priest music.
 */
(function(global){
'use strict';
const presets=[
 {id:'organ',label:'⛪ パイプオルガン',gm:19,kind:'sustain',family:'keyboard',description:'礼拝や祝祭向けの持続音'},
 {id:'guitar',label:'🎸 ギター',gm:24,kind:'pluck',family:'strings',description:'柔らかな弾き語り風'},
 {id:'violin',label:'🎻 バイオリン',gm:40,kind:'bow',family:'strings',description:'ゆっくり立ち上がる弓奏風'},
 {id:'lute',label:'🪕 リュート',gm:24,kind:'lute',family:'strings',description:'短い余韻の古楽風'},
 {id:'shakuhachi',label:'🎋 尺八',gm:77,kind:'shakuhachi',family:'winds',description:'息の成分がある竹笛風'},
 {id:'flute',label:'🪈 フルート',gm:73,kind:'flute',family:'winds',description:'丸く澄んだ木管音'},
 {id:'trumpet',label:'🎺 トランペット',gm:56,kind:'brass',family:'brass',description:'明るい金管音'},
 {id:'sax',label:'🎷 サックス',gm:65,kind:'sax',family:'winds',description:'リードの倍音がある管楽器風'},
 {id:'taiko',label:'🥁 和太鼓',gm:116,kind:'taiko',family:'percussion',description:'深い低音と打撃の立ち上がり'},
 {id:'tabla',label:'🪘 タブラ',gm:0,kind:'tabla',family:'percussion',description:'高音と低音の手打ち太鼓風（MIDIはコンガ等で代用）'},
 {id:'drums',label:'🥁 ドラムセット',gm:0,kind:'drums',family:'percussion',description:'キック・スネア・ハイハットなど（25鍵対応）'}
];
const byId=Object.fromEntries(presets.map(p=>[p.id,p]));
const drumNotes=[35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59];
const tablaNotes=[60,61,62,63,64,60,61,62,63,64,60,61,62,63,64,60,61,62,63,64,60,61,62,63,64];
const aliases={church:'organ',viola:'violin',altoSax:'sax'};
function get(id){return byId[aliases[id]||id]||byId.organ;}
function percussion(id){return id==='drums'||id==='tabla';}
function midiPitch(id,pitch){
 const p=Math.max(60,Math.min(84,Math.round(Number(pitch)||60))),ix=p-60;
 return id==='drums'?drumNotes[ix]:id==='tabla'?tablaNotes[ix]:p;
}
const buffers=new WeakMap();
function noiseBuffer(c){
 let b=buffers.get(c);if(b)return b;
 b=c.createBuffer(1,Math.max(1,Math.round(c.sampleRate*.35)),c.sampleRate);
 const a=b.getChannelData(0);
 for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
 buffers.set(c,b);return b;
}
function start(c,pitch,id,at,velocity){
 if(!c)return null;
 const inst=get(id),kind=inst.kind,t=Math.max(c.currentTime,Number(at)||c.currentTime),f=440*Math.pow(2,(pitch-69)/12),v=Math.max(.05,Math.min(1,Number(velocity)||.7));
 const hit=kind==='drums'?midiPitch(inst.id,pitch):0;
 const drumHit=hit===35||hit===36?'kick':
  hit===38||hit===40?'snare':
  hit===42||hit===44||hit===46?'hat':
  [49,51,52,55,57,59].includes(hit)?'cymbal':'tom';
 const group=c.createGain();group.gain.setValueAtTime(.0001,t);group.connect(c.destination);
 const voice={group,nodes:[],pitch,kind,ended:false,time:t};
 const parts={
  sustain:[[1,'triangle',.62],[2,'sine',.25],[4,'sine',.13]],
  pluck:[[1,'triangle',.68],[2,'sine',.21],[3,'sine',.11]],
  lute:[[1,'triangle',.59],[2,'sine',.25],[3,'sine',.16]],
  bow:[[1,'sawtooth',.52],[2,'sine',.33],[3,'sine',.15]],
  shakuhachi:[[1,'sine',.77],[2,'triangle',.16],[3,'sine',.07]],
  flute:[[1,'sine',.84],[2,'sine',.13],[3,'sine',.03]],
  brass:[[1,'sawtooth',.55],[2,'triangle',.34],[3,'sine',.11]],
  sax:[[1,'sawtooth',.44],[2,'triangle',.42],[3,'sine',.14]],
  taiko:[[1,'sine',.82],[2,'triangle',.18]],
  tabla:[[1,'sine',.8],[1.52,'sine',.2]],
  drums:[[1,'sine',.72],[1.76,'triangle',.28]]
 }[kind];
 const attack=kind==='bow'?.16:kind==='brass'?.075:kind==='sax'?.075:
  kind==='flute'?.055:kind==='shakuhachi'?.09:.009;
 const peak=(kind==='drums'&&['hat','cymbal'].includes(drumHit)?.045:percussion(inst.id)?.25:.15)*v;
 group.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+attack);
 const decays={pluck:.75,lute:.48,taiko:.54,tabla:.37,drums:drumHit==='hat'?.10:drumHit==='cymbal'?.7:drumHit==='kick'?.38:.25};
 if(decays[kind]){
  group.gain.setTargetAtTime(.0001,t+attack,decays[kind]/5);
 }
 parts.forEach(([mul,wave,mix],index)=>{
  const o=c.createOscillator(),g=c.createGain();
  o.type=wave;o.frequency.setValueAtTime(f*mul,t);
  if(kind==='taiko'||kind==='tabla'||kind==='drums'){
   const root=kind==='taiko'?Math.max(60,Math.min(165,f*.38)):
    kind==='tabla'?Math.max(130,Math.min(350,(midiPitch(inst.id,pitch)%2?220:145)*(f/440)**.12)):
     drumHit==='kick'?76:drumHit==='snare'?195:drumHit==='hat'?720:drumHit==='cymbal'?510:Math.max(92,Math.min(260,f*.38));
   o.frequency.setValueAtTime(root*mul*1.5,t);
   o.frequency.exponentialRampToValueAtTime(root*mul,t+.11);
  }
  if(kind==='bow'||kind==='sax'||kind==='shakuhachi'){
   o.detune.setValueAtTime(index===1?3:-2,t);
  }
  g.gain.value=mix;o.connect(g);g.connect(group);
  o.start(t);voice.nodes.push(o);
 });
 if(['taiko','tabla','drums','shakuhachi','flute','sax'].includes(kind)){
  const n=c.createBufferSource(),filter=c.createBiquadFilter(),ng=c.createGain();
  n.buffer=noiseBuffer(c);filter.type=(kind==='drums'&&(drumHit==='hat'||drumHit==='cymbal'))?'highpass':'bandpass';
  filter.frequency.value=kind==='taiko'?500:kind==='tabla'?850:kind==='drums'?(drumHit==='hat'?5100:drumHit==='cymbal'?3300:drumHit==='snare'?1900:600):kind==='sax'?1650:2450;
  filter.Q.value=kind==='drums'?.7:1.3;
  const level=kind==='drums'?(drumHit==='hat'?.30:drumHit==='cymbal'?.23:drumHit==='snare'?.21:drumHit==='kick'?.045:.08):kind==='taiko'?.12:kind==='tabla'?.10:kind==='shakuhachi'?.047:.019;
  ng.gain.setValueAtTime(Math.max(.0001,level*v),t);
  ng.gain.setTargetAtTime(.0001,t+(percussion(inst.id)?0:.15),kind==='drums'?(drumHit==='cymbal'?.15:drumHit==='hat'?.021:.055):percussion(inst.id)?.065:.16);
  n.connect(filter);filter.connect(ng);ng.connect(c.destination);
  n.start(t);n.stop(t+.34);voice.nodes.push(n);
 }
 return voice;
}
function release(c,voice,at){
 if(!c||!voice||voice.ended)return;
 voice.ended=true;
 const t=Math.max(c.currentTime,Number(at)||c.currentTime,voice.time+.001);
 const releaseSeconds=voice.kind==='bow'?.19:voice.kind==='sustain'?.16:
   voice.kind==='brass'?.13:voice.kind==='sax'?.15:voice.kind==='shakuhachi'?.17:
   voice.kind==='flute'?.12:.09;
 try{
  const g=voice.group.gain;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(.0001,t,releaseSeconds/4);
 }catch(e){}
 voice.nodes.forEach(o=>{try{o.stop(t+releaseSeconds+.08)}catch(e){}});
}
function kill(c,voice){
 if(!c||!voice)return;
 voice.ended=true;
 try{
  const t=c.currentTime,g=voice.group.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(.0001,t);
  voice.nodes.forEach(o=>{try{o.stop(t+.001)}catch(e){}});
 }catch(e){}
}
global.FW_INSTRUMENTS={
 presets,get,percussion,midiPitch,start,release,kill,
 channel:id=>percussion(id)?9:0,
 program:id=>get(id).gm,
 label:id=>get(id).label
};
})(window);
