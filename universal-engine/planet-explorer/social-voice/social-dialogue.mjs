/**
 * Universal Engine v0.3 — NPC social speech rules, no cloud services required.
 * This module is pure data/logic except SocialDialogueDirector invoking voice.say().
 * It never invents an intimate relationship: relationship.kind comes from game state.
 * Caller supplies world-space distance from the SAME coordinate reference frame.
 */

const clamp = (n, lo=0, hi=1) => Math.min(hi,Math.max(lo,Number.isFinite(Number(n))?Number(n):lo));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const TRAIT_DEFAULTS = Object.freeze({ warmth:0.6, formality:0.6, expressiveness:0.55, caution:0.5 });
export const RELATIONSHIP_KINDS = Object.freeze(['stranger','colleague','friend','close_friend','partner','family']);
export const SOCIAL_EVENTS = Object.freeze(['greet','acknowledge','report','gift','farewell','danger','comfort','celebrate']);
const TRUST = {stranger:0.08,colleague:0.30,friend:0.58,close_friend:0.83,partner:0.97,family:0.98};
const EMOTIONS = new Set(['neutral','warm','friendly','confident','alert','urgent','curious','thinking','happy','sad','angry','calm']);
const safeString = (s, max=240) => String(s??'').trim().slice(0,max);

export const JAPANESE_LINES = Object.freeze({
  greet:{
    stranger:['こんにちは。何かお手伝いしましょうか？','ご用件をお伺いします。'],
    colleague:['お疲れさまです。今日もよろしくお願いします。','お帰りなさい。準備はできています。'],
    friend:['おかえり！待っていたよ。','やあ！ちょうど話したいことがあったんだ。'],
    close_friend:['おかえり！元気にしてた？','来てくれたんだね。うれしいよ。'],
    partner:['おかえり。会えてうれしい。','待っていたよ。今日も一緒に頑張ろう。'],
    family:['おかえり！今日も会えてうれしいよ。','おかえりなさい。元気だった？']
  },
  acknowledge:['了解しました。対応します。','わかりました。任せてください。'],
  report:['現在の状況をご報告します。異常はありません。','各部を確認しました。計画どおり進行しています。'],
  gift:['ありがとう！大切にするね。','プレゼント、うれしいです。ありがとうございます。'],
  farewell:['いってらっしゃい。お気をつけて。','またお会いしましょう。'],
  danger:['緊急警報！危険な反応を検知しました！','注意してください！周辺に危険があります！'],
  comfort:['無理はしないでください。手伝えることがあれば言ってください。','ここにいます。必要なときは声をかけてください。'],
  celebrate:['やったね！成功です！','素晴らしい成果ですね。おめでとうございます！'],
});

export function normalizeNPCProfile(raw={}) {
  const id=safeString(raw.id,80);
  if(!id)throw new Error('NPC id is required');
  const r=raw.relationship??{};
  const relationship={
    kind:RELATIONSHIP_KINDS.includes(r.kind)?r.kind:'colleague',
    affinity:clamp(r.affinity??45,0,100),
    trust:clamp(r.trust??0.5),
  };
  return {
    id, name:safeString(raw.name||id,64), role:safeString(raw.role||'npc',48),
    personality:Object.fromEntries(Object.entries(TRAIT_DEFAULTS).map(([k,v])=>[k,clamp(raw.personality?.[k]??v)])),
    relationship,
    mood:EMOTIONS.has(raw.mood)?raw.mood:'neutral',
    voice:{rate:clamp(raw.voice?.rate??1,0.5,2),pitch:clamp(raw.voice?.pitch??1,0.5,1.8),volume:clamp(raw.voice?.volume??1)},
    isOfficer:raw.isOfficer===true||raw.role==='officer',
  };
}

export function distanceBand(distance) {
  const d=finite(distance,Infinity);
  if(d<0)return 'unknown';
  if(d<=1.35)return 'near';
  if(d<=3.25)return 'conversation';
  if(d<=8)return 'far';
  return 'out_of_range';
}
function selectLine(event,kind,variant,lines) {
  let options=lines[event];
  if(event==='greet'&&options && !Array.isArray(options)) options=options[kind]??options.colleague;
  if(!Array.isArray(options)||!options.length)return '';
  return safeString(options[Math.abs(Math.floor(finite(variant,0)))%options.length]);
}

/** Compose predictable speech/acting metadata from one NPC and an event. */
export function planSocialLine(rawProfile, {
  event='greet', distance=1.8, urgency=0, target='player', text=null, variant=0,
  lines=JAPANESE_LINES, viaRadio=false,
}={}) {
  const p=normalizeNPCProfile(rawProfile);
  if(!SOCIAL_EVENTS.includes(event))throw new Error(`Unknown social event: ${event}`);
  const band=distanceBand(distance);
  const emergency=event==='danger'||clamp(urgency)>0.82;
  if(band==='out_of_range'&&!viaRadio&&!emergency)return null;
  if(band==='unknown'&&!viaRadio&&!emergency)return null;
  const {warmth,formality,expressiveness,caution}=p.personality;
  const closeness=clamp(TRUST[p.relationship.kind]*0.6+p.relationship.affinity/100*0.25+p.relationship.trust*0.15);
  const friendly=closeness>0.54&&warmth>0.42;
  let emotion='calm',gesture=null;
  switch(event){
    case 'greet':
      emotion=friendly?'friendly':'warm';
      gesture=p.isOfficer&&formality>=0.65&&!friendly?'salute':
        formality>0.7?'nod':expressiveness>0.42?'wave':'nod';
      break;
    case 'acknowledge':emotion=formality>0.55?'confident':'warm';gesture='nod';break;
    case 'report':emotion='confident';gesture=expressiveness>0.6?'explain':null;break;
    case 'gift':emotion='happy';gesture=expressiveness>0.48?'thumbs_up':'nod';break;
    case 'farewell':emotion='warm';gesture=expressiveness>0.45?'wave':'nod';break;
    case 'danger':emotion='urgent';gesture='alert';break;
    case 'comfort':emotion='calm';gesture=warmth>0.48?'nod':null;break;
    case 'celebrate':emotion='happy';gesture=expressiveness>0.42?'thumbs_up':'nod';break;
  }
  if(p.mood==='sad'&&!['danger','celebrate','gift'].includes(event))emotion='sad';
  if(p.mood==='alert'&&!emergency&&event==='report')emotion='alert';
  if(emergency){emotion='urgent';gesture='alert';}
  const proximityGain=band==='near'?-0.16:band==='far'?0.14:0;
  const rate=clamp(p.voice.rate+(1-formality)*0.07+expressiveness*0.035+(emergency?0.12:0)-(event==='comfort'?0.10:0),0.72,1.45);
  const pitch=clamp(p.voice.pitch+(friendly?0.055:0)+expressiveness*0.04+(emergency?0.10:0)-(p.mood==='sad'?0.07:0),0.6,1.65);
  const volume=clamp(p.voice.volume+proximityGain+(emergency?0.12:0),0.2,1);
  // Scaled gesturing/gaze allows a shy, formal or cautious NPC to act subtly.
  const gestureStrength=clamp(0.28+0.72*expressiveness+(emergency?0.15:0));
  const gazeStrength=clamp(0.35+0.35*formality+0.22*closeness-0.18*caution,0.15,1);
  const expressionStrength=clamp(0.30+expressiveness*0.55+warmth*0.15,0.2,1);
  const phrase=text===null?selectLine(event,p.relationship.kind,variant,lines):safeString(text);
  if(!phrase)return null;
  return {
    avatarId:p.id,event,text:phrase,
    voice:{rate,pitch,volume},
    performance:{emotion,gesture,lookAt:safeString(target,80)||'player',gestureStrength,gazeStrength,expressionStrength},
    interrupt:emergency,
    description:{distanceBand:band,relationship:p.relationship.kind,affinity:p.relationship.affinity,formality,closeness},
  };
}

/** Stateful social dialogue, with per-NPC entry hysteresis + global anti-spam. */
export class SocialDialogueDirector {
  constructor({voice,lines=JAPANESE_LINES,clock=()=>Date.now(),cooldownMs=12000,
    globalGreetingCooldownMs=2600,enterDistance=2.25,exitDistance=3.3,onPlan=()=>{}}={}) {
    if(!voice?.say)throw new Error('A voice director is required');
    if(!(exitDistance>enterDistance&&enterDistance>=0))throw new Error('Invalid distance thresholds');
    this.voice=voice;this.lines=lines;this.clock=clock;this.onPlan=onPlan;
    this.cooldownMs=Math.max(0,cooldownMs);this.globalGreetingCooldownMs=Math.max(0,globalGreetingCooldownMs);
    this.enterDistance=enterDistance;this.exitDistance=exitDistance;
    this.profiles=new Map();this.proximity=new Map();this.variants=new Map();
    this.lastAnyGreetingAt=-Infinity;this.disposed=false;
  }
  registerNPC(raw) {
    const p=normalizeNPCProfile(raw);
    if(this.profiles.has(p.id))throw new Error(`Duplicate NPC: ${p.id}`);
    this.profiles.set(p.id,p);
    this.proximity.set(p.id,{inside:false,lastSpokeAt:-Infinity});
    return ()=>this.removeNPC(p.id);
  }
  removeNPC(id) {this.profiles.delete(String(id));this.proximity.delete(String(id));for(const k of this.variants.keys())if(k.startsWith(`${id}:`))this.variants.delete(k);}
  _get(id){const p=this.profiles.get(String(id));if(!p)throw new Error(`Unknown NPC: ${id}`);return p;}
  updateRelationship(id,patch={}) {
    const p=this._get(id),r={...p.relationship,...patch};
    p.relationship=normalizeNPCProfile({...p,relationship:r}).relationship;
    return {...p.relationship};
  }
  updatePersonality(id,patch={}) {
    const p=this._get(id);
    p.personality=normalizeNPCProfile({...p,personality:{...p.personality,...patch}}).personality;
    return {...p.personality};
  }
  updateMood(id,mood){const p=this._get(id);p.mood=EMOTIONS.has(mood)?mood:'neutral';return p.mood;}
  plan(id,opts={}) {
    const p=this._get(id),event=opts.event??'greet';
    const key=`${id}:${event}`;
    return planSocialLine(p,{...opts,variant:opts.variant??this.variants.get(key)??0,lines:this.lines});
  }
  speak(id,opts={}) {
    if(this.disposed)return Promise.resolve({status:'disposed'});
    const event=opts.event??'greet';
    const plan=this.plan(id,opts);
    if(!plan)return Promise.resolve({status:'out_of_range'});
    const key=`${id}:${event}`;
    this.variants.set(key,(this.variants.get(key)??0)+1);
    this.onPlan(plan);
    return this.voice.say(plan.avatarId,plan.text,{
      ...plan.voice,...plan.performance,interrupt:plan.interrupt,lineId:`social.${event}`,
    });
  }
  /** Call each frame with true, same-frame world-space player/NPC distance. */
  updateDistance(id,distance,nowMs=this.clock()) {
    if(this.disposed)return false;
    const p=this._get(id),s=this.proximity.get(p.id);
    if(!Number.isFinite(distance)||distance<0||!Number.isFinite(nowMs))return false;
    if(s.inside && distance>=this.exitDistance){s.inside=false;return false;}
    if(s.inside||distance>this.enterDistance)return false;
    s.inside=true;
    if(nowMs-s.lastSpokeAt<this.cooldownMs||nowMs-this.lastAnyGreetingAt<this.globalGreetingCooldownMs)return false;
    if(this.voice.active||this.voice.queue?.length)return false;
    s.lastSpokeAt=nowMs;this.lastAnyGreetingAt=nowMs;
    void this.speak(id,{event:'greet',distance});
    return true;
  }
  snapshot(){return {version:1,npcs:[...this.profiles.values()].map(p=>structuredClone(p))};}
  restore(snapshot) {
    if(snapshot?.version!==1||!Array.isArray(snapshot.npcs))throw new Error('Invalid NPC social state');
    for(const data of snapshot.npcs){
      if(!data?.id||!this.profiles.has(String(data.id)))continue;
      // Caller owns which NPCs exist: restore only matching IDs, never create arbitrary NPCs.
      const p=normalizeNPCProfile(data);
      const original=this._get(p.id);
      this.profiles.set(p.id,{...original,personality:p.personality,relationship:p.relationship,mood:p.mood,voice:p.voice});
    }
  }
  dispose(){this.disposed=true;this.profiles.clear();this.proximity.clear();this.variants.clear();}
}