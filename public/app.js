console.log("👑 APP JS READY");

let currentMode = "/free";


/* =========================
   LOAD
========================= */

async function loadPredictions(url) {

    currentMode = url;

    const box =
        document.getElementById("results");

    box.innerHTML =
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

        document.getElementById("matches")
            .innerText = data.length;

        document.getElementById("predictions")
            .innerText = data.length;

        if (!data.length) {

            box.innerHTML = `
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

        box.innerHTML = "";

        data.forEach(item => {

            const card =
                document.createElement("div");

            card.className =
                "prediction-card";

            card.innerHTML =
                createCard(item);

            box.appendChild(card);

        });

    } catch (error) {

        box.innerHTML = `
            <div class="error-card">
                ❌ ${error.message}
            </div>
        `;

    }
}


/* =========================
   CARD
========================= */

function createCard(item) {

    if (currentMode === "/vip/score") {

        return `

        <h2>👑 ${item.match}</h2>

        <p>📌 SCORE EXACT</p>

        <h2>
            🎯 ${item.score}
        </h2>

        <p>
            📊 Probabilité :
            ${item.probability}%
        </p>

        <p>
            ⚽ XG :
            ${item.xg}
        </p>

        <p>
            🧠 AI Score :
            ${item.aiScore}/100
        </p>

        <p>
            ⚠️ Risque :
            ${item.risk || "UNKNOWN"}
        </p>

        `;

    }


    if (currentMode === "/vip/over25") {

        return `

        <h2>👑 ${item.match}</h2>

        <p>📌 OVER 2.5</p>

        <h2>
            🎯 ${item.market}
        </h2>

        <p>
            📊 Confiance :
            ${item.confidence}%
        </p>

        <p>
            ⚽ XG :
            ${item.expectedGoals}
        </p>

        <p>
            🧠 VIP Score :
            ${item.vipScore}
        </p>

        `;

    }


    if (currentMode === "/vip/btts") {

        return `

        <h2>👑 ${item.match}</h2>

        <p>📌 BTTS</p>

        <h2>
            🎯 ${item.pick}
        </h2>

        <p>
            📊 Confiance :
            ${item.confidence}%
        </p>

        <p>
            🧠 VIP Score :
            ${item.vipScore}
        </p>

        `;

    }


    /* 1X2 */

    const p =
        item.probabilities || {};

    return `

    <h2>👑 ${item.match}</h2>

    <p>📌 1X2</p>

    <h2>
        🎯 ${item.pick}
    </h2>

    <p>
        📊 Confiance :
        ${item.confidence}%
    </p>

    <p>🏠 Domicile :
        ${p.homeWin ?? 0}%
    </p>

    <p>🤝 Nul :
        ${p.draw ?? 0}%
    </p>

    <p>✈️ Extérieur :
        ${p.awayWin ?? 0}%
    </p>

    <p>
        🧠 VIP Score :
        ${item.vipScore ?? "-"}
    </p>

    <p>
        ⚠️ Risque :
        ${item.risk ?? "UNKNOWN"}
    </p>

    `;

}


/* =========================
   START
========================= */

loadPredictions("/free");
