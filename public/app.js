console.log("👑 KING PREDICTIONS AI");

let currentMode = "/safest";

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function name(a) {
    if (typeof a?.match === "string") return a.match;

    if (a?.match?.homeTeam && a?.match?.awayTeam) {
        return `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`;
    }

    if (a?.homeTeam && a?.awayTeam) {
        return `${a.homeTeam.name} vs ${a.awayTeam.name}`;
    }

    return "Match inconnu";
}

function show(data, mode) {

    const results = document.getElementById("results");

    let list = Array.isArray(data)
        ? data
        : data
            ? [data]
            : [];

    document.getElementById("matches").textContent = list.length;
    document.getElementById("predictions").textContent = list.length;

    if (!list.length) {
        results.innerHTML = `
            <div class="empty-card">
                🔍 Aucun pari disponible.
            </div>
        `;
        return;
    }

    results.innerHTML = list.map(a => {

        const p = a.predictions || {};
        const model = a.model || {};
        const ai = p.aiDecision || {};

        let market = "1X2";
        let pick = p.winner || "-";
        let confidence = num(p.winnerConfidence);

        if (mode === "/vip/over25") {
            market = "OVER 2.5";
            pick = p.over25 || "-";
            confidence = num(p.over25Confidence);
        }

        if (mode === "/vip/btts") {
            market = "BTTS";
            pick = p.btts || "-";
            confidence = num(p.bttsConfidence);
        }

        if (mode === "/safest") {
            market = a.market || "1X2";
            pick = a.pick || p.winner || "-";
            confidence = num(
                a.confidence || p.winnerConfidence
            );
        }

        const probabilities = p.probabilities || {};

        return `
            <article class="prediction-card">

                <h2>👑 ${name(a)}</h2>

                <p>📌 <strong>${market}</strong></p>

                <h3>🎯 ${pick}</h3>

                <p>
                    📊 <strong>Confiance :</strong>
                    ${confidence}%
                </p>

                ${
                    market === "1X2"
                    ? `
                        <p>🏠 Domicile : ${num(probabilities.homeWin)}%</p>
                        <p>🤝 Nul : ${num(probabilities.draw)}%</p>
                        <p>✈️ Extérieur : ${num(probabilities.awayWin)}%</p>
                    `
                    : ""
                }

                ${
                    market === "OVER 2.5" || market === "BTTS"
                    ? `
                        <p>⚽ XG : ${num(model.expectedGoals)}</p>
                    `
                    : ""
                }

                <p>
    🧠 AI Score :
    ${num(a.vipScore ?? p.aiRating)}/100
</p>

                ${
                    a.vipScore !== undefined
                    ? `
                        <p>💎 VIP Score : ${num(a.vipScore)}</p>
                    `
                    : ""
                }

                <p>
                    ⚠️ Risque :
                    ${ai.risk || a.risk || "UNKNOWN"}
                </p>

            </article>
        `;

    }).join("");
}


async function loadPredictions(url) {

    currentMode = url;

    const results = document.getElementById("results");

    results.innerHTML = `
        <div class="loading">
            ⏳ Analyse...
        </div>
    `;

    try {

        const response = await fetch(
            url,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        show(data, url);

    } catch (error) {

        console.error(error);

        results.innerHTML = `
            <div class="error-card">
                ❌ Erreur : ${error.message}
                <br><br>
                <button onclick="loadPredictions(currentMode)">
                    🔄 Réessayer
                </button>
            </div>
        `;
    }
}


/* =========================
   START
========================= */

loadPredictions("/safest");
