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
 const preferred={twinkle:'flute',beethoven9:'violin',amazing:'organ',auld:'lute',mary:'guitar',frere:'flute',jingle:'trumpet',london:'lute',hotcross:'guitar',greensleeves:'lute',sakura:'shakuhachi',auclair:'flute'};
 return {id:'pd-'+id,title,author,bpm,instrument:preferred[id]||'organ',rights:'原曲PD・ゲーム内簡易単旋律',
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
 ],'19世紀の古い童謡の旋律をオルガン練習用の単旋律に簡略化。'),
 score('frere','フレール・ジャック（かえるの合唱の原曲）','フランスの伝統的な輪唱歌',105,
 'https://fr.wikisource.org/wiki/Fr%C3%A8re_Jacques',
 [
 [72,1],[74,1],[76,1],[72,1],[72,1],[74,1],[76,1],[72,1],
 [76,1],[77,1],[79,2],[76,1],[77,1],[79,2],
 [79,.5],[81,.5],[79,.5],[77,.5],[76,1],[72,1],
 [79,.5],[81,.5],[79,.5],[77,.5],[76,1],[72,1],
 [72,1],[67,1],[72,2],[72,1],[67,1],[72,2]
 ],'伝統曲の旋律。最終フレーズの低いGを収録鍵盤の音域に合わせて調整。'),
 score('jingle','ジングルベル（サビ抜粋）','James Lord Pierpont（1857年初版）',125,
 'https://imslp.org/wiki/Jingle_Bells_%28Pierpont%2C_James%29',
 [
 [64,1],[64,1],[64,2],[64,1],[64,1],[64,2],
 [64,1],[67,1],[60,1],[62,1],[64,4],
 [65,1],[65,1],[65,1],[65,1],[65,1],[64,1],[64,1],[64,1],
 [64,1],[62,1],[62,1],[64,1],[62,2],[67,2]
 ],'1857年出版の旋律をハ長調の練習用サビとして簡略化。'),
 score('london','ロンドン橋（抜粋）','イングランドの伝承童謡',115,
 'https://en.wikipedia.org/wiki/London_Bridge_Is_Falling_Down',
 [
 [67,1],[69,1],[67,1],[65,1],[64,1],[65,1],[67,2],
 [62,1],[64,1],[65,1],[64,1],[65,1],[67,2],
 [67,1],[69,1],[67,1],[65,1],[64,1],[65,1],[67,2],
 [62,1],[67,1],[64,1],[60,3]
 ],'古い伝承旋律を短い学習用フレーズにしたもの。'),
 score('hotcross','ホット・クロス・バンズ（練習曲）','イングランドの伝承わらべ歌',116,
 'https://en.wikipedia.org/wiki/Hot_Cross_Buns_(song)',
 [
 [64,1],[62,1],[60,2],[64,1],[62,1],[60,2],
 [60,.5],[60,.5],[60,.5],[60,.5],[62,.5],[62,.5],[62,.5],[62,.5],
 [64,1],[62,1],[60,3]
 ],'伝承童謡の単旋律を鍵盤練習向けに簡略化。'),
 score('greensleeves','グリーンスリーブス（旋律抜粋）','イングランド伝承（16世紀）',90,
 'https://en.wikipedia.org/wiki/Greensleeves',
 [
 [69,.5],[72,1],[74,.5],[76,1],[77,1],[76,.5],[74,1],
 [71,.5],[67,1],[69,.5],[71,1],[72,1],[69,1],
 [69,.5],[68,.5],[69,1],[71,1],[68,1],[64,2]
 ],'古い英国民謡の導入部を簡易に採譜。現代のギター編曲・伴奏は使用していません。'),
 score('sakura','さくらさくら（伝承旋律・抜粋）','日本の伝承曲（江戸期にさかのぼる旋律）',78,
 'https://en.wikipedia.org/wiki/Sakura_Sakura',
 [
 [69,1],[69,1],[70,2],[69,1],[69,1],[70,2],
 [69,1],[70,1],[74,1],[70,1],[69,1],[70,1],[69,2],
 [65,1],[67,1],[69,1],[70,1],[69,1],[67,1],[65,3]
 ],'伝承旋律の練習用抜粋。歌詞・新しい編曲は収録していません。'),
 score('auclair','月の光に（Au clair de la lune・抜粋）','フランスの伝承童謡',106,
 'https://en.wikipedia.org/wiki/Au_clair_de_la_lune',
 [
 [60,1],[60,1],[60,1],[62,1],[64,2],[62,2],
 [60,1],[64,1],[62,1],[62,1],[60,3],
 [60,1],[60,1],[60,1],[62,1],[64,2],[62,2],
 [60,1],[64,1],[62,1],[62,1],[60,3]
 ],'古いフランス民謡を簡単な鍵盤練習用に抜粋。')
]);
})();