// =========================================
// 定数定義
// =========================================

// 勝ち点ごとの突破確率定義
const QUALIFY_RATES = {
    9: 1.000, 7: 1.000, 6: 1.000, 5: 1.000,
    4: 0.993, 3: 0.473, 2: 0.025, 1: 0.000, 0: 0.000
};

// 判定ラベル定義（デフォルト：クラス名用）
// テキストは後でJSONから取得して上書きします
const STATUS_LABELS = {
    9: { class: "status-safe" },
    7: { class: "status-safe" },
    6: { class: "status-safe" },
    5: { class: "status-safe" },
    4: { class: "status-safe" },
    3: { class: "status-border" },
    2: { class: "status-miracle" },
    1: { class: "status-out" },
    0: { class: "status-out" }
};

// =========================================
// グローバル変数
// =========================================
const browserLanguage = (window.navigator.languages && window.navigator.languages[0]) ||
                        window.navigator.language ||
                        'en';
let currentLang = browserLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';

let targetTeamCode = 'JP';
let currentGroupData = null;
let statsData = []; // stats.json のデータを保持
let isStateLoaded = false; // 初回ロード時のURLパラメータ反映済みフラグ

// 翻訳データを保持する変数
let uiResources = null;

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
    
    // シェアボタンのイベントリスナー
    const shareBtn = document.getElementById('share-url-btn');
    if(shareBtn) {
        shareBtn.addEventListener('click', copyShareUrl);
    }

    loadAllData();
};

function loadAllData() {
    // teams.json, stats.json, locales/{lang}.json を並列で読み込む
    Promise.all([
        fetch('./teams.json').then(res => res.json()),
        fetch('./stats.json').then(res => res.json()),
        fetch(`./locales/${currentLang}.json`).then(res => res.json())
    ])
    .then(([groups, stats, localeData]) => {
        // 統計データ保存
        statsData = stats;
        
        // 翻訳データ保存 (indexページ用を使用)
        uiResources = localeData.index;

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
            return loadAllData(); 
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
            '<p style="color:red; text-align:center;">データの読み込みに失敗しました。<br>Failed to load data.</p>';
    });
}

function changeLang() {
    currentLang = document.getElementById('lang-selector').value;
    
    const url = new URL(window.location);
    url.searchParams.set('lang', currentLang);
    window.history.replaceState(null, '', url);

    // 言語を切り替えたのでデータを再読み込み（リロードせずfetchし直す）
    loadAllData();
}

// =========================================
// ヘルパー関数: ランキング丸め処理
// =========================================
function getRoundedRank(rank) {
    if (!rank) return 50; 
    let r = Math.ceil(rank / 10) * 10;
    if (r > 50) r = 50;
    return r;
}

// =========================================
// 描画処理
// =========================================
function render() {
    if (!currentGroupData || !uiResources) return;

    // HTMLタグの言語設定
    document.documentElement.lang = currentLang;

    const text = uiResources; // JSONから読み込んだデータ
    const target = currentGroupData.target;
    const opponents = currentGroupData.opponents;
    const urlParams = new URLSearchParams(window.location.search);
    const hasStateParam = urlParams.has('s');

    // リンクの更新
    const selectBtn = document.getElementById('select-team-btn');
    if(selectBtn) {
        selectBtn.href = `select.html?lang=${currentLang}`;
        selectBtn.innerText = text.select_btn;
    }

    // テキスト更新
    document.getElementById('app-title').innerText = text.title;
    document.getElementById('target-team-heading-text').innerText = 
        `${text.target_label} ${target.name[currentLang]}`;
    document.getElementById('target-team-flag').src = `./img/${target.code}.png`;
    document.getElementById('app-desc').innerText = text.desc;
    document.getElementById('th-opponent').innerText = text.th_opponent;
    document.getElementById('th-win').innerText = text.th_win;
    document.getElementById('th-draw').innerText = text.th_draw;
    document.getElementById('th-loss').innerText = text.th_loss;
    
    // テンプレート置換: Summary
    const summaryText = text.summary_template.replace('{name}', target.name[currentLang]);
    document.getElementById('res-summary-text').innerText = summaryText;

    document.getElementById('th-pts').innerText = text.th_pts;
    document.getElementById('th-prob').innerText = text.th_prob;
    document.getElementById('th-qual-prob').innerText = text.th_qual_prob;
    document.getElementById('th-status').innerText = text.th_status;
    
    const shareBtn = document.getElementById('share-url-btn');
    if(shareBtn) shareBtn.innerText = text.share_btn;

    const descTitle = document.getElementById('desc-title');
    if (descTitle) descTitle.innerText = text.desc_title;

    const descList = document.getElementById('desc-list');
    if (descList) {
        descList.innerHTML = '';
        text.desc_list.forEach(item => {
            const li = document.createElement('li');
            li.innerText = item;
            descList.appendChild(li);
        });
    }

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
            let defW = 30, defD = 40, defL = 30;

            if (!hasStateParam) {
                const targetRank = getRoundedRank(target.rank);
                const oppRank = getRoundedRank(opp.rank);
                const stat = statsData.find(d => d.my_rank === targetRank && d.opponent_rank === oppRank);
                
                if (stat) {
                    defW = stat.win_rate;
                    defD = stat.draw_rate;
                    defL = stat.loss_rate;
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

// ... (updateUrlState, applyUrlState, copyShareUrl などの関数は変更なしのため省略可能ですが、そのまま維持してください) ...

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
    } catch (e) { console.error(e); }
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
    } catch (e) { console.warn(e); }
}

function copyShareUrl() {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => showCopySuccess()).catch(() => copyShareUrlFallback(url));
    } else {
        copyShareUrlFallback(url);
    }
}

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
        if (document.execCommand('copy')) showCopySuccess();
        else alert(uiResources.share_fail);
    } catch (err) {
        alert(uiResources.share_fail);
    }
    document.body.removeChild(textArea);
}

function showCopySuccess() {
    const btn = document.getElementById('share-url-btn');
    const originalText = btn.innerText;
    btn.innerText = uiResources.share_done;
    setTimeout(() => { btn.innerText = originalText; }, 2000);
}

// =========================================
// 計算ロジック
// =========================================
function calc() {
    // UIリソースがロードされていない場合は計算しない
    if (!uiResources) return;

    const getVal = (el) => {
        if (!el) return 0;
        let v = parseFloat(el.value);
        if (isNaN(v)) return 0;
        if (v < 0) { v = 0; el.value = 0; }
        if (v > 100) { v = 100; el.value = 100; }
        return v;
    };

    const tbody = document.getElementById('input-rows');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr.input-row');
    const inputs = [];

    rows.forEach((row, index) => {
        const w = getVal(row.querySelector('.in-win'));
        const d = getVal(row.querySelector('.in-draw'));
        const l = getVal(row.querySelector('.in-loss'));
        
        const sum = w + d + l;
        const errEl = document.getElementById(`err${index}`);
        
        if (Math.abs(sum - 100) > 0.1) {
            if(errEl) errEl.style.display = 'block';
        } else {
            if(errEl) errEl.style.display = 'none';
        }
        
        inputs.push({ w: w/100, d: d/100, l: l/100 });
    });

    if (inputs.length === 0) return;

    if (typeof updateUrlState === 'function') {
        updateUrlState();
    }

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

    let totalQualifyProb = 0;
    let p4_plus = 0, p3 = 0, p3_qual = 0, p2_under = 0;
    const tableData = [];
    const text = uiResources; // JSON参照

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
        
        // テキストはJSONから、クラス名は定数から取得
        tableData.push({ 
            pts: pt, 
            prob: p, 
            qRate: qRate, 
            statusText: text.status[statusKey],
            statusClass: STATUS_LABELS[pt] ? STATUS_LABELS[pt].class : "status-out"
        });
    });

    document.getElementById('total-prob').innerText = 
        (totalQualifyProb * 100).toFixed(1) + "%" + text.res_summary_suffix;

    const p3_fail = p3 - p3_qual;
    
    // テンプレート置換: Breakdown
    let bd = text.breakdown_template;
    bd = bd.replace('{p4}', (p4_plus * 100).toFixed(1));
    bd = bd.replace('{p3}', (p3 * 100).toFixed(1));
    bd = bd.replace('{p3_qual}', (p3_qual * 100).toFixed(1));
    bd = bd.replace('{p3_fail}', (p3_fail * 100).toFixed(1));
    bd = bd.replace('{p2}', (p2_under * 100).toFixed(1));
    
    document.getElementById('breakdown-text').innerHTML = bd;

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