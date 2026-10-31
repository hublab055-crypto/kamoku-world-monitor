import {test} from "node:test";
import assert from "node:assert/strict";
import {MUSIC_FORMAT,MUSIC_STEPS,newScore,normalizeScore,addNote,toggleStep,
 renderScoreWav,scoreSeconds,noteName,GUITAR_OPEN_NOTES} from "./music-core.mjs";

test("a score is normalised and retains independent instrument notes",()=>{
 let s=newScore("街の演奏");
 s=addNote(s,{track:"keys",step:0,pitch:60});
 s=addNote(s,{track:"guitar",step:0,pitch:64,length:4});
 s=addNote(s,{track:"keys",step:0,pitch:64}); // chord
 assert.equal(s.notes.length,3);
 assert.equal(normalizeScore(JSON.parse(JSON.stringify(s))).notes.length,3);
 assert.equal(s.format,MUSIC_FORMAT);
 assert.equal(MUSIC_STEPS,32);
 assert.equal(noteName(60),"C4");
 assert.deepEqual(GUITAR_OPEN_NOTES,[64,59,55,50,45,40]);
});

test("step edits toggle and replace one pitched cell without touching other tracks",()=>{
 let s=newScore();
 s=toggleStep(s,{track:"keys",step:5,pitch:60});
 s=toggleStep(s,{track:"guitar",step:5,pitch:64});
 assert.equal(s.notes.length,2);
 s=toggleStep(s,{track:"keys",step:5,pitch:62});
 assert.deepEqual(s.notes.map(n=>n.pitch).sort((a,b)=>a-b),[62,64]);
 s=toggleStep(s,{track:"keys",step:5,pitch:62});
 assert.equal(s.notes.length,1);
 assert.equal(s.notes[0].track,"guitar");
});

test("invalid scores cannot inject unbounded durations or unsupported instruments",()=>{
 const s=newScore();
 assert.throws(()=>normalizeScore({...s,bpm:0}),/BPM/);
 assert.throws(()=>normalizeScore({...s,notes:[{track:"unknown",step:0,pitch:60,length:1}]}),/音符/);
 assert.throws(()=>normalizeScore({...s,notes:[{track:"keys",step:31,pitch:60,length:8}]}),/音符/);
 assert.throws(()=>normalizeScore({...s,notes:Array.from({length:513},(_,i)=>({track:"keys",step:i%32,pitch:60,length:1}))}),/512/);
});

test("WAV export has valid PCM header, sample count and non-silent audio",async()=>{
 let s=newScore("test");
 s=addNote(s,{track:"guitar",step:0,pitch:64,length:4});
 s=addNote(s,{track:"drums",step:0,pitch:36,length:1});
 const rate=8000,blob=renderScoreWav(s,{sampleRate:rate});
 assert.equal(blob.type,"audio/wav");
 const bytes=await blob.arrayBuffer(),v=new DataView(bytes);
 const ascii=(offset,length)=>Array.from(new Uint8Array(bytes,offset,length),b=>String.fromCharCode(b)).join("");
 assert.equal(ascii(0,4),"RIFF");assert.equal(ascii(8,4),"WAVE");assert.equal(ascii(36,4),"data");
 assert.equal(v.getUint16(20,true),1);assert.equal(v.getUint16(22,true),1);
 assert.equal(v.getUint32(24,true),rate);assert.equal(v.getUint16(34,true),16);
 assert.equal(v.getUint32(40,true),Math.ceil((scoreSeconds(s)+.05)*rate)*2);
 assert.equal(blob.size,v.getUint32(40,true)+44);
 assert.ok(new Int16Array(bytes.slice(44)).some(x=>x!==0));
});
