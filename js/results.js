// js/results.js

// URLパラメータまたはブラウザ設定から言語を判定
const urlParams = new URLSearchParams(window.location.search);
let currentLang = urlParams.get('lang') ||
                  (navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en');

document.documentElement.lang = currentLang;

const langSel = document.getElementById('lang-selector');
if (langSel) {
    langSel.value = currentLang;
    langSel.addEventListener('change', () => {
        window.location.href = `results.html?lang=${langSel.value}`;
    });
}

// 突破確率セルを生成
//   mode: 'base'    … 当初（基準・通常表示）
//         'delta'   … 確定済み（当初比の差分を色分け表示）
//         'pending' … 未確定（白背景・グレー文字、差分なし）
function probCell(val, baseVal, mode) {
    if (val === undefined || val === null || val === '-') {
        return '<td class="prob-cell pending">-</td>';
    }
    if (mode === 'pending') {
        return `<td class="prob-cell pending">${val}%</td>`;
    }
    if (mode === 'base' || baseVal === undefined || baseVal === null) {
        return `<td class="prob-cell">${val}%</td>`;
    }
    const d = parseFloat(val) - parseFloat(baseVal);
    let cls = 'delta-none', delta = '';
    if (d > 0.05) { cls = 'delta-up'; delta = ` <span class="delta">▲${Math.abs(d).toFixed(1)}</span>`; }
    else if (d < -0.05) { cls = 'delta-down'; delta = ` <span class="delta">▼${Math.abs(d).toFixed(1)}</span>`; }
    return `<td class="prob-cell ${cls}">${val}%${delta}</td>`;
}

// 旧フォーマット("89.5") / 新フォーマット({init,md1,md2,md3}) 両対応
function snapOf(entry) {
    if (entry && typeof entry === 'object') return entry;
    if (entry === undefined || entry === null) return null;
    return { init: entry, md1: entry, md2: entry, md3: entry };
}

Promise.all([
    fetch('./teams.json').then(r => r.json()),
    fetch('./results.json').then(r => r.json()),
    fetch('./matches.json').then(r => r.json()).catch(() => ({ matches: [] })),
    fetch(`./locales/${currentLang}.json`).then(r => r.json())
]).then(([groups, results, matchesJson, locales]) => {
    const text = locales.results;
    const commonText = locales.select;

    // 各チームの消化試合数（確定済みスナップショットの判定に使用）
    const matches = Array.isArray(matchesJson) ? matchesJson : (matchesJson.matches || []);
    const playedCount = {};
    matches.forEach(m => {
        playedCount[m.teamA] = (playedCount[m.teamA] || 0) + 1;
        playedCount[m.teamB] = (playedCount[m.teamB] || 0) + 1;
    });

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = text.page_title;

    document.querySelectorAll('#back-link, .back-link').forEach(el => {
        el.textContent = commonText.back;
        el.href = `index.html?lang=${currentLang}`;
    });

    const container = document.getElementById('results-area');
    if (!container) return;
    container.innerHTML = '';

    if (text.compare_note) {
        const note = document.createElement('p');
        note.className = 'compare-note';
        note.textContent = text.compare_note;
        container.appendChild(note);
    }

    groups.forEach(group => {
        const section = document.createElement('div');
        section.className = 'group-card result-card';

        const header = document.createElement('div');
        header.className = 'group-header';
        header.textContent = text.group.replace('{name}', group.name[currentLang] || group.name.ja);
        section.appendChild(header);

        const table = document.createElement('table');
        table.className = 'result-table compare-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>${text.team}</th>
                    <th class="col-prob">${text.col_init}</th>
                    <th class="col-prob">${text.col_md1}</th>
                    <th class="col-prob">${text.col_md2}</th>
                    <th class="col-prob">${text.col_md3}</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        group.teams.forEach(team => {
            const snap = snapOf(results[team.code]);
            const teamName = team.name[currentLang] || team.name.ja;
            const init = snap ? snap.init : null;
            const played = playedCount[team.code] || 0;
            // 第N節後は、そのチームが N 試合消化済みのときだけ「確定」表示
            const m1 = played >= 1 ? 'delta' : 'pending';
            const m2 = played >= 2 ? 'delta' : 'pending';
            const m3 = played >= 3 ? 'delta' : 'pending';

            const tr = document.createElement('tr');
            // 国名（チームセル）クリックでそのチームのシミュレーター画面へ
            tr.innerHTML = `
                <td>
                    <a class="team-cell team-result-link" href="index.html?team=${team.code}&lang=${currentLang}" title="${teamName}">
                        <img src="./img/${team.code}.png" class="team-flag-small" alt="${team.code}">
                        <span>${teamName}</span>
                    </a>
                </td>
                ${probCell(init, init, 'base')}
                ${probCell(snap ? snap.md1 : null, init, m1)}
                ${probCell(snap ? snap.md2 : null, init, m2)}
                ${probCell(snap ? snap.md3 : null, init, m3)}
            `;
            tbody.appendChild(tr);
        });

        section.appendChild(table);
        container.appendChild(section);
    });
}).catch(err => {
    console.error('Data load failed:', err);
    const container = document.getElementById('results-area');
    if (container) container.innerHTML = '<p class="error">Failed to load simulation results.</p>';
});
