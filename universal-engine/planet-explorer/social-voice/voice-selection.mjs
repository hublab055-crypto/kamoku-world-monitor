/** Browser-provided Japanese TTS voices. Web Speech does not expose gender metadata.
 * Known Japanese voice names are hints, NOT a guaranteed voice identity.
 * Manual name selection always wins; unknown device voices remain selectable.
 */
export const FEMALE_AVATAR_MODELS = Object.freeze(['lyra','mina','sera']);
export const MALE_AVATAR_MODELS = Object.freeze(['ren','noah','elio']);
const FEMALE = /(?:kyoko|nanami|haruka|ayumi|sayaka|shiori|mizuki|yuna|hikari|nozomi|sakura|hanako|yuki|misaki|七海|はるか|京子|きょうこ|あゆみ|さくら)/i;
const MALE = /(?:otoya|ichiro|takumi|naoki|keita|daichi|masaru|hiroshi|一郎|おとや|おとや|たくみ|ひろし)/i;
const language = value => String(value||'').replace('_','-').toLowerCase();
export function japaneseVoices(voices=[]) {
 return [...(voices||[])].filter(v=>language(v.lang).split('-')[0]==='ja');
}
export function modelVoiceStyle(model,defaultStyle='neutral') {
 if(FEMALE_AVATAR_MODELS.includes(model))return 'feminine';
 if(MALE_AVATAR_MODELS.includes(model))return 'masculine';
 return defaultStyle;
}
export function inferVoiceStyle(voice) {
 const name=String(voice?.name||'')+' '+String(voice?.voiceURI||'');
 if(FEMALE.test(name))return 'feminine';
 if(MALE.test(name))return 'masculine';
 return 'unknown';
}
export function chooseJapaneseVoice(voices,{voiceName=null,style='neutral'}={}) {
 const japanese=japaneseVoices(voices);
 if(voiceName){
  const matching=japanese.find(v=>v.name===voiceName||v.voiceURI===voiceName);
  if(matching)return matching;
 }
 const known=japanese.filter(v=>inferVoiceStyle(v)===style);
 if(known.length){
  // Prefer a named neural or enhanced voice *within the requested style* when available.
  return known.find(v=>/neural|natural|premium|enhanced/i.test(v.name))||known[0];
 }
 // Do not pretend pitch adjustment creates a different gender.
 // If only known opposite-style voices exist, the actual fallback is reported to the user.
 return japanese.find(v=>inferVoiceStyle(v)==='unknown')||japanese[0]||null;
}
export function voiceSelectionStatus(voices,{voiceName=null,style='neutral'}={}) {
 const japanese=japaneseVoices(voices),choice=chooseJapaneseVoice(japanese,{voiceName,style});
 const explicit=Boolean(voiceName&&japanese.some(v=>v.name===voiceName||v.voiceURI===voiceName));
 const matching=Boolean(choice&&inferVoiceStyle(choice)===style);
 return {available:japanese.length,selected:choice?.name||null,explicit,
  styleMatched:matching,style,warning:japanese.length===0?
    'このブラウザに日本語音声が見つかりません':
    (!explicit&&style!=='neutral'&&!matching)?
    '希望するタイプの声を識別できません。音声を手動選択するか、端末の日本語音声を追加してください':null};
}
