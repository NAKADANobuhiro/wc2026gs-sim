// js/select.js

// URLから現在の言語を取得
const urlParams = new URLSearchParams(window.location.search);
const lang = urlParams.get('lang') || 'ja';

// 翻訳リソース
const UI_TEXT = {
    ja: {
        title: "チームを選択してください",
        back: "← ホーム"
    },
    en: {
        title: "Select a Team",
        back: "<- Home"
    }
};

// テキストの適用
const text = UI_TEXT[lang] || UI_TEXT.ja;
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

// チームデータの読み込みと表示
fetch('./teams.json')
    .then(response => response.json())
    .then(groups => {
        const container = document.getElementById('groups-area');
        if (!container) return;
        
        container.innerHTML = '';

        groups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';

            // グループヘッダー
            const header = document.createElement('div');
            header.className = 'group-header';
            // データに該当言語がない場合はフォールバック（例: ja）
            header.textContent = group.name[lang] || group.name['ja'];
            groupCard.appendChild(header);

            // チームリスト
            const ul = document.createElement('ul');
            ul.className = 'team-list';

            group.teams.forEach(team => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.className = 'team-link';
                // index.html にチームコードと言語を渡す
                a.href = `index.html?team=${team.code}&lang=${lang}`;

                const teamName = team.name[lang] || team.name['ja'];

                // 国旗と国名
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
            const errMsg = lang === 'en' 
                ? 'Failed to load data. Please ensure you are running this on a local server.' 
                : 'データの読み込みに失敗しました。<br>ローカルサーバー経由で実行しているか確認してください。';
            container.innerHTML = `<p style="color:red">${errMsg}</p>`;
        }
    });