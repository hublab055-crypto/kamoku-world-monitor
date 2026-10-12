// Frontier World creative marketplace: deterministic, licensed exports.
// Receipt ID is embedded in all three formats; this is traceability, not DRM.
const E=new TextEncoder();
const durationSec=0.32;
function checked(notes){
 if(!Array.isArray(notes)||notes.length<1||notes.length>400)throw Error('音符は1〜400個の範囲で必要です。');
 return notes.map(n=>{
  const pitch=Number(n.pitch);
  if(!Number.isInteger(pitch)||pitch<24||pitch>108)throw Error('音程データが正しくありません。');
  return pitch;
 });
}
function ascii(s){return E.encode(String(s));}
function concat(...parts){const total=parts.reduce((a,b)=>a+b.length,0);const out=new Uint8Array(total);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;}
function u16(n){return new Uint8Array([(n>>>8)&255,n&255]);}
function u32(n){return new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);}
function le32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function le16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function vlen(value){let n=Math.max(0,Math.floor(value)),arr=[n&127];while((n>>=7)>0)arr.unshift((n&127)|128);return new Uint8Array(arr);}
function meta(type,text){const b=ascii(text);return concat(new Uint8Array([0,255,type]),vlen(b.length),b);}
function musicMidi(notes,stamp,title){
 const chunks=[meta(3,title),meta(1,stamp),
 new Uint8Array([0,255,0x51,3,0x07,0xA1,0x20]),new Uint8Array([0,0xC0,0])];
 for(const pitch of notes){
  chunks.push(new Uint8Array([0,0x90,pitch,88]),
   concat(vlen(260),new Uint8Array([0x80,pitch,0])));
  chunks.push(new Uint8Array([0x3B,0xFF,0x01,0])); // 59-tick gap as empty text marker
 }
 chunks.push(new Uint8Array([0,0xFF,0x2F,0]));
 const track=concat(...chunks);
 return concat(ascii('MThd'),u32(6),u16(0),u16(1),u16(480),
               ascii('MTrk'),u32(track.length),track);
}
function riffChunk(label,data){const pad=data.length%2;return concat(ascii(label),le32(data.length),data,pad?new Uint8Array(1):new Uint8Array(0));}
function infoSub(label,txt){const b=concat(ascii(txt),new Uint8Array([0]));return riffChunk(label,b);}
function musicWav(notes,stamp,title){
 const rate=22050,samplesPer=Math.round(durationSec*rate),samples=samplesPer*notes.length;
 if(samples>3000000)throw Error('曲が長すぎます（書き出し上限約136秒）。');
 const pcm=new Uint8Array(samples*2);const view=new DataView(pcm.buffer);
 let pos=0;
 for(const pitch of notes){
  const freq=440*Math.pow(2,(pitch-69)/12);
  for(let i=0;i<samplesPer;i++){
   const t=i/rate;
   const attack=Math.min(1,i/(rate*.016));
   const release=Math.min(1,(samplesPer-i)/(rate*.03));
   const envelope=.31*attack*release;
   const wave=(Math.sin(2*Math.PI*freq*t)+.18*Math.sin(4*Math.PI*freq*t))*.82;
   const sample=Math.max(-1,Math.min(1,wave*envelope));
   view.setInt16(pos,Math.round(sample*32767),true);pos+=2;
  }
 }
 const format=concat(le16(1),le16(1),le32(rate),le32(rate*2),le16(2),le16(16));
 const info=riffChunk('LIST',concat(ascii('INFO'),
  infoSub('INAM',title.slice(0,100)),
  infoSub('IART','Frontier World licensed original'),
  infoSub('ICMT',stamp)));
 const body=concat(riffChunk('fmt ',format),riffChunk('data',pcm),info);
 return concat(ascii('RIFF'),le32(body.length+4),ascii('WAVE'),body);
}
function escapeXml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function musicXml(notes,stamp,title){
 const mapping=['C','C','D','D','E','F','F','G','G','A','A','B'];
 let measures=[],current=[],number=1;
 for(let i=0;i<notes.length;i++){
  const pitch=notes[i],step=mapping[pitch%12],octave=Math.floor(pitch/12)-1,sharp=[1,3,6,8,10].includes(pitch%12);
  const note='<note><pitch><step>'+step+'</step>'+(sharp?'<alter>1</alter>':'')+
  '<octave>'+octave+'</octave></pitch><duration>480</duration><type>quarter</type></note>';
  if(i%4===0)current.push('<measure number="'+number+++'">'+(i===0?'<attributes><divisions>480</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>':''));
  current.push(note);
  if(i%4===3||i===notes.length-1){current.push('</measure>');measures.push(current.join(''));current=[];}
 }
 return ascii('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'+
 '<score-partwise version="4.0"><work><work-title>'+escapeXml(title)+'</work-title></work><movement-title>'+
 escapeXml(title)+'</movement-title><identification><rights>'+escapeXml(stamp)+
 '; personal use only, redistribution prohibited</rights></identification><part-list><score-part id="P1"><part-name>Licensed melody</part-name></score-part></part-list><part id="P1">'+
 measures.join('')+'</part></score-partwise>');
}
export function buildLicensedMusicFile(work,payload,receipt){
 if(work.kind!=='music'||!receipt||!receipt.receipt_id||receipt.work_id!==work.id)throw Error('音楽のライセンス情報が一致しません。');
 const format=receipt.format;
 if(!['wav','midi','musicxml'].includes(format))throw Error('未対応の書き出し形式です。');
 const notes=checked(payload.notes);
 const stamp='FW-DL:'+receipt.receipt_id+';WORK:'+work.id;
 const bytes=format==='wav'?musicWav(notes,stamp,work.title):
             format==='midi'?musicMidi(notes,stamp,work.title):
             musicXml(notes,stamp,work.title);
 const contentType=format==='wav'?'audio/wav':format==='midi'?'audio/midi':'application/vnd.recordare.musicxml+xml';
 const ext={wav:'wav',midi:'mid',musicxml:'musicxml'}[format];
 const safe=work.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,45)||'frontier-music';
 const filename=safe+'_'+receipt.receipt_id.slice(0,8)+'.'+ext;
 return {bytes,blob:new Blob([bytes],{type:contentType}),filename,stamp,format};
}
export async function sha256Hex(bytes){
 const hashed=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hashed),b=>b.toString(16).padStart(2,'0')).join('');
}
export function triggerMusicDownload(blob,filename){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;link.style.display='none';document.body.append(link);
 link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function licenseReceiptFromFile(bytes){
 const sample=bytes.length>5000
   ?new Uint8Array([...bytes.slice(0,1800),...bytes.slice(-2000)])
   :bytes;
 const text=new TextDecoder('latin1').decode(sample);
 return (text.match(/FW-DL:([0-9a-f-]{36})/i)||[])[1]||null;
}
