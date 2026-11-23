/**
 * Universal Engine: native crew-managed launch procedure.
 * No independent ship physics/camera. The current ShipJourney and SpaceCombat remain authoritative.
 * State belongs to the voyage and is persisted by ShipJourney.snapshot().
 */
const GROUNDED = new Set(['docked', 'landed']);
const SPACE = new Set(['origin-orbit','orbit','cruise','approach','flyby']);
const HOME = Object.freeze({
  navigator: {x:-2.3,z:-10.8},
  engineer: {x:1.6,z:7.2},
  companion: {x:-2.5,z:3.0},
});
const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
export function launchCrewReady(voyage) {
  const crew = voyage?.interior?.crew;
  return Array.isArray(crew)&&crew.length>=3&&
    ['navigator','engineer','companion'].every(id=> {
      const c=crew.find(member=>member.id===id);
      return Boolean(c?.seated && !c.following && !c.returning);
    });
}
export function launchStatus(voyage) {
  const state=voyage?.launchChecklist;
  return {
    active: Boolean(voyage?.kind==='surface-to-surface'),
    grounded: Boolean(voyage&&GROUNDED.has(voyage.status)),
    seated: Boolean(voyage?.seated),
    hatchSecured: Boolean(voyage&&!voyage.hatchOpen),
    crewReady: launchCrewReady(voyage),
    engineStarted: Boolean(state?.engineStarted),
    engineReady: Boolean(state?.engineReady),
    rollCalled: Boolean(state?.rollCalled),
    combatAuthorized: Boolean(state?.combatAuthorized),
    altitudeMeters: Number(voyage?.airAltitude)||0,
  };
}
export class ShipLaunchProcedure {
  constructor({notify=()=>{},say=()=>{}}={}){
    this.notify=notify;
    this.say=say;
  }
  ensure(voyage){
    if(voyage?.kind!=='surface-to-surface')return null;
    const old=voyage.launchChecklist;
    if(!old||old.schemaVersion!==1){
      voyage.launchChecklist={schemaVersion:1,engineStarted:false,engineReady:false,
        spinupSeconds:0,crewOrdered:false,rollCalled:false,launched:false,
        clearanceAnnounced:false,orbitAnnounced:false,piratesAnnounced:false,
        combatAuthorized:false};
    }
    return voyage.launchChecklist;
  }
  _fail(message){return {ok:false,message};}
  _say(id,label,line,voyage){
    this.notify(`${label}「${line}」`);
    try{this.say(id,line,voyage);}catch(e){/* subtitle/log still available */}
  }
  orderCrew(voyage){
    const s=this.ensure(voyage);
    if(!s||!GROUNDED.has(voyage.status))return this._fail('乗員の着席指示は停泊中に行ってください');
    if(!voyage.seated)return this._fail('艦長が操縦席に着席してください');
    const interior=voyage.interior;
    if(!Array.isArray(interior?.crew))return this._fail('船内乗員データを確認できません');
    for(const member of interior.crew){
      const home=HOME[member.id];
      if(!home)continue;
      member.following=false;member.seatLocked=true;member.routineTarget=null;
      interior.routine?.endIfParticipant?.(interior,member.id);
      if(!member.seated||Math.hypot(member.x-home.x,member.z-home.z)>.42){
        member.seated=false;member.returning=true;
      }
    }
    s.crewOrdered=true;s.rollCalled=false;
    return {ok:true,message:'📢 総員離陸準備。着席の上、各所の状況報告。乗員が持ち場へ移動します'};
  }
  startEngine(voyage){
    const s=this.ensure(voyage);
    if(!s||!GROUNDED.has(voyage.status))return this._fail('主機は停泊中に始動してください');
    if(!voyage.seated)return this._fail('主機始動は操縦席で行ってください');
    if(voyage.fuel<3)return this._fail('燃料不足：主機を始動できません');
    if((voyage.shipSystems?.parts?.engine??100)<40)return this._fail('主機が損傷しています。先に修理してください');
    if(s.engineStarted)return {ok:true,message:s.engineReady?'機関出力は正常です':'主機の回転数が安定するまで待機してください'};
    s.engineStarted=true;s.engineReady=false;s.spinupSeconds=0;
    this._say('engineer','機関士','主機始動。回転数上昇中。',voyage);
    return {ok:true,message:'🔘 主機始動。機関が安定するまで約3秒待機してください'};
  }
  rollCall(voyage){
    const s=this.ensure(voyage);
    if(!s||!GROUNDED.has(voyage.status))return this._fail('点呼は停泊中に行ってください');
    if(!voyage.seated)return this._fail('艦長が操縦席に着席してください');
    if(voyage.hatchOpen)return this._fail('ハッチが開いています。閉鎖・気密確認が必要です');
    if(!s.engineReady)return this._fail('エンジンが安定していません。主機始動と機関確認が必要です');
    if(!s.crewOrdered||!launchCrewReady(voyage))return this._fail('全員の着席を確認できません。乗員に着席を指示してください');
    if(s.rollCalled)return {ok:true,message:'総員準備完了。離陸許可は維持されています'};
    s.rollCalled=true;
    this.notify('艦長「総員離陸準備。着席の上、各所の状況報告。」');
    this._say('engineer','機関士','燃料、機関出力正常。',voyage);
    this._say('companion','火器管制','シールドおよび兵装、異常なし。CIWSおよび自動追尾・射撃管制システム、オンライン。',voyage);
    this._say('navigator','副官','総員準備完了。ハッチ閉鎖、船体気密正常。離陸可能です。',voyage);
    return {ok:true,message:'✅ 全員点呼完了。VOLレバーによる離陸を許可します'};
  }
  beforeLaunch(voyage){
    const s=this.ensure(voyage);
    if(!s||!GROUNDED.has(voyage.status))return this._fail('現在の状態では離陸手順を実行できません');
    if(!voyage.seated)return this._fail('操縦席に着席してください');
    if(voyage.hatchOpen)return this._fail('ハッチ閉鎖・ロックが必要です');
    if(!s.engineReady)return this._fail('エンジン始動と回転数安定を確認してください');
    if(!launchCrewReady(voyage))return this._fail('全員の着席・安全確認が終わっていません');
    if(!s.rollCalled)return this._fail('全員点呼を実行してください');
    if(voyage.fuel<3)return this._fail('離陸燃料が不足しています');
    return {ok:true};
  }
  launched(voyage){
    const s=this.ensure(voyage);if(!s)return;
    s.launched=true;s.rollCalled=false;
    s.clearanceAnnounced=false;s.orbitAnnounced=false;s.piratesAnnounced=false;s.combatAuthorized=false;
    // No automatic main-engine acceleration before the pilot advances MAIN.
    voyage.setThrottle?.(0);voyage.volThrottle=0;
    this.notify('🚀 VOLスロットルで浮上し、主推進と機首角を操作してください');
  }
  authorizeCombat(voyage,combat){
    const s=this.ensure(voyage);
    if(!s?.launched||!SPACE.has(voyage.status)||!voyage.seated)
      return this._fail('交戦許可は宇宙空間の操縦席から実行してください');
    if(!combat?.combatTargets?.length)return this._fail('捕捉可能な海賊艦がありません');
    s.combatAuthorized=true;
    combat.fireControl=true; // Track hostiles; do not enable automatic offensive fire.
    this._say('companion','火器管制','交戦許可を受領。目標追尾、兵装を待機から解除します。',voyage);
    return {ok:true,message:'🎯 艦長の交戦許可を受理。主兵装を使用できます'};
  }
  update(voyage,dt,combat=null){
    const s=this.ensure(voyage);if(!s)return;
    const step=clamp(dt,0,.12);
    if(s.crewOrdered&&GROUNDED.has(voyage.status)){
      voyage.interior?.advanceCrew?.(step,{status:voyage.status,autopilot:voyage.autopilot});
    }
    if(s.engineStarted&&!s.engineReady&&GROUNDED.has(voyage.status)){
      s.spinupSeconds=clamp(s.spinupSeconds+step,0,3);
      if(s.spinupSeconds>=2.5){
        s.engineReady=true;
        this._say('engineer','機関士','主機回転安定、燃料供給正常。',voyage);
      }
    }
    if(s.rollCalled&&(!voyage.seated||voyage.hatchOpen||!launchCrewReady(voyage)||!s.engineReady)){
      s.rollCalled=false;
      this.notify('⚠️ 離陸許可取消：着席・気密・機関状態を再点検してください');
    }
    if(!s.launched)return;
    if(voyage.status==='atmosphere'&&voyage.airAltitude>=30&&!s.clearanceAnnounced){
      s.clearanceAnnounced=true;
      this._say('navigator','副官','進路クリア。主推進で上昇、大気圏離脱に移行できます。',voyage);
    }
    if(SPACE.has(voyage.status)&&!s.orbitAnnounced){
      s.orbitAnnounced=true;
      this._say('engineer','機関士','大気圏離脱を確認。宇宙航行モードへ移行。',voyage);
    }
    if(SPACE.has(voyage.status)&&!s.piratesAnnounced&&combat?.combatTargets?.length){
      s.piratesAnnounced=true;
      this._say('navigator','副官','前方から所属不明機。機影から海賊勢力と思われます。対艦戦闘に備えてください。',voyage);
      combat.fireControl=true;
      combat.autoFire=false;
      let locks=0;
      for(const target of combat.combatTargets)if(combat.lockContact?.(target.id,voyage))locks++;
      this._say('companion','火器管制',locks?
        '全ターゲット捕捉、射程内です。射撃許可を待機。':
        '敵性機影を捕捉。現在射程圏外、射撃許可を待機。',voyage);
    }
  }
}