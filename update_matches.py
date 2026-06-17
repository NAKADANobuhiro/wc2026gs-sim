#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_matches.py
  FIFA 公式データ API（api.fifa.com）から 2026 W杯の「確定した試合結果」を取得し、
  matches.json を更新するスクリプト（標準ライブラリのみ・APIキー不要）。

  取得元: https://api.fifa.com/api/v3/calendar/matches
          ?idCompetition=17&idSeason=285023&count=500&language=en
    - idCompetition=17       … FIFA World Cup（男子）
    - idSeason=285023        … FIFA World Cup 2026
    - MatchStatus==0         … 試合終了（確定）／ 1 … 未実施

使い方:
  uv run python update_matches.py             # 取得して matches.json を更新
  uv run python update_matches.py --dry-run   # 取得・解析のみ（書き込まない）
  uv run python update_matches.py --json FILE  # 保存済み API レスポンスを解析（オフライン確認用）

仕組み:
  - MatchStatus==0（確定）かつグループステージ（GroupName が "Group X"）の試合のみ採用。
  - チーム名（英語）を teams.json の code に対応づけ、同一グループの対戦だけ取り込む。
  - matches.json に未登録の試合を追記。スコアが変われば更新。書き換え前に matches.json.bak を作成。
"""
import argparse
import datetime
import json
import os
import re
import ssl
import sys
import unicodedata
import urllib.parse
import urllib.request

API_URL = "https://api.fifa.com/api/v3/calendar/matches"
ID_COMPETITION = "17"      # FIFA World Cup（男子）
ID_SEASON = "285023"       # FIFA World Cup 2026
HERE = os.path.dirname(os.path.abspath(__file__))
TEAMS_PATH = os.path.join(HERE, "teams.json")
MATCHES_PATH = os.path.join(HERE, "matches.json")

DEFAULT_COMMENT = ("グループステージの確定試合結果。teamA/teamB は teams.json の code。"
                   "score は実際の得点。試合が終わったらここに 1 行追記すれば、"
                   "シミュレーターの該当カードが自動で勝/分/敗 100/0/0 に固定されます。"
                   "update_matches.py（FIFA 公式 API）で自動更新も可能。"
                   "日付・グループは参考情報で計算には未使用。")

# FIFA 表記が teams.json の en 名と異なるチームの別名 → teams.json の code
ALIASES = {
    "czechia": "CZ", "czech republic": "CZ",
    "cabo verde": "CV", "cape verde": "CV",
    "turkey": "TR", "turkiye": "TR",
    "usa": "US", "united states": "US",
    "bosnia and herzegovina": "BA", "bosnia & herz.": "BA", "bosnia": "BA",
    "dr congo": "CD", "congo dr": "CD", "democratic republic of the congo": "CD",
    "ivory coast": "CI", "cote d'ivoire": "CI",
    "south korea": "KR", "korea republic": "KR", "korea": "KR",
    "curacao": "CW",
    "ir iran": "IR", "iran": "IR",
}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s)
                   if not unicodedata.combining(c))


def norm(s):
    return re.sub(r"\s+", " ", strip_accents(s or "").strip().lower())


def load_team_data():
    with open(TEAMS_PATH, encoding="utf-8") as f:
        groups = json.load(f)
    name_to_code, code_to_group = {}, {}
    for g in groups:
        for t in g["teams"]:
            code_to_group[t["code"]] = g["id"]
            name_to_code[norm(t["name"]["en"])] = t["code"]
    for alias, code in ALIASES.items():
        name_to_code[norm(alias)] = code
    return groups, name_to_code, code_to_group


def fetch_matches():
    params = {"idCompetition": ID_COMPETITION, "idSeason": ID_SEASON,
              "count": "500", "language": "en"}
    url = API_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0 Safari/537.36"),
    })
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        payload = json.loads(r.read().decode("utf-8"))
    return payload.get("Results", [])


def _desc(arr):
    if isinstance(arr, list) and arr:
        return arr[0].get("Description")
    return None


def parse_matches(raw, name_to_code, code_to_group):
    results, seen, unmapped = [], set(), set()
    for m in raw:
        if m.get("MatchStatus") != 0:          # 0=終了, 1=未実施
            continue
        gname = _desc(m.get("GroupName"))
        if not gname:                          # ノックアウトは GroupName が無い
            continue
        gl = re.search(r"([A-L])\b", gname)
        if not gl:
            continue
        home, away = m.get("Home"), m.get("Away")
        hs, as_ = m.get("HomeTeamScore"), m.get("AwayTeamScore")
        if not home or not away or hs is None or as_ is None:
            continue
        hn, an = _desc(home.get("TeamName")), _desc(away.get("TeamName"))
        c1, c2 = name_to_code.get(norm(hn)), name_to_code.get(norm(an))
        if not c1:
            unmapped.add(hn)
        if not c2:
            unmapped.add(an)
        if not c1 or not c2 or c1 == c2:
            continue
        if code_to_group.get(c1) != code_to_group.get(c2):
            continue
        key = frozenset((c1, c2))
        if key in seen:
            continue
        seen.add(key)
        date = (m.get("Date") or "")[:10] or None
        results.append({"group": code_to_group[c1], "date": date,
                        "teamA": c1, "teamB": c2,
                        "scoreA": int(hs), "scoreB": int(as_)})
    return results, unmapped


def score_map(mt):
    return {mt["teamA"]: mt["scoreA"], mt["teamB"]: mt["scoreB"]}


def merge(existing, parsed):
    by_key, order = {}, []
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


def load_matches():
    if not os.path.exists(MATCHES_PATH):
        return {"_comment": DEFAULT_COMMENT, "updated": None, "matches": []}, []
    with open(MATCHES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return {"_comment": DEFAULT_COMMENT, "updated": None, "matches": data}, data
    return data, data.get("matches", [])


def fmt(mt):
    return f"[{mt.get('group','?')}] {mt.get('date') or '----'} {mt['teamA']} {mt['scoreA']}-{mt['scoreB']} {mt['teamB']}"


def main():
    ap = argparse.ArgumentParser(description="FIFA 公式 API から確定結果を取得して matches.json を更新")
    ap.add_argument("--json", help="保存済み API レスポンス(JSON)を解析（オフライン確認用）")
    ap.add_argument("--dry-run", action="store_true", help="書き換えずに結果だけ表示")
    args = ap.parse_args()

    groups, name_to_code, code_to_group = load_team_data()

    if args.json:
        with open(args.json, encoding="utf-8") as f:
            payload = json.load(f)
        raw = payload.get("Results", payload) if isinstance(payload, dict) else payload
        print(f"ローカル JSON を解析: {args.json}（{len(raw)} 試合）")
    else:
        print(f"取得中: FIFA API (idCompetition={ID_COMPETITION}, idSeason={ID_SEASON})")
        try:
            raw = fetch_matches()
        except urllib.error.HTTPError as e:
            print(f"取得に失敗（HTTP {e.code}）: {e.reason}")
            sys.exit(1)
        except Exception as e:
            print(f"取得に失敗しました: {e}")
            sys.exit(1)
        print(f"API から取得した全試合: {len(raw)} 件")

    parsed, unmapped = parse_matches(raw, name_to_code, code_to_group)
    print(f"確定したグループステージ試合: {len(parsed)} 件")
    if unmapped:
        print("  ※ コードに対応づけできなかったチーム名（ALIASES への追加を検討）: "
              + ", ".join(sorted(n for n in unmapped if n)))

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

    if os.path.exists(MATCHES_PATH):
        with open(MATCHES_PATH, encoding="utf-8") as fsrc, \
             open(MATCHES_PATH + ".bak", "w", encoding="utf-8") as fdst:
            fdst.write(fsrc.read())
        print("バックアップ: matches.json.bak")

    out = {"_comment": data.get("_comment", DEFAULT_COMMENT),
           "updated": datetime.date.today().isoformat(),
           "matches": merged_list}
    tmp = MATCHES_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, MATCHES_PATH)
    print(f"\n更新しました: matches.json（合計 {len(merged_list)} 試合）")


if __name__ == "__main__":
    main()
