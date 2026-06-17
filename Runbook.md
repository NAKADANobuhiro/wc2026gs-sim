# Runbook — wc2026gs-sim 運用手順

デプロイ・データ更新・障害対応の手順書。対象は静的サイト（GitHub Pages 配信）。

## 1. 環境

| 項目 | 値 |
| --- | --- |
| リポジトリ | `https://github.com/NAKADANobuhiro/wc2026gs-sim`（`main`） |
| 公開 URL | `https://wc2026gs.ironsite.net`（GitHub Pages + `CNAME`） |
| 必要環境 | Python 3.8+（`serve.py` / `update_matches.py`）。任意で `uv` |
| 依存 | なし（ランタイム依存ゼロの静的サイト） |

## 2. ローカル開発

1. `start-server.bat` をダブルクリック（`python serve.py 8080` を起動。`python` が無ければ `uv run python serve.py 8080` にフォールバック）。
2. ブラウザで `http://localhost:8080/` を開く。編集後は **Ctrl+F5**（スーパーリロード）で反映。
3. 停止は起動中コンソールで **Ctrl+C**。

> `index.html` を直接開かないこと（`fetch` 失敗）。必ずサーバー経由。
> `npx serve` は使わない（`?team=` を落としてチーム選択が壊れる）。`serve.py` を使う。

## 3. 試合結果の更新（GS 期間中の定常運用）

確定試合を `matches.json` に取り込むと、該当カードが自動でロック（勝/分/敗 100/0/0）される。

```bash
# 1) プレビュー（書き込まない）
uv run python update_matches.py --dry-run

# 2) 問題なければ反映（matches.json.bak を自動作成）
uv run python update_matches.py

# 3) 一覧ページの突破確率(当初/第1〜3節後)を再計算
uv run python update_results.py

# 4) ローカルで表示確認 → 問題なければコミット
git add matches.json results.json && git commit -m "Update results" && git push origin main
```

手動で追記する場合は `matches.json` の `matches` 配列に 1 行追加するだけでよい:

```json
{ "group": "I", "date": "2026-06-16", "teamA": "FR", "teamB": "SN", "scoreA": 3, "scoreB": 1 }
```

- `teamA`/`teamB` は `teams.json` の `code`、`scoreA`/`scoreB` は実際の得点。
- `group`/`date` は参考情報で計算には未使用。
- 取り込み後は必ず JSON 妥当性を確認: `python -c "import json;json.load(open('matches.json',encoding='utf-8'))"`。

## 4. デプロイ（GitHub Pages）

1. ローカルで動作確認（最低でも 1 チームの表示・チーム変更・言語切替）。
2. `git add -A && git commit -m "..." && git push origin main`。
3. GitHub Pages が自動公開（数分）。`https://wc2026gs.ironsite.net` を Ctrl+F5 で確認。
4. 独自ドメインは `CNAME`（`wc2026gs.ironsite.net`）で管理。変更時は DNS 設定（CNAME レコード）も合わせて確認。

### ロールバック

```bash
git revert <commit>            # 問題コミットを打ち消して push
# もしくは直前バックアップから戻す（データのみ）
copy matches.json.bak matches.json
```

## 5. 翻訳（Crowdin）

- 原本は `locales/ja.json`。`crowdin.yml` の設定で各言語 `locales/<code>.json` に展開。
- キーを追加したら `ja.json` と `en.json` の**両方**に同じキーを追加する（`en.json` のキー欠落は表示崩れの原因）。
- 追加後は両ファイルの JSON 妥当性と `index.desc_list` などの要素数を確認。

## 6. 障害対応・トラブルシューティング

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| チームを変更しても反映されない | `npx serve` が `/index.html?team=XX` を `/` にリダイレクトしクエリを破棄 | `serve.py` で起動し直す（`start-server.bat`） |
| `/select` が 404 | 素の `python -m http.server` はクリーン URL 非対応 | `serve.py` を使う（`/select`→`select.html` 解決） |
| 画面が「データの読み込みに失敗」 | `file://` で開いた／サーバー未起動 | サーバー経由で開く |
| 編集が反映されない | ブラウザキャッシュ | Ctrl+F5。`serve.py` は `Cache-Control: no-store` 付与済み |
| 保存したファイルが途中で切れる | OneDrive 同期による上書き切り詰め | 別名で書き出し→`cp -f` で差し替え→ディスク実体を検証。恒久対策は OneDrive 外（例 `C:\JOD\...`）へ移動 |
| `update_matches.py` が 0 件検出 | 該当試合が未確定、または FIFA API の idSeason/仕様変更 | `--dry-run` で確認。新大会では idSeason を更新（seasons エンドポイントで確認） |

## 7. バックアップ・移行

- `update_matches.py` は書き込み前に `matches.json.bak` を作成する。
- OneDrive 外への移行は `copy-to-JOD.bat` を実行（`C:\JOD\Claude\Personal\wc2026gs-sim` へ robocopy。`.git` 履歴は保持、`__pycache__`/`.bak`/`.tmp` は除外）。移行後は作業フォルダを新パスに切り替える。
