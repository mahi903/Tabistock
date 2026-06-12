# Tabistock 開発ルール（Claude用の取扱説明書）

このファイルは Claude Code が起動時に自動で読む。Tabistock を触るときの
ルールをここにまとめておく。中身は飯野さんが自由に足し引きしてOK。

## プロジェクト概要
- Tabistock＝日本語の旅行PWA（旅程記事を共有するサービス）
- 公開URL：https://tabistock.jp
- リポジトリ：GitHub `mahi903/Tabistock`（ブランチ `main`）
- ホスティング：Vercel（`main` に push すると自動デプロイ）
- 保存場所：iCloud Drive のフォルダで運用

## デプロイのルール（最重要）
- 「デプロイ」「デプ」「で」= `git add` → `git commit` → `git push` のこと
- **勝手にコミットしない**。必ず飯野さんの明示的な指示を待つ
- コミット前に必ず `git status` で内容を確認する
- コミットメッセージの最後に必ずこの行を付ける：
  `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- コミット前に `.git/index.lock` が無いか確認する（あれば原因を調べる）
- `git add` は**ファイル名を指定して**追加する（`git add -A` や `.` は使わない）

## 必ずコミットから除外するファイル／フォルダ
- `.DS_Store`
- `その他/`（作業用フォルダ）
- `.claude/launch.json`
これらは絶対にステージング・コミットしない。

## Service Worker（キャッシュ）のルール
- `sw.js` 内の `const VERSION = 'tabistock-vN'` がキャッシュのバージョン
- **HTML / CSS / JS を変更したら、デプロイ時に必ず N を +1 する**
  （上げないと利用者のブラウザに古いファイルが残る）
- `api/` だけの変更（サーバーレス関数）はキャッシュ対象外なので、
  SWバージョンは**上げない**（上げると全員に無駄な再ダウンロードが走る）
- 新しいページ（HTML）を追加したら `sw.js` の `PRECACHE` 配列にも足す

## 秘密情報（絶対に漏らさない）
- Firebase のサービスアカウント JSON は**秘密**。絶対にコミットしない
- API キー類（`ANTHROPIC_API_KEY` など）は Vercel の環境変数で管理。
  コード内にベタ書きしない

## 開発環境の制約
- ローカルに Node / npm / firebase CLI は**入っていない**
  → JS のローカル実行・テストはできない前提で進める
- 動作確認は本番デプロイ後にブラウザで行う

## 技術構成メモ
- フロント：素のHTML/CSS/JS（フレームワークなし）。PWA対応
- バックエンド：Firebase（Authentication / Firestore / Storage）
  - `firebase-config.js` が `auth` / `db` / `storage` を export
  - `auth.currentUser` はロード直後 null のことがある
    → `onAuthStateChanged` で復元を待ってから使う
- サーバーレス関数：Vercel の `api/` フォルダ（Node）
  - `api/ask.js`＝AI相談（RAG）。`claude-sonnet-4-6` 使用
  - `api/extractPlaces.js`＝場所抽出。`claude-haiku-4-5` 使用
  - Anthropic はSDKを使わず raw HTTP（`fetch`）で呼ぶ
    （`POST https://api.anthropic.com/v1/messages`、
     ヘッダ `x-api-key` と `anthropic-version: 2023-06-01`）
  - 各関数は Firebase IDトークンを検証（`ensureApp()` + `verifyIdToken`）

## カード描画と検索
- `tabistock-render.js` の `renderCard(d)` が記事カードを生成
  - `data-country / data-days / data-budget / data-style / data-region` を付与
  - `data-search`＝キーワード検索用の隠しテキスト
    （日本語/英語国名・地域・タイトル・リード・各DAY要約）
- 検索方法は4つ：①4項目絞り込み ②キーワード入力 ③マップ ④AIに相談
- スタイル一覧の定義は `post.html` の STYLES 配列が起点。
  追加時は `tabistock-render.js` の STYLES と `api/ask.js` の STYLE_JP、
  各HTMLの `<option>`/チェックボックスも揃えて更新する

## 進め方の好み
- 指示は日本語。簡潔なやり取りを好む
- 大きい変更は、いきなり作らず先に案・トレードオフを出すと良い
