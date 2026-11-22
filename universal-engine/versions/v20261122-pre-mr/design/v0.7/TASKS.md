# Universal Engine v0.7 — GitHub実装タスク表

**現状: v0.7c（6カメラモード/位置追跡）まで実験実装、全v0.7は進行中。** これはGitHubに切り出す単位のタスクリスト。各タスクは変更予定ファイル、受け入れ条件、依存先と概算をセットで扱う。最終的な工数・優先度はコード検証で見直す。

`PLAN`=設計中、`TODO`=未開始、`WIP`=実装中、`DONE`=検証済み（UE-701/702は一部実装済みだが、GPUスキニングや足ロック等が残るため未完了）。

| ID | 重要度 | タスク | 主な変更予定ファイル | 依存 | サイズ |
| --- | --- | --- | --- | --- | --- |
| UE-701 | P0 | v2骨格60点の定義、旧21関節互換 | `planet-explorer/rig-v2.mjs`, `original-assets/rig-mapping.mjs` | なし | M |
| UE-702 | P0 | AnimationGraph、slerp、歩行/走行/ジャンプ/道具のブレンド | `planet-explorer/animator.mjs`, `render.mjs` | 701 | L |
| UE-703 | P1 | 表情・視線・まばたき・感情状態 | `planet-explorer/expression.mjs`, `original-assets/original-models.mjs` | 701/702 | M |
| UE-704 | P0 | 衣装レイヤー＋10職業プリセット＋体格と髪 | `planet-explorer/wardrobe.mjs`, `original-assets/original-models.mjs`, `app.mjs` | 701 | L |
| UE-705 | P0 | 6カメラモードと専用設定UI | `planet-explorer/camera-controller.mjs`, `render.mjs`, `app.mjs`, `index.html`, `style.css` | なし | L |
| UE-706 | P0 | 遠景地形・海・谷・川・地平線・描画LOD | `planet-explorer/distant-terrain.mjs`, `geo.mjs`, `render.mjs` | 705 | XL |
| UE-707 | P1 | 高高度追従、アバター位置マーカー/拡大窓 | `planet-explorer/actor-marker.mjs`, `render.mjs`, `app.mjs` | 705/706 | M |
| UE-708 | P0 | 設定保存・旧セーブ移行・ユーザー操作回帰 | `planet-explorer/settings.mjs`, `app.mjs`, `tests/*.test.mjs` | 701〜707 | L |
| UE-709 | P0 | 実機描画・性能・アクセシビリティ・完成判定 | `tests/*`, `design/v0.7/RELEASE_CHECKLIST.md` | 701〜708 | L |

**v0.7a進捗:** 60関節のデータ構造と旧21関節互換、補間アニメーション、関節カバーまで試験実装済み。UE-701とUE-702の全完了条件は未達。GitHub復帰用v0.6保存版とセーブ分離も実装済み。

## UE-701 — 60関節リグ

実装:
- [ ] `RIG_V2`で各関節の `id,parentId,bindTranslationM,limitsRad,lodGroup` を宣言。
- [ ] 旧21ピボット名がそのまま動き、`jointTransforms`を壊さない。
- [ ] 新しい背骨3部位・鎖骨・上腕/前腕ツイスト・指10×両手・顎/眼・脚ツイスト/足先を追加。
- [ ] バインドポーズの骨長/回転をチェックし、ポーズの循環参照を拒否。
- [ ] 衣装・外部GLBへのリターゲット用 `boneAlias` を定義。

受入:
- 60点・欠損0・同名0・親なしはpelvisのみ。
- 既存歩行/ジャンプ/斧等の`samplePose`と旧3アバターを回帰確認。
- テスト: `rig-v2.test.mjs`、決定論・角度上下限・階層変換。

## UE-702 — 滑らかな動作

実装:
- [ ] `Animator`に状态遷移と前/後モーション時間補間を追加。
- [ ] quaternion slerp、フレームレート非依存のblend時間。
- [ ] 立脚中の足位置ロック（地表勾配も考慮）と重心揺動。
- [ ] 腕の装備攻撃と歩行を独立レイヤー、ジャンプ優先度を定義。
- [ ] `toolAttachment`と将来の2手持ちIKターゲットを公開。

受入:
- 60→30FPSで同じ時刻の姿勢が許容誤差内。
- 歩行→停止・走行→ジャンプ・剣→待機で姿勢角の急変なし。
- 元の`Actions`の実行時間・資材増加を変えない。

**v0.7b進捗:** UE-703/704の基本的な感情7種・視線・まばたき、衣装10種、帽子/マント/髪/鞄/色替えと独立セーブを実装。厳密なIK、複数NPC・関係性、布の物理、自由カメラ、モバイル実機QAは未完了。

## UE-703 — 表情・視線・キャラクター性

実装:
- [ ] `EmotionState`と`ExpressionController`、6表情の重み付け。
- [ ] 顎/目線/眉/まばたきの簡易可動メッシュを追加。
- [ ] 相手のEntity IDをターゲットに設定し、会話/別れ/喜びの非言語反応を試す。
- [ ] 画面設定の表情プレビュー、OFF/省電力のオプション。

受入:
- 笑顔・驚き・悲しみ・警戒・疲れ・平常が視認可能。
- 更新順による不連続や異常なまばたき、NaNなし。
- 感情値は社会AIとは別に保存可能。

## UE-704 — 衣装とアバター編集

実装:
- [ ] `AvatarAppearance`の10スロット/髪/顔/体格/色モデル。
- [ ] 衣装10プリセット（開拓者・斥候・職人・農民・商人・司祭・衛兵・狩人・旅人・村人）。
- [ ] 帽子/マント/バッグ/ベルト/靴などを個別GPUパーツに分ける。
- [ ] 差分パーツのみGPU再生成、装備と衝突しない簡易シルエット調整。
- [ ] スマホ対応ワードローブUI＋選択時プレビュー＋元に戻す。

受入:
- 人物A/Bで別々の装いを保持、各関節が服と連動。
- 10プリセットの保存復元に成功、未知IDは安全な初期値へ。
- 単一の衣装切替で世界の地形GPUバッファは再生成されない。

**v0.7c進捗:** カメラ6モード、距離/FOV/追従係数設定、自由移動時の人物座標不変、人物を正面から見るモード、30m〜18kmの俯瞰と地上/全球マーカー、旧セーブ保護を実装。障害物回避、シームレスな全球LOD、実iPhoneでの視認性などは未完了。

## UE-705 — カメラ設定

実装:
- [ ] `CameraController`を`ExplorerController`から分離し、本人の位置は不変。
- [ ] legacy / follow / shoulder / free / orbitTarget / tactical の6モード。
- [ ] スムーズなモード遷移/距離/高さ/回転感度/FOVを追加。
- [ ] 遮蔽と地面へのめり込み防止、Freeモードのスティック割当。
- [ ] 設定画面・現在モード表示・保存/復元。

受入:
- 6モードを連続切替しても本人が移動せず、Legacyに戻せる。
- 地上/宇宙/建築時に設定を変えても操作ボタンが使える。
- ピッチ/FOV/距離に範囲チェック、無限大・NaNを拒否。

## UE-706 — 遠景と水系（最大の作業）

実装:
- [ ] `terrainSurface`に従う近景〜遠景リングLODと法線、背景スカート。
- [ ] 海面、川の河道、谷と河岸が一致する座標/高さデータ。
- [ ] カメラの高度と球面曲率から地平線距離を計算。
- [ ] LODパッチ境界のクラック解消、再生成スパイク削減。
- [ ] 眺望検証の3地点を同じseedから固定（海沿い、山脈、川谷）。
- [ ] 省電力設定：描画距離、森林密度、解像度スケール。

受入:
- 上記3地点から指定方向で海・山・谷・川・水平線を地理的に正しく確認。
- 1km/10km/100km相当で地形/水の継ぎ目なし。
- 保存/復元、日付変更線、高緯度で同じ標高。

## UE-707 — 高高度でも人物を見失わない

実装:
- [ ] `actorId`の緯度経度と画面座標の投影を統一。
- [ ] 追従ONで100m〜10km上空から人物の位置を指示するマーカー。
- [ ] 俯瞰時に任意の小窓で人物を拡大、縮尺の違いを表示。
- [ ] UIの人物マーカーON/OFFとオフスクリーン方位矢印。

受入:
- 距離により位置マーカーを非表示/変換せず正しく維持。
- カメラを動かしても`actorId`の指す人物が別人にならない。

## UE-708 — セーブと既存UI保護

実装:
- [ ] `universal-engine:explorer:v1`の旧セーブを読み込み、新設定を補完。
- [ ] 新規フィールド `v0_7`のバリデータ、エラー時の元セーブ保護。
- [ ] スティック/タップ移動、ジャンプ、剣、斧、採掘、建築、全画面の回帰テスト。
- [ ] v0.6のオリジナル12GLBとモデル工房に変更がないことを確認。

受入:
- 同じセーブで惑星日数・建物・資材・本人緯度経度が完全維持。
- 衣装とカメラの設定を変えても旧`Actions`の行動結果が一致。

## UE-709 — 動作測定と完成判定

実装:
- [ ] `npm test`（Node 20+）を実環境で実行。
- [ ] PCブラウザ、iPhone Safariで操作・カメラ・衣装/表情描画を確認。
- [ ] FPS平均・1%低FPS・フレームp95・地形読み込み停止時間を記録。
- [ ] 低負荷モード、44px以上のタッチ領域、UI重なり・画面回転を点検。
- [ ] Kamoku MonitorとFrontier WorldがGitHub差分に含まれないことを確認。

受入:
- 自動テストを全て通過、実機テスト結果を記録。
- 実機目標: iPhone WebGL2対応機で30FPS、PCで50〜60FPS（目標であり現時点の測定値ではない）。
- 既存保存・起動時の回帰なし。

## 提案する実装順序（リリースの切り方）

1. **v0.7a: 気持ちよく動く人物** — UE-701, UE-702（既存操作を壊さず滑らかな歩行へ）
2. **v0.7b: 見た目と人格** — UE-703, UE-704（表情と衣装編集）
3. **v0.7c: 旅のカメラ** — UE-705, UE-707（自由視点と高高度追従）
4. **v0.7d: 遠景地球** — UE-706（山/海/谷/川/水平線）
5. **v0.7 release** — UE-708, UE-709（保存・検証・公開）

各段階で必ず動作するデモを残し、局所機能だけ段階的に反映。v0.6や他ゲームを直接変更しない。

## 後続の接続点（今回の実装対象外）

- **v0.8 屋内と家具:** 建物内のroomId、ドア、壁・床・天井、家具・照明、壁画/壁材メタデータの初期仕様。実装時にはカメラの屋内クリッピングを追加する。
- **v0.9 村・家族・コミュニティ:** Actor/Building/Communityの安定IDで家・住人・職場・資源の関係を結ぶ。
- **v1.x モデリング/壁ペイント/動画投影:** 編集/取り消し/権限/ライセンス/コンテンツ審査/動画配信ソースを切り離す。WebGLテクスチャと外部映像URLは信頼できるソースのみ許容。

関連: [実装仕様](SPEC.md) / [状態スキーマ](DATA_SCHEMAS.md)。

## GitHub Issueへのリンク（登録済み）

- [UE-701 — Issue #4](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/4)
- [UE-702 — Issue #5](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/5)
- [UE-703 — Issue #6](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/6)
- [UE-704 — Issue #7](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/7)
- [UE-705 — Issue #8](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/8)
- [UE-706 — Issue #9](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/9)
- [UE-707 — Issue #10](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/10)
- [UE-708 — Issue #11](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/11)
- [UE-709 — Issue #12](https://github.com/hublab055-crypto/kamoku-world-monitor/issues/12)
