// js/results.js

// URLパラメータまたはブラウザ設定から言語を判定
const urlParams = new URLSearchParams(window.location.search);
let currentLang = urlParams.get('lang') || 
                  (navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en');

// HTMLタグの言語設定を更新
document.documentElement.lang = currentLang;

// 言語切り替えイベントの設定
const langSel = document.getElementById('lang-selector');
if (langSel) {
    langSel.value = currentLang;
    langSel.addEventListener('change', () => {
        const newLang = langSel.value;
        window.location.href = `results.html?lang=${newLang}`;
    });
}

// データ読み込みと描画
Promise.all([
    fetch('./teams.json').then(r => r.json()),
    fetch('./results.json').then(r => r.json()),
    fetch(`./locales/${currentLang}.json`).then(r => r.json())
]).then(([groups, results, locales]) => {
    const text = locales.results;
    const commonText = locales.select;

    // ページタイトルなどの静的テキスト設定
    const pageTitle = document.getElementById('page-title');
    if(pageTitle) pageTitle.textContent = text.page_title;
    
    const backLink = document.getElementById('back-link');
    if(backLink) {
        backLink.textContent = commonText.back;
        backLink.href = `index.html?lang=${currentLang}`;
    }

    const container = document.getElementById('results-area');
    if(!container) return;
    
    container.innerHTML = '';

    groups.forEach(group => {
        // グループごとのカード作成
        const section = document.createElement('div');
        // select.cssのスタイル(group-card)とresults.cssのスタイル(result-card)を適用
        section.className = 'group-card result-card';

        const header = document.createElement('div');
        header.className = 'group-header';
        // 言語に対応するグループ名を取得
        header.textContent = text.group.replace('{name}', group.name[currentLang] || group.name.ja);
        section.appendChild(header);

        // テーブル作成
        const table = document.createElement('table');
        table.className = 'result-table';
        
        // テーブルヘッダー
        table.innerHTML = `
            <thead>
                <tr>
                    <th>${text.team}</th>
                    <th class="col-rank">${text.rank}</th>
                    <th class="col-prob">${text.prob}</th>
                </tr>
            </thead>
            <tbody id="tbody-${group.name.en}"></tbody>
        `;

        const tbody = table.querySelector('tbody');

        group.teams.forEach(team => {
            const prob = results[team.code] || '-';
            const teamName = team.name[currentLang] || team.name.ja;
            const rankText = team.rank ? team.rank + (currentLang === 'ja' ? '位' : '') : '-';
            
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>
                    <div class="team-cell">
                        <img src="./img/${team.code}.png" class="team-flag-small" alt="${team.code}">
                        <span>${teamName}</span>
                    </div>
                </td>
                <td>${rankText}</td>
                <td class="prob-cell">${prob}%</td>
            `;
            tbody.appendChild(tr);
        });

        section.appendChild(table);
        container.appendChild(section);
    });
}).catch(err => {
    console.error('Data load failed:', err);
    const container = document.getElementById('results-area');
    if(container) container.innerHTML = '<p class="error">Failed to load simulation results.</p>';
});