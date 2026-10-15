# Universal Engine — Planet Explorer v0.3

独立した架空マルチバースの **WebGL2 3D惑星探索プロトタイプ**。宇宙から3D球体惑星を観察し、同一の地理座標・地形サンプラーで細密な地表メッシュへ降下し、人物を操作できます。

**URL:** https://hublab055-crypto.github.io/kamoku-world-monitor/universal-engine/planet-explorer/

- 宇宙: WebGL2で球体惑星・大陸・海・雲の三角形メッシュ、自転の見かけと恒星照明。
- 地表: WGS84ではなく架空惑星の球面緯度・経度、地形の高さに連続する高解像度メッシュを高度別LODで生成。
- 人物: 地表にいる時、WASD/方向ボタンで前後左右移動、Q/Eで旋回。移動先の水域・急斜面を簡易的にブロック。
- 操作: 降下・帰還、拡大・縮小、惑星日数の早送り、時間停止、端末ローカル保存・復元。
- モバイル: 画面ボタンを押し続ける操作、タッチでカメラ回転、ピンチの代わりに拡大縮小ボタン。
- JavaScript ES Modules + ブラウザ標準WebGL2だけで動作。CDN・外部アセット・認証・外部ネットワーク通信なし。

## ファイル

- `geo.mjs`：球面上の緯度/経度→位置、東北方向メートル→地理座標、地表を共有する `terrainSurface`、局所メッシュ。
- `controller.mjs`：高度/降下/地表の歩行と簡易衝突、セーブ形式。
- `render.mjs`：WebGL2プログラム、球面メッシュ、LOD地形パッチ、樹木・草・人物の簡易立体モデル。
- `app.mjs`：UI・シミュレーション時間・スマホ操作・独立保存管理。
- `index.html`、`style.css`：ブラウザ表示。
- `../tests/explorer.test.mjs`：座標、地形、移動、WebGL描画のテスト。

## 実行

GitHub Pages上のリンクを開くか、リポジトリのルートで `python3 -m http.server 8000` を実行し `http://localhost:8000/universal-engine/planet-explorer/` を開いてください。ローカルの `file://` URLではES Modulesが読み込めません。

テスト: `cd universal-engine && npm test`（Node.js 20以降・追加npm依存なし）。

## 守る境界

Kamoku Monitorは現実の観測・投影専用。Frontier Worldは既存の独立ゲーム。両者の実装、保存、API、ルートページには一切接続しません。Explorer独自のセーブキーは `universal-engine:explorer:v1` です。

## 制限事項

**地表と惑星の地形サンプルは同一ですが、完全に連続した単一メッシュではありません。** 高度約23kmで球面表示から地表詳細パッチへ切り替わり、映像が少し切り替わることがあります。地表の樹木/草や人物は仮モデルで、v0.2の種子散布・動物AI・石投げシステムとはこの画面ではまだ連携していません。地表の一部の水域・急斜面だけ簡易通行止めを行い、積雪、地下、洞窟、建造物、衝突剛体、広域水文学は今後の開発範囲です。

ブラウザ実機での描画・タッチ・GPU性能のE2Eテストは別途必要です。
