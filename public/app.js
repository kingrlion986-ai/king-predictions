console.log("👑 KING PREDICTIONS AI V1");

let currentMode = "/vip/1x2";

function name(a) {
    const m = a?.match;

    return m?.homeTeam && m?.awayTeam
        ? `${m.homeTeam.name} vs ${m.awayTeam.name}`
        : "Match inconnu";
}

function n(value, fallback = "-") {
    return Number.isFinite(Number(value))
        ? Number(value)
        : fallback;
}

function card(a, market) {

    const p = a.predictions || {};
    const ai = p.aiDecision || {};
    const model = a.model || {};

    let pick = "-";
    let confidence = "-";

    if (market === "1X2") {
        pick = p.winner;
        confidence = p.winnerConfidence;
    }

    if (market === "OVER 2.5") {
        pick = p.over25;
        confidence = p.over25Confidence;
    }

    if (market === "BTTS") {
        pick = p.btts;
        confidence = p.bttsConfidence;
    }

    return `
        <div class="prediction-card">

            <h2>👑 ${name(a)}</h2>

            <p>📌 ${market}</p>

            <h3>🎯 ${pick || "-"}</h3>

            <p>
                📊 Confiance :
                <strong>${n(confidence)}%</strong>
            </p>

            ${
                market === "1X2"
                ? `
                    <p>🏠 Domicile :
                    ${n(p.probabilities?.homeWin, 0)}%</p>

                    <p>🤝 Nul :
                    ${n(p.probabilities?.draw, 0)}%</p>

                    <p>✈️ Extérieur :
                    ${n(p.probabilities?.awayWin, 0)}%</p>
                `
                : ""
            }

            ${
                market !== "1X2"
                ? `
                    <p>⚽ XG :
                    ${n(model.expectedGoals)}</p>
                `
                : ""
            }

            <p>🧠 AI Score :
                ${n(p.aiRating, 0)}/100
            </p>

            <p>💎 VIP Score :
                ${n(a.vipScore, 0)}
            </p>

            <p>⚠️ Risque :
                ${ai.risk || "-"}
            </p>

        </div>
    `;
}


async function loadPredictions(url) {

    currentMode = url;

    const results =
        document.getElementById("results");

    results.innerHTML =
        "<div class='loading'>⏳ Analyse...</div>";

    try {

        const response =
            await fetch(url, {
                cache: "no-store"
            });

        if (!response.ok)
            throw new Error(
                `HTTP ${response.status}`
            );

        let data =
            await response.json();

        const market =
    url === "/vip/over25"
        ? "OVER 2.5"
        : url === "/vip/btts"
            ? "BTTS"
            : url === "/safest"
                ? data?.market || "1X2"
                : "1X2";

        if (url === "/safest") {

            if (data) {
    data = [data];
} else {
    data = [];
            }

        }

        if (!Array.isArray(data))
            data = [];

        document.getElementById("matches")
            .textContent = data.length;

        document.getElementById("predictions")
            .textContent = data.length;

        results.innerHTML =
            data.length
                ? data.map(a =>
                    card(a, data[0]?.market || market)
                  ).join("")
                : `
                    <div class="empty-card">
                        🔍 Aucun pari disponible.
                    </div>
                `;

    } catch (error) {

        console.error("❌", error);

        results.innerHTML = `
            <div class="error-card">
                ❌ Erreur : ${error.message}
            </div>
        `;
    }
}


loadPredictions("/vip/1x2");
