console.log("👑 KING APP READY");

let currentMode = "/free";


function name(item) {

    const m = item.match;

    if (typeof m === "string")
        return m;

    if (m?.homeTeam?.name && m?.awayTeam?.name)
        return `${m.homeTeam.name} vs ${m.awayTeam.name}`;

    if (item.homeTeam?.name && item.awayTeam?.name)
        return `${item.homeTeam.name} vs ${item.awayTeam.name}`;

    return "Match inconnu";
}


function predictions(item) {
    return item.predictions || {};
}


function card(item) {

    const p = predictions(item);
    const model = item.model || {};

    const match = name(item);

    /* SCORE */

    if (currentMode === "/vip/score") {

        return `
        <h2>👑 ${match}</h2>
        <p>📌 SCORE EXACT</p>

        <h2>🎯 ${p.correctScore || item.score || "-"}</h2>

        <p>📊 Probabilité :
        ${p.correctScoreProbability ??
          item.probability ?? 0}%</p>

        <p>⚽ XG :
        ${model.expectedGoals ??
          item.xg ?? "-"}</p>

        <p>🧠 AI Score :
        ${p.aiRating ?? item.aiScore ?? 0}/100</p>

        <p>⚠️ Risque :
        ${p.aiDecision?.risk ??
          item.risk ?? "UNKNOWN"}</p>
        `;
    }


    /* OVER */

    if (currentMode === "/vip/over25") {

        return `
        <h2>👑 ${match}</h2>
        <p>📌 OVER 2.5</p>

        <h2>🎯
        ${p.over25 ?? item.market ?? "-"}</h2>

        <p>📊 Confiance :
        ${p.over25Confidence ??
          item.confidence ?? 0}%</p>

        <p>⚽ XG :
        ${model.expectedGoals ??
          item.expectedGoals ?? "-"}</p>

        <p>🧠 VIP Score :
        ${item.vipScore ?? "-"}</p>
        `;
    }


    /* BTTS */

    if (currentMode === "/vip/btts") {

        return `
        <h2>👑 ${match}</h2>
        <p>📌 BTTS</p>

        <h2>🎯
        ${p.btts ?? item.pick ?? "-"}</h2>

        <p>📊 Confiance :
        ${p.bttsConfidence ??
          item.confidence ?? 0}%</p>

        <p>🧠 VIP Score :
        ${item.vipScore ?? "-"}</p>
        `;
    }


    /* 1X2 */

    const probs = p.probabilities || item.probabilities || {};

    return `
    <h2>👑 ${match}</h2>

    <p>📌 1X2</p>

    <h2>🎯
    ${p.winner ?? item.pick ?? "-"}</h2>

    <p>📊 Confiance :
    ${p.winnerConfidence ??
      item.confidence ?? 0}%</p>

    <p>🏠 Domicile :
    ${probs.homeWin ?? 0}%</p>

    <p>🤝 Nul :
    ${probs.draw ?? 0}%</p>

    <p>✈️ Extérieur :
    ${probs.awayWin ?? 0}%</p>

    <p>🧠 VIP Score :
    ${item.vipScore ?? "-"}</p>

    <p>⚠️ Risque :
    ${p.aiDecision?.risk ??
      item.risk ?? "UNKNOWN"}</p>
    `;
}


async function loadPredictions(url) {

    currentMode = url;

    const results =
        document.getElementById("results");

    results.innerHTML =
        "<h2>⏳ Analyse...</h2>";

    try {

        const response =
            await fetch(url, {
                cache: "no-store"
            });

        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);

        const data =
            await response.json();

        const list =
            Array.isArray(data)
                ? data
                : data.data || [];

        document.getElementById("matches")
            .innerText = list.length;

        document.getElementById("predictions")
            .innerText = list.length;

        if (!list.length) {

            results.innerHTML = `
            <div class="empty-card">
                <h2>🔍 Aucun match</h2>
                <p>
                Aucun match ne respecte
                actuellement les critères.
                </p>
            </div>`;

            return;
        }

        results.innerHTML = "";

        list.forEach(item => {

            const div =
                document.createElement("div");

            div.className =
                "prediction-card";

            div.innerHTML =
                card(item);

            results.appendChild(div);

        });

    } catch (error) {

        console.error(error);

        results.innerHTML = `
        <div class="error-card">
            ❌ ${error.message}
        </div>`;
    }
}


loadPredictions("/free");
