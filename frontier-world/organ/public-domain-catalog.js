/* Frontier World FW48.2 — public-domain melody starter library.
 * Melody-only educational transcriptions created for this game. Do not reproduce
 * any modern arranger's harmony, recording, edition artwork, or editorial text.
 * The underlying traditional / historical works are in the public domain in Japan.
 * Reference links describe the source works, not licenses for modern derivatives.
 */
(function(){
'use strict';
function phrase(pairs){
 let beat=0;
 return pairs.flatMap(function(pair){
  const pitch=pair[0],duration=pair[1];
  if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid duration');
  const at=beat;beat+=duration;
  return pitch===null?[]:[{pitch:pitch,start:at,duration:duration}];
 });
}
function score(id,title,author,bpm,ref,melody,detail){
 return {id:'pd-'+id,title,author,bpm,rights:'原曲PD・ゲーム内簡易単旋律',
  source:ref,detail:detail||'現代の編曲譜・録音は使用せず、公開領域の旋律から練習用に簡易入力。',notes:phrase(melody)};
}
const G=67,A=69,B=71,C=72,D=74,E=76,F=77,FG=78;
window.FW_ORGAN_PD=Object.freeze([
 score('twinkle','きらきら星（全曲・練習用）','フランス民謡（18世紀、Ah! vous dirai-je, maman）',108,
 'https://imslp.org/wiki/16_Variations_on_%27Ah!_vous_dirai-je%2C_Maman%27_%28Vogler%2C_Georg_Joseph%29',
 [
 [60,1],[60,1],[G,1],[G,1],[A,1],[A,1],[G,2],
 [65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2],
 [G,1],[G,1],[65,1],[65,1],[64,1],[64,1],[62,2],
 [G,1],[G,1],[65,1],[65,1],[64,1],[64,1],[62,2],
 [60,1],[60,1],[G,1],[G,1],[A,1],[A,1],[G,2],
 [65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2]
 ],'旋律の由来：フランス古謡。ゲーム用にハ長調・単旋律で入力。'),
 score('beethoven9','歓喜の歌（第九・主題抜粋）','L. van Beethoven（1827年没）',105,
 'https://imslp.org/wiki/Symphony_No.9%2C_Op.125_%28Beethoven%2C_Ludwig_van%29',
 [
 [64,1],[64,1],[65,1],[G,1],[G,1],[65,1],[64,1],[62,1],
 [60,1],[60,1],[62,1],[64,1],[64,1],[62,1],[62,2],
 [64,1],[64,1],[65,1],[G,1],[G,1],[65,1],[64,1],[62,1],
 [60,1],[60,1],[62,1],[64,1],[62,1],[60,1],[60,2]
 ],'交響曲第9番 第4楽章「歓喜の歌」の主題をハ長調に移調したオルガン練習用抜粋。'),
 score('amazing','アメイジング・グレイス（旋律抜粋）','NEW BRITAIN（19世紀アメリカ民謡・賛美歌旋律）',80,
 'https://hymnary.org/tune/new_britain',
 [
 [G,1],[C,1.5],[E,.5],[C,1.5],[E,.5],[D,1.5],[C,.5],
 [A,1.5],[G,.5],[G,1],[C,1.5],[E,.5],[C,1.5],[E,.5],
 [D,2],[G,1],[E,2],[G,1],[E,1.5],[C,.5],[A,1.5],
 [G,.5],[G,1],[C,1.5],[E,.5],[C,1.5],[D,.5],[C,3]
 ],'NEW BRITAINの古い旋律を使用。現代の賛美歌集の伴奏・和声・録音は使用していません。'),
 score('auld','蛍の光の原曲（Auld Lang Syne・抜粋）','スコットランド伝承旋律',96,
 'https://hymnary.org/tune/auld_lang_syne',
 [
 [G,1],[C,1.5],[C,.5],[C,1],[E,1],[D,1.5],[C,.5],
 [D,1],[E,1],[C,1.5],[C,.5],[E,1],[G,1],[A,2],
 [A,1],[G,1],[E,1],[E,1],[C,1],[D,1],[C,2]
 ],'スコットランド伝承歌の旋律をオルガン練習用に簡略化。歌詞は収録しません。'),
 score('mary','メリーさんのひつじ（練習曲）','19世紀アメリカの童謡旋律',116,
 'https://commons.wikimedia.org/wiki/File:Mary_Had_a_Little_Lamb.pdf',
 [
 [64,1],[62,1],[60,1],[62,1],[64,1],[64,1],[64,2],
 [62,1],[62,1],[62,2],[64,1],[G,1],[G,2],
 [64,1],[62,1],[60,1],[62,1],[64,1],[64,1],[64,1],[64,1],
 [62,1],[62,1],[64,1],[62,1],[60,4]
 ],'19世紀の古い童謡の旋律をオルガン練習用の単旋律に簡略化。')
]);
})();