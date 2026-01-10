// js/select.js

// URLから現在の言語を取得
const urlParams = new URLSearchParams(window.location.search);
const lang = urlParams.get('lang') || 'ja';

// HTMLタグの言語設定を更新
document.documentElement.lang = lang;

// 言語データの読み込み
fetch(`./locales/${lang}.json`)
    .then(response => response.json())
    .then(data => {
        // selectページ用の翻訳データを使用
        const text = data.select;
        
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.innerText = text.title;
        }

        const backLink = document.getElementById('back-link');
        if (backLink) {
            backLink.innerText = text.back;
            // 言語設定を維持して戻れるようにパラメータを付与
            backLink.href = `index.html?lang=${lang}`;
        }
        
        // 次にチームデータを読み込む
        loadTeamsData(lang, text);
    })
    .catch(err => {
        console.error('Failed to load locale:', err);
        // エラー時のフォールバック表示
        const errMsg = "Failed to load translation data.";
        const container = document.getElementById('groups-area');
        if(container) container.innerHTML = `<p style="color:red">${errMsg}</p>`;
    });

function loadTeamsData(lang, uiText) {
    fetch('./teams.json')
        .then(response => response.json())
        .then(groups => {
            const container = document.getElementById('groups-area');
            if (!container) return;
            
            container.innerHTML = '';

            groups.forEach(group => {
                const groupCard = document.createElement('div');
                groupCard.className = 'group-card';

                const header = document.createElement('div');
                header.className = 'group-header';
                header.textContent = group.name[lang] || group.name['ja'];
                groupCard.appendChild(header);

                const ul = document.createElement('ul');
                ul.className = 'team-list';

                group.teams.forEach(team => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.className = 'team-link';
                    a.href = `index.html?team=${team.code}&lang=${lang}`;

                    const teamName = team.name[lang] || team.name['ja'];

                    a.innerHTML = `
                        <img src="./img/${team.code}.png" alt="${team.code}">
                        <span>${teamName}</span>
                    `;
                    li.appendChild(a);
                    ul.appendChild(li);
                });

                groupCard.appendChild(ul);
                container.appendChild(groupCard);
            });
        })
        .catch(err => {
            console.error('Error:', err);
            const container = document.getElementById('groups-area');
            if (container) {
                // エラーメッセージも翻訳データから取得
                container.innerHTML = `<p style="color:red">${uiText.load_error}</p>`;
            }
        });
}