# Frontier World — Market Login Setup

更新日: 2026-10-05 JST  
対象: V38 オンライン株式マーケットβ

## Supabase

Project: `kamoku-cloud-v2`  
Project ref: `htwcscrllohavtbejhjr`

ゲーム本体には publishable key のみを使用する。service role / secret は配置しない。

## GitHub OAuth

Creator SuiteですでにGitHub providerを設定している場合、provider自体は共用できる。

Supabase Dashboard:

`Authentication > URL Configuration > Redirect URLs`

に次の**完全一致URL**を追加する。

`https://hublab055-crypto.github.io/kamoku-world-monitor/frontier-world/`

本番URLはワイルドカードより完全一致を優先する。

GitHub OAuth App側のAuthorization callback URLはSupabase callback:

`https://htwcscrllohavtbejhjr.supabase.co/auth/v1/callback`

ゲームの `redirectTo` は公開ゲームURLへ固定済み。

## 確認

1. 公開ゲームを開く。
2. Shop → 株式・会社 → ユーザー間マーケットβ。
3. 「GitHubで市場ログイン」。
4. GitHub/Supabase認証後、同じFrontier World URLへ戻る。
5. 市場口座1000Gが表示される。
6. 再ログインしても1000Gが再付与されないことを確認。

## 注意

市場βGはゲーム内ローカルGとは別。ローカルゲームデータはブラウザから改ざんできるため、V38ではオンライン市場資産へ直接入金できない。
