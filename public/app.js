console.log("👑 KING PREDICTIONS AI");

let currentMode = "/free";
const cache = new Map();

function predictions(a) {
    return a?.predictions || {};
}

function matchName(a) {
    if (typeof a?.match === "string")
        return a.match;

    if (a?.match?.homeTeam && a?.match?.awayTeam)
        return `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`;

    if (a?.homeTeam && a?.awayTeam)
        return `${a.homeTeam.name} vs ${a.awayTeam.name}`;

    return "Match inconnu";
}

function number(v, fallback = "-") {
    return Number.isFinite(Number(v))
        ? Number(v)
        : fallback;
}

function market() {

    if (currentMode === "/vip/over25")
        return "OVER 2.5";

    if (currentMode === "/vip/btts")
        return "BTTS";

    if (currentMode === "/vip/score")
        return "SCORE EXACT";

    return "1X2";
}

function createCard(a) {

    const p = predictions(a);
    const m = a?.model || {};
    const ai = p.aiDecision || {};

    const type = market();

    const card =
        document.createElement("div");

    card.className = "prediction-card";

    let html = `
        <h2>👑 ${matchName(a)}</h2>
        <p>📌 ${type}</p>
    `;

    if (type === "1X2") {

        html += `
            <h3>🎯 ${p.winner || "-"}</h3>

            <p>📊 Confiance :
                ${number(p.winnerConfidence)}%
            </p>

            <p>🏠 Domicile :
                ${number(p.probabilities?.homeWin, 0)}%
            </p>

            <p>🤝 Nul :
                ${number(p.probabilities?.draw, 0)}%
            </p>

            <p>✈️ Extérieur :
                ${number(p.probabilities?.awayWin, 0)}%
            </p>

            <p>🧠 AI Score :
                ${number(p.aiRating, 0)}
            </p>

            <p>💎 VIP Score :
                ${number(a.vipScore, "-")}
            </p>

            <p>⚠️ Risque :
                ${ai.risk || "-"}</p>
        `;
    }

    if (type === "OVER 2.5") {

        html += `
            <h3>🎯 ${p.over25 || "-"}</h3>

            <p>📊 Confiance :
                ${number(p.over25Confidence)}%
            </p>

            <p>⚽ XG :
                ${number(m.expectedGoals)}
            </p>

            <p>🧠 AI Score :
                ${number(p.aiRating, 0)}
            </p>

            <p>💎 VIP Score :
                ${number(a.vipScore, "-")}
            </p>
        `;
    }

    if (type === "BTTS") {

        html += `
            <h3>🎯 ${p.btts || "-"}</h3>

            <p>📊 Confiance :
                ${number(p.bttsConfidence)}%
            </p>

            <p>⚽ XG :
                ${number(m.expectedGoals)}
            </p>

            <p>💎 VIP Score :
                ${number(a.vipScore, "-")}
            </p>
        `;
    }

    if (type === "SCORE EXACT") {

        html += `
            <h3>🎯 ${p.correctScore || "-"}</h3>

            <p>📊 Probabilité :
                ${number(p.correctScoreProbability)}%
            </p>

            <p>⚽ XG :
                ${number(m.expectedGoals)}
            </p>

            <p>🧠 AI Score :
                ${number(p.aiRating, 0)}/100
            </p>

            <p>⚠️ Risque :
                ${ai.risk || "-"}
            </p>

            <small>
                ⚠️ Le score exact reste une estimation probabiliste.
            </small>
        `;
    }

    card.innerHTML = html;

    return card;
}

async function loadPredictions(url) {

    currentMode = url;

    const results =
        document.getElementById("results");

    results.innerHTML =
        "<div class='loading'>⏳ Analyse...</div>";

    try {

        let data;

        if (cache.has(url)) {

            data = cache.get(url);

        } else {

            const response =
                await fetch(url, {
                    cache: "no-store"
                });

            if (!response.ok)
                throw new Error(
                    `HTTP ${response.status}`
                );

            data = await response.json();

            cache.set(url, data);
        }

        if (!Array.isArray(data))
            data = [];

        document.getElementById("matches").textContent =
            data.length;

        document.getElementById("predictions").textContent =
            data.length;

        results.innerHTML = "";

        if (!data.length) {

            results.innerHTML = `
                <div class="empty-card">
                    🔍 Aucun match disponible.
                </div>
            `;

            return;
        }

        data.forEach(a => {
            results.appendChild(
                createCard(a)
            );
        });

    } catch (err) {

        console.error(err);

        results.innerHTML = `
            <div class="error-card">
                ❌ Erreur : ${err.message}
            </div>
        `;
    }
}

loadPredictions("/free");
