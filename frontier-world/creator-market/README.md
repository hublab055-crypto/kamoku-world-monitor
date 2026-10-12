# Frontier World — 共用クリエイターマーケット β

管理ID: FW-2026-10-12-CREATOR-001 / 導入日: 2026-10-12

## 公開UI

- `frontier-world/creator-market/index.html` : GitHub OAuthによる出品・購入・閲覧・印税確認
- `frontier-world/index.html` : 持ち物→「読書・創作」のマーケット入口
- 制作物は本（本文20〜20,000文字）、楽曲（単音メロディー1〜400音）、イラスト（PNG/JPEGを640pxに縮小）を扱う。
- 原著作を持つ本人が権利申告した作品を「審査待ち」で登録する。公開には別途管理者による確認が必要。権利侵害報告は `fw_creator_reports` に記録される。
- 現時点ではオルガンで作ったMIDIファイルや画像編集アプリのIndexedDB原稿をワンクリック転送する機能はない。作品を新規入力・画像選択して投稿する試作版。
- 青空文庫・古典は無料図書室で読める。著作権満了の原作者に印税は入れない。出典・入力・校正情報は本のデータ側で保存する。

## サーバーと通貨

Supabaseプロジェクト: `kamoku-cloud-v2`。既存の共用マーケットβ（株式市場）と同じ`fw_market_accounts`のオンライン残高を使う。ゲーム内所持Gとは**連動していない**。実通貨・出金・暗号資産とは無関係。

新規テーブル:
- `fw_creator_works`: 制作者の `auth.uid()`、種類、題名、価格、80%印税率、審査状態
- `fw_creator_payloads`: 本文/音符配列/画像。制作者か購入者に限りSELECT可能
- `fw_creator_purchases`: サーバー確定価格・80%印税/20%市場分・依頼IDの決済記録
- `fw_creator_royalty_ledger`: 制作者別の入金台帳
- `fw_creator_treasury`: 運営側取り分
- `fw_creator_reports`: 通報（同一利用者の同一作品の重複を防止）

RPC:
- `fw_creator_submit_work(p_kind,p_title,p_description,p_price_g,p_content,p_original_confirmed)`: サーバー認証UIDに所有権を固定、権利宣誓必須、審査状態`pending`として登録
- `fw_creator_purchase_work(p_work_id,p_request_id)`: `active`のみ購入可、サーバーで価格計算、購入者の利用可能残高を判定。購入者引落・作者80%入金・市場20%入金・購入記録・印税台帳を単一DBトランザクションで処理
- `fw_creator_private.moderate_work(p_work_id,p_status)`: SQL管理者用。ブラウザや一般ユーザーにはEXECUTE権限を付与していない。

## 印税ルール

100Gの作品を購入した場合：購入者 -100G、制作者 +80G、運営 +20G。端数は作家印税の端数切捨て（例：1G販売時は作者0G、運営1G）。単一制作者のみ対応。共同作曲・共著・出版社/レーベルの分配は未実装。

`(buyer_id,work_id)`および`(buyer_id,request_id)`の一意制約を設け、再試行/重複ボタンで二重課金をしない。制作者本人の自己購入は禁止。市場株式口座の拘束残高`cash_reserved`を控除して購入可能額を確認し、口座行は決めた順序で排他ロックする。

## 管理者の作品審査

投稿には直ちに公開権限を与えない。Supabase SQL Editorで権利と内容を確認し、本人の作品だと審査できた場合のみ管理者権限で下記を実行。

```sql
select id,kind,title,creator_id,price_g,created_at
from public.fw_creator_works where status='pending' order by created_at;

-- 実際の作品IDへ置き換える（権利と内容の確認後）
select fw_creator_private.moderate_work('00000000-0000-0000-0000-000000000000'::uuid,'active');

-- 違反・盗用が疑われる作品は非公開
select fw_creator_private.moderate_work('00000000-0000-0000-0000-000000000000'::uuid,'suspended');
```

投稿本文を見る際は管理画面のDB管理権限のみで `fw_creator_payloads` を確認する。作品購入後はダウンロード・転送を完全に防止できる仕組みではないため、DRM対応済みとは表示しない。

## 検証結果と残課題

- 全6表のRLS有効化。表に対する一般ユーザーのUPDATE/DELETEを不許可。公開作品情報と自分の取引情報だけ読めるRLS。
- サーバーへの未認証RPC購入呼出は`login required`として拒否されることを確認。
- `creator-market/index.html`内のJavaScriptモジュールの静的構文確認済み。
- 本体の既存スクリプト構文確認済み。
- **未実施**：GitHub OAuth実機操作、2名の認証済ユーザーでの本番購入・実際の入出金照合、管理者の実物審査、モバイル音再生/画像アップロード、負荷テスト。
- 将来: 自動審査と通報ワークフロー、複数作者の分配率、収録MIDIの正式転送、クリエイター写真編集との連動、注文取り消し・返金、真のゲーム内G連携、収益化する際の法的/税務的取扱い。
