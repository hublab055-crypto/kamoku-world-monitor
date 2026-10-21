## 2026-10-21 — v0.8w Atmospheric Perspective + Adaptive LOD

- 地表WebGL2に大気フォグ4モード（OFF／軽量／リアル／自動）。天候・日照・標高・潜水に応じて視程変化。屋内・宇宙では無効。
- FPSの継続的な低下に応じて地形と遠距離植生のLODを段階調整。既存の47km級アルプス遠景を維持。
- 設定は専用キーで保存し既存セーブを変更しない。Node自動テスト追加。Safari実機FPSは未測定。

## 2026-10-21 — v0.8t Railway Timetable / Steam Train Boarding

- ルミナス、フロウベル、アルディナス、セレノートを環状7km・4駅の固定路線として定義し、外回り／内回り2列車の8ゲーム時間周期ダイヤを追加
- 惑星標準時に連動した駅別次発6本、発車カウントダウン、行先・途中停車駅、列車の現在区間・進捗・到着予定を表示
- 「駅で待つ」でホームへ移動して到着時刻で一時停止。機関車、炭水車、旅客車、貨車を選択して乗車し、停車中のみ降車可能
- 高速時間で停車を飛び越えても次駅到着を検出して時計を到着時刻へ合わせ、自動停止する乗車処理を追加
- 駅舎・ホーム・線路・信号、蒸気機関車＋3車両の編成、4種類の独立した車内をオリジナル低ポリゴン3Dメッシュで追加
- 乗車状態の手動セーブ／専用ジャーナル、旧保存互換、時刻表・進捗・到着・乗降・3D形状・画面接続の自動試験を追加
- 制約：駅間はスケジュールと車内表示で扱い、惑星地表全区間の連続線路、分岐・閉塞・運賃・貨物物流は未実装

## 2026-10-19 — v0.8m Sailing Cabin / Fishing / Planet Voyage

- 中型帆船の内装を3D表示。船室への入退室、ベッドで睡眠、椅子で休息、食卓で食事、調理台で魚料理、本棚で航海日誌の閲覧を実装
- 既存の人物HP以外の体力・メンタル・満腹度・料理在庫・読書のデータと船室での操作を連携。巡航中も生活行動を継続可能
- 甲板・海岸でタイミング式釣りを追加。魚が掛かるまで待ち、一定時間内に引き上げると食料1匹と釣果記録。竿とウキの簡易3D表示
- 球面航法の累計距離・経度一周・出航地点への帰還をチェック。経度±180°を跨ぐ場合や惑星一周後の船の近傍照会をテスト
- 船室・釣り・周航進捗・累計釣果を既存船専用セーブに追加（旧データ互換維持）
- 9件の新規テスト。自動航路探索・長距離の全建物持続描画・実機での連続一周試験は対象外

## 2026-10-19 — v0.8k Offshore Sailing / Arrow Cleanup

- 刺さった矢の寿命を90ゲーム秒に設定、回収可能時間中の矢は従来のタップ／移動して回収を維持。期限切れで自動消滅、スナップショット互換
- 海上への降下で水面開始と外洋用中型帆船の甲板開始を選択可能に。海以外では船を生成せず、既存の船を再利用できる
- 17mのオリジナル低ポリゴン中型帆船（船体・甲板・船室・舵輪・2本の帆柱・帆・索具）を作成、帆の開度に応じて外観を切り替え
- 帆の調整、舵操作、巡航、投錨・揚錨、最大6kmの海洋目的地指示を追加。帆船は川に入らない
- 航行中に海へ下りても巡航を継続可能。近距離で再乗船、岸では上陸でき、速度・船の状態を保存
- 回帰テストで矢の期限・旧セーブ移行、帆船降下・舵・帆・巡航・航行中再乗船と3Dメッシュを確認
- 制約：甲板での独立した徒歩移動・船室内利用・風向・海流・実際の船舶物理は今後の機能

## 2026-10-19 — v0.8j Map Directory / Tap Navigation

- 動物の上などをダブルタップしても、1回目のタップ処理が動物ウィンドウを先に開かないよう、アプリ内のみ320msのシングルタップ待機を追加
- 2回タップを地面移動として優先し、TPV/RTS共通で動物・人物・資源の誤選択を防止。RTSは人物選択より移動指示を優先
- マップ一覧を「☰ 操作」に追加。建物／動物／人物／資源の4分類と距離順、検索、範囲、更新、個別操作・移動を追加
- 選択した建物などを3D地面のシアン色リングで表示。旧保存形式・既存UIを変更せず動作
- 新規 map-directory と double-tap 回帰テスト。iPhone Safari実機での操作遅延と表示は未検証

## 2026-10-18 — v0.8h Hunger / Vitals / Healing

- 新しい満腹度ゲージ。移動・作業・時間経過に応じて低下し、HP自然回復でも満腹度・スタミナを消費
- HP被ダメージ時のメンタル減少、空腹や低スタミナの慢性的な精神負荷。休息と食事による回復
- 料理・果実／食材を食べる、休む、寝る、回復薬、メンタル消費の回復魔法、教会8m以内の回復
- 教会の建築モデルとレシピ、薬屋で水1＋繊維3から回復薬調合
- 旧生活UIの食事・睡眠を人物状態値へ同期し、満腹・メンタルを自動行動条件に追加。HPと人物状態を保存
- 新テスト `vitals-hunger-v08h.test.mjs`。実機表示・FPS検証と大規模な傷病シミュレーションは対象外

## 2026-10-18 — v0.8f 野生動物の祖先と馬術

- 野生馬／オーロックス／ムフロン／ベゾアールヤギ／セキショクヤケイ／オオカミ／リビアヤマネコの7種・13個体を軽量3D表示し、野生の巡回と馴致済の追従を追加
- 野生馬の3回の馴致、近づく・呼ぶ、ハミ／手綱／鞍／蹄鉄の資材消費と外観反映
- 馬具3点で騎乗可能。速度切替3段階、馬自身の疲労、プレイヤーの疲労軽減、移動指定距離1200mへ拡張。降馬時は平地・陸地をチェック
- 騎乗中は既存の剣・槍・弓コマンドを使用し、矢の射出高さを調整
- タップ選択とコンパクトUI、旧セーブ互換の動物ジャーナル、7件の回帰テスト
- 制約: 非馬種の家畜化／飼育、騎乗専用関節ポーズ・繁殖・牧畜、実機パフォーマンス未検証

## 2026-10-18 — v0.8e 資源重量・石壁・店舗・コンパクトHUD

- 資源量: 低木5kg、大木80kg、小石0.5kg、鉄鉱床50kg。サイズ別メッシュと個数を維持した重量追跡を追加
- 倒木にノコギリを使い板材を作る新規ツールコマンド
- 2m石壁、通常1タップずつ、RTSでドラッグ線指定＋視覚ガイド。石材消費、衝突判定、位置と建築データの保存
- 共同倉庫・日用品商店・鍛冶屋・薬屋・本屋・魔法店・マーケットの3D施設を配置可能に
- 共同倉庫は8m以内でリュック全収納が可能。個数と重量の保存に対応
- HP・スタミナ・メンタル・重量を控えめな折り畳みHUDに表示
- 注意：店舗での売買・NPC店員・在庫価格計算は未実装。手動採集資源は現段階では共有クラフト資材に加算。実機FPSは未測定

## 2026-10-18 — v0.8d 動く倒木と風で流れる雲

- `tree-fall.mjs`: 1.45秒の木の倒壊補間。伐採の最終打撃で3Dモデルを傾け、アニメ終了後に倒木メッシュへ移行。初期森林のインスタンシングと採集保存形式は維持。
- `ground-clouds.mjs`: 天候・雲量に応じた雲の量、雨天時の暗色化と風速。描画行列による滑らかな風移動。
- `render.mjs`: 倒木アニメーション専用の小メッシュと、雲だけの段階的更新でGPU負荷を抑制。
- `tree-fall-weather-v08d.test.mjs`: 木の倒壊、天候、雲の位置連続性・形状のテスト。Safariキャッシュのバージョン更新を実施。
- 限界: 伐採は剛体物理ではなく演出アニメ。iPhone実機性能未測定。

## 2026-10-18 — v0.8c 伐採・採掘・自動巡回・チェスト・雲

- 山の歩行を細分化した傾斜判定に変更し、急斜面への侵入を制限
- 木・岩へ近づいて道具を使い、倒木・砕石から回収する作業と画面エフェクトを追加
- 自動行動で設定半径内の実在資源を回り、道具切替とリュックの重量蓄積を実行
- 重量18kg超で名前付きチェストに全収納。名前と距離順で収納先選択可能
- 地上視点に半透明の雲群を追加
- 新規テスト6件。端末実機性能は未測定

## 2026-10-18 — v0.8b 山脈・渓谷・蛇行河川の立体化

- `landscape-relief.mjs` に開拓開始地点を固定した河道関数・川幅・水位、川底・岸・山並み・丘陵・浸食渓谷の標高計算を追加。
- `terrainSurface` へ反映。移動・掘削・採集地表サンプリングで同じ高度を参照。
- `buildRiverWaterPatch` で局所的な川面3Dメッシュを作成し、地形とは別にWebGL2で描画。
- 森・草原の生成時に川筋への草木出現を制限し、Safariで最新モジュールを読み込むためバージョンを更新。
- 新規4テスト（山・渓谷・川・河面メッシュ）を追加。橋、物理流体、滝、全球の侵食網は対象外。

## 2026-10-18 — v0.8a 紅葉樹・実伐採／採石・地形掘削

- 新しい樹木（赤・橙カエデ、黄葉ナラ、シラカバ）、下草の低木を追加。既存樹木IDを変更しないまま植生種別を拡張。
- `resource-harvest.mjs` で耐久、傷、倒木／砕石、回収、有限資源ドロップを追加。単なる攻撃モーションの無料資源取得を停止。
- `geo.mjs` の山脈・峡谷・川・海岸などの地形形状と色表現を拡充。 `earthworks.mjs` で掘削／盛土の球面差分を管理し、実際の地面の高さと移動判定に適用。
- 掘る／盛り土ボタン、土資源、`v0_8a` セーブの地形差分と伐採状態、ローカル自動保存を追加。
- 実装上の注意：河川と渓谷は簡易生成、倒木は完成時に倒木モデルへ切替（連続倒壊アニメーション未実装）、地形は高さマップ方式（洞窟未対応）。スマホ実機FPSは別途評価が必要。

## 2026-10-18 — v0.7z 樹木・草・石をさらに約10倍

- 背景の森林座標系を維持したまま副セルを追加。生成検証：木14,430本、石1,329個、草147,001株（標準的な森林のデモ条件）。
- WebGL2 インスタンシングへ移行し、種別ごとのプロトタイプメッシュとFloat32Arrayのインスタンス変換を利用。描画バッチ数を低く維持。
- Safari向け資源タップの画面投影を局所範囲へ抑制。既存セーブ・12施設・アバター・RTS・戦闘システムとの互換性を維持。
- 新版UI/モジュールのキャッシュ更新識別子を追加。WebGL2未実装のモック用には互換処理を持たせた。
- 描画品質/負荷の実機計測は未実施。ユニットテストは `dense-scenery-v07y.test.mjs` と `explorer.test.mjs` で検証。

## 2026-10-18 — v0.7z 大気圏・雲海・地形LOD降下

- 惑星上の任意地点選択から地表まで、高度に連動して大気圏接近・雲海・山脈・森林・地表の段階を表示。雲と大気の透過レイヤー、降下中の視覚的な霧を追加。
- 惑星球面に近接3段階の高密度地形タイルを逐次生成。地表と同じ地理座標・標高サンプラーを利用し、従来の23km球面／地表切替の見た目を改善。
- 対数補間の移動速度を制限して、従来ほぼ瞬時だった雲層通過を数フレーム以上で表示。雲球面の高さを現実的なスケールへ補正。
- スマホ向け入力透過、視覚効果の動作抑制設定、旧セーブとRTS／TPV操作を保持。純粋ロジックと球面タイル生成はV8上で検証、Node自動テストを追加。WebGL実機／GitHub Actions全テストは未確認。
- 厳密な連続ジオメトリLODや実気象雲は未実装。詳細は [DESCENT_V07Z.md](DESCENT_V07Z.md)。

## 2026-10-18 — v0.7y 高密度の草木と開拓集落

- `world-scenery.mjs` にシード固定の配置計算を導入。近景の植生を旧最大80から約1,455、草を約13,433株へ。移動・ズームで木々の世界位置を保持し、距離LOD・水域スキップ・空き地確保を行う。
- `scenery-geometry.mjs` にバッチ化した松／広葉樹／花木／岩／草と、宿舎・小屋・納屋・工房・見張り塔・穀物倉庫・井戸・露店・厩舎の12か所の装飾モデルを追加。
- 地形高度に丘陵・尾根・浅い谷、頂点色にばらつきを追加。地面・採集地点の高さは共通地形関数と実描画メッシュに追従。
- 遠景の生態系LOD、メッシュの16bit頂点上限、既存セーブ／建築・操作の互換性を維持。装飾建物は操作・衝突判定の対象外。スマホ実機性能は要評価。

## 2026-10-17 — v0.7w 長槍・両手剣の重量感と接触判定

- 既存の両手武器に専用の戦闘判定モジュール `melee-contact.mjs` を追加。武器の刃や槍先の軌道を時間分割した2Dカプセル（X/Z座標）として評価し、敵の当たり円に実際に接触したときだけヒットさせる。槍の直線突き・横薙ぎ、両手剣の振り下ろし・横薙ぎ・突きに対応。
- 同じ敵への二重ダメージは元のステージ管理で防止。背後や射程外、横方向に外れた敵への空振りに対応し、攻撃者の向き（yaw）を反映。プレイヤーと仲間の攻撃で共通処理を使う。
- 長槍は構え、両手での突き伸ばし、引き戻しまで連続化。両手剣は遅い予備動作、腰と足の踏ん張り、振り抜き後の余韻、回復速度を調整。両手武器の待機姿勢も改善。
- 両手剣の命中では敵に短いノックバックと被弾硬直、槍は控えめな押し戻しを与える。盾ガード中は従来どおり威力軽減し、重い攻撃の溜め中は敵のガード姿勢を延長する。既存の弓の飛行・回収処理やセーブ形式は変更しない。
- 標準的なFrontier GLB骨格にも両手武器の肩・肘・手首・腰・膝のポーズを反映。既存の行動時間と両手武器コンボのモーションを調整。新規テスト `two-handed-contact-v07w.test.mjs` の6テストをV8上で検証済み、個別ロジック25項目の動作確認済み。GitHub ActionsのNode全テストおよびiPhone Safari実機テストは未確認。
- この段階の接触判定は水平面のカプセル近似であり、GLBの指IKや垂直方向の武器刃への厳密な3D衝突判定までは未実装。

## 2026-10-17 — v0.7v 射撃統制・三種類の矢

- 弓の照準を「集中（指定対象）」「各自（最寄りの敵）」「分散（未割当の敵を優先）」から選択。RTSの複数選択＋シンクロモードの「射る」「一斉射撃」に適用。アバターごとに照準方向を合わせる。
- 発射タイミングは「一斉」「順次」を選択。「順次」は部隊内の後続射手が選択した0.12・0.22・0.40・0.60秒間隔で弓を引いた状態で待ち、順番に放つ。保持中は弓のモーションを78%で一時停止し、実際の矢の放出を遅らせる。
- 矢種を木の矢（22ダメージ）・鉄の矢（33ダメージ）・火矢（17ダメージ＋命中後1秒ごと4×最大3回）から選択。鉄の矢と火矢はそれぞれ別の3D外観を持つ。火矢による森林火災や建物延焼は今回の対象外。
- 個人別の矢種在庫、消費、命中後の同種回収と保存／復元に対応。旧セーブの `arrows` は木の矢としてそのまま継承。木の矢6本＝木材1・石材1、鉄の矢3本＝木材1・金属2、火矢3本＝木材1・繊維2でクラフト可能。
- iPhoneのコンパクト操作バーを横スクロール対応。新規テスト `archery-ammo-v07v.test.mjs` を追加。純粋ロジックの構文／軌道／矢種／時間差発射／旧セーブ互換テストを個別に確認。ブラウザ実機と GitHub Actions 全スイートは未検証。

## 2026-10-17 — v0.7u 両手武器（長槍・両手剣）

- 🔱 長槍と⚔️ 両手剣を基本装備に追加。右手・左手のいずれかに装備すると両手を占有し、盾や片手装備は同時装備不可。外すと両手とも空き、既存スロット保存と旧セーブ復元に対応。
- ⚙️ 5つの行動デッキから選択可能。剣系の突き・薙ぎ払い・振り下ろし・連続攻撃に接続。槍は長い突き（最大4.7m）、両手剣は広い薙ぎ払い・高ダメージを特徴とする暫定バランス。
- 両腕の肩・肘・手首を動かす専用モーションとオリジナルの簡易3D武器形状を追加。両手で1つの武器を持つため、手首に同じメッシュが重複表示されない処理を導入。
- RTSシンクロ時の「薙ぎ払う」「突く」から複数選択者に同期近接指示。NPCの命中判定もアニメーションの衝撃フレーム単位で反映。盾防御より控えめな両手武器ガードに対応。
- 10モジュールの構文チェック、主要17項目の実ロジック検証は通過。Node単体テストを追加。GitHub Actions全テストとSafari実機の表示・操作は未確認。手の厳密なIK把持は今後の改善対象。

## 2026-10-17 — v0.7t シンクロ射撃と回収可能な矢

- RTSの複数選択で「🔗 シンクロON」を有効にすると「🏹 射る」または「🏹 一斉射撃」で選択人物に同期射撃を指示。弓を実際に装備し矢筒残数がある人物だけ参加し、人物ごとに矢を1本消費。準備不足や動作中の人物はスキップ。
- 射出は「自動・直射・曲射」を選択可能。飛翔中の矢を独立した3Dメッシュとして描画、重力を考慮した放物線と連続的な衝突判定。自動は近距離直射／遠距離曲射を切替。
- 地表、樹木／岩、完成小屋、練習用の的、敵への着弾を判定。的は前方9mに設置、タップして狙える。敵のHP減少は弓を引いた時点でなく実際の命中時だけ発生。敵に刺さった矢は敵の移動に追従。
- 着弾した矢は3D空間に残り、タップで接近・回収。矢筒残数に1本を戻し、同じ矢の二重回収を防ぐ。3D矢・的の保存／復元は既存の v0.7i セーブに後方互換の v0_7t セクションを追加して保持。
- 単体モジュールの構文確認と飛翔・木／建物／敵／的・回収のロジック確認を実施。iPhone Safari と GitHub Actions の全テスト結果は未確認。

## 2026-10-17 — v0.7s RTS / TPV 共通タッチ操作

- RTS / TPVともに1本指ドラッグで視点回転、2本指ピンチでカメラ拡大・縮小。RTS俯瞰は約8mまで接近可能。肩越し視点にもズーム距離を反映。
- 敵を1回タップして手動ターゲットに指定。弓の「🏹 射る」で射撃。RTSの仲間も選択した敵への射撃・命中判定を矢の放出タイミングに実行。
- 地表の木・岩を1回タップすると選択人物が接近して伐採・採掘。地面のダブルタップでRTSの選択部隊またはTPVプレイヤーが目的地へ移動開始。既存の人物・家具・扉タップを優先し、予期しない移動指示を防止。
- 自動条件行動中のRTS手動移動指示が失われる問題を修正。ジェスチャーとNPC弓の回帰テストを追加。
- 従来のセーブ形式・過去バージョンへの復帰を保持。スマホ Safari 実機の操作試験は未実施。

## 2026-10-16 — v0.7k 右手/左手の個別装備

- 画面右に左右の使用ボタン、持ち物画面で右手/左手に装備。
- 所持数に基づく装備可否・消耗・贈り物の使用、人物別の保存。
- 5枠クイック操作を維持し、左右手首の道具表示とRTSでの左手アクションに接続。
- v0.7iのセーブ形式と互換。実機UIは未検証。

## 2026-10-16 — v0.7j Frontier GLB GPUモーション

- GLB skeleton/skin/clip/FaceIdle/FaceTalking取り込み、GPU関節と口・まぶたのモーフ、基本埋込テクスチャ描画。
- 歩行・作業・会話/プレゼントに応じてキャラクター別再生。フォールバックと合成GLBテスト追加。
- v0.7iセーブ形式と互換。実高精細GLB・iPhone Safari描画は未検証。

## 2026-10-16 — Frontier World 第1段階の統合

3D惑星上の個人スタミナ・重量・所持品、有限資源採集、家への帰還とチェスト収納、8枠IF/THEN優先順位を連動。

# Planet Explorer — Change Log

## v0.7h — コンパクト操作 HUD (2026-10-16)

- スマホのプレイ画面を占有していた縦8個の操作ボタンを、常時表示の「⛶」と「☰ 操作」だけに整理。後者を開いたときのみカメラ切替・移動方式・RTS指揮・自動行動・読書・家具クラフト・詳細メニューが現れる（2列グリッド、タッチしやすい高さ42px）。
- 画面右下は「ジャンプ」と「⚒ 道具」の小型2ボタンに変更。剣・斧・採掘・建築は道具メニュー内に統合。小屋の入口は状況依存の「🚪 ドア」1ボタンから開閉・出入り・本棚操作を展開。
- 左下の仮想スティックを小型化し、半透明の操作レイヤーを整理。安全領域（iOS Safari safe-area）、縦横持ち表示とフルスクリーン切替に対応。
- メニュー外のタップまたはEscで閉じる。メニューの開閉状態はaria-expandedに反映し、既存のイベントリスナーと各種操作ボタンのIDを保持。カメラ・移動モードの切替は展開中に連続操作可能。
- **既存のロジック・セーブは無変更**：v0.7g の家具・野営・書籍、v0.7dのRTSと自動行動、旧版への復帰はそのまま。新しい保存データ形式は追加しない。
- テスト `compact-hud-v07h.test.mjs` で既存コマンドの所在・初期折りたたみ・キー／タップ操作・セーフエリアを確認。iPhone Safari実機での操作性チェックはこれから。

## v0.7g — Furniture / Craft / Kitchen / Portable Camp (2026-10-16)

- 新「🛠️ 生活・クラフト」メニューをゲーム画面とツールバーに追加。クラフト／持ち物／屋内家具／野営の4タブ、所持素材・体力・空腹・清潔・暖かさ・知識のHUDを提供。
- 屋内に配置できる家具：ベッド、椅子、机、暖炉、キッチン、本棚、ランプ、チェスト。木・石・繊維・粘土・金属からレシピに応じてクラフト。2Dフロアマップで位置（0.25mずつ）と向き（90°単位）を調節して設置・回収。扉・壁・他の家具と重なる位置を禁止。
- 以前のv0.7e/fの小屋のベッド・チェスト・机・椅子・ランプ・本棚を、各小屋の実際に操作可能な家具へ初回移行。完成後の小屋にも同じ基本家具のデモセットを自動生成（将来は空家モードも検討）。家具と建物の状態は別レイヤーで管理。
- ベッド（睡眠・休息）、椅子（座る・立つ）、机（本を読む・皿に配膳・食事）、暖炉（薪を使った点火・消火・保温・料理）、キッチン（調理・水汲み・食器洗い）、本棚（前版の本文読書）、ランプ（点灯・消灯）。着座・睡眠・調理・食事・読書など関節ポーズを追加。
- 皿、椀、コップ、鍋、スプーンを個別アイテム化。鍋と食材・薪で料理を作り、机で皿に盛って食べ、使用後の汚れた皿をキッチンで洗って再利用できる。椀＋料理とスプーンの食事、水とコップの飲用・洗浄にも対応。食器と料理は実際に3D机・キッチンに表示。
- 携帯式のテントとベッドロールを「アイテム兼建築」としてクラフト。野外で設置するとオリジナル3Dテント／ベッドロールを生成し、テントに入る・出る・寝る、ベッドロールで寝る、たたんで持ち物へ戻すことが可能。地形の水域・既存建物との近接をチェックし、アイテム数量を保持。
- 木を切ると繊維、採掘すると粘土・金属も得られる。屋外で簡易食材採集が可能。材料・料理・家具・携帯設備・人物状態を含む `v0_7g` データを保存。新セーブキー `universal-engine:explorer:v0.7g` は以前の `v0.7d` と分離、旧セーブ読み取り用ボタンを追加。生活アイテムは別の端末ローカル自動セーブも持つ。
- `lifestyle.mjs`、`lifestyle-geometry.mjs`、`lifestyle-ui.mjs`、`tests/lifestyle-v07g.test.mjs` を追加。既存の描画・RTS・読み書きと共存する回帰テストをCIで実行。
- **MVPの制約:** 携帯テントは簡易Aフレームでドア鍵や風雨物理は未実装。料理は簡易レシピで素材もデモ採集。ランプは光色の強弱表現のみ（周辺を照らす動的光源は未実装）。家具使用は室内メニューからも実行可能（実物までの歩行経路・手の物理接触は今後）。商業利用可能なオリジナル形状で構成。

## v0.7f — 読書可能な本・本棚・しおり (2026-10-16)

- 『いろは歌とことば』（古典本文全文＋オリジナル解説）、オリジナル物語『開拓者の手記 ― 最初の灯』、図鑑『テラ・ノヴァ自然観察帳』、生活書『炉辺の暮らし ― 食卓と道具』の全4冊を収録。外部通信不要の本物の本文として、章とページを閲覧できる。
- 小屋の内部に本の背表紙を並べた3D本棚を描画。「📚 本棚」ボタン、棚の3Dモデルタップ、画面右の「📖 読書」、画面メニューの「📚 本棚・読書」から読書画面へ。
- 読書画面は日本語組版に配慮した紙面色、章見出し、前後ページ操作、文字サイズ調整（15〜26px）。プレイヤー移動は読書中停止。PCの左右矢印・Escapeにも対応。
- 本は小屋の本棚から持ち出して所持品とし、野外で読むことができる。持ち物から本棚へ戻すことも可能。初期の完成小屋には4冊を収蔵。
- しおり・所持本・文字サイズは読書のたびに端末ローカルへ自動保存。ゲームの従来のv0.7dセーブにも任意データ `v0_7f` を保存し、本棚の在庫は既存の建物データと一緒に保存。旧セーブも読み込める。
- 著作権に配慮し、いろは歌は伝承パブリックドメイン作品、説明とほか3冊は新規のオリジナル文章。商用作品や未許諾の文章は含まない。
- `books.mjs` と `tests/books-v07f.test.mjs` を追加。本文の完全性、ページ分割、出し入れ、復元、UIの自動検証を追加。iPhone Safariでの実機視覚確認は未実施。既存の家具クラフト・読書レベル連動は今後。

## v0.7e — 小屋のドアと屋内への出入り (2026-10-16)

- 完成した小屋の壁に実際の開口部を設け、独立した蝶番付きドアを作成。3D画面でドアをタップするか、入口に近づいて「🚪 開ける／閉める」を押すとドアが回転して開閉する。
- 開いた入口をアバターが徒歩で通過可能。閉じたドア・小屋の外壁では衝突を判定し、壁抜けを防ぐ。「🏠 中に入る」「🌿 外に出る」でも出入りできる。
- 入室時に屋根を非表示にして、木床、ベッド、チェスト、机、椅子、照明器具の簡易3D室内と室内俯瞰カメラに切り替える。家具操作・所有権・部屋の自由編集は次の段階。
- 既存のv0.7d保存キーを維持し、任意の `v0_7e.insideId` を加えて屋内状態を保存。小屋のドア開閉は `actions.structures[].doorOpen` で復元する。旧版の読込機能・v0.6/0.7a/0.7bアーカイブはそのまま。
- `buildings.mjs` と `tests/interiors-v07e.test.mjs` を追加。GitHub ActionsでJS構文と全Nodeテストを実行し、既存v0.7dと旧v0.7cキーの共存も回帰検証する。
- **制約:** これは小屋の簡易内装とドア開閉の試験実装。室内のオブジェクト選択・ドア鍵・自由家具配置・他NPC追従・モバイル実機の描画品質検査は今後対応。

## v0.7d — RTS squad + conditional automation (2026-10-16)

- Three independently moving on-planet avatars (pioneer, scout, artisan) share a geographical origin and render with selection rings and differentiated companion colors. The old player controls remain available.
- New ⚓ RTS overhead mode: tap one character to select; select all or toggle multi-select to command several; tap land to move the selected squad in loose formation; set a rally point or stop (which also disables AI). Direct camera mode transitions and existing movement modes are preserved.
- 🤔 In-view automatic action panel: eight ordered IF-condition / THEN-action slots **per avatar**, each individually enabled, plus a per-person automation master toggle. Metrics: wood, stone, finished huts, idle flag, distance from leader and walked metres. Operators: <, <=, >, >=, ==, !=. Actions: gather wood/stone, build a demo hut, move to rally, follow, patrol, or wait.
- Per-character autonomous gathering and movement with manual override. This is a **small single-player demonstration**, not multi-device RTS networking or simulated economics/production chains. Existing building rules reuse the demo's globally shared resource/action state.
- Independent current save key `universal-engine:explorer:v0.7d`. Old v0.7c is read-only import; v0.7b/v0.7a/v0.6 archives and keys are unchanged. Frozen pre-RTS code branch: `universal-engine-v0.7c-before-rts`.
- Adds condition, select/order, schema and persistence tests; desktop/iPhone WebGL E2E and full repository npm tests must be verified in a runnable environment.

## v0.7c mobile viewport patch — 2026-10-16

- On first visit from a small touch device, launch the 3D scene in reversible CSS immersive mode. A visible in-scene button exits to all settings and older-version links; the manual choice lasts only within that browser tab.
- Add in-scene quick actions for fullscreen/return, six-camera cycling, joystick/tap movement, and an expandable tools drawer for saving, time controls and landing/orbit controls.
- Adapt the viewport and floating controls to dynamic iPhone Safari height, portrait/landscape and safe-area insets. No claim that a web page can remove Safari chrome or external platform UI.
- Give the ground view a daylight atmospheric sky through transparent WebGL clearing. Opaque orbital/space rendering remains unchanged. This is **not** yet distant mountain/ocean geometry.
- Keep the v0.7c save schema unchanged and the v0.7b/v0.7a/v0.6 runtime archives intact. Create GitHub rollback branch `universal-engine-v0.7c-before-mobile`.
- Add mobile viewport tests and update the fullscreen regression test. Browser/GPU visual checks on iPhone are still required.

## v0.7c — 2026-10-16 (experimental)

- Added six camera modes: legacy, following, over-shoulder, detached free, actor orbit and high tactical view.
- Added camera settings, drag rotation, free movement controlled by stick/WASD, actor portrait button and beacon.
- Added persistent independent v0.7c save, manual read-only import of v0.7b/v0.7a/v0.6.
- Archived whole v0.7b runtime and models at a separate URL; source rollback branches retained.
- Added camera projection/controls tests and save UI tests. Long-distance terrain and interiors remain future tasks.

## v0.7b — 2026-10-16 (experimental)

- Added ten original clothing presets, adjustable hats, capes, bags, hairstyles and independent fabric/hair dyes for three existing avatar bodies.
- Added seven expressive states, gaze, blink, eyebrows, eye and mouth meshes tied to v2 face pivots.
- Added UI settings panel and separate v0.7b saves, including explicit read-only import from v0.7a and v0.6.
- Archived v0.7a as a complete self-contained playable version and retained v0.6 archive and branches.
- Added wardrobe/expression regression tests; camera, far terrain and interiors remain future work.

## v0.7a — 2026-10-16 (experimental)
- Saved full v0.6 executable engine/demos/models under `versions/v0.6/`, plus independent GitHub branch for source-level rollback.
- Added direct two-way version navigation between v0.6 and v0.7a.
- Changed only the new version's localStorage key; import old v0.6 data read-only with explicit button.
- Added 60 semantic anatomical joints with exact old 21 pivot compatibility, smooth gait/action transitions, joint fillers and finger pieces.
- Added 11 v0.7a regression tests; old simulation, build, models and terrain tests remain valid.
- **Not a full v0.7 release:** expression/wardrobe/camera/distant terrain remain on the issue roadmap.

## v0.6 — 2026-10-16
- 12 unique original 3D models and self-contained binary GLB files; 3 avatar variants with rigid hierarchy and five GLB animation clips.
- Procedural model generation, GLB and OBJ exporters, interactive preview studio.
- Explorer's custom WebGL rendering upgraded to original avatar/environment/tool/building meshes, with avatar style switching and persisted selection.
- Model geometry/export regression tests, sources and model license documentation.
- Existing Frontier World and Kamoku Monitor files remain untouched.

## v0.5 — 2026-10-16
- Expanded the desktop and phone world viewport and widened the page layout.
- Added a fullscreen button with native Fullscreen API and CSS immersive fallback for iPhone Safari.
- Kept touch joystick, action palette, land-and-tap movement and HUD visible in expanded mode.
- Documented original-creator CC0 model/animation packs, free-tier details, integration steps and license cautions; no external assets imported.
- Added viewport regression tests. Existing simulators and Kamoku Monitor are untouched.

## v0.4 (2026-10-16)
- 関節21点（頭・首・手・腰・太腿・脛・足など）と独立低ポリゴン16身体部位、歩行/ジャンプ/剣/斧/採掘/建築のポーズ。
- 惑星重力によるジャンプ・着地。
- 画面左下の仮想スティック、地面タップのレイキャスト移動、アクションボタン。
- 採取資材（木/石）、段階的な小屋建築、建造物の惑星緯度経度保存。
- 保存形式の後方互換性と新しい操作系テストを追加。
- 変更は`universal-engine/`内に限定。

## v0.3 (2026-10-16)
- 新規 `planet-explorer/` に独立したブラウザ標準WebGL2の3D球体＋地面表示。
- 全球と局所で共通の地形標高・緯度経度・局所メートルを利用。
- 高度による描画LOD、宇宙⇄地表のズーム、アバターの歩行と簡易通行判定。
- マウス/タッチ回転、PCキー操作、スマホ方向ボタン、惑星時間停止・早送り。
- 別名前空間で保存・復元可能。
- ジオメトリ／描画モックを含む14項目の自動テスト、仕様書を追加。
- Universal Engineの入口を、v0.1〜v0.3デモのハブへ変更。
- Kamoku Monitor、Frontier Worldとそのデータは一切変更しない。
