# Universal Engine — バージョン切替とロールバック

このディレクトリはゲームの**旧バージョンへ戻るための独立アーカイブ**です。

| バージョン | プレイ | セーブキー | 性質 |
| --- | --- | --- | --- |
| [v0.6 旧安定版](./v0.6/planet-explorer/) | 旧版へ戻る | `universal-engine:explorer:v1` | 独立したコア・地形・人物・モデル工房を保存 |
| [v0.7a 旧版](./v0.7a/planet-explorer/) | 旧版へ戻る | `universal-engine:explorer:v0.7a` | 60関節・滑らかな補間・指と関節カバー |
| [v0.7b 最新試験版](../planet-explorer/) | 新版を試す | `universal-engine:explorer:v0.7b` | 衣装と表情・髪・視線・まばたき |

**操作:** v0.7aの上部から「↶ v0.6に戻る」を開く。v0.6の上部には「新しいv0.7aへ」があります。トップページからも両バージョンを選べます。

**セーブの扱い:** v0.6とv0.7aで`localStorage`のキーを分けており、どちらでセーブしてももう一方のキーを上書きしません。v0.7aの「v0.6データ読込」は旧キーを読み込むだけで、旧キーを書き換えず、保存操作を行うまでは新版セーブも変更しません。

**注意:** この仕組みは同じ端末/ブラウザのストレージで動きます。別端末へは自動同期しません。ブラウザデータを消去すると両方のセーブデータが消えます。

**将来の方針:** 新バージョン公開時は`versions/vX.Y/`へ旧実行モジュール・デモ・GLBを固定し、独立URLとセーブキーを追加する。変更は`universal-engine/`だけで、Kamoku Monitor/Frontier Worldには接続しません。

元のv0.6コミットから完全に復元したい場合は[バックアップ用GitHubブランチ](https://github.com/hublab055-crypto/kamoku-world-monitor/tree/universal-engine-v0.6-stable)を使用してください。
