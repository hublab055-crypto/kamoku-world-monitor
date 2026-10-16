# UniversalENGINE v0.7i — Frontier World GLB / Social / Equipment / RTS

更新: 2026-10-16

## 実装

- Frontier Worldの男性・女性GLBをUniversalENGINEのネイティブWebGL2表示に取り込む導線を追加。既存FrontierのIndexedDB（`frontier-3d-avatar-cache`）を参照し、GitHub Pagesに実GLBが存在する場合は `frontier-world/assets/avatars/frontier_{male,female}_{high,mobile}.glb` を試す。
- 男性／女性GLBの個別ファイル取込（85MBまで）、セッションを超えたキャッシュ。開拓者・斥候・職人それぞれでモデル割当（男性／女性／従来）を選べる。
- 取り込んだGLBをNative WebGLの三角形メッシュとして描画する。未登録時は既存の関節付き人物モデルを使用。取り込みが失敗してもゲーム全体は継続する。
- 会話コマンド：相手が4m以内にいると会話。3種類の親密度帯に応じた短い台詞、親密度+1、人物別ログ。
- プレゼント：アイテムが実際に1個減少し、相手の受領リストへ記録。親密度+4（料理は+7）。距離4m超や在庫ゼロでは不成立。ゲーム全体保存に反映。
- 5装備スロット：人物別に割当・選択し「使う」で使用。1〜5キーで選択、Uキーで実行。剣/斧/つるはしのアニメーション、コップ/椀/スプーンの食事動作、料理・水の消費、ベッドロール設置、本の読書に接続。RTS選択中NPCの剣/斧/つるはし使用を追加。
- RTS俯瞰：「進行方向を上にする」をチェックでON/OFF。既定はOFF。選択した人物の向きに世界表示を合わせる。カメラ設定でも操作可。
- 新しいセーブキー `universal-engine:explorer:v0.7i` に、交流・スロット・モデル割当・カメラ向きを保存。旧v0.7gを上書きしない。復元時にv0.7iがなければv0.7gを読み込み可能。

## GLB取り込みの制限

1. v5のGLB実体はフロンティアワールド側GitHubに未同梱。ZIPを持っている場合は解凍して `frontier_male_high.glb` `frontier_female_high.glb` を選択する。
2. **v0.7jでGLBのGPU骨格スキニング、顔の2つのモーフ、GLBアニメーションクリップ、埋め込み画像テクスチャに対応**。ただしglTF全拡張と独自モデル仕様には未対応のため、完全再現を保証しません。
3. ノード階層TRS・inverseBindMatrices・最大4骨ウェイト・LINEAR/STEP/CUBICSPLINE補間を取り込みます。対応していない圧縮/メッシュ拡張、5本目以降の骨ウェイト、最初の2つを超えるモーフターゲットは非対応です。
4. ZIP直接入力は未対応（GLB単体の選択が必要）。高精細GLBの距離別LOD自動切替は未実装で、iPhoneではmobile版の利用を推奨します。読み込みに失敗した時は従来の3Dアバターへフォールバックします。

## 動作確認

- JSXではなくESモジュール構文確認とHTML ID検査を実施。
- 数値ロジック：会話・親密度・贈り物の数量移動、所持記録の保存、5スロット、ベッドロール判定を確認。
- 合成GLBを利用し、44/46骨を想定したGPU骨行列データ転送、歩行時の関節位置変化、FaceTalkingの口モーフ、人物別の独立再生を確認。自動テスト4件を追加。実際の50k高精細GLBとiPhone Safariでの実機描画は未確認。

## 次段階

- 高精細/軽量GLBの距離別LOD、装備手持ちメッシュ、glTFの追加拡張、より自然なアニメーションクロスフェードと受領モーション、NPCの会話ツリー・自律会話。

## v0.7j (2026-10-16) アニメーション拡張

- `frontier-animated.mjs`：GLB2のスキン、逆バインド行列、ノード親子階層、GLBアニメーションクリップ、目と口のモーフ値を抽出・サンプリング。
- `frontier-skinned-renderer.mjs`：WebGL2スキニングを骨行列のfloatテクスチャで実装。各キャラ別の時計でWalk/Idle/Chop/Sit/Talk/FaceIdle/FaceTalking等を再生し、埋込テクスチャを使用。
- `render.mjs`：プレイヤー・NPCの移動/作業情報をGLBクリップへ接続。話す・贈る操作で約2秒間ソーシャルモーションに切替。描画エラー時は従来モデルに切替。
- `frontier-interaction-ui.mjs`：男性/女性GLB読み込み時にGPUアニメーションを設定し、状態とクリップ数を表示。
- `universal-engine/tests/frontier-animated.test.mjs`：GLB構造、歩行骨、表情、GPU行列転送、独立タイムラインの4テストを追加。
- セーブ形式はv0.7iと同じ。旧v0.7gセーブを保護。
