import test from 'node:test';
import assert from 'node:assert/strict';
import {japaneseVoices,modelVoiceStyle,inferVoiceStyle,chooseJapaneseVoice,voiceSelectionStatus} from '../social-voice/voice-selection.mjs';
import {AvatarVoiceDirector} from '../social-voice/avatar-voice.mjs';
import {ShipSocialVoice} from '../ship-social-voice.mjs';

const kyoko={name:'Kyoko',voiceURI:'apple.kyoko',lang:'ja-JP'};
const ot = {name:'Otoya',voiceURI:'apple.otoya',lang:'ja-JP'};
const nanami={name:'Microsoft Nanami Online',voiceURI:'ms.nanami',lang:'ja_JP'};
const english={name:'English US',voiceURI:'en-us',lang:'en-US'};
const voices=[ot,kyoko,nanami,english];

test('detect Japanese TTS voices without including non-Japanese',()=>{
 assert.equal(japaneseVoices(voices).length,3);
 assert.equal(japaneseVoices([english]).length,0);
});
test('known Japanese voice names are hints, not pitch-based gender',()=>{
 assert.equal(inferVoiceStyle(kyoko),'feminine');
 assert.equal(inferVoiceStyle(ot),'masculine');
 assert.equal(inferVoiceStyle({name:'Google 日本語'}),'unknown');
});
test('female avatar model presets recognize Lyra, Mina, Sera',()=>{
 for(const model of ['lyra','mina','sera'])assert.equal(modelVoiceStyle(model),'feminine');
 for(const model of ['ren','noah','elio'])assert.equal(modelVoiceStyle(model),'masculine');
});
test('auto female selects female Japanese voice even if male is first',()=>{
 assert.equal(chooseJapaneseVoice(voices,{style:'feminine'}).name,'Kyoko');
});
test('auto male selects a known male voice',()=>{
 assert.equal(chooseJapaneseVoice(voices,{style:'masculine'}).name,'Otoya');
});
test('explicit voice selection overrides inferred gender and remains Japanese',()=>{
 assert.equal(chooseJapaneseVoice(voices,{style:'masculine',voiceName:'ms.nanami'}).name,nanami.name);
 assert.equal(chooseJapaneseVoice(voices,{voiceName:'en-us',style:'feminine'}).name,'Kyoko');
});
test('voice choices can be empty and report unavailable voice type',()=>{
 assert.equal(chooseJapaneseVoice([english],{style:'feminine'}),null);
 const status=voiceSelectionStatus([ot],{style:'feminine'});
 assert.equal(status.styleMatched,false);
 assert.match(status.warning,/希望するタイプ/);
});
test('Web Speech director selects requested Japanese style',()=>{
 const d=new AvatarVoiceDirector({synthesis:{getVoices:()=>voices,speak(){},cancel(){}},Utterance:class{}});
 assert.equal(d._matchVoice({lang:'ja-JP',voiceStyle:'feminine'}),kyoko);
 assert.equal(d._matchVoice({lang:'ja-JP',voiceStyle:'masculine'}),ot);
 assert.equal(d._matchVoice({lang:'ja-JP',voiceStyle:'masculine',voiceName:'Kyoko'}),kyoko);
});
test('ShipSocialVoice follows edited model and supports persistent override',()=>{
 const actions=[];
 const voice={voices,registerAvatar(){},say(id,text,opts){actions.push({id,text,opts});return Promise.resolve({status:'completed'});},stop(){}};
 const saved={enabled:false,subtitles:true,voiceNames:{companion:'ms.nanami'},tuning:{companion:{rate:.92,pitch:1.08}}};
 const storage={getItem:()=>JSON.stringify(saved),setItem:(_,value)=>{Object.assign(saved,JSON.parse(value));}};
 const models={navigator:'lyra',engineer:'elio',companion:'mina'};
 const system=new ShipSocialVoice({voice,storage,doc:null,getAvatarModel:id=>models[id]});
 const ship={crew:[{id:'navigator'},{id:'engineer'},{id:'companion'}]};
 system.setEnabled(true);
 assert.equal(system.speak('navigator','こちらライラ',{interior:ship}),true);
 assert.equal(actions.at(-1).opts.voiceStyle,'feminine');
 assert.equal(system.speak('engineer','こちらエリオ',{interior:ship}),true);
 assert.equal(actions.at(-1).opts.voiceStyle,'masculine');
 assert.equal(system.speak('companion','こちらミナ',{interior:ship}),true);
 assert.equal(actions.at(-1).opts.voiceName,'ms.nanami');
 assert.ok(actions.at(-1).opts.pitch>1);
 models.navigator='ren';
 system.speak('navigator','モデル変更後',{interior:ship});
 assert.equal(actions.at(-1).opts.voiceStyle,'masculine');
 assert.equal(system.setVoiceName('navigator','apple.kyoko'),true);
 system.speak('navigator','設定変更後',{interior:ship});
 assert.equal(actions.at(-1).opts.voiceName,'apple.kyoko');
 assert.equal(system.setVoiceName('navigator','en-us'),false);
 assert.equal(system.setTuning('navigator','rate',.88),true);
 assert.equal(saved.tuning.navigator.rate,.88);
});
