# Universal Engine — バージョン切替とロールバック

このディレクトリはゲームの**旧バージョンへ戻るための独立アーカイブ**です。

| バージョン | プレイ | セーブキー | 性質 |
| --- | --- | --- | --- |
| [v0.6 旧安定版](./v0.6/planet-explorer/) | 旧版へ戻る | `universal-engine:explorer:v1` | 独立したコア・地形・人物・モデル工房を保存 |
| [v0.7a 旧版](./v0.7a/planet-explorer/) | 旧版へ戻る | `universal-engine:explorer:v0.7a` | 60関節・滑らかな補間・指と関節カバー |
| [v0.7b 保存版](./v0.7b/planet-explorer/) | 旧版へ戻る | `universal-engine:explorer:v0.7b` | 衣装・表情・視線・まばたき |
| [2026-11-22 MR導入前の保存版](./v20261122-pre-mr/planet-explorer/) | 独立した旧実行版へ戻る | `ue:archive:20261122:pre-mr:*` | 旧プログラム・GLB・依存コードを保存。旧版での変更は専用の保存領域に隔離 |
| [v0.10.0 MRアバター召喚](../planet-explorer/) | 新版をプレイ | `universal-engine:explorer:v0.7i` | Quest 3S MRでV10副官・クルー等を最大4人投影（試験機能） |
| [v0.7c 旧実装](https://github.com/hublab055-crypto/kamoku-world-monitor/tree/universal-engine-v0.7c-before-rts) | 固定ソース | `universal-engine:explorer:v0.7c` | 6カメラモードと上空マーカー |

**操作:** v0.7aの上部から「↶ v0.6に戻る」を開く。v0.6の上部には「新しいv0.7aへ」があります。トップページからも両バージョンを選べます。

**セーブの扱い:** v0.6とv0.7aで`localStorage`のキーを分けており、どちらでセーブしてももう一方のキーを上書きしません。v0.7aの「v0.6データ読込」は旧キーを読み込むだけで、旧キーを書き換えず、保存操作を行うまでは新版セーブも変更しません。

**注意:** この仕組みは同じ端末/ブラウザのストレージで動きます。別端末へは自動同期しません。ブラウザデータを消去すると両方のセーブデータが消えます。

**将来の方針:** 新バージョン公開時は`versions/vX.Y/`へ旧実行モジュール・デモ・GLBを固定し、独立URLとセーブキーを追加する。変更は`universal-engine/`だけで、Kamoku Monitor/Frontier Worldには接続しません。

元のv0.6コミットから完全に復元したい場合は[バックアップ用GitHubブランチ](https://github.com/hublab055-crypto/kamoku-world-monitor/tree/universal-engine-v0.6-stable)を使用してください。


## 2026-11-22 MR導入直前版の保存方法

独立実行URLは [v20261122-pre-mr](./v20261122-pre-mr/planet-explorer/)。同じディレクトリ階層にその時点の `planet-explorer/`、`original-assets/`、`planet/`、`core.mjs` 等をGitオブジェクト単位で固定コピーしており、新版の依存コードを読み込みません。

正確なソース全体は [GitHubアーカイブブランチ](https://github.com/hublab055-crypto/kamoku-world-monitor/tree/archive/universal-engine-pre-mr-20261122) （コミット `1ac24287ad89bb7298104a46b2fbf3c96f4a41d7`）に保存しました。旧版のページはブラウザ内で保存キーを独立名前空間に変換し、最初に旧キーを読む場合だけ値を複製します。**古い値を新版に書き戻したり、現行セーブキーを削除したりしません。** 明示的な相互インポートは別機能です。

実機VR/MRの動作検証は別途必要です。
