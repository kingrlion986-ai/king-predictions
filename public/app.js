console.log("👑 KING PREDICTIONS AI - APP JS");

let currentMode = "/free";
const PAGE_CACHE = new Map();

function list(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.predictions)) return data.predictions;
    return data ? [data] : [];
}

function matchName(a) {
    const m = a?.match;

    if (typeof m === "string") return m;

    if (m?.homeTeam?.name && m?.awayTeam?.name)
        return `${m.homeTeam.name} vs ${m.awayTeam.name}`;

    if (a?.homeTeam?.name && a?.awayTeam?.name)
        return `${a.homeTeam.name} vs ${a.awayTeam.name}`;

    return "Match inconnu";
}

function card(a, market) {

    const p = a.predictions || {};
    const model = a.model || {};
    const probs = p.probabilities || {};
    const ai = p.aiDecision || {};

    let pick = "-";
    let confidence = "-";

    if (market === "1X2") {
        pick = p.winner || a.pick || "-";
        confidence = p.winnerConfidence ?? a.confidence ?? "-";
    }

    if (market === "OVER 2.5") {
        pick = p.over25 || a.market || "-";
        confidence = p.over25Confidence ?? a.confidence ?? "-";
    }

    if (market === "BTTS") {
        pick = p.btts || a.pick || "-";
        confidence = p.bttsConfidence ?? a.confidence ?? "-";
    }

    if (market === "SCORE EXACT") {
        pick = p.correctScore || a.score || "-";
    }

    const risk =
        ai.risk ||
        a.risk ||
        "UNKNOWN";

    const aiScore =
        p.aiRating ??
        a.vipScore ??
        "-";

    let extra = "";

    if (market === "1X2") {
        extra = `
        <p>🏠 Domicile : ${probs.homeWin ?? 0}%</p>
        <p>🤝 Nul : ${probs.draw ?? 0}%</p>
        <p>✈️ Extérieur : ${probs.awayWin ?? 0}%</p>
        `;
    }

    if (market === "OVER 2.5") {
        extra = `
        <p>⚽ XG : ${model.expectedGoals ?? a.expectedGoals ?? "-"}</p>
        `;
    }

    if (market === "BTTS") {
        extra = `
        <p>⚽ XG : ${model.expectedGoals ?? "-"}</p>
        `;
    }

    if (market === "SCORE EXACT") {
        extra = `
        <p>📊 Probabilité : ${p.correctScoreProbability ?? a.probability ?? "-"}%</p>
        <p>⚽ XG : ${model.expectedGoals ?? a.expectedGoals ?? "-"}</p>
        `;
    }

    return `
    <div class="prediction-card">

        <h2>👑 ${matchName(a)}</h2>

        <p>📌 ${market}</p>

        <h3>🎯 ${pick}</h3>

        ${
            market !== "SCORE EXACT"
                ? `<p>📊 Confiance : ${confidence}%</p>`
                : ""
        }

        ${extra}

        <p>🧠 AI Score : ${aiScore}</p>

        <p>⚠️ Risque : ${risk}</p>

    </div>
    `;
}

function display(data) {

    const results = document.getElementById("results");
    const items = list(data);

    document.getElementById("matches").innerText = items.length;
    document.getElementById("predictions").innerText = items.length;

    if (!items.length) {
        results.innerHTML = `
        <div class="empty-card">
            <h2>🔍 Aucun match</h2>
            <p>Aucune prédiction disponible.</p>
        </div>`;
        return;
    }

    let market = "1X2";

    if (currentMode === "/vip/over25")
        market = "OVER 2.5";

    if (currentMode === "/vip/btts")
        market = "BTTS";

    if (currentMode === "/vip/score")
        market = "SCORE EXACT";

    results.innerHTML =
        items.map(x => card(x, market)).join("");
}

async function loadPredictions(url) {

    currentMode = url;

    const results =
        document.getElementById("results");

    results.innerHTML =
        `<div class="loading">⏳ Analyse...</div>`;

    PAGE_CACHE.delete(url);

    try {

        const response = await fetch(
            url,
            { cache: "no-store" }
        );

        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        PAGE_CACHE.set(url, data);

        display(data);

    } catch (err) {

        console.error(err);

        results.innerHTML = `
        <div class="error-card">
            <h2>❌ Erreur</h2>
            <p>${err.message}</p>
            <button onclick="loadPredictions('${url}')">
                🔄 Réessayer
            </button>
        </div>`;
    }
}

loadPredictions("/free");
