console.log("👑 KING PREDICTIONS AI - APP JS LOADED");

let currentMode = "/free";

const PAGE_CACHE = new Map();

/* ======================================================
   HELPERS
====================================================== */

function num(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getPredictions(item) {
    return item?.predictions || {};
}

function getModel(item) {
    return item?.model || {};
}

function getHome(item) {
    return item?.teamStats?.home || {};
}

function getAway(item) {
    return item?.teamStats?.away || {};
}

/* ======================================================
   MATCH NAME
====================================================== */

function getMatchName(item) {

    return (
        item?.match ||
        item?.name ||
        (
            item?.homeTeam?.name &&
            item?.awayTeam?.name
                ? `${item.homeTeam.name} vs ${item.awayTeam.name}`
                : null
        ) ||
        (
            getHome(item)?.teamName &&
            getAway(item)?.teamName
                ? `${getHome(item).teamName} vs ${getAway(item).teamName}`
                : null
        ) ||
        "Match inconnu"
    );
}

/* ======================================================
   WINNER
====================================================== */

function getWinner(item) {

    const p = getPredictions(item);

    return (
        p.winner ||
        item?.winner ||
        item?.pick ||
        item?.prediction ||
        "-"
    );
}

/* ======================================================
   CONFIDENCE
====================================================== */

function getWinnerConfidence(item) {

    const p = getPredictions(item);

    return num(
        p.winnerConfidence ??
        p.confidence ??
        item?.confidence,
        null
    );
}

/* ======================================================
   RISK
====================================================== */

function getRisk(item) {

    const p = getPredictions(item);

    return (
        p?.aiDecision?.risk ||
        p?.risk ||
        item?.risk ||
        "UNKNOWN"
    );
}

/* ======================================================
   AI DECISION
====================================================== */

function getDecision(item) {

    const p = getPredictions(item);

    return (
        p?.aiDecision?.decision ||
        item?.decision ||
        null
    );
}

/* ======================================================
   VERDICT UI
====================================================== */

function getVerdict(item, market) {

    const p = getPredictions(item);

    const risk = getRisk(item);
    const decision = getDecision(item);

    if (
        decision === "TRAP MATCH" ||
        risk === "VERY HIGH" ||
        risk === "HIGH"
    ) {
        return {
            label: "🔴 NO BET",
            className: "danger"
        };
    }

    let confidence = null;

    if (market === "1X2") {
        confidence = getWinnerConfidence(item);
    }

    if (market === "OVER 2.5") {
        confidence = num(
            p.over25Confidence,
            null
        );
    }

    if (market === "BTTS") {
        confidence = num(
            p.bttsConfidence,
            null
        );
    }

    if (confidence === null) {
        return {
            label: "🟡 À SURVEILLER",
            className: "warning"
        };
    }

    if (confidence >= 75) {
        return {
            label: "🟢 TRÈS BON",
            className: "excellent"
        };
    }

    if (confidence >= 65) {
        return {
            label: "🟢 BON",
            className: "good"
        };
    }

    if (confidence >= 55) {
        return {
            label: "🟡 PRUDENT",
            className: "warning"
        };
    }

    return {
        label: "🔴 NO BET",
        className: "danger"
    };
}

/* ======================================================
   MARKET PICK
====================================================== */

function getMarketPick(item, market) {

    const p = getPredictions(item);

    if (market === "1X2") {
        return (
            p.winner ||
            item?.winner ||
            item?.pick ||
            "-"
        );
    }

    if (market === "OVER 2.5") {
        return (
            p.over25 ||
            item?.over25 ||
            "-"
        );
    }

    if (market === "BTTS") {
        return (
            p.btts ||
            item?.btts ||
            "-"
        );
    }

    return "-";
}

/* ======================================================
   CARD
====================================================== */

function createCard(item, market) {

    const p = getPredictions(item);
    const model = getModel(item);

    const home = getHome(item);
    const away = getAway(item);

    const matchName = getMatchName(item);

    const verdict =
        getVerdict(
            item,
            market
        );

    const confidence =
        market === "1X2"
            ? getWinnerConfidence(item)
            : market === "OVER 2.5"
                ? num(p.over25Confidence)
                : market === "BTTS"
                    ? num(p.bttsConfidence)
                    : null;

    const pick =
        getMarketPick(
            item,
            market
        );

    const expectedGoals =
        num(
            model.expectedGoals,
            null
        );

    const vipScore =
        num(
            item.vipScore,
            null
        );

    const risk =
        getRisk(item);

    const card =
        document.createElement("div");

    card.className = "prediction-card";

    let extra = "";

    /* =========================
       1X2
    ========================= */

    if (market === "1X2") {

        const probabilities =
            p.probabilities || {};

        extra = `
            <div class="probabilities">
                <div>
                    <span>🏠 Domicile</span>
                    <strong>${num(probabilities.homeWin, 0)}%</strong>
                </div>

                <div>
                    <span>🤝 Nul</span>
                    <strong>${num(probabilities.draw, 0)}%</strong>
                </div>

                <div>
                    <span>✈️ Extérieur</span>
                    <strong>${num(probabilities.awayWin, 0)}%</strong>
                </div>
            </div>
        `;
    }

    /* =========================
       OVER
    ========================= */

    if (market === "OVER 2.5") {

        extra = `
            <div class="stats-grid">

                <div>
                    <span>⚽ XG</span>
                    <strong>
                        ${expectedGoals ?? "-"}
                    </strong>
                </div>

                <div>
                    <span>🔥 OVER</span>
                    <strong>
                        ${num(p.over25Confidence, 0)}%
                    </strong>
                </div>

            </div>
        `;
    }

    /* =========================
       BTTS
    ========================= */

    if (market === "BTTS") {

        extra = `
            <div class="stats-grid">

                <div>
                    <span>⚽ XG</span>
                    <strong>
                        ${expectedGoals ?? "-"}
                    </strong>
                </div>

                <div>
                    <span>🎯 BTTS</span>
                    <strong>
                        ${num(p.bttsConfidence, 0)}%
                    </strong>
                </div>

            </div>
        `;
    }

    const predictions = item.predictions || {};
const probabilities = predictions.probabilities || {};
const aiDecision = predictions.aiDecision || {};
const model = item.model || {};

const homeWin = Number(probabilities.homeWin || 0);
const draw = Number(probabilities.draw || 0);
const awayWin = Number(probabilities.awayWin || 0);

const confidence =
    Number(predictions.winnerConfidence || 0);

const aiRating =
    Number(predictions.aiRating || 0);

const risk =
    aiDecision.risk || "UNKNOWN";

const decision =
    aiDecision.decision || "NO BET";

const winner =
    predictions.winner || "-";

card.innerHTML = `
    <h2>👑 ${item.match?.homeTeam?.name || item.homeTeam?.name || "Domicile"}
    vs
    ${item.match?.awayTeam?.name || item.awayTeam?.name || "Extérieur"}</h2>

    <p>🎯 <strong>PRONOSTIC</strong></p>

    <h3>${winner}</h3>

    <p>📊 <strong>Confiance :</strong> ${confidence}%</p>

    <p>🏠 Domicile : ${homeWin}%</p>
    <p>🤝 Nul : ${draw}%</p>
    <p>✈️ Extérieur : ${awayWin}%</p>

    <p>🧠 <strong>AI Score :</strong> ${aiRating}</p>

    <p>⚠️ <strong>Risque :</strong> ${risk}</p>

    <p>🔴 <strong>${decision}</strong></p>
`;
}

/* ======================================================
   NORMALIZE API RESPONSE
====================================================== */

function normalizeResponse(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.data)) {
        return data.data;
    }

    if (Array.isArray(data?.matches)) {
        return data.matches;
    }

    if (Array.isArray(data?.predictions)) {
        return data.predictions;
    }

    if (data && typeof data === "object") {
        return [data];
    }

    return [];
}

/* ======================================================
   EMPTY STATE
====================================================== */

function showEmptyState(url) {

    const results =
        document.getElementById("results");

    let message =
        "Aucune prédiction disponible actuellement.";

    if (url === "/vip/1x2") {

        message =
            "💎 Aucun match ne respecte actuellement les critères VIP 1X2.";

    } else if (url === "/vip/over25") {

        message =
            "🟣 Aucun match ne respecte actuellement les critères VIP OVER 2.5.";

    } else if (url === "/vip/btts") {

        message =
            "🟠 Aucun match ne respecte actuellement les critères VIP BTTS.";

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
                plutôt que de forcer une mauvaise prédiction.
            </small>

        </div>
    `;
}

/* ======================================================
   DISPLAY
====================================================== */

function displayPredictions(data) {

    const results =
        document.getElementById("results");

    const list =
        normalizeResponse(data);

    document.getElementById("matches").innerText =
        list.length;

    document.getElementById("predictions").innerText =
        list.length;

    if (!list.length) {

        showEmptyState(
            currentMode
        );

        return;
    }

    results.innerHTML = "";

    let market = "1X2";

    if (currentMode === "/vip/over25") {
        market = "OVER 2.5";
    }

    if (currentMode === "/vip/btts") {
        market = "BTTS";
    }

    list.forEach(item => {

        results.appendChild(
            createCard(
                item,
                market
            )
        );

    });
}

/* ======================================================
   LOAD PREDICTIONS
====================================================== */

async function loadPredictions(url) {

    const results =
        document.getElementById("results");

    currentMode = url;

    results.innerHTML = `
        <div class="loading">
            ⏳ Analyse des prédictions...
        </div>
    `;

    /* =========================
       CACHE
    ========================= */

    if (PAGE_CACHE.has(url)) {

        console.log(
            "⚡ PAGE CACHE:",
            url
        );

        displayPredictions(
            PAGE_CACHE.get(url)
        );

        return;
    }

    try {

        console.log(
            "🔎 API REQUEST:",
            url
        );

        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
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
                    onclick="reloadCurrentPage()"
                >
                    🔄 Réessayer
                </button>

            </div>

        `;
    }
}

/* ======================================================
   REFRESH
====================================================== */

function reloadCurrentPage() {

    PAGE_CACHE.delete(
        currentMode
    );

    loadPredictions(
        currentMode
    );
}

/* ======================================================
   START
====================================================== */

loadPredictions(
    "/free"
);
