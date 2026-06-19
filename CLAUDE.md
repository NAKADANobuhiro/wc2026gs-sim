# CLAUDE.md

このリポジトリで作業する AI アシスタント・コントリビューター向けのガイドです。

## プロジェクト概要

2026 FIFA ワールドカップの**グループステージ（GS）突破予想確率シミュレーター**。
ユーザーが対象チームを選び、各対戦の勝利／引分／敗北の確率を入力すると、GS 突破確率を計算する。
すでに終了した試合は実際の結果（`matches.json`）を自動反映し、入力欄をロックする。日本語／英語の 2 言語対応。
フレームワーク・ビルド工程なしの静的サイトで、GitHub Pages にデプロイしている。

## 技術スタック

- フロントエンド: HTML5 / CSS3（レスポンシブ）/ バニラ JavaScript（ES6+）。**外部ライブラリ・ビルド工程なし**。
- データ: 実行時に `fetch` するローカル JSON（`teams.json` / `stats.json` / `matches.json` / `results.json`）。
- i18n: `locales/ja.json`（翻訳の原本）/ `locales/en.json`。Crowdin 管理（`crowdin.yml`）。
- ローカル開発サーバー: `serve.py`（Python 標準ライブラリのみ）。`start-server.bat` から起動。
- 補助スクリプト: `update_matches.py` / `update_results.py`（Python 標準ライブラリのみ）。確定結果の取得と一覧の再計算。
- 自動更新（任意）: `register-hourly-task.bat` で毎時タスク（`wc2026gs-update`）を登録し、取得→再計算→`git push` を実行。
- ホスティング: GitHub Pages（`NAKADANobuhiro/wc2026gs-sim`、`main` ブランチ）。独自ドメインは `CNAME`（`wc2026gs.ironsite.net`）。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `index.html` / `js/script.js` | メイン画面（シミュレーター）。計算ロジック・UI 制御・i18n |
| `select.html` / `js/select.js` | チーム選択画面 |
| `results.html` / `js/results.js` | 全チーム突破確率の一覧 |
| `css/style.css` / `select.css` / `results.css` | スタイル |
| `teams.json` | 12 グループ（A〜L）× 4 チーム。`{code, name{ja,en}, rank}` |
| `stats.json` | FIFA ランク帯ごとの勝/分/敗率（入力初期値の元データ） |
| `matches.json` | **確定試合の結果**。`{teamA,teamB,scoreA,scoreB,group,date}`。ロック機能の入力源 |
| `results.json` | 一覧ページ用。各チーム4スナップショット `{init,md1,md2,md3}`（update_results.py が生成） |
| `results.initial.json` | 旧 results.json（当初値）のバックアップ |
| `locales/*.json` | 翻訳リソース |
| `img/<code>.png` | 各国国旗（77 ファイル） |
| `serve.py` | ローカル開発サーバー（クリーン URL 対応・クエリ非破棄） |
| `start-server.bat` | サーバー起動（`python` → 失敗時 `uv run python`） |
| `update_matches.py` | FIFA 公式 API（api.fifa.com）から確定結果を取得し `matches.json` を更新（APIキー不要） |
| `update_results.py` | matches.json を基に results.json の4スナップショット（当初/第1〜3節後）を再計算 |
| `update-hourly.bat` / `register-hourly-task.bat` | 毎時自動更新（取得→再計算→`git push`）の実行bat／Windows タスク登録bat |
| `spec.md` | 仕様書（Gemini 生成・参考） |
| `copy-to-JOD.bat` | プロジェクトを `C:\JOD\Claude\Personal\wc2026gs-sim` へコピーする補助 |

`.gitignore` 対象: `wc2026gs-sim.html`（旧プロトタイプ）、`work/`（Affinity の国旗ソース `.af`）、`.bak`。

## データモデルの要点

- チームコードは原則 ISO 3166-1 alpha-2（`JP`,`BR` など）。例外で `GB-ENG`,`GB-SCT`、プレーオフ枠の特殊コードあり。国旗は `img/<code>.png`。
- `teams.json` の組分けは実際の W杯2026 ドロー（A〜L）と一致。
- `matches.json` の確定試合は、入力初期値（`stats.json` 由来）より優先され、勝/分/敗を `100/0/0` 等に固定する。
- 突破確率の係数 `QUALIFY_RATES`（勝点→突破率）は `js/script.js` に定義。

## コーディング規約・慣習

- ビルド不要。ファイルを直接編集してブラウザで再読み込み。
- すべての `fetch` は相対パス（`./teams.json`）。**HTTP 経由で配信が必須**（`file://` 直開きは `fetch` が失敗）。
- URL パラメータ: `team`（対象チーム）/ `lang`（`ja`|`en`）/ `s`（Base64 化した入力状態）。詳細は `spec.md` §7。
- 翻訳は `ja.json` を原本とし、`en.json` は同じキー構成を維持する。
- 確定試合のロック行は `applyUrlState` で URL 状態の上書きをスキップする（実結果を優先）。
- 一覧ページ(`results.js`)は `results.json` の4スナップショットを **PCで2段組み**表示（`@media (min-width:1000px)`）。国名・対戦国名は `index.html?team=XX` へのリンク。勝ち点表の確率0%行は `.prob-zero` でグレー表示。

## よく使うコマンド

```bash
# ローカルサーバー起動（推奨）
start-server.bat
# または
python serve.py 8080
uv run python serve.py 8080      # python が無い環境

# 確定結果の取り込み（matches.json 更新）
uv run python update_matches.py            # 取得して更新（FIFA 公式 API・キー不要）
uv run python update_matches.py --dry-run  # 取得・解析のみ（書き込まない）
# 取得元: api.fifa.com calendar/matches（idCompetition=17, idSeason=285023=W杯2026）

# 一覧ページの突破確率(4スナップショット)を再計算（matches.json 更新後に実行）
uv run python update_results.py

# JSON 妥当性チェック
python -c "import json; json.load(open('matches.json', encoding='utf-8'))"

# デプロイ（GitHub Pages）
git add -A && git commit -m "..." && git push origin main
```

## 注意点（落とし穴）

- `index.html` を `file://` で直接開かない（`fetch` が CORS で失敗）。必ずサーバー経由。
- `npx serve` は `/index.html` を `/` にリダイレクトし `?team=XX` を捨てるため、**チーム選択が反映されなくなる**。ローカルでは `serve.py` を使うこと。
- OneDrive 上での既存ファイル上書きは内容が途中で切り詰められることがある。書き込み後は bash 等でディスク実体を必ず検証する。

## 関連ドキュメント

- セットアップ・使い方・アーキテクチャ → `README.md`
- デプロイ・運用手順 → `Runbook.md`
- 仕様 → `spec.md`
