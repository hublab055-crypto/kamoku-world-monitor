/** Adult, non-clinical anatomy study metadata for Avatar V10.
 * The coordinates refer to a neutral 1.8 m upright body (metres).
 * These are LABEL ANCHORS and NOT a diagnostic anatomical atlas.
 * Historical V10 saves have no "anatomy" key: original appearance remains.
 */
export const ANATOMY_PRESETS=Object.freeze({
 neutral:"汎用の人体構造",
 uterine:"子宮・卵巣のある骨盤内構造（学習用）",
 testicular:"精巣・前立腺のある骨盤内構造（学習用）"
});
export const ANATOMY_BODY_SOURCES=Object.freeze({
 procedural:"人体専用メッシュ（標準）",legacy:"旧方式（衣服形状ベース）"
});
export const ANATOMY_LAYERS=Object.freeze({
 skin:"通常の皮膚・体表",
 xray:"X線風：皮膚透明＋内部構造",
 muscle:"半透明皮膚＋筋肉（簡易3D）",
 bones:"半透明皮膚＋骨格（簡易3D）",
 organs:"半透明皮膚＋臓器（教育用3D）"
});
export const ANATOMY_SLIDERS=Object.freeze([
 ["pecDefinition","胸筋の輪郭"],
 ["abdomenDefinition","腹直筋・腹斜筋の輪郭"],
 ["navelDepth","臍のくぼみ"],
 ["gluteDefinition","臀部の形状"],
 ["armDefinition","上腕・前腕の筋の輪郭"],
 ["legDefinition","大腿・ふくらはぎの筋の輪郭"],
 ["chestJiggle","胸部の動作追従"],
 ["abdomenJiggle","腹部の動作追従"],
 ["gluteJiggle","臀部の動作追従"]
]);
const region=(id,name,layer,xyz,detail,preset="neutral")=>
 Object.freeze({id,name,layer,anchorM:xyz,detail,preset});
export const ANATOMY_REGIONS=Object.freeze([
 region("umbilicus","臍","skin",[0,1.04,.12],"腹壁の体表目印。位置は骨盤基準で動的補正"),
 region("chest-surface","胸部・乳輪・乳頭","skin",[.095,1.28,.13],"成人の胸部体表。胸郭骨格基準で位置補正"),
 region("gluteal","臀部","skin",[.10,.80,-.15],"骨盤後面の軟部組織"),
 region("biceps","上腕二頭筋","muscle",[.34,1.27,.03],"肘屈曲の主な筋の一つ"),
 region("triceps","上腕三頭筋","muscle",[.37,1.23,-.05],"肘伸展に関与"),
 region("forearm","前腕屈筋群","muscle",[.50,1.07,.01],"手指の運動に関与"),
 region("pectoralis","大胸筋","muscle",[.12,1.23,.13],"肩関節の内転・内旋など"),
 region("rectus","腹直筋","muscle",[.07,1.00,.10],"体幹前屈と腹圧"),
 region("obliques","腹斜筋群","muscle",[.16,.99,.08],"体幹の回旋・側屈"),
 region("quadriceps","大腿四頭筋","muscle",[.14,.58,.06],"膝関節伸展"),
 region("hamstrings","ハムストリングス","muscle",[.14,.51,-.06],"股関節伸展・膝屈曲"),
 region("calf","下腿三頭筋","muscle",[.13,.27,-.04],"足関節底屈"),
 region("mouth","口腔・舌・歯","organs",[0,1.62,.07],"摂食・咀嚼・嚥下の入口"),
 region("pharynx","咽頭","organs",[0,1.52,.02],"口腔から食道への連絡"),
 region("esophagus","食道","organs",[0,1.34,.01],"食物を胃へ送る"),
 region("stomach","胃","organs",[-.07,1.06,.025],"貯留・攪拌・消化"),
 region("liver","肝臓","organs",[.10,1.10,.03],"代謝・胆汁生成"),
 region("small-intestine","小腸","organs",[0,.88,.035],"消化と吸収"),
 region("large-intestine","大腸","organs",[0,.85,.02],"水分吸収・便形成"),
 region("bladder","膀胱","organs",[0,.72,.05],"尿の貯留"),
 region("uterus","子宮","organs",[0,.76,.005],"生殖器官の学習用位置", "uterine"),
 region("ovaries","卵巣","organs",[.07,.78,.015],"生殖細胞とホルモン産生", "uterine"),
 region("testes","精巣","organs",[.05,.64,.06],"生殖細胞とホルモン産生", "testicular"),
 region("prostate","前立腺","organs",[0,.68,.015],"骨盤内の腺", "testicular")
]);
const value=n=>Number.isFinite(n)?Math.max(-100,Math.min(100,Math.round(n))):0;
export function normalizeAvatarAnatomy(saved){
 return {
  source:Object.hasOwn(ANATOMY_BODY_SOURCES,saved?.source)?saved.source:"procedural",
  layer:Object.hasOwn(ANATOMY_LAYERS,saved?.layer)?saved.layer:"skin",
  preset:Object.hasOwn(ANATOMY_PRESETS,saved?.preset)?saved.preset:"neutral",
  opacity:Number.isFinite(saved?.opacity)?Math.max(10,Math.min(90,Math.round(saved.opacity))):30,
  ...Object.fromEntries(ANATOMY_SLIDERS.map(([key])=>[key,value(saved?.[key])]))
 };
}
export function visibleAnatomyRegions(anatomy){
 const settings=normalizeAvatarAnatomy(anatomy);
 return ANATOMY_REGIONS.filter(r=>(r.layer===settings.layer||settings.layer==="xray"&&["muscle","organs"].includes(r.layer)||settings.layer==="bones"&&r.layer==="muscle")&&
  (r.preset==="neutral"||r.preset===settings.preset));
}
