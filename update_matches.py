#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_matches.py
  CBS Sports の 2026 FIFA ワールドカップ一覧ページから「確定した試合結果」を取得し、
  matches.json を更新するスクリプト（標準ライブラリのみ）。

使い方:
  uv run python update_matches.py              # サイトを取得して matches.json を更新
  uv run python update_matches.py --dry-run    # 取得・解析のみ（matches.json は書き換えない）
  uv run python update_matches.py --html FILE  # ローカルの HTML/テキストを解析（オフライン確認用）
  uv run python update_matches.py --url URL    # 取得元 URL を上書き

仕組み:
  - ページ本文から「TeamName N, TeamName M」形式の確定スコア行を抽出。
  - teams.json の組分けで「同じグループ同士の対戦」だけを採用（誤検出よけ）。
  - matches.json に未登録の試合を追記。スコアが変わっていれば更新。
  - 書き換え前に matches.json.bak を作成。
"""
import argparse
import datetime
import html as html_mod
import json
import os
import re
import ssl
import sys
import unicodedata
import urllib.request

DEFAULT_URL = ("https://www.cbssports.com/soccer/news/"
               "world-cup-group-standings-table-results/")
HERE = os.path.dirname(os.path.abspath(__file__))
TEAMS_PATH = os.path.join(HERE, "teams.json")
MATCHES_PATH = os.path.join(HERE, "matches.json")

DEFAULT_COMMENT = ("グループステージの確定試合結果。teamA/teamB は teams.json の code。"
                   "score は実際の得点。試合が終わったらここに 1 行追記すれば、"
                   "シミュレーターの該当カードが自動で勝/分/敗 100/0/0 に固定されます。"
                   "update_matches.py で自動追記も可能。日付・グループは参考情報で計算には未使用。")

# CBS 表記が teams.json の en 名と異なるチームの別名 → teams.json の code
ALIASES = {
    "czechia": "CZ", "czech republic": "CZ",
    "cabo verde": "CV", "cape verde": "CV",
    "turkey": "TR", "turkiye": "TR",
    "usa": "US", "united states": "US",
    "bosnia & herz.": "BA", "bosnia and herzegovina": "BA", "bosnia": "BA",
    "dr congo": "CD", "congo dr": "CD", "democratic republic of the congo": "CD",
    "ivory coast": "CI", "cote d'ivoire": "CI",
    "south korea": "KR", "korea republic": "KR",
    "curacao": "CW",
}

MONTHS = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], start=1)}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s)
                   if not unicodedata.combining(c))


def norm(s):
    return re.sub(r"\s+", " ", strip_accents(s).strip().lower())


def looks_like_html(raw):
    return bool(re.search(r"(?i)</?(div|p|table|td|tr|th|h[1-6]|body|html|span)\b", raw))


def extract_text(raw):
    """HTML ならタグ除去。markdown 装飾も除去してプレーンテキスト化。"""
    if looks_like_html(raw):
        raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
        raw = re.sub(r"(?i)<(br|/p|/h[1-6]|/li|/tr|/div|/td|/th)[^>]*>", "\n", raw)
        raw = re.sub(r"(?s)<[^>]+>", " ", raw)
        raw = html_mod.unescape(raw)
    # markdown: [text](url) -> text、装飾記号を除去
    raw = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", raw)
    raw = raw.replace("**", "").replace("*", "")
    raw = re.sub(r"(?m)^\s*#+\s*", "", raw)
    return raw


def load_team_data():
    with open(TEAMS_PATH, encoding="utf-8") as f:
        groups = json.load(f)
    name_to_code = {}
    code_to_group = {}
    for g in groups:
        for t in g["teams"]:
            code_to_group[t["code"]] = g["id"]
            name_to_code[norm(t["name"]["en"])] = t["code"]
    for alias, code in ALIASES.items():
        name_to_code[norm(alias)] = code
    return groups, name_to_code, code_to_group


def build_score_regex(name_to_code):
    # スコア行解析用の英語名のみ（日本語名などは除外）を長い順に
    ascii_names = [n for n in name_to_code
                   if re.fullmatch(r"[a-z0-9 .&'\-]+", n)]
    ascii_names.sort(key=len, reverse=True)
    alt = "|".join(re.escape(n) for n in ascii_names)
    return re.compile(r"(?i)(" + alt + r")\s+(\d{1,2})\s*,\s*("
                      + alt + r")\s+(\d{1,2})")


def parse_results(text, name_to_code, code_to_group, year):
    text = strip_accents(text)
    score_re = build_score_regex(name_to_code)
    date_re = re.compile(
        r"(?i)\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s+([A-Za-z]+)\s+(\d{1,2})\b")
    current_date = None
    results = []
    seen = set()
    for line in text.splitlines():
        dm = date_re.search(line)
        if dm:
            mon = MONTHS.get(dm.group(1).lower())
            if mon:
                current_date = f"{year:04d}-{mon:02d}-{int(dm.group(2)):02d}"
        for m in score_re.finditer(line):
            n1, s1, n2, s2 = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
            c1 = name_to_code.get(norm(n1))
            c2 = name_to_code.get(norm(n2))
            if not c1 or not c2 or c1 == c2:
                continue
            if code_to_group.get(c1) != code_to_group.get(c2):
                continue  # 同一グループの対戦のみ採用
            key = frozenset((c1, c2))
            if key in seen:
                continue
            seen.add(key)
            results.append({
                "group": code_to_group[c1], "date": current_date,
                "teamA": c1, "teamB": c2, "scoreA": s1, "scoreB": s2,
            })
    return results


def score_map(mt):
    return {mt["teamA"]: mt["scoreA"], mt["teamB"]: mt["scoreB"]}


def merge(existing, parsed):
    by_key = {}
    order = []
    for mt in existing:
        key = frozenset((mt["teamA"], mt["teamB"]))
        by_key[key] = mt
        order.append(key)
    added, updated = [], []
    for mt in parsed:
        key = frozenset((mt["teamA"], mt["teamB"]))
        if key not in by_key:
            by_key[key] = mt
            order.append(key)
            added.append(mt)
        elif score_map(by_key[key]) != score_map(mt):
            merged = dict(by_key[key])
            merged.update({"teamA": mt["teamA"], "teamB": mt["teamB"],
                           "scoreA": mt["scoreA"], "scoreB": mt["scoreB"]})
            if not merged.get("date"):
                merged["date"] = mt.get("date")
            by_key[key] = merged
            updated.append(merged)
    merged_list = [by_key[k] for k in order]
    merged_list.sort(key=lambda x: (x.get("group", ""), x.get("date") or "", x["teamA"]))
    return merged_list, added, updated


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0 Safari/537.36"),
        "Accept-Language": "en-US,en;q=0.9",
    })
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return r.read().decode("utf-8", "replace")


def load_matches():
    if not os.path.exists(MATCHES_PATH):
        return {"_comment": DEFAULT_COMMENT, "updated": None, "matches": []}, []
    with open(MATCHES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return {"_comment": DEFAULT_COMMENT, "updated": None, "matches": data}, data
    return data, data.get("matches", [])


def fmt(mt):
    d = mt.get("date") or "----"
    return f"[{mt.get('group','?')}] {d} {mt['teamA']} {mt['scoreA']}-{mt['scoreB']} {mt['teamB']}"


def main():
    ap = argparse.ArgumentParser(description="CBS から確定結果を取得して matches.json を更新")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--html", help="ローカルの HTML/テキストファイルを解析")
    ap.add_argument("--dry-run", action="store_true", help="書き換えずに結果だけ表示")
    ap.add_argument("--year", type=int, default=datetime.date.today().year)
    args = ap.parse_args()

    groups, name_to_code, code_to_group = load_team_data()

    if args.html:
        with open(args.html, encoding="utf-8", errors="replace") as f:
            raw = f.read()
        print(f"ローカルファイルを解析: {args.html}")
    else:
        print(f"取得中: {args.url}")
        try:
            raw = fetch(args.url)
        except Exception as e:
            print(f"取得に失敗しました: {e}")
            sys.exit(1)

    text = extract_text(raw)
    parsed = parse_results(text, name_to_code, code_to_group, args.year)
    print(f"ページから検出した確定試合: {len(parsed)} 件")

    data, existing = load_matches()
    merged_list, added, updated = merge(existing, parsed)

    print(f"\n既存: {len(existing)} 件 / 追加: {len(added)} 件 / 更新: {len(updated)} 件")
    for mt in added:
        print("  + 追加 " + fmt(mt))
    for mt in updated:
        print("  ~ 更新 " + fmt(mt))
    if not added and not updated:
        print("  変更はありません。")

    if args.dry_run:
        print("\n--dry-run のため書き込みません。")
        return
    if not added and not updated:
        return

    # バックアップ
    if os.path.exists(MATCHES_PATH):
        bak = MATCHES_PATH + ".bak"
        with open(MATCHES_PATH, encoding="utf-8") as fsrc, \
             open(bak, "w", encoding="utf-8") as fdst:
            fdst.write(fsrc.read())
        print(f"バックアップ: {os.path.basename(bak)}")

    out = {
        "_comment": data.get("_comment", DEFAULT_COMMENT),
        "updated": datetime.date.today().isoformat(),
        "matches": merged_list,
    }
    tmp = MATCHES_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, MATCHES_PATH)
    print(f"\n更新しました: {os.path.basename(MATCHES_PATH)}（合計 {len(merged_list)} 試合）")


if __name__ == "__main__":
    main()
