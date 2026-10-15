# Frontier World｜盗賊の部位別PNG・関節リグ仕様 v1
更新: 2026-10-15 / ステータス: **仕様確定用のたたき台。部位別完成PNGは未制作**

## 1. 画風
既存の「盗賊 四方向・モーション指示シート」に寄せる。暗色フード、目元の光、革鎧、長いマント、両手の短剣、重厚な描き込みを維持。単純な棒人間に置換しない。衣服・鎧・袖口で関節を自然に覆い、パーツ同士を原寸400×480px上で6～12px程度重ねて継ぎ目を隠す。背景・関節ガイド点・文字は部位PNGへ含めない。

## 2. 座標と画像サイズ
- **MON2関節編集座標**: 幅200×高さ240の論理単位、原点は左上、X右・Y下。初期足首のYは約216。
- **原画マスター**: 400×480px RGBA透明キャンバス（論理1単位=2px）。関節位置の原画座標は `[x*2, y*2]`。
- **画像PNG**: 初期は共通キャンバスで別レイヤー制作し、書き出し時にアルファの有効範囲+8px余白で切り詰める。トリム矩形 `cropPx=[x,y,w,h]` を方向×部品別に記録する。
- **最終出力**: ゲームスプライト1コマ128×128px（縮小時の品質を確認）。アニメーションは4または8コマ、正面/front・左/left・右/right・背面/backの4方向。
- **互換性**: 既存エディタの `L/R` は現状「画面の左側/右側」関節名として継承し、解剖学的な左右に自動変換しない。左右の絵は専用PNGを描き、単純な鏡像反転は原則しない。

## 3. ファイル設計
保存先（予定）: `frontier-world/assets/monsters/thief/<direction>/<part>.png`。
定義JSON: `frontier-world/data/monster-rigs/thief.parts.json`。

|部位ID（PNG名）|支点／追従先|意味|
|---|---|---|
|shadow|地面固定|半透明の足元影|
|cape_back|neck、torso角度追従|背面マント|
|hood_tail|neck、head角度追従|後ろフードの布|
|thigh_l / thigh_r|hipL→kneeL / hipR→kneeR|左右太もも|
|shin_l / shin_r|kneeL→footL / kneeR→footR|左右すね|
|foot_l / foot_r|footL / footR、各shin角度継承|左右ブーツ|
|pelvis|waist、torso角度継承|腰布・骨盤|
|torso|neck→waist|胴体と革鎧|
|belt|waist、torso角度継承|ベルト・継ぎ目隠し|
|upper_arm_l / upper_arm_r|shoulderL→elbowL / shoulderR→elbowR|左右上腕|
|forearm_l / forearm_r|elbowL→handL / elbowR→handR|左右前腕・篭手|
|hand_l / hand_r|handL / handR、各forearm角度継承|左右手|
|head|neck→head|フード・顔|
|scarf|neck、torso角度継承|首元布|
|dagger_l / dagger_r|handL / handR、各forearm角度継承|短剣・柄を握り支点に|

**22種類×4方向＝88枚の部位PNG**（描画効果や表情差分は追加可能）。命名は小文字スネークケース。左右の武器の柄位置も各画像で校正する。

## 4. 支点の定義
各部品の `pivotJoint` と、ボーンに沿う `axisJoint` を保存。例えば `upper_arm_r` の支点は `shoulderR`、追従先は `elbowR`。首の支点は `neck`、頭の追従点は `head`。画像をトリムする際、原画マスター上での支点 `[jointX*2,jointY*2]` から `cropPx.xy` を引いたものが部位画像ローカルの支点になる。**切り出しの結果、支点が画像外へ出ても有効**。

回転:
```
restVector = defaultPose[axisJoint] - defaultPose[pivotJoint]
poseVector = currentPose[axisJoint] - currentPose[pivotJoint]
rotation = atan2(poseVector.y, poseVector.x) - atan2(restVector.y, restVector.x)
```
画像の描画中心を、現在コマの `pivotJoint` に移す。手・ブーツ・短剣・腰帯・マント等は親ボーンの回転を継承する。腕や脚の伸縮は原則させず、長さ不一致時は警告する。極端なポーズ用の補助的な拡大縮小は将来検討する。

## 5. 4方向の描画順
`thief.parts.json` に方向別 `layer` を持つ。
- 正面: 影→背面マント→脚→腰→胴→腕→フード頭→スカーフ→短剣。
- 背面: 影→脚→腰→胴→腕→頭→短剣→背中マント（部分的に前後2枚へ分割する場合あり）。
- 左右: 奥側の腕/脚→胴→手前側の腕/脚/短剣。どちらが手前かは方向別で指定。
- 手先と短剣の**握り位置**を優先。肩・膝・腰は衣装を重ねて継ぎ目を隠す。

## 6. コマ別モーション
現在のMON2 `frontierMonsterPoseEditorV1` の保存形式をそのまま使う。
```json
{
  "schemaVersion": 1,
  "count": 4,
  "poses": {
    "thief:attack:front:4:0": {
      "head":[100,35], "neck":[100,57],
      "shoulderL":[78,69], "elbowL":[68,107], "handL":[64,144],
      "shoulderR":[122,69], "elbowR":[136,107], "handR":[141,144],
      "waist":[100,128],
      "hipL":[87,136], "kneeL":[78,175], "footL":[71,216],
      "hipR":[113,136], "kneeR":[122,175], "footR":[132,216]
    }
  }
}
```
`thief:<idle|walk|chase|attack|hurt|death>:<front|left|right|back>:<4|8>:<0-based frame>`。モーションと向きとコマ数は別データ。武器角度やパーツ個別の微修正は将来の `partOverrides` に分離し、既存15関節JSONを壊さない。

## 7. 制作・検証工程
1. 最初は**盗賊／正面／待機**で22個の透過レイヤーを制作。下に隠れる肩・肘・膝・股を描き足しておく。
2. 制作済み原画を方向別に400×480上へ配置し、透明アルファをトリム。全PNGに `cropPx` を記録する。
3. PNG読み込みレンダラーをMON2へ接続。仮ベクター描画と切替可能にする。
4. 正面で待機4コマ→歩行→攻撃→被弾/倒れるを検証。うまくいったら左・右・背面を作る。
5. 手から柄が離れないこと（表示上2px以内目標）、接合が目立たないこと、ループが滑らかなこと、全画像透過であること、JSON再読込時に姿勢が同じことを確認。
6. iPhone Safariとゲーム本編を実機で確認してから本編へ組み込む。

## 8. 現状の範囲
**仕様とパーツ参照先の定義まで**。88枚の完成PNGは今後のアート制作工程。参照先が存在しないままゲーム本編がアクセスすることは避ける。現行MON2は関節の位置調整と仮ベクター描画まで実装済みで、切り抜いた原画のパーツが動く状態ではない。

参考: [モンスター構想](./MONSTERS.md)｜[MON2エディタ](./sprite-asset-test/monster-rig.html)
