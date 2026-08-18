console.log(
    "👑 KING PREDICTIONS AI - APP JS LOADED"
);

let currentMode = "/free";

const PAGE_CACHE = new Map();


/* ======================================================
   HELPERS
====================================================== */

function num(value, fallback = 0) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}


function getPredictions(item) {

    return item?.predictions || {};

}


function getModel(item) {

    return item?.model || {};

}


/* ======================================================
   MATCH
====================================================== */

function getMatchName(item) {

    if (item?.match) {

        if (
            typeof item.match === "string"
        ) {

            return item.match;

        }

        if (
            item.match.homeTeam &&
            item.match.awayTeam
        ) {

            return (
                `${item.match.homeTeam.name} vs ` +
                `${item.match.awayTeam.name}`
            );

        }

    }


    if (
        item?.homeTeam?.name &&
        item?.awayTeam?.name
    ) {

        return (
            `${item.homeTeam.name} vs ` +
            `${item.awayTeam.name}`
        );

    }


    return "Match inconnu";

}


/* ======================================================
   MARKET
====================================================== */

function getMarket() {

    if (
        currentMode ===
        "/vip/over25"
    )
        return "OVER 2.5";


    if (
        currentMode ===
        "/vip/btts"
    )
        return "BTTS";


    if (
        currentMode ===
        "/vip/score"
    )
        return "SCORE EXACT";


    return "1X2";

}


/* ======================================================
   CARD
====================================================== */

function createCard(item) {

    const p =
        getPredictions(item);

    const model =
        getModel(item);

    const market =
        item.vipMarket ||
        getMarket();


    const matchName =
        getMatchName(item);


    const confidence =
        market === "1X2"
            ? num(p.winnerConfidence)
            : market === "OVER 2.5"
                ? num(p.over25Confidence)
                : market === "BTTS"
                    ? num(p.bttsConfidence)
                    : num(
                        p.correctScoreProbability
                    );


    const risk =
        p.aiDecision?.risk ||
        "UNKNOWN";


    const decision =
        p.aiDecision?.decision ||
        "NO BET";


    const aiRating =
        num(p.aiRating);


    const vipScore =
        num(item.vipScore);


    let verdict = "🟡 À SURVEILLER";


/* ==================================================
   SCORE EXACT
================================================== */

if (market === "SCORE EXACT") {

    if (
        decision === "TRAP MATCH" ||
        risk === "VERY HIGH"
    ) {

        verdict = "🔴 TRÈS RISQUÉ";

    }
    else if (
        confidence >= 12
    ) {

        verdict = "🟢 MEILLEUR SCORE";

    }
    else if (
        confidence >= 9
    ) {

        verdict = "🟡 SCORE INTÉRESSANT";

    }
    else {

        verdict = "⚪ FAIBLE PROBABILITÉ";

    }

}


/* ==================================================
   AUTRES MARCHÉS
================================================== */

else {

    if (
        decision === "TRAP MATCH" ||
        risk === "VERY HIGH" ||
        risk === "HIGH"
    ) {

        verdict = "🔴 NO BET";

    }
    else if (
        confidence >= 75
    ) {

        verdict = "🟢 TRÈS BON";

    }
    else if (
        confidence >= 65
    ) {

        verdict = "🟢 BON";

    }
    else if (
        confidence >= 55
    ) {

        verdict = "🟡 PRUDENT";

    }
    else {

        verdict = "🔴 NO BET";

    }

}

    let content = "";


    /* ==================================================
       1X2
    ================================================== */

    if (
        market === "1X2"
    ) {

        const probabilities =
            p.probabilities || {};


        content = `

            <p>
                🎯 <strong>PRONOSTIC</strong>
            </p>

            <h3>
                ${p.winner || "-"}
            </h3>

            <p>
                📊 <strong>Confiance :</strong>
                ${confidence}%
            </p>

            <div class="probabilities">

                <p>
                    🏠 Domicile :
                    <strong>
                        ${num(
                            probabilities.homeWin
                        )}%
                    </strong>
                </p>

                <p>
                    🤝 Nul :
                    <strong>
                        ${num(
                            probabilities.draw
                        )}%
                    </strong>
                </p>

                <p>
                    ✈️ Extérieur :
                    <strong>
                        ${num(
                            probabilities.awayWin
                        )}%
                    </strong>
                </p>

            </div>

        `;

    }


    /* ==================================================
       OVER 2.5
    ================================================== */

    else if (
        market ===
        "OVER 2.5"
    ) {

        content = `

            <p>
                🎯 <strong>PRONOSTIC</strong>
            </p>

            <h3>
                ${p.over25 || "-"}
            </h3>

            <p>
                📊 <strong>Confiance :</strong>
                ${confidence}%
            </p>

            <div class="stats-grid">

                <p>
                    ⚽ XG :
                    <strong>
                        ${num(
                            model.expectedGoals
                        )}
                    </strong>
                </p>

                <p>
                    🔥 OVER :
                    <strong>
                        ${num(
                            p.over25Confidence
                        )}%
                    </strong>
                </p>

            </div>

        `;

    }


    /* ==================================================
       BTTS
    ================================================== */

    else if (
        market ===
        "BTTS"
    ) {

        content = `

            <p>
                🎯 <strong>PRONOSTIC</strong>
            </p>

            <h3>
                ${p.btts || "-"}
            </h3>

            <p>
                📊 <strong>Confiance :</strong>
                ${confidence}%
            </p>

            <div class="stats-grid">

                <p>
                    ⚽ XG :
                    <strong>
                        ${num(
                            model.expectedGoals
                        )}
                    </strong>
                </p>

                <p>
                    🎯 BTTS :
                    <strong>
                        ${num(
                            p.bttsConfidence
                        )}%
                    </strong>
                </p>

            </div>

        `;

    }


    /* ==================================================
       SCORE EXACT
    ================================================== */

    else if (
        market ===
        "SCORE EXACT"
    ) {

        content = `

            <p>
                🎯 <strong>SCORE PRÉVU</strong>
            </p>

            <h2>
                ${p.correctScore || "-"}
            </h2>

            <p>
                📊 <strong>Probabilité :</strong>
                ${num(
                    p.correctScoreProbability
                )}%
            </p>

            <p>
                ⚽ XG :
                <strong>
                    ${num(
                        model.expectedGoals
                    )}
                </strong>
            </p>

            <small>
                ⚠️ Le score exact est une
                estimation probabiliste, pas
                une garantie.
            </small>

        `;

    }


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "prediction-card";


    card.innerHTML = `

        <h2>
            👑 ${matchName}
        </h2>

        <hr>

        <p>
            📌 <strong>${market}</strong>
        </p>

        ${content}

        <hr>

        <p>
            🧠 <strong>AI Score :</strong>
            ${aiRating}
        </p>

        ${
            market !== "FREE"
            ? `
                ${
    market === "SCORE EXACT"
    ? `
        <p>
            🧠 <strong>AI Score :</strong>
            ${aiRating}
        </p>
    `
    : `
        <p>
            💎 <strong>VIP Score :</strong>
            ${vipScore}
        </p>
    `
                }
            `
            : ""
        }

        <p>
            ⚠️ <strong>Risque :</strong>
            ${risk}
        </p>

        <p>
            <strong>${verdict}</strong>
        </p>

    `;


    return card;

}


/* ======================================================
   NORMALIZE
====================================================== */

function normalizeResponse(data) {

    if (
        Array.isArray(data)
    )
        return data;


    if (
        Array.isArray(data?.data)
    )
        return data.data;


    if (
        Array.isArray(data?.predictions)
    )
        return data.predictions;


    if (
        data &&
        typeof data === "object"
    )
        return [data];


    return [];

}


/* ======================================================
   EMPTY
====================================================== */

function showEmptyState() {

    const results =
        document.getElementById(
            "results"
        );


    let message =
        "Aucun match ne respecte actuellement les critères.";


    if (
        currentMode ===
        "/vip/1x2"
    ) {

        message =
            "💎 Aucun match ne respecte actuellement les critères VIP 1X2.";

    }
    else if (
        currentMode ===
        "/vip/over25"
    ) {

        message =
            "🟣 Aucun match ne respecte actuellement les critères VIP OVER 2.5.";

    }
    else if (
        currentMode ===
        "/vip/btts"
    ) {

        message =
            "🟠 Aucun match ne respecte actuellement les critères VIP BTTS.";

    }
    else if (
        currentMode ===
        "/vip/score"
    ) {

        message =
            "📊 Aucun score exact disponible actuellement.";

    }


    results.innerHTML = `

        <div class="empty-card">

            <div class="empty-icon">
                🔍
            </div>

            <h2>
                Aucun match
            </h2>

            <p>
                ${message}
            </p>

            <small>
                Le moteur préfère ne rien proposer
                plutôt que de forcer une mauvaise
                prédiction.
            </small>

        </div>

    `;

}


/* ======================================================
   DISPLAY
====================================================== */

function displayPredictions(data) {

    const results =
        document.getElementById(
            "results"
        );


    const list =
        normalizeResponse(
            data
        );


    document.getElementById(
        "matches"
    ).innerText =
        list.length;


    document.getElementById(
        "predictions"
    ).innerText =
        list.length;


    results.innerHTML = "";


    if (!list.length) {

        showEmptyState();

        return;

    }


    list.forEach(item => {

        results.appendChild(
            createCard(item)
        );

    });

}


/* ======================================================
   LOAD
====================================================== */

async function loadPredictions(
    url
) {

    currentMode =
        url;


    const results =
        document.getElementById(
            "results"
        );


    results.innerHTML = `

        <div class="loading">

            ⏳ Analyse des prédictions...

        </div>

    `;


    /*
     * Pour éviter qu'une ancienne réponse
     * reste affichée toute la journée après
     * une nouvelle analyse.
     */
    PAGE_CACHE.delete(url);


    try {

        console.log(
            "🔎 API REQUEST:",
            url
        );


        const response =
            await fetch(
                url,
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        console.log(
            "✅ API RESPONSE:",
            url,
            data
        );


        PAGE_CACHE.set(
            url,
            data
        );


        displayPredictions(
            data
        );


    } catch (error) {

        console.error(
            "❌ API ERROR:",
            error
        );


        results.innerHTML = `

            <div class="error-card">

                <h2>
                    ❌ Impossible de charger
                </h2>

                <p>
                    ${error.message}
                </p>

                <button
                    onclick="
                        loadPredictions(
                            currentMode
                        )
                    "
                >
                    🔄 Réessayer
                </button>

            </div>

        `;

    }

}


/* ======================================================
   START
====================================================== */

loadPredictions(
    "/free"
);
