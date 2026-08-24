console.log("👑 KING PREDICTIONS AI - APP JS");

let currentMode = "/free";
const CACHE = new Map();

const $ = id => document.getElementById(id);

function list(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.predictions)) return data.predictions;
    if (data?.match) return [data];
    return [];
}

function matchName(a) {
    if (typeof a.match === "string") return a.match;

    if (a.match?.homeTeam && a.match?.awayTeam) {
        return `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`;
    }

    if (a.homeTeam && a.awayTeam) {
        return `${a.homeTeam.name} vs ${a.awayTeam.name}`;
    }

    return "Match inconnu";
}

function card(a, mode) {

    const p = a.predictions || {};
    const m = a.model || {};

    let title = "1X2";
    let pick = p.winner || "-";
    let confidence = p.winnerConfidence;
    let extra = "";

    if (mode === "/vip/over25") {
        title = "OVER 2.5";
        pick = p.over25 || "-";
        confidence = p.over25Confidence;

        extra = `
            <p>⚽ XG : ${m.expectedGoals ?? "-"}</p>
        `;
    }

    if (mode === "/vip/btts") {
        title = "BTTS";
        pick = p.btts || "-";
        confidence = p.bttsConfidence;
    }

    if (mode === "/vip/score") {
        title = "SCORE EXACT";
        pick = p.correctScore || "-";
        confidence = p.correctScoreProbability;

        extra = `
            <p>⚽ XG : ${m.expectedGoals ?? "-"}</p>
        `;
    }

    let probabilities = "";

    if (mode === "/free" || mode === "/vip/1x2") {

        const x = p.probabilities || {};

        probabilities = `
            <p>🏠 Domicile : ${x.homeWin ?? "-"}%</p>
            <p>🤝 Nul : ${x.draw ?? "-"}%</p>
            <p>✈️ Extérieur : ${x.awayWin ?? "-"}%</p>
        `;
    }

    const ai = p.aiRating ?? "-";
    const risk = p.aiDecision?.risk ?? "-";
    const decision = p.aiDecision?.decision;

    let verdict = "";

    if (decision === "NO BET" || risk === "VERY HIGH") {
        verdict = "🔴 NO BET";
    } else if (Number(confidence) >= 75) {
        verdict = "🟢 TRÈS BON";
    } else if (Number(confidence) >= 65) {
        verdict = "🟢 BON";
    } else if (Number(confidence) >= 55) {
        verdict = "🟡 PRUDENT";
    } else {
        verdict = "🔴 NO BET";
    }

    return `
        <div class="prediction-card">

            <h2>👑 ${matchName(a)}</h2>

            <p>📌 ${title}</p>

            <h3>🎯 ${pick}</h3>

            <p>
                📊 Probabilité :
                ${confidence ?? "-"}%
            </p>

            ${probabilities}

            ${extra}

            <p>🧠 AI Score : ${ai}</p>

            ${a.vipScore !== undefined
                ? `<p>💎 VIP Score : ${a.vipScore}</p>`
                : ""
            }

            <p>⚠️ Risque : ${risk}</p>

            <p>${verdict}</p>

        </div>
    `;
}

function empty() {
    $("results").innerHTML = `
        <div class="empty-card">
            <div class="empty-icon">🔍</div>
            <h2>Aucun match</h2>
            <p>
                Aucun match ne respecte actuellement
                les critères.
            </p>
            <small>
                Le moteur préfère ne rien proposer
                plutôt que de forcer une mauvaise prédiction.
            </small>
        </div>
    `;
}

function display(data) {

    const matches = list(data);

    $("matches").textContent = matches.length;
    $("predictions").textContent = matches.length;

    if (!matches.length) {
        empty();
        return;
    }

    $("results").innerHTML =
        matches.map(a => card(a, currentMode)).join("");
}

async function loadPredictions(url) {

    currentMode = url;

    $("results").innerHTML = `
        <div class="loading">
            ⏳ Analyse des prédictions...
        </div>
    `;

    if (CACHE.has(url)) {
        display(CACHE.get(url));
        return;
    }

    try {

        const response = await fetch(
            url,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log("✅ API:", url, data);

        CACHE.set(url, data);

        display(data);

    } catch (error) {

        console.error("❌ API ERROR:", error);

        $("results").innerHTML = `
            <div class="error-card">
                <h2>❌ Erreur</h2>
                <p>${error.message}</p>

                <button onclick="reload()">
                    🔄 Réessayer
                </button>
            </div>
        `;
    }
}

function reload() {
    CACHE.delete(currentMode);
    loadPredictions(currentMode);
}

loadPredictions("/free");
