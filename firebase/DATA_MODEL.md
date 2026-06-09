# Tabistock データモデル設計（Firebase）

動的化（会員登録＋投稿フォーム＋承認制）のためのデータ構造。
post.html の入力項目（gather() が作るJSON）をそのまま土台にしている。

## Firestore コレクション

### `users/{uid}`
ログインユーザーのプロフィール。uid は Firebase Auth が発行。

| フィールド | 型 | 説明 |
|---|---|---|
| nickname | string | 表示名（記事の著者名・slug生成に使用） |
| email | string | 登録メール |
| createdAt | timestamp | 登録日時 |

### `admins/{uid}`
このドキュメントが存在する uid が管理者。**Firebaseコンソールから手動で追加**する
（あなたが会員登録 → 自分のUIDを確認 → admins に追加）。中身は空でよい（例: `{ note: "owner" }`）。

### `articles/{articleId}`
旅程記事。articleId は自動ID。post.html の gather() の項目をほぼ踏襲。

| フィールド | 型 | 説明 |
|---|---|---|
| authorId | string | 著者の uid |
| authorNickname | string | 著者ニックネーム（表示用・非正規化） |
| status | string | `pending`（承認待ち） / `published`（公開） / `rejected` |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |
| countries | array<string> | 国コード（例 `["korea"]`）※検索 data-country |
| region | string | 地域コード（国から自動）※検索 data-region |
| budget | string | 予算コード（`10`/`20`/.../`50plus`）※検索 data-budget |
| days_v | string | 日数コード（`daytrip`/`1night`/...）※検索 data-days |
| styles | array<string> | 旅スタイル（例 `["friends","city"]`）※検索 data-style |
| title | string | 記事タイトル |
| lead | string | リード文（検索カードの説明にも流用） |
| dateStart | string | 旅行開始日 `YYYY-MM-DD` |
| dateEnd | string | 旅行終了日 `YYYY-MM-DD` |
| currency | string | 通貨 |
| language | string | 言語 |
| safety | string | 治安 |
| difficulty | number | 難易度 1〜5 |
| costs | map | `{flight,stay,food,transit,tour,sightseeing,esim,souvenir}` 各number |
| flights | array<map> | `[{route,airline,price}]` |
| flightWhen | string | 予約時期 |
| flightSite | string | 予約サイト |
| services | array<map> | `[{label, items:[...]}]` |
| days | array<map> | `[{date,summary,text, photoUrls:[...]}]` |
| comment | string | 投稿者コメント |
| heroUrls | array<string> | ヒーロー写真URL（Storageの公開URL） |
| thumbUrl | string | 検索カードのサムネURL（= heroUrls[0]） |

> 注：静的版では写真はファイル名（hero1.jpg等）だったが、動的版では
> Storage にアップロード後の**公開URLを保存**する。

## Storage 構造

```
articles/{articleId}/
  hero1.jpg, hero2.jpg, ...      ← ヒーロー（カルーセル）写真
  day1-1.jpg, day1-2.jpg, ...    ← 各日の写真
  thumb.jpg                       ← サムネ（= hero1 を流用 or 別保存）
```

## 承認フロー

1. ユーザーが投稿 → `status: 'pending'` で保存（ルールで強制）
2. 管理者（あなた）が管理ページで承認 → `status: 'published'` に更新
3. 公開記事だけが検索・トップ・記事ページに表示される（ルールで担保）

## 検索・一覧の描画

- トップ/検索ページは `articles where status == 'published'` を取得して
  カードを**JSで自動生成**（手書きカードは廃止）。
- 検索フィルタは取得後にクライアント側で絞り込み（現行の data-* と同じ語彙）。

## ルールファイル

- `firestore.rules` … Firestore のアクセス制御
- `storage.rules` … 画像のアクセス制御

どちらも Firebase コンソールの各「ルール」タブに貼り付けて「公開」する
（または firebase CLI で deploy）。
