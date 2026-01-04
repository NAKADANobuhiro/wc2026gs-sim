// 勝ち点ごとの突破確率定義（シミュレーション結果に基づく定数）
const QUALIFY_RATES = {
    9: 1.000,
    7: 1.000,
    6: 1.000,
    5: 1.000,
    4: 0.993,
    3: 0.473,
    2: 0.025,
    1: 0.000,
    0: 0.000
};

// 判定ラベル定義
const STATUS_LABELS = {
    9: { text: "突破", class: "status-safe" },
    7: { text: "突破", class: "status-safe" },
    6: { text: "突破", class: "status-safe" },
    5: { text: "突破", class: "status-safe" },
    4: { text: "ほぼ確実", class: "status-safe" },
    3: { text: "可能性あり", class: "status-border" },
    2: { text: "奇跡待ち", class: "status-miracle" },
    1: { text: "敗退決定", class: "status-out" },
    0: { text: "敗退決定", class: "status-out" }
};

function calc() {
    // 入力値の取得
    const inputs = [
        { w: +document.getElementById('w1').value, d: +document.getElementById('d1').value, l: +document.getElementById('l1').value, err: 'err1' },
        { w: +document.getElementById('w2').value, d: +document.getElementById('d2').value, l: +document.getElementById('l2').value, err: 'err2' },
        { w: +document.getElementById('w3').value, d: +document.getElementById('d3').value, l: +document.getElementById('l3').value, err: 'err3' }
    ];

    // バリデーション（合計100確認）
    inputs.forEach(row => {
        const sum = row.w + row.d + row.l;
        document.getElementById(row.err).style.display = (sum !== 100) ? 'block' : 'none';
    });

    // 確率計算（全ての組み合わせ 3*3*3 = 27通り）
    let pointsDist = { 9:0, 7:0, 6:0, 5:0, 4:0, 3:0, 2:0, 1:0, 0:0 };
    const games = inputs.map(i => ({ w: i.w / 100, d: i.d / 100, l: i.l / 100 }));

    ['w', 'd', 'l'].forEach(r1 => {
        ['w', 'd', 'l'].forEach(r2 => {
            ['w', 'd', 'l'].forEach(r3 => {
                const prob = games[0][r1] * games[1][r2] * games[2][r3];
                let pts = 0;
                if(r1 === 'w') pts += 3; else if(r1 === 'd') pts += 1;
                if(r2 === 'w') pts += 3; else if(r2 === 'd') pts += 1;
                if(r3 === 'w') pts += 3; else if(r3 === 'd') pts += 1;
                if (pointsDist.hasOwnProperty(pts)) pointsDist[pts] += prob;
            });
        });
    });

    // 最終的な突破確率の計算と集計
    let totalQualifyProb = 0;
    let p4_plus = 0, p3 = 0, p3_qual = 0, p2_under = 0;
    const tableData = [];

    Object.keys(pointsDist).sort((a,b) => b-a).forEach(pt => {
        const p = pointsDist[pt];
        const qRate = QUALIFY_RATES[pt];
        const qProb = p * qRate;
        totalQualifyProb += qProb;

        if (pt >= 4) p4_plus += p;
        else if (pt == 3) { p3 = p; p3_qual = qProb; }
        else p2_under += p;

        tableData.push({ pts: pt, prob: p, qRate: qRate, status: STATUS_LABELS[pt] });
    });

    // 表示更新
    document.getElementById('total-prob').innerText = (totalQualifyProb * 100).toFixed(1) + "%";
    const p3_fail = p3 - p3_qual;
    document.getElementById('breakdown-text').innerHTML = `
        内訳<br>
        ${(p4_plus * 100).toFixed(1)}% の確率で、勝ち点4以上を獲得し突破<br>
        ${(p3 * 100).toFixed(1)}% の確率で、勝ち点3を獲得し、${(p3_qual * 100).toFixed(1)}% で突破、${(p3_fail * 100).toFixed(1)}% で敗退<br>
        ${(p2_under * 100).toFixed(1)}% の確率で、勝ち点2以下しか獲得できず敗退
    `;

    const tbody = document.getElementById('result-tbody');
    tbody.innerHTML = '';
    tableData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.pts}</td><td>${(row.prob * 100).toFixed(1)}%</td><td>${(row.qRate * 100).toFixed(1)}%</td><td class="${row.status.class}">${row.status.text}</td>`;
        tbody.appendChild(tr);
    });
}

window.onload = calc;