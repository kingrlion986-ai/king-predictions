console.log("👑 KING AI APP");

let currentMode = "/free";


function marketName(url) {

    if (url === "/vip/1x2")
        return "1X2";

    if (url === "/vip/over25")
        return "OVER 2.5";

    if (url === "/vip/btts")
        return "BTTS";

    if (url === "/vip/score")
        return "SCORE EXACT";

    return "1X2";
}


function showCard(a, market) {

    const results =
        document.getElementById("results");

    let html = `
        <div class="prediction-card">

        <h2>👑 ${a.match}</h2>

        <p>📌 ${market}</p>
    `;


    /* 1X2 */

    if (market === "1X2") {

        const p =
            a.probabilities || {};

        html += `
            <p>🎯 <strong>PRONOSTIC</strong></p>

            <h3>${a.pick || "-"}</h3>

            <p>📊 Confiance :
            ${a.confidence ?? "-"}%</p>

            <p>🏠 Domicile :
            ${p.homeWin ?? 0}%</p>

            <p>🤝 Nul :
            ${p.draw ?? 0}%</p>

            <p>✈️ Extérieur :
            ${p.awayWin ?? 0}%</p>

            <p>🧠 AI Score :
            ${a.aiScore ?? "-"}</p>

            ${
                a.vipScore != null
                ? `<p>💎 VIP Score : ${a.vipScore}</p>`
                : ""
            }

            <p>⚠️ Risque :
            ${a.risk || "UNKNOWN"}</p>
        `;
    }


    /* OVER */

    if (market === "OVER 2.5") {

        html += `
            <p>🎯 <strong>${a.pick || "-"}</strong></p>

            <p>📊 Confiance :
            ${a.confidence ?? "-"}%</p>

            <p>⚽ XG :
            ${a.expectedGoals ?? "-"}</p>

            <p>🧠 AI Score :
            ${a.aiScore ?? "-"}</p>

            <p>💎 VIP Score :
            ${a.vipScore ?? "-"}</p>

            <p>⚠️ Risque :
            ${a.risk || "UNKNOWN"}</p>
        `;
    }


    /* BTTS */

    if (market === "BTTS") {

        html += `
            <p>🎯 <strong>${a.pick || "-"}</strong></p>

            <p>📊 Confiance :
            ${a.confidence ?? "-"}%</p>

            <p>⚽ XG :
            ${a.expectedGoals ?? "-"}</p>

            <p>🧠 AI Score :
            ${a.aiScore ?? "-"}</p>

            <p>💎 VIP Score :
            ${a.vipScore ?? "-"}</p>

            <p>⚠️ Risque :
            ${a.risk || "UNKNOWN"}</p>
        `;
    }


    /* SCORE EXACT */

    if (market === "SCORE EXACT") {

        html += `
            <p>🎯 <strong>${a.pick || "-"}</strong></p>

            <p>📊 Probabilité :
            ${a.probability ?? "-"}%</p>

            <p>⚽ XG :
            ${a.expectedGoals ?? "-"}</p>

            <p>🧠 AI Score :
            ${a.aiScore ?? "-"}/100</p>

            <p>⚠️ Risque :
            ${a.risk || "UNKNOWN"}</p>

            <small>
                Le score exact est une estimation
                probabiliste, pas une garantie.
            </small>
        `;
    }


    html += `</div>`;

    results.innerHTML += html;
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
            throw new Error(
                `HTTP ${response.status}`
            );

        const data =
            await response.json();

        console.log(
            "API:",
            url,
            data
        );

        results.innerHTML = "";

        const list =
            Array.isArray(data)
                ? data
                : [];

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
                </div>
            `;

            return;
        }

        const market =
            marketName(url);

        list.forEach(a =>
            showCard(a, market)
        );

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
