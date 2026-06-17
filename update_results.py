#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_results.py
  全チームの GS 突破予想確率を「4 スナップショット」で再計算し results.json を更新する。
    - init : 当初（全試合 stats.json の初期値）
    - md1  : 第1節終了時（チームの1試合目が確定していれば実結果、残りは初期値）
    - md2  : 第2節終了時（1〜2試合目が確定していれば実結果）
    - md3  : 第3節終了時＝GS終了（3試合とも確定していれば実結果）
  計算式は index（js/script.js）と同一（stats 初期値 + 確定結果 + QUALIFY_RATES）。

  初回実行時、既存 results.json を results.initial.json にバックアップする。

使い方:
  uv run python update_results.py
  uv run python update_results.py --dry-run
"""
import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TEAMS_PATH = os.path.join(HERE, "teams.json")
STATS_PATH = os.path.join(HERE, "stats.json")
MATCHES_PATH = os.path.join(HERE, "matches.json")
RESULTS_PATH = os.path.join(HERE, "results.json")
BACKUP_PATH = os.path.join(HERE, "results.initial.json")

QUALIFY_RATES = {9: 1.0, 7: 1.0, 6: 1.0, 5: 1.0, 4: 0.993, 3: 0.473, 2: 0.025, 1: 0.0, 0: 0.0}
SNAPSHOTS = [("init", 0), ("md1", 1), ("md2", 2), ("md3", 3)]


def rounded_rank(r):
    if not r:
        return 50
    x = -(-int(r) // 10) * 10   # ceil(r/10)*10
    return 50 if x > 50 else x


def load():
    teams = json.load(open(TEAMS_PATH, encoding="utf-8"))
    stats = json.load(open(STATS_PATH, encoding="utf-8"))
    md = json.load(open(MATCHES_PATH, encoding="utf-8"))
    matches = md.get("matches", md) if isinstance(md, dict) else md
    return teams, stats, matches


def stat_lookup(stats, mr, orank):
    for s in stats:
        if s["my_rank"] == mr and s["opponent_rank"] == orank:
            return s["win_rate"], s["draw_rate"], s["loss_rate"]
    return 30, 40, 30


def team_result(code, m):
    """code 視点の (win,draw,loss)=100/0/0 等"""
    if m["teamA"] == code:
        f, a = m["scoreA"], m["scoreB"]
    else:
        f, a = m["scoreB"], m["scoreA"]
    if f > a:
        return (100, 0, 0)
    if f == a:
        return (0, 100, 0)
    return (0, 0, 100)


def opponent(code, m):
    return m["teamB"] if m["teamA"] == code else m["teamA"]


def qualify(team, opponents, stats, applied):
    inputs = []
    for o in opponents:
        if o["code"] in applied:
            w, d, l = applied[o["code"]]
        else:
            w, d, l = stat_lookup(stats, rounded_rank(team.get("rank")),
                                  rounded_rank(o.get("rank")))
        inputs.append((w / 100.0, d / 100.0, l / 100.0))
    pd = {k: 0.0 for k in QUALIFY_RATES}
    R = [(3, 0), (1, 1), (0, 2)]  # (points, index in (w,d,l))
    for p1, i1 in R:
        for p2, i2 in R:
            for p3, i3 in R:
                pr = inputs[0][i1] * inputs[1][i2] * inputs[2][i3]
                pd[p1 + p2 + p3] += pr
    return sum(pd[k] * QUALIFY_RATES[k] for k in pd) * 100.0


def compute(teams, stats, matches):
    out = {}
    for g in teams:
        for team in g["teams"]:
            code = team["code"]
            opponents = [t for t in g["teams"] if t["code"] != code]
            played = sorted(
                [m for m in matches if code in (m["teamA"], m["teamB"])],
                key=lambda m: (m.get("date") or "", m.get("group", "")))
            snaps = {}
            for label, k in SNAPSHOTS:
                applied = {opponent(code, m): team_result(code, m) for m in played[:k]}
                snaps[label] = f"{qualify(team, opponents, stats, applied):.1f}"
            out[code] = snaps
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    teams, stats, matches = load()
    out = compute(teams, stats, matches)

    # サマリ表示
    played_counts = {}
    for m in matches:
        for c in (m["teamA"], m["teamB"]):
            played_counts[c] = played_counts.get(c, 0) + 1
    moved = [c for c, s in out.items() if s["init"] != s["md3"]]
    print(f"全 {len(out)} チームを再計算。確定試合のあるチーム: {len(moved)}")
    for c in sorted(moved):
        s = out[c]
        print(f"  {c}: 当初 {s['init']}% → 第1 {s['md1']}% → 第2 {s['md2']}% → 第3 {s['md3']}%")

    if args.dry_run:
        print("\n--dry-run のため書き込みません。")
        return

    if not os.path.exists(BACKUP_PATH) and os.path.exists(RESULTS_PATH):
        with open(RESULTS_PATH, encoding="utf-8") as fsrc, \
             open(BACKUP_PATH, "w", encoding="utf-8") as fdst:
            fdst.write(fsrc.read())
        print(f"\nバックアップ作成: {os.path.basename(BACKUP_PATH)}（当初の results.json）")

    tmp = RESULTS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, RESULTS_PATH)
    print(f"更新: {os.path.basename(RESULTS_PATH)}（{len(out)} チーム × 4 スナップショット）")


if __name__ == "__main__":
    main()
