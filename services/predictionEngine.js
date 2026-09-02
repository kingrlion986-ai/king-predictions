const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const { getTeamElo, calculateEloProbability } = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");
const { buildLearningModel } = require("./learningEngine");

const CACHE = new Map();
const TTL = 10 * 60 * 1000;

const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, Number(n) || 0));

const avg = (...v) =>
    v.reduce((a, b) => a + (Number(b) || 0), 0) / v.length;


/* =========================
   WINNER
========================= */

function getWinner(match, p) {
    const values = [
        ["HOME", Number(p.homeWin || 0)],
        ["DRAW", Number(p.draw || 0)],
        ["AWAY", Number(p.awayWin || 0)]
    ].sort((a, b) => b[1] - a[1]);

    if (values[0][0] === "HOME") return match.homeTeam.name;
    if (values[0][0] === "AWAY") return match.awayTeam.name;
    return "DRAW";
}


/* =========================
   STRICT FILTER
========================= */

function strictFilter(probability, confidence, risk, separation) {

    if (risk === "VERY HIGH") return false;
    if (probability < 65) return false;
    if (confidence < 60) return false;
    if (separation < 10) return false;

    return true;
}


/* =========================
   ANALYSE
========================= */

async function analyzeMatch(match) {

    if (!match?.homeTeam?.id || !match?.awayTeam?.id)
        return null;

    if (
        match.status !== "SCHEDULED" &&
        match.status !== "TIMED"
    )
        return null;

    const key =
        `${match.homeTeam.id}_${match.awayTeam.id}_${match.utcDate}`;

    const cached = CACHE.get(key);

    if (cached && Date.now() - cached.time < TTL)
        return cached.data;

    const [homeStats, awayStats] =
        await Promise.all([
            analyzeTeam(match.homeTeam),
            analyzeTeam(match.awayTeam)
        ]);

    const played = Math.min(
        Number(homeStats?.played || 0),
        Number(awayStats?.played || 0)
    );

    if (!homeStats || !awayStats || played < 5)
        return null;

    const homeElo = getTeamElo(match.homeTeam.id);
    const awayElo = getTeamElo(match.awayTeam.id);

    const eloProbability =
        calculateEloProbability(homeElo, awayElo);

    const xg =
        calculateExpectedGoals(
            homeStats,
            awayStats,
            { home: homeElo, away: awayElo }
        );

    const poisson =
        buildPoissonMatrix(
            xg.expectedHomeGoals,
            xg.expectedAwayGoals
        );

    const probabilities =
        poisson.probabilities;

    const confidence =
        calculateConfidence({
            probabilities,
            homeStats,
            awayStats,
            eloProbability,
            poisson
        });

    const winner =
        getWinner(match, probabilities);

    const values = [
        Number(probabilities.homeWin || 0),
        Number(probabilities.draw || 0),
        Number(probabilities.awayWin || 0)
    ].sort((a, b) => b - a);

    const favorite = values[0];
    const second = values[1];
    const separation = favorite - second;

    /* =========================
       RISQUE STRICT
    ========================= */

    let risk = "VERY HIGH";

    if (favorite >= 75 && separation >= 15 && confidence >= 70)
        risk = "LOW";
    else if (favorite >= 65 && separation >= 12 && confidence >= 65)
        risk = "MEDIUM";
    else if (favorite >= 55 && separation >= 8 && confidence >= 55)
        risk = "HIGH";


    /* =========================
       MARCHÉS
    ========================= */

    const overRaw = Number(poisson.over25 || 0);
    const bttsRaw = Number(poisson.btts || 0);

    const over25 =
        overRaw >= 50 ? "OVER 2.5" : "UNDER 2.5";

    const btts =
        bttsRaw >= 50 ? "OUI" : "NON";

    const overConfidence =
        Math.round(Math.max(overRaw, 100 - overRaw));

    const bttsConfidence =
        Math.round(Math.max(bttsRaw, 100 - bttsRaw));


    /* =========================
       AUTORISATION 1X2
    ========================= */

    const winnerAllowed =
        strictFilter(
            favorite,
            confidence,
            risk,
            separation
        );


    /* =========================
       SCORE AI
    ========================= */

    const aiRating = Math.round(
        clamp(
            confidence * 0.50 +
            favorite * 0.35 +
            separation * 1.5,
            0,
            100
        )
    );


    const result = {

        match: {
            id: match.id,
            utcDate: match.utcDate,
            status: match.status,
            competition: match.competition,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam
        },

        predictions: {

            winner,
            winnerConfidence: confidence,
            probabilities,

            /* IMPORTANT :
               Un match non autorisé
               devient NO BET.
            */

            winnerDecision:
                winnerAllowed
                    ? "VIP PICK"
                    : "NO BET",

            winnerRisk:
                winnerAllowed
                    ? risk
                    : "VERY HIGH",

            winnerAIScore:
                winnerAllowed
                    ? aiRating
                    : 0,

            over25Confidence: overConfidence,

            btts,
            bttsConfidence,

            correctScore:
                poisson.exactScore?.score,

            correctScoreProbability:
                poisson.exactScore?.probability,

            aiRating,
            predictionStrength: aiRating,

            quality:
                winnerAllowed
                    ? "HIGH"
                    : "NO BET"
        },

        teamStats: {
            home: homeStats,
            away: awayStats
        },

        model: {
            elo: {
                home: homeElo,
                away: awayElo,
                homeProbability:
                    Math.round(eloProbability * 100)
            },

            expectedGoals:
                xg.totalExpectedGoals,

            expectedHomeGoals:
                xg.expectedHomeGoals,

            expectedAwayGoals:
                xg.expectedAwayGoals,

            poissonMatrix:
                poisson.matrix,

            learning:
                typeof buildLearningModel === "function"
                    ? buildLearningModel()
                    : null
        },

        /* Pour le filtre VIP */
        marketScores: {
            oneXtwo:
                winnerAllowed ? aiRating : 0,

            over25:
                overConfidence >= 65
                    ? overConfidence
                    : 0,

            btts:
                bttsConfidence >= 65
                    ? bttsConfidence
                    : 0
        },

        vipAllowed:
            winnerAllowed
    };

    CACHE.set(key, {
        time: Date.now(),
        data: result
    });

    console.log(
        `👑 ${match.homeTeam.name} vs ${match.awayTeam.name}`,
        `| ${winner}`,
        `| ${favorite.toFixed(2)}%`,
        `| CONF ${confidence}%`,
        `| ${risk}`,
        `| ${winnerAllowed ? "VIP PICK" : "NO BET"}`
    );

    return result;
}


module.exports = {
    analyzeMatch
};
