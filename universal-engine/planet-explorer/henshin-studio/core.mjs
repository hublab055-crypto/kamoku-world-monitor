export const PROFILES = {
 zeroone:{name:'ゼロワン',tag:'01 / HOPPER',driver:'飛電ゼロワンドライバー',item:'プログライズキー',shape:'key',color:'#c7ff21',accent:'#ef3340',steps:['キーを起動','ベルトに認証','キーを装填','変身！'],fx:'digital'},
 zio:{name:'ジオウ',tag:'TIME / WATCH',driver:'ジクウドライバー',item:'ライドウォッチ',shape:'watch',color:'#ed69cc',accent:'#c6cddd',steps:['ウォッチを起動','ウォッチを装填','ベルトを回転','変身！'],fx:'clock'},
 ghost:{name:'ゴースト',tag:'SPIRIT / EYE',driver:'ゴーストドライバー',item:'ゴースト眼魂',shape:'eye',color:'#ff7e27',accent:'#c8fdff',steps:['眼魂を起動','眼魂を装填','レバーを操作','変身！'],fx:'spirit'},
 gaim:{name:'鎧武',tag:'ARMS / ORANGE',driver:'戦極ドライバー',item:'ロックシード',shape:'lock',color:'#ffa329',accent:'#335de6',steps:['ロックを解除','ロックシードを装填','ブレードを操作','変身！'],fx:'fruit'}
};
export const JOINTS=['leftShoulder','leftElbow','leftHand','rightShoulder','rightElbow','rightHand','leftKnee','leftFoot','rightKnee','rightFoot'];
export const defaultPose=()=>({leftShoulder:[-.28,1.35,0],leftElbow:[-.42,1.08,0],leftHand:[-.43,.83,0],rightShoulder:[.28,1.35,0],rightElbow:[.42,1.08,0],rightHand:[.43,.83,0],leftKnee:[-.16,.5,0],leftFoot:[-.16,.08,.08],rightKnee:[.16,.5,0],rightFoot:[.16,.08,.08]});
export function newProject(id='zeroone'){if(!PROFILES[id])throw Error('Unknown rider');return {version:1,profile:id,name:PROFILES[id].name+' マイベルト',color:PROFILES[id].color,accent:PROFILES[id].accent,beltScale:1,itemScale:1,waist:.55,parts:[],motion:[],pose:defaultPose(),audioSlots:{}};}
export function validateProject(p){
 if(!p||p.version!==1||!PROFILES[p.profile])throw Error('対応していないプロジェクトです');
 const n=newProject(p.profile);n.name=String(p.name||n.name).slice(0,60);
 for(const k of ['color','accent']){if(!/^#[0-9a-f]{6}$/i.test(p[k]))throw Error('色の形式を確認してください');n[k]=p[k];}
 for(const [k,min,max] of [['beltScale',.5,1.6],['itemScale',.5,1.8],['waist',.25,.85]]){if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error('サイズ・位置が範囲外です');n[k]=p[k];}
 const pose=v=>{const out={};for(const j of JOINTS){if(!Array.isArray(v?.[j])||v[j].length!==3||v[j].some(x=>!Number.isFinite(x)||Math.abs(x)>3))throw Error('関節座標が不正です');out[j]=[...v[j]];}return out;};
 n.pose=pose(p.pose);if(!Array.isArray(p.parts)||p.parts.length>24)throw Error('パーツは24個までです');
 n.parts=p.parts.map(v=>{if(!['box','orb','fin','ring'].includes(v.shape)||!['belt','item'].includes(v.target)||!Array.isArray(v.position)||v.position.length!==3||v.position.some(x=>!Number.isFinite(x)||Math.abs(x)>1)||!Number.isFinite(v.size)||v.size<.01||v.size>.3)throw Error('パーツが不正です');return {shape:v.shape,target:v.target,position:[...v.position],size:v.size};});
 if(!Array.isArray(p.motion)||p.motion.length>1800)throw Error('モーションは1800フレームまでです');let last=-1;
 n.motion=p.motion.map(f=>{if(!Number.isFinite(f.t)||f.t<0||f.t<last||f.t>120)throw Error('記録時刻が不正です');last=f.t;return {t:f.t,pose:pose(f.pose)};});
 for(const k of ['activate','insert','transform','attack'])if(typeof p.audioSlots?.[k]==='string')n.audioSlots[k]=p.audioSlots[k].slice(0,100);
 return n;
}
export class TransformState{constructor(){this.reset();}reset(){this.step=0;this.transformed=false;}advance(){if(this.transformed)return 'attack';this.step++;if(this.step>=4){this.transformed=true;return 'transform';}return this.step===1?'activate':'insert';}}
export function sampleMotion(frames,t){if(!frames.length)return null;if(t<=frames[0].t)return structuredClone(frames[0].pose);const end=frames.at(-1);if(t>=end.t)return structuredClone(end.pose);let b=frames.findIndex(f=>f.t>=t),a=b-1;const k=(t-frames[a].t)/(frames[b].t-frames[a].t||1);return Object.fromEntries(JOINTS.map(j=>[j,frames[a].pose[j].map((v,i)=>v+(frames[b].pose[j][i]-v)*k)]));}
