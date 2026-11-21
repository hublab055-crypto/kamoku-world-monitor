import {PROFILES,validateProject,HENSHIN_PROJECT_KEY} from './henshin-runtime.mjs';
import {mountHenshinWorkshop} from './henshin-studio/host-adapter.mjs';
const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
export function installHenshinUI({runtime,audio,getXR=()=>null,notify=()=>{}}){
 const wrap=document.querySelector('.view-panel .canvas-wrap');if(!wrap)return null;
 const panel=make('section');panel.id='ue-henshin-panel';panel.hidden=true;panel.setAttribute('aria-label','変身工房');panel.setAttribute('role','dialog');panel.style.cssText='position:absolute;inset:12px;z-index:145;overflow:auto;background:#10212af5;color:#effbf4;border:1px solid #8fae79;border-radius:12px;padding:16px;font:15px system-ui';
 const header=make('header');header.style.cssText='display:flex;align-items:center;gap:12px;flex-wrap:wrap';header.append(make('strong','変身工房 / VR・MR'));
 const controls=make('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:14px 0';const output=make('output');output.setAttribute('role','status');const profile=make('select');profile.setAttribute('aria-label','変身するライダー');for(const [id,p]of Object.entries(PROFILES))profile.add(new Option(p.name,id));controls.append(profile);
 const btn=(parent,label,fn)=>{const b=make('button',label);b.type='button';b.addEventListener('click',e=>{e.stopPropagation();audio.unlock();fn();});parent.append(b);return b;};
 const close=()=>{panel.hidden=true;};btn(header,'閉じる',close);panel.append(header);
 const description=make('p','ベルトを装備して変身できます。WORKSHOPのモデル・音は簡略試作です。工作・録音は「工作・音・モーション」で編集し、「ゲームへ反映」を押してください。');panel.append(description,controls,output);
 btn(controls,'ベルトを装備',()=>runtime.setEnabled(!runtime.enabled)).dataset.equip='';
 profile.onchange=()=>{const id=profile.value;runtime.next();while(runtime.project.profile!==id)runtime.next();};
 btn(controls,'変身の次の操作',()=>runtime.advance());btn(controls,'必殺技',()=>runtime.attack());btn(controls,'変身解除',()=>runtime.reset());
 btn(controls,'VRで遊ぶ',()=>{runtime.setEnabled(true);getXR()?.startHenshin?.('vr');close();});
 btn(controls,'MRで遊ぶ',()=>{runtime.setEnabled(true);getXR()?.startHenshin?.('mr');close();});
 btn(controls,'動きを再生',()=>{if(!runtime.play())notify('工房でポーズを追加してください。');});
 btn(controls,'VR記録の停止',()=>runtime.setRecording(false));
 btn(controls,'作品を本体に保存',()=>{try{localStorage.setItem(HENSHIN_PROJECT_KEY,JSON.stringify(validateProject(runtime.project)));notify('変身工房の作品を保存しました。');}catch(e){notify('保存できません：'+e.message);}});
 const tools=make('div');tools.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';panel.append(tools);
 const studioWrap=make('div');studioWrap.hidden=true;studioWrap.style.cssText='height:76vh;min-height:740px';panel.append(studioWrap);let studio=null;
 const openStudio=()=>{if(getXR()?.active){notify('工作・録音はVR／MRを終了してから開いてください。');return;}studioWrap.hidden=false;if(!studio)studio=mountHenshinWorkshop({container:studioWrap,url:new URL('./henshin-studio/',import.meta.url).href,onReady:()=>studio.loadProject(runtime.project),onProject:p=>{try{runtime.loadProject(p);runtime.setEnabled(true);localStorage.setItem(HENSHIN_PROJECT_KEY,JSON.stringify(runtime.project));notify('ベルト・モーション・音の割当をゲームへ反映しました。');}catch(e){notify(e.message);}},onError:notify});};
 btn(tools,'工作・音・モーション',openStudio);btn(tools,'ゲームへ反映',()=>{if(!studio){openStudio();return;}studio.getProject();});btn(tools,'工房を閉じる',()=>studioWrap.hidden=true);
 btn(tools,'工房の作品へ現在の動きを送る',()=>{if(!studio){openStudio();return;}studio.loadProject(runtime.project);notify('ゲーム側のポーズ・記録を工作画面へ送りました。');});
 const file=make('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','変身工房の作品JSONを読み込む');file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>3*1024*1024)throw Error('作品は3MBまでです');runtime.loadProject(JSON.parse(await f.text()));runtime.setEnabled(true);}catch(e){notify('読込できません：'+e.message);}file.value='';};tools.append(file);
 for(const [label,value,change]of [['音量',audio.volume,v=>audio.volume=v],['演出の強さ',runtime.effectPower,v=>runtime.effectPower=v]]){const l=make('label',label),input=make('input');input.type='range';input.min='0';input.max='.8';input.step='.05';input.value=String(value);input.oninput=()=>change(+input.value);l.append(input);panel.append(l);}
 const hint=make('p','VR/MR：右腰の浮遊アイテムを左右いずれかのグリップでつかみ、腰へ近づけて離します。ベルト付近のトリガーで次の操作。目の前のパネル：STEP=操作、HIT=必殺技、RESET=解除、NEXT=ライダー切替、POSE=関節編集、REC=記録、PLAY=再生、WAIST=左手の高さへ腰を調整、EXIT=XR終了。POSEでは正面のモデルの関節をグリップで動かせます。');hint.style.fontSize='13px';panel.append(hint);wrap.append(panel);
 const open=()=>{panel.hidden=false;refresh();};const toggles=[];for(const [id,parent]of [['viewport-henshin',document.getElementById('viewport-quick-panel')],['toolbar-henshin',document.getElementById('viewport-toolbar')]])if(parent){const b=btn(parent,'変身工房',open);b.id=id;toggles.push(b);}
 const tablet=document.querySelector('#ue-world-tablet [data-pane="settings"] .ue-tablet-buttons');if(tablet)btn(tablet,'変身工房',open);
 const refresh=()=>{profile.value=runtime.project.profile;controls.querySelector('[data-equip]').textContent=runtime.enabled?'ベルトを外す':'ベルトを装備';output.textContent=PROFILES[runtime.project.profile].name+' / '+(runtime.enabled?(runtime.transformed?'変身中':PROFILES[runtime.project.profile].steps[runtime.state.step]):'未装備')+(runtime.recording?' / ● モーション記録中':'');};
 const prev=runtime.onChange;runtime.onChange=r=>{prev(r);refresh();};
 panel.addEventListener('keydown',e=>e.stopPropagation());panel.addEventListener('pointerdown',e=>e.stopPropagation());
 try{const saved=localStorage.getItem(HENSHIN_PROJECT_KEY);if(saved)runtime.loadProject(JSON.parse(saved));}catch{notify('保存した変身作品を読み込めませんでした。初期状態で開始します。');}
 refresh();return {open,close,refresh,dispose(){studio?.dispose();runtime.onChange=prev;panel.remove();toggles.forEach(b=>b.remove());}};
}
