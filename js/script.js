// =========================================
// 定数定義
// =========================================

// 勝ち点ごとの突破確率定義
const QUALIFY_RATES = {
    9: 1.000, 7: 1.000, 6: 1.000, 5: 1.000,
    4: 0.993, 3: 0.473, 2: 0.025, 1: 0.000, 0: 0.000
};

// 判定ラベル定義
const STATUS_LABELS = {
    9: { text: "突破", class: "status-safe" },
    7: { text: "突破", class: "status-safe" },
    6: { text: "突破", class: "status-safe" },
    5: { text: "突破", class: "status-safe" },
    4: { text: "ほぼ確実", class: "status-safe" },
    3: { text: "得失点差勝負", class: "status-border" },
    2: { text: "奇跡待ち", class: "status-miracle" },
    1: { text: "敗退決定", class: "status-out" },
    0: { text: "敗退決定", class: "status-out" }
};

// 翻訳リソース (UI用)
const UI_RESOURCES = {
    ja: {
        title: "2026 FIFAワールドカップ GS突破予想確率シミュレーション",
        target_label: "対象チーム：",
        select_btn: "変更",
        desc: "各対戦における勝利・引き分け・敗北の確率を入力してください。グループステージ(GS)を突破できる確率をシミュレーションします。",
        th_opponent: "対戦チーム",
        th_win: "勝利 %",
        th_draw: "引分 %",
        th_loss: "敗北 %",
        getSummary: (name) => `${name}のGS突破予想確率は`,
        res_summary_suffix: " です。",
        th_pts: "勝ち点",
        th_prob: "確率",
        th_qual_prob: "GS突破確率",
        th_status: "GS突破",
        err_msg: "合計が100%になっていません",
        share_btn: "シェア用URLをコピー",
        share_done: "コピーしました！",
        share_fail: "コピーに失敗しました",
        getBreakdown: (p4, p3, p3_qual, p3_fail, p2) => `
            内訳<br>
            ${p4}% の確率で、勝ち点4以上を獲得し<strong>突破</strong><br>
            ${p3}% の確率で、勝ち点3を獲得 (${p3_qual}% で突破、${p3_fail}% で敗退)<br>
            ${p2}% の確率で、勝ち点2以下しか獲得できず<strong>敗退</strong>
        `,
        status: {
            safe: "突破", likely: "ほぼ確実", border: "得失点差勝負", miracle: "奇跡待ち", out: "敗退決定"
        }
    },
    en: {
        title: "2026 World Cup Qualification Simulator",
        target_label: "Target Team: ",
        select_btn: "Change",
        desc: "Enter the probability of Win, Draw, and Loss for each match.",
        th_opponent: "Opponent",
        th_win: "Win %",
        th_draw: "Draw %",
        th_loss: "Loss %",
        getSummary: (name) => `${name}'s Qualification Probability:`,
        res_summary_suffix: "",
        th_pts: "Points",
        th_prob: "Prob.",
        th_qual_prob: "Qualify %",
        th_status: "Status",
        err_msg: "Total must be 100%",
        share_btn: "Copy Share URL",
        share_done: "Copied!",
        share_fail: "Copy Failed",
        getBreakdown: (p4, p3, p3_qual, p3_fail, p2) => `
            Breakdown<br>
            ${p4}%: 4+ points (<strong>Qualified</strong>)<br>
            ${p3}%: 3 points (${p3_qual}% qualify, ${p3_fail}% elim)<br>
            ${p2}%: 2 points or less (<strong>Eliminated</strong>)
        `,
        status: {
            safe: "Qualified", likely: "Very Likely", border: "Goal Difference", miracle: "Miracle Needed", out: "Eliminated"
        }
    }
};

// =========================================
// グローバル変数
// =========================================
let currentLang = 'ja';
let targetTeamCode = 'JP';
let currentGroupData = null;
let statsData = []; // stats.json のデータを保持
let isStateLoaded = false; // 初回ロード時のURLパラメータ反映済みフラグ

// =========================================
// 初期化処理
// =========================================
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lang')) currentLang = urlParams.get('lang');
    if (urlParams.has('team')) targetTeamCode = urlParams.get('team');

    const langSel = document.getElementById('lang-selector');
    if(langSel) {
        langSel.value = currentLang;
        langSel.addEventListener('change', changeLang);
    }
    
    const selectBtn = document.getElementById('select-team-btn');
    if(selectBtn) {
        selectBtn.href = `select.html?lang=${currentLang}`;
        selectBtn.innerText = UI_RESOURCES[currentLang].select_btn;
    }

    // シェアボタンのイベントリスナー
    const shareBtn = document.getElementById('share-url-btn');
    if(shareBtn) {
        shareBtn.addEventListener('click', copyShareUrl);
    }

    loadTeamsData();
};

function loadTeamsData() {
    // teams.json と stats.json を並列で読み込む
    Promise.all([
        fetch('./teams.json').then(res => res.json()),
        fetch('./stats.json').then(res => res.json())
    ])
    .then(([groups, stats]) => {
        // 統計データをグローバル変数に保存
        statsData = stats;

        let foundGroup = null;
        let targetTeamData = null;

        for (const group of groups) {
            const team = group.teams.find(t => t.code === targetTeamCode);
            if (team) {
                foundGroup = group;
                targetTeamData = team;
                break;
            }
        }

        if (!targetTeamData) {
            console.warn('Team not found:', targetTeamCode);
            targetTeamCode = 'JP';
            // 再帰呼び出し（データはキャッシュされるため負荷は低い）
            return loadTeamsData(); 
        }

        currentGroupData = {
            target: targetTeamData,
            opponents: foundGroup.teams.filter(t => t.code !== targetTeamCode)
        };

        render();
    })
    .catch(err => {
        console.error('Failed to load data:', err);
        document.querySelector('.container').innerHTML = 
            '<p style="color:red; text-align:center;">データの読み込みに失敗しました。<br>ローカルサーバー経由で実行しているか、stats.json / teams.json が存在するか確認してください。</p>';
    });
}

function changeLang() {
    currentLang = document.getElementById('lang-selector').value;
    const selectBtn = document.getElementById('select-team-btn');
    if(selectBtn) selectBtn.href = `select.html?lang=${currentLang}`;

    // 言語切り替え時にURLのlangパラメータも更新する
    const url = new URL(window.location);
    url.searchParams.set('lang', currentLang);
    window.history.replaceState(null, '', url);

    render();
}

// =========================================
// ヘルパー関数: ランキング丸め処理
// =========================================
function getRoundedRank(rank) {
    if (!rank) return 50; // null等の場合は50扱い
    // 1-10 -> 10, 11-20 -> 20, ... 
    let r = Math.ceil(rank / 10) * 10;
    // 50以上は50
    if (r > 50) r = 50;
    return r;
}

// =========================================
// 描画処理
// =========================================
function render() {
    if (!currentGroupData) return;

    const text = UI_RESOURCES[currentLang];
    const target = currentGroupData.target;
    const opponents = currentGroupData.opponents;
    const urlParams = new URLSearchParams(window.location.search);
    const hasStateParam = urlParams.has('s');

    // テキスト更新
    document.getElementById('app-title').innerText = text.title;
    document.getElementById('select-team-btn').innerText = text.select_btn;
    document.getElementById('target-team-heading-text').innerText = 
        `${text.target_label} ${target.name[currentLang]}`;
    document.getElementById('target-team-flag').src = `./img/${target.code}.png`;
    document.getElementById('app-desc').innerText = text.desc;
    document.getElementById('th-opponent').innerText = text.th_opponent;
    document.getElementById('th-win').innerText = text.th_win;
    document.getElementById('th-draw').innerText = text.th_draw;
    document.getElementById('th-loss').innerText = text.th_loss;
    document.getElementById('res-summary-text').innerText = text.getSummary(target.name[currentLang]);
    document.getElementById('th-pts').innerText = text.th_pts;
    document.getElementById('th-prob').innerText = text.th_prob;
    document.getElementById('th-qual-prob').innerText = text.th_qual_prob;
    document.getElementById('th-status').innerText = text.th_status;
    
    // シェアボタンの文言更新
    const shareBtn = document.getElementById('share-url-btn');
    if(shareBtn) shareBtn.innerText = text.share_btn;

    // 入力エリアの生成
    const tbody = document.getElementById('input-rows');
    const existingRows = tbody.querySelectorAll('tr.input-row');
    
    let needReset = false;
    if (existingRows.length !== opponents.length) {
        needReset = true;
    } else {
        const firstImg = existingRows[0].querySelector('img').src;
        if (!firstImg.includes(opponents[0].code)) needReset = true;
    }

    if (needReset) {
        tbody.innerHTML = '';
        opponents.forEach((opp, index) => {
            // 初期値の計算
            let defW = 30, defD = 40, defL = 30; // デフォルト

            // URLに 's' がない場合のみランキングから計算
            if (!hasStateParam) {
                const targetRank = getRoundedRank(target.rank);
                const oppRank = getRoundedRank(opp.rank);
                
                // 読み込んだ statsData から検索
                const stat = statsData.find(d => d.my_rank === targetRank && d.opponent_rank === oppRank);
                
                if (stat) {
                    defW = stat.win_rate;
                    defD = stat.draw_rate;
                    defL = stat.loss_rate;
                } else {
                    // マッチしなかった場合のフォールバック
                    defW = 30; defD = 40; defL = 30;
                }
            }

            const tr = document.createElement('tr');
            tr.className = 'input-row';
            tr.innerHTML = `
                <td>
                    <div class="team-name">
                        <img src="./img/${opp.code}.png" class="flag-icon">
                        <span class="team-name-text">${opp.name[currentLang]}</span>
                    </div>
                </td>
                <td><input type="number" class="in-win" id="w${index}" value="${defW}" oninput="calc()"> <span class="percent-label">%</span></td>
                <td><input type="number" class="in-draw" id="d${index}" value="${defD}" oninput="calc()"> <span class="percent-label">%</span></td>
                <td><input type="number" class="in-loss" id="l${index}" value="${defL}" oninput="calc()"> <span class="percent-label">%</span></td>
            `;
            tbody.appendChild(tr);

            const trErr = document.createElement('tr');
            trErr.innerHTML = `<td colspan="4"><span id="err${index}" class="error-msg">${text.err_msg}</span></td>`;
            tbody.appendChild(trErr);
        });

        if (!isStateLoaded) {
            applyUrlState(opponents.length);
            isStateLoaded = true;
        }

    } else {
        existingRows.forEach((row, index) => {
            row.querySelector('.team-name-text').innerText = opponents[index].name[currentLang];
        });
    }

    calc();
}

// =========================================
// URL状態管理 & シェア機能
// =========================================

function updateUrlState() {
    const values = [];
    const rows = document.querySelectorAll('tr.input-row');
    
    rows.forEach((row, index) => {
        const w = document.getElementById(`w${index}`).value;
        const d = document.getElementById(`d${index}`).value;
        values.push(parseInt(w));
        values.push(parseInt(d));
    });

    try {
        const jsonStr = JSON.stringify(values);
        const encoded = btoa(jsonStr);
        const url = new URL(window.location);
        
        url.searchParams.set('s', encoded);
        url.searchParams.set('lang', currentLang);

        window.history.replaceState(null, '', url);
    } catch (e) {
        console.error('Encode failed', e);
    }
}

function applyUrlState(count) {
    const urlParams = new URLSearchParams(window.location.search);
    const s = urlParams.get('s');
    if (!s) return;

    try {
        const jsonStr = atob(s);
        const values = JSON.parse(jsonStr);

        if (Array.isArray(values) && values.length === count * 2) {
            for (let i = 0; i < count; i++) {
                const w = values[i * 2];
                const d = values[i * 2 + 1];
                const l = 100 - w - d;

                const elW = document.getElementById(`w${i}`);
                const elD = document.getElementById(`d${i}`);
                const elL = document.getElementById(`l${i}`);
                
                if(elW) elW.value = w;
                if(elD) elD.value = d;
                if(elL) elL.value = l;
            }
        }
    } catch (e) {
        console.warn('Invalid state parameter', e);
    }
}

// シェアURLをクリップボードにコピー
function copyShareUrl() {
    const url = window.location.href;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => {
            showCopySuccess();
        }).catch(err => {
            copyShareUrlFallback(url);
        });
    } else {
        copyShareUrlFallback(url);
    }
}

// フォールバック
function copyShareUrlFallback(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess();
        } else {
            alert(UI_RESOURCES[currentLang].share_fail);
        }
    } catch (err) {
        console.error('Fallback copy failed', err);
        alert(UI_RESOURCES[currentLang].share_fail);
    }

    document.body.removeChild(textArea);
}

function showCopySuccess() {
    const btn = document.getElementById('share-url-btn');
    const originalText = btn.innerText;
    btn.innerText = UI_RESOURCES[currentLang].share_done;
    setTimeout(() => {
        btn.innerText = originalText;
    }, 2000);
}

// =========================================
// 計算ロジック
// =========================================
function calc() {
    // 値を安全に取得するヘルパー（0〜100に制限）
    const getVal = (el) => {
        if (!el) return 0;
        let v = parseFloat(el.value);
        if (isNaN(v)) return 0;
        if (v < 0) { v = 0; el.value = 0; }
        if (v > 100) { v = 100; el.value = 100; }
        return v;
    };

    const tbody = document.getElementById('input-rows');
    if (!tbody) return; // エラー回避
    
    const rows = tbody.querySelectorAll('tr.input-row');
    const inputs = [];

    rows.forEach((row, index) => {
        const w = getVal(row.querySelector('.in-win'));
        const d = getVal(row.querySelector('.in-draw'));
        const l = getVal(row.querySelector('.in-loss'));
        
        const sum = w + d + l;
        const errEl = document.getElementById(`err${index}`);
        
        // ★修正ポイント: 合計と100の差が 0.1 より大きい場合にエラーとする（誤差許容）
        if (Math.abs(sum - 100) > 0.1) {
            if(errEl) errEl.style.display = 'block';
        } else {
            if(errEl) errEl.style.display = 'none';
        }
        
        inputs.push({ w: w/100, d: d/100, l: l/100 });
    });

    if (inputs.length === 0) return;

    // URL更新（シェア機能用）
    if (typeof updateUrlState === 'function') {
        updateUrlState();
    }

    // 確率計算（27通り）
    let pointsDist = { 9:0, 7:0, 6:0, 5:0, 4:0, 3:0, 2:0, 1:0, 0:0 };
    
    ['w', 'd', 'l'].forEach(r1 => {
        ['w', 'd', 'l'].forEach(r2 => {
            ['w', 'd', 'l'].forEach(r3 => {
                const prob = inputs[0][r1] * inputs[1][r2] * inputs[2][r3];
                let pts = 0;
                if(r1 === 'w') pts += 3; else if(r1 === 'd') pts += 1;
                if(r2 === 'w') pts += 3; else if(r2 === 'd') pts += 1;
                if(r3 === 'w') pts += 3; else if(r3 === 'd') pts += 1;
                if (pointsDist.hasOwnProperty(pts)) pointsDist[pts] += prob;
            });
        });
    });

    // 集計
    let totalQualifyProb = 0;
    let p4_plus = 0, p3 = 0, p3_qual = 0, p2_under = 0;
    const tableData = [];
    const text = UI_RESOURCES[currentLang];

    Object.keys(pointsDist).sort((a,b) => b-a).forEach(pt => {
        const p = pointsDist[pt];
        const qRate = QUALIFY_RATES[pt];
        const qProb = p * qRate;
        totalQualifyProb += qProb;

        if (pt >= 4) p4_plus += p;
        else if (pt == 3) { p3 = p; p3_qual = qProb; }
        else p2_under += p;

        let statusKey = 'out';
        if (pt >= 5) statusKey = 'safe';
        else if (pt == 4) statusKey = 'likely';
        else if (pt == 3) statusKey = 'border';
        else if (pt == 2) statusKey = 'miracle';
        
        tableData.push({ 
            pts: pt, 
            prob: p, 
            qRate: qRate, 
            statusText: text.status[statusKey],
            statusClass: `status-${statusKey}`
        });
    });

    // 結果表示
    document.getElementById('total-prob').innerText = 
        (totalQualifyProb * 100).toFixed(1) + "%" + text.res_summary_suffix;

    const p3_fail = p3 - p3_qual;
    document.getElementById('breakdown-text').innerHTML = text.getBreakdown(
        (p4_plus * 100).toFixed(1),
        (p3 * 100).toFixed(1),
        (p3_qual * 100).toFixed(1),
        (p3_fail * 100).toFixed(1),
        (p2_under * 100).toFixed(1)
    );

    const resTbody = document.getElementById('result-tbody');
    resTbody.innerHTML = '';
    tableData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.pts}</td>
            <td>${(row.prob * 100).toFixed(1)}%</td>
            <td>${(row.qRate * 100).toFixed(1)}%</td>
            <td class="${row.statusClass}">${row.statusText}</td>
        `;
        resTbody.appendChild(tr);
    });
}