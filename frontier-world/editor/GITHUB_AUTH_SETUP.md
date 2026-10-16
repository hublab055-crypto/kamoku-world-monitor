# Frontier World Creator Suite — GitHub Login Setup

Creator Suite から GitHub の `hublab055-crypto/kamoku-world-monitor` を直接編集するための初回設定。

## 構成

- Frontend: GitHub Pages
- Authentication: Supabase Auth
- OAuth Provider: GitHub
- Repository write: GitHub REST API
- GitHub provider token: browser `sessionStorage` のみ
- Supabase project: `kamoku-cloud-v2`
- Supabase ref: `htwcscrllohavtbejhjr`

Creator Suite には Supabase の **publishable key** のみを置く。
GitHub OAuth Client Secret や Supabase service role key は置かない。

## 1. GitHub OAuth App を作る

GitHub Developer Settings で OAuth App を作成する。

Application name:
`Frontier World Creator Suite`

Homepage URL:
`https://hublab055-crypto.github.io/kamoku-world-monitor/frontier-world/editor/`

Authorization callback URL:
`https://htwcscrllohavtbejhjr.supabase.co/auth/v1/callback`

作成後、Client ID と Client Secret を取得する。

## 2. Supabase Auth で GitHub provider を有効化

Supabase Dashboard:

`kamoku-cloud-v2 > Authentication > Providers > GitHub`

- GitHub provider: Enabled
- Client ID: GitHub OAuth App の Client ID
- Client Secret: GitHub OAuth App の Client Secret

Redirect URL / allow list には次を追加:

`https://hublab055-crypto.github.io/kamoku-world-monitor/frontier-world/editor/`

## 3. 権限

Creator Suite は GitHub OAuth で次の scope を要求する。

- `public_repo`
- `read:user`

現在の対象 repository は public のため、private repository 全体への `repo` scope は要求しない。

## 4. Creator Suite の安全制限

- 編集対象 repository は `hublab055-crypto/kamoku-world-monitor` 固定。
- 通常は `frontier-world/` 配下のみ。
- `frontier-world/index.html` の書き込みは追加チェックが必要。
- 読み込んだ SHA を使って更新するため、他で更新された場合は競合として停止する。
- GitHub token は HTML に埋め込まない。
- GitHub provider token は `localStorage` ではなくタブ単位の `sessionStorage` のみ。
- GitHub上の削除はコミットとして行われるため、Git履歴から復元可能。

## 5. 画像連携

GitHub連携画面で画像ファイルを読み込むと「画像エディタで開く」が使える。

画像エディタでは:

1. GitHub画像を読み込む
2. ペイント編集
3. GitHubパスを保持
4. 「GitHubへ保存」
5. 同じパスを更新コミット

新規画像は GitHubパスを指定して追加できる。
