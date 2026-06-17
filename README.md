# FIFA ワールドカップ 2026 グループステージ突破予想確率 シミュレーター / FIFA World Cup 2026 Group Stage Qualification Simulator

FIFA ワールドカップ 2026 のグループステージ突破予想確率をシミュレーションするためのツールです。48 チームが参加するこの大会のグループステージ突破確率を計算します。

各対戦の勝利／引分／敗北の確率を入力すると、3 試合の全パターンから勝点分布を計算し、勝点ごとの突破期待値を掛け合わせて突破確率を算出します。すでに終了した試合は実際の結果を自動反映し、入力欄を固定（編集不可）します。

## サンプルサイト

- https://wc2026gs.ironsite.net

## 紹介記事

Note に紹介記事を書きました。[「FIFA ワールドカップ 2026 GS突破シミュレーター」を作成した｜スーパー笹ダンゴムシ](https://note.com/spsasadangomushi/n/n2dad03817dc8)

## 使い方

1. トップ画面で対象チームの GS 突破確率が表示されます（デフォルトは日本）。
2. 「変更」ボタンからチームを選択できます。
3. 同グループ 3 チームとの「勝利／引分／敗北」（各 0〜100%、合計 100%）を入力すると、結果がリアルタイムに更新されます。
4. 終了済みの試合は実際の結果で固定され（グレー表示・編集不可）、残りの試合だけ予想を入力します。
5. 右上のプルダウンで日本語／英語を切り替えられます。
6. 「シェア用 URL をコピー」や X / Facebook ボタンで、入力状態を含む URL を共有できます。
7. 「全チームシミュレーション結果一覧」では、各チームの突破確率を**当初／第1節後／第2節後／第3節後（GS終了）**で比較できます（未消化の節はグレー表示）。

## ローカルでの実行方法

`start-server.bat` をダブルクリックしてローカルサーバーを起動し、ブラウザで http://localhost:8080 を開いてください（Python が必要。無い場合は `uv run python` にフォールバックします）。

```bash
# どちらでも可
python serve.py 8080
uv run python serve.py 8080
```

> **注意：** `index.html` をブラウザで直接開くと CORS エラーが発生します。必ずサーバー経由でアクセスしてください。
> ローカル開発には同梱の `serve.py` を使ってください（`npx serve` は `?team=` を落とすためチーム選択が反映されなくなります）。

## アーキテクチャ概要

外部ライブラリ・ビルド工程なしの静的サイトです（HTML5 + CSS3 + バニラ JavaScript）。データは実行時に JSON を `fetch` します。

| ファイル | 役割 |
| --- | --- |
| `index.html` / `js/script.js` | メイン画面・計算ロジック・i18n |
| `select.html` / `js/select.js` | チーム選択画面 |
| `results.html` / `js/results.js` | 全チーム突破確率の一覧（当初／第1〜3節後の4スナップショット比較） |
| `teams.json` | グループ・チーム定義（12 グループ × 4 チーム） |
| `stats.json` | FIFA ランク帯ごとの勝/分/敗率（入力初期値） |
| `matches.json` | 確定試合の結果（ロック機能の入力源） |
| `results.json` | 一覧ページ用。各チーム4スナップショット `{init,md1,md2,md3}`（`update_results.py` が生成） |
| `results.initial.json` | 旧 results.json（当初値）のバックアップ |
| `locales/ja.json`,`en.json` | 翻訳リソース（Crowdin 管理、`ja` が原本） |
| `serve.py` / `start-server.bat` | ローカル開発サーバー |
| `update_matches.py` | FIFA 公式 API（api.fifa.com）から確定結果を取得して `matches.json` を更新（キー不要） |
| `update_results.py` | `matches.json` を基に `results.json` の4スナップショットを再計算 |

- 計算ロジック: 3 試合 × {勝,分,敗} の 27 パターンを確率合成 → 勝点分布 → 勝点別の突破期待値（`QUALIFY_RATES`）で突破確率を算出。
- URL パラメータ: `team`（対象チーム）/ `lang`（表示言語）/ `s`（Base64 化した入力状態）。
- 詳細仕様は [`spec.md`](spec.md)、開発者向けガイドは [`CLAUDE.md`](CLAUDE.md)、運用手順は [`Runbook.md`](Runbook.md) を参照。

## 試合結果の更新

グループステージ期間中は、確定した試合を `matches.json` に取り込むことで自動反映できます。

```bash
uv run python update_matches.py --dry-run   # プレビュー
uv run python update_matches.py             # FIFA 公式から取得して matches.json を反映
uv run python update_results.py             # results.json の4スナップショットを再計算
```

手動の場合は `matches.json` の `matches` 配列に 1 行追加します（`teamA`/`teamB` は `teams.json` の `code`）。

## データ更新履歴

### 2026-06-17
- 確定結果の取得元を FIFA 公式 API（api.fifa.com）に変更（APIキー不要）。
- 一覧ページに「当初／第1節後／第2節後／第3節後」の4スナップショット比較を追加（`update_results.py`／`results.initial.json` に当初値を保全）。

### 2026-06-16
- グループステージ開幕に伴い、確定試合の実結果を反映する機能を追加（`matches.json`）。
- 確定カードは勝/分/敗を実績どおりに固定（編集不可・グレー表示）。

### 2026-04-04
- 欧州プレーオフ（UEFA）予選結果を反映
  - パスA：ボスニア・ヘルツェゴビナ（グループB）
  - パスB：スウェーデン（グループF）
  - パスC：トルコ（グループD）
  - パスD：チェコ（グループA）
- 大陸間プレーオフ（ICPO）結果を反映
  - ICPO-1：コンゴ民主共和国（グループK）
  - ICPO-2：イラク（グループI）
- 全48チームが確定
