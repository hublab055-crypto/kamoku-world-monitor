/**
 * Universal Engine music score / deterministic PCM synthesis.
 * Pure module: no DOM, WebAudio, or changes to world coordinates.
 */
export const MUSIC_FORMAT="ue/music-score";
export const MUSIC_STEPS=32; // two 4/4 bars, 16th-note resolution
export const MUSIC_TRACKS=Object.freeze(["keys","guitar","bass","drums"]);
export const GUITAR_OPEN_NOTES=Object.freeze([64,59,55,50,45,40]); // E4 B3 G3 D3 A2 E2
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const validInt=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
export const pitchFrequency=n=>440*2**((n-69)/12);
export function noteName(n){
 const names=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
 return names[((n%12)+12)%12]+(Math.floor(n/12)-1);
}
export function newScore(title="新しい曲"){
 return {format:MUSIC_FORMAT,version:1,title,bpm:110,notes:[]};
}
export function normalizeScore(raw){
 if(!raw||raw.format!==MUSIC_FORMAT||raw.version!==1)throw Error("未対応の楽譜形式です");
 const title=String(raw.title??"").trim().slice(0,80);
 if(!title)throw Error("曲名を入力してください");
 const bpm=Number(raw.bpm);
 if(!validInt(bpm,40,240))throw Error("BPMは40〜240の整数にしてください");
 if(!Array.isArray(raw.notes)||raw.notes.length>512)throw Error("音符は512個以下です");
 const notes=raw.notes.map(n=>{
  if(!MUSIC_TRACKS.includes(n.track)||!validInt(n.step,0,MUSIC_STEPS-1)||
     !validInt(n.pitch,28,96)||!validInt(n.length,1,16)||
     n.step+n.length>MUSIC_STEPS)throw Error("楽譜の音符が不正です");
  const velocity=Number(n.velocity??.85);
  if(!Number.isFinite(velocity)||velocity<=0||velocity>1)throw Error("音量が不正です");
  return {track:n.track,step:n.step,pitch:n.pitch,length:n.length,velocity};
 });
 return {format:MUSIC_FORMAT,version:1,title,bpm,notes};
}
export const stepSeconds=bpm=>60/bpm/4;
export const scoreSeconds=score=>MUSIC_STEPS*stepSeconds(score.bpm);
export function addNote(raw,{track,step,pitch,length=1,velocity=.85}){
 const score=normalizeScore(raw);
 const n={track,step,pitch,length,velocity};
 // Validate by running the same canonical parser before modifying the score.
 normalizeScore({...score,notes:[n]});
 score.notes=score.notes.filter(old=>!(old.track===track&&old.step===step&&old.pitch===pitch));
 score.notes.push(n);
 return normalizeScore(score);
}
export function toggleStep(raw,{track,step,pitch,length=1}){
 const score=normalizeScore(raw);
 const existing=score.notes.filter(n=>n.track===track&&n.step===step);
 if(existing.some(n=>n.pitch===pitch)){
  score.notes=score.notes.filter(n=>!(n.track===track&&n.step===step&&n.pitch===pitch));
  return score;
 }
 // Step grid edits one note per instrument/step; live recording permits chords.
 score.notes=score.notes.filter(n=>!(n.track===track&&n.step===step));
 return addNote(score,{track,step,pitch,length});
}
function voice(track,pitch,t,duration,sample){
 const hz=pitchFrequency(pitch),phase=2*Math.PI*hz*t;
 if(track==="drums"){
  const noise=Math.sin(sample*78.233+pitch*19.19)*43758.5453;
  const random=(noise-Math.floor(noise))*2-1;
  if(pitch===36)return Math.sin(2*Math.PI*(85*t-40*t*t))*Math.exp(-t*18)*.8;
  if(pitch===42)return random*Math.exp(-t*35)*.29;
  return (random*.48+Math.sin(2*Math.PI*170*t)*.25)*Math.exp(-t*20);
 }
 const attack=Math.min(1,t/.012),release=Math.min(1,Math.max(0,duration-t)/.085);
 const env=attack*release;
 if(track==="guitar")return env*Math.exp(-t*3.3)*(Math.sin(phase)+.42*Math.sin(2*phase)+.18*Math.sin(3*phase))*.34;
 if(track==="bass")return env*(Math.sin(phase)*.68+Math.sin(2*phase)*.16)*.50;
 return env*(Math.sin(phase)*.61+Math.sin(2*phase)*.17+Math.sin(3*phase)*.07)*.42;
}
/** Standard PCM 16-bit mono WAV, valid as an audio/wav record in media-library. */
export function renderScoreWav(raw,{sampleRate=22050}={}){
 const score=normalizeScore(raw);
 if(!validInt(sampleRate,8000,48000))throw Error("サンプルレートが不正です");
 const count=Math.ceil((scoreSeconds(score)+.05)*sampleRate);
 const pcm=new Float32Array(count);
 const unit=stepSeconds(score.bpm);
 for(const n of score.notes){
  const start=Math.round(n.step*unit*sampleRate);
  const duration=n.length*unit;
  const frames=Math.min(count-start,Math.ceil(duration*sampleRate));
  for(let i=0;i<frames;i++)pcm[start+i]+=voice(n.track,n.pitch,i/sampleRate,duration,i)*n.velocity*.62;
 }
 const bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
 const ascii=(offset,s)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
 ascii(0,"RIFF");v.setUint32(4,36+count*2,true);ascii(8,"WAVE");ascii(12,"fmt ");
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
 v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);
 v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,"data");v.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){
  const x=clamp(pcm[i],-1,1);
  v.setInt16(44+2*i,Math.round(x<0?x*32768:x*32767),true);
 }
 return new Blob([bytes],{type:"audio/wav"});
}
