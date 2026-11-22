# Universal Engine v0.7 — データ構造とAPI契約案

**状態:** Proposal / 尚未実装。コード上の正式型ではなく、v0.7開発で取り入れるシリアライズ仕様案。単位は**m, 秒, ラジアン**、角度UIのみ度表示。

## 1. World / Entity識別

- `worldId`: "terra-nova" などの世界固有ID
- `actorId`: 各人物ごとの安定ID（セーブ/復元/村への加入後も維持）
- `assetId`: モデルの出所とバージョンが特定できる値（現行は`pioneer`,`scout`,`artisan`）
- `buildingId`: 惑星緯度経度で固定される建築物
- `roomId` / `furnitureId`: v0.8以降の屋内オブジェクト予約
- `communityId`: v0.9以降の村識別子予約

同じIDでも別`worldId`をまたぐと同一物体ではない。`{worldId,entityId}`を組として扱う。

## 2. AvatarAppearance

```json
{
  "schemaVersion": 1,
  "actorId": "actor:player-1",
  "baseModelId": "pioneer",
  "body": {
    "heightScale": 1.0,
    "shoulderWidth": 1.0,
    "armLength": 1.0,
    "legLength": 1.0
  },
  "face": {
    "presetId": "face:01",
    "hairStyleId": "hair:short",
    "eyeColor": "#4b6f74",
    "skinColor": "#d6a47a"
  },
  "wardrobe": {
    "base": "base:linen",
    "inner": "inner:shirt",
    "outer": "outer:pioneer-coat",
    "legs": "legs:trousers",
    "feet": "feet:leather-boots",
    "head": null,
    "gloves": null,
    "cape": null,
    "belt": "belt:utility",
    "bag": "bag:leather"
  },
  "dyes": {
    "outer": "#33766c",
    "inner": "#e8d5ac"
  },
  "presetId": "pioneer"
}
```

制限: 身長倍率0.75〜1.35、腕・脚倍率0.80〜1.20、RGBは`#RRGGBB`、各アセットIDは登録済み値のみ。不正値はロード拒否か既定値補完のどちらかを仕様に記録し、勝手に外部モデルを読み込まない。ID/色は描画設定であり、身体の能力値は別コンポーネントとして扱う。

## 3. RigDefinition / Pose

```json
{
  "schemaVersion": 2,
  "rigId": "humanoid:ue-v2",
  "rootJointId": "pelvis",
  "joints": [
    {
      "id": "pelvis",
      "parentId": null,
      "bindTranslationM": [0, 0.96, 0],
      "limitsRad": {
        "x": [-0.5, 0.5],
        "y": [-0.75, 0.75],
        "z": [-0.5, 0.5]
      },
      "lodGroup": "base",
      "semantic": "hips"
    },
    {
      "id": "waist",
      "parentId": "pelvis",
      "bindTranslationM": [0, 0, 0],
      "limitsRad": {
        "x": [-0.55, 0.55],
        "y": [-0.7, 0.7],
        "z": [-0.4, 0.4]
      },
      "lodGroup": "base",
      "semantic": "spine"
    }
  ]
}
```

例は2ボーンのみ（正式な全60関節定義はUE-701が生成する）。

**AnimationPose API案:**

```js
const pose = animator.update(dtSeconds, {
  actorId,
  locomotion: { speedMps, yawRad, grounded, jumpHeightM },
  action: { kind: "axe", progress01: 0.45 },
  emotion: emotionState
});
const worldMatrices = evaluateHierarchy(rig, pose, avatarTransform);
```

- 角度は関節ごとのquaternion`[x,y,z,w]`が標準。UIのEuler角は編集専用。
- 旧`samplePose`は`AdapterLegacyPose`へ移管し、最終行列は`jointTransforms`の現行と同じ親子座標系。
- 指/目/眉の表情は毎フレーム更新するが、外見設定そのものは毎フレーム保存しない。

## 4. EmotionState

```json
{
  "schemaVersion": 1,
  "actorId": "actor:player-1",
  "values": {
    "joy": 0.55,
    "sadness": 0.02,
    "anger": 0.0,
    "fear": 0.08,
    "trust": 0.6,
    "fatigue": 0.15,
    "attention": 0.8
  },
  "gazeTarget": {
    "worldId": "terra-nova",
    "entityId": "actor:friend-1"
  },
  "expressionPreset": "neutral",
  "autoblink": true
}
```

感情値は[0,1]。記憶、人間関係、性格は別コンポーネント（v0.9で設計）。`gazeTarget`が無効または異世界なら視線は中立へフェード。目線だけで人物位置を変化させない。

## 5. CameraState

```json
{
  "schemaVersion": 1,
  "mode": "follow",
  "target": {
    "worldId": "terra-nova",
    "entityId": "actor:player-1"
  },
  "freeAnchor": {
    "lat": 29.0,
    "lon": 39.0,
    "altM": 85
  },
  "yawRad": 0.0,
  "pitchRad": -0.3,
  "rollRad": 0.0,
  "distanceM": 8.0,
  "fieldOfViewDeg": 65,
  "followEnabled": true,
  "followStiffness": 7.5,
  "shoulderSide": "right",
  "avatarIndicator": "auto",
  "horizonLock": true,
  "inputSensitivity": 1.0,
  "modeSettings": {
    "tactical": {
      "heightM": 250,
      "targetLock": true
    }
  }
}
```

`mode` は `legacy | follow | shoulder | free | orbitTarget | tactical`。
`avatarIndicator` は `auto | on | off`。`shoulderSide`は`left | right`。ピッチ-1.4835〜+1.4835rad、FOV35〜90deg、`followStiffness`は0.1〜20。画面操作時のピッチ/高度はジオメトリと干渉しない範囲で補正する。

**Camera API案:**

```js
camera.setMode("follow", { transitionSec: 0.45 });
camera.setTarget({ worldId, entityId: actorId });
camera.setFov(65);
camera.setAltitude(120);
const view = camera.update(dtSeconds, world, rendererQueries);
// returns { viewMatrix, projectionMatrix, worldEye, viewTarget,
//           actorIndicator, lodHint, visibleHorizonM }
```

## 6. Explorer save: 後方互換

旧セーブのルートをそのまま維持し、追加する状態をネストする。**現時点のv0.6セーブをGitHub上で上書き/変換しない**。

```json
{
  "format": "ue/explorer-demo",
  "version": 1,
  "planet": {},
  "explorer": {},
  "universe": {},
  "actions": {},
  "avatarStyle": "pioneer",
  "v0_7": {
    "schemaVersion": 1,
    "appearanceByActorId": {
      "actor:player-1": {}
    },
    "emotionByActorId": {
      "actor:player-1": {}
    },
    "camera": {},
    "renderOptions": {
      "terrainQuality": "medium",
      "avatarJointLod": "auto",
      "showGaze": true,
      "reduceMotion": false
    }
  }
}
```

上記の`{}`は説明用の省略表現。実装テストでスキーマを固定するまでは`v0_7`を保存してはならない。

**マイグレーション方針:**

1. `format`と`version`を検証。
2. v0.6で`v0_7`欠如→`avatarStyle`から外見既定値、表情はneutral、カメラは`legacy`。
3. `v0_7`があり有効→保存値を読み込む。
4. 無効値はエラーをログ/画面へ伝え、元データは`localStorage`に残す。
5. 明示的な「保存」を実行するまで既存セーブを変更しない。
6. 正式`version:2`移行時は元データを`backup`キーへ複製してからマイグレーション。

## 7. Building / Room / Furniture (v0.8向け)

```json
{
  "building": {
    "id": "building:hut-0001",
    "worldId": "terra-nova",
    "assetId": "hut",
    "anchorGeo": {"lat": 29, "lon": 39, "altM": 152},
    "yawRad": 0,
    "roomIds": ["room:hut-0001-main"],
    "ownerId": "actor:player-1"
  },
  "room": {
    "id": "room:hut-0001-main",
    "buildingId": "building:hut-0001",
    "ceilingHeightM": 3.2,
    "furnitureIds": ["furniture:chair-01"]
  },
  "furniture": {
    "id": "furniture:chair-01",
    "assetId": "furniture:wooden-chair",
    "roomId": "room:hut-0001-main",
    "transform": {
      "x": 1.4,
      "y": 0,
      "z": -0.8,
      "yawRad": 1.57
    },
    "interactions": ["use", "clean", "repair"]
  }
}
```

壁表面に`paintLayerIds`と`projectionSlotId`を追加できる予約フィールドはv1.0以降。外部動画URLを自由入力して再生する機能は現段階で有効化しない（権利、閲覧者同意、読み込み元制限が必要）。

## 8. Community (v0.9向け)

```json
{
  "id": "community:alpha",
  "worldId": "terra-nova",
  "settlementAnchor": {"lat": 29, "lon": 39, "altM": 152},
  "memberIds": ["actor:player-1", "actor:friend-1"],
  "householdIds": [],
  "workplaceIds": [],
  "resourceLedgerId": "ledger:alpha",
  "roles": {"actor:friend-1": "woodcutter"}
}
```

v0.7では型だけ設計し、NPC生成・社会AI・家族/市場/村所有関係の実装は行わない。

## 9. 入力検証とバージョン

- すべてのfloatは有限値、`altM`は惑星半径を超える飛行時にも扱えるdouble精度を使う。
- 氏名/説明文はユーザー文字列としてHTMLにそのまま挿入せず`textContent`で描画。
- 外部`assetId`は登録済み辞書のみ、外部URLパス文字列をそのままファイル読込には使わない。
- `WorldEntity`所属世界を明示し、別惑星の既存建物を誤って描かない。
- 任意のアバター・カメラ設定にセーブとロードの往復テストを必須とする。
