const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const {
    getTeamElo,
    calculateEloProbability
} = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");
const { evaluateDecision } = require("./decisionEngine");
const { buildLearningModel } = require("./learningEngine");

const CACHE = new Map();
const TTL = 10 * 60 * 1000;

const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, Number(n) || 0));

const avg = (...v) =>
    v.reduce((a, b) => a + (Number(b) || 0), 0) / v.length;


/* =====================================================
   WINNER
===================================================== */

function getWinner(match, p) {

    const values = [
        ["HOME", Number(p.homeWin || 0)],
        ["DRAW", Number(p.draw || 0)],
        ["AWAY", Number(p.awayWin || 0)]
    ];

    const best =
        values.sort((a, b) => b[1] - a[1])[0][0];

    if (best === "HOME")
        return match.homeTeam.name;

    if (best === "AWAY")
        return match.awayTeam.name;

    return "DRAW";
}


/* =====================================================
   MARKET SCORE
===================================================== */

function marketScore({
    poisson,
    confidence,
    rate,
    xg,
    threshold,
    type
}) {

    const model =
        type === "OVER"
            ? Number(poisson.over25 || 0)
            : Number(poisson.btts || 0);

    const score =
        model * 0.60 +
        rate * 100 * 0.20 +
        clamp(xg / 3, 0, 1) * 100 * 0.20;

    if (type === "OVER" && xg < 2)
        return Math.min(score, 50);

    if (type === "BTTS" && xg < 1.8)
        return Math.min(score, 50);

    return clamp(
        score * 0.70 + confidence * 0.30,
        5,
        95
    );
}


/* =====================================================
   MAIN ANALYSIS
===================================================== */

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

    if (
        cached &&
        Date.now() - cached.time < TTL
    )
        return cached.data;


    console.log(
        "🔎 ANALYZING:",
        `${match.homeTeam.name} vs ${match.awayTeam.name}`
    );


    /* =========================
       TEAM DATA
    ========================= */

    const [homeStats, awayStats] =
        await Promise.all([
            analyzeTeam(match.homeTeam),
            analyzeTeam(match.awayTeam)
        ]);

    const minPlayed =
        Math.min(
            Number(homeStats?.played || 0),
            Number(awayStats?.played || 0)
        );

    if (
        !homeStats ||
        !awayStats ||
        minPlayed < 5
    ) {

        console.log(
            "🚫 INSUFFICIENT DATA:",
            minPlayed
        );

        return null;
    }


    /* =========================
       ELO
    ========================= */

    const homeElo =
        getTeamElo(match.homeTeam.id);

    const awayElo =
        getTeamElo(match.awayTeam.id);

    const eloProbability =
        calculateEloProbability(
            homeElo,
            awayElo
        );


    /* =========================
       XG
    ========================= */

    const xg =
        calculateExpectedGoals(
            homeStats,
            awayStats,
            {
                home: homeElo,
                away: awayElo
            }
        );


    /* =========================
       POISSON
    ========================= */

    const poisson =
        buildPoissonMatrix(
            xg.expectedHomeGoals,
            xg.expectedAwayGoals
        );

    const probabilities =
        poisson.probabilities;


    /* =========================
       CONFIDENCE
    ========================= */

    const confidence =
        calculateConfidence({
            probabilities,
            homeStats,
            awayStats,
            eloProbability,
            poisson
        });


    /* =========================
       WINNER
    ========================= */

    const winner =
        getWinner(
            match,
            probabilities
        );


        /* =========================
   MARKETS
========================= */

const overRate =
    avg(
        homeStats.over25Rate,
        awayStats.over25Rate
    );

const bttsRate =
    avg(
        homeStats.bttsRate,
        awayStats.bttsRate
    );

const overScore =
    Math.round(
        marketScore({
            poisson,
            confidence,
            rate: overRate,
            xg: xg.totalExpectedGoals,
            threshold: 2,
            type: "OVER"
        })
    );

const bttsScore =
    Math.round(
        marketScore({
            poisson,
            confidence,
            rate: bttsRate,
            xg: xg.totalExpectedGoals,
            threshold: 1.8,
            type: "BTTS"
        })
    );

const over25 =
    overScore >= 60
        ? "OVER 2.5"
        : "UNDER 2.5";

const btts =
    bttsScore >= 60
        ? "OUI"
        : "NON";

    /* =========================
       DECISION
    ========================= */

    const aiDecision =
        evaluateDecision({
            confidence,
            poisson,
            homeStats,
            awayStats,
            eloProbability,
            winner
        });


    /* =========================
       AI RATING
    ========================= */

    const stability =
        avg(
            homeStats.stability,
            awayStats.stability
        );

    const reliability =
        avg(
            homeStats.reliability,
            awayStats.reliability
        ) * 100;


    const aiRating =
        Math.round(
            clamp(
                confidence * 0.55 +
                poisson.matchScore * 0.20 +
                stability * 0.10 +
                reliability * 0.15,
                0,
                100
            )
        );


    /*
     * FORCE LE RATING À RESTER
     * COHÉRENT AVEC LE RISQUE.
     */

    const finalRating =
        aiDecision.decision === "TRAP MATCH"
            ? Math.min(aiRating, 40)
            : aiDecision.risk === "VERY HIGH"
                ? Math.min(aiRating, 50)
                : aiRating;


    /* =========================
       LEARNING
    ========================= */

    const learning =
        buildLearningModel();


    /* =========================
       RESULT
    ========================= */

    const result = {

        match: {
            id: match.id,
            utcDate: match.utcDate,
            competition: match.competition,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam
        },

        predictions: {

            winner,

            winnerConfidence:
                confidence,

            probabilities,

            over25,
            over25Confidence:
                overScore,

            btts,
            bttsConfidence:
                bttsScore,

            correctScore:
                poisson.exactScore?.score,

            correctScoreProbability:
                poisson.exactScore?.probability,

            aiRating:
                finalRating,

            predictionStrength:
                Math.round(
                    avg(
                        confidence,
                        finalRating,
                        poisson.matchScore
                    )
                ),

            quality:
                confidence >= 70
                    ? "HIGH"
                    : confidence >= 55
                        ? "MEDIUM"
                        : "LOW",

            aiDecision
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
                    Math.round(
                        eloProbability * 100
                    )
            },

            expectedGoals:
                xg.totalExpectedGoals,

            expectedHomeGoals:
                xg.expectedHomeGoals,

            expectedAwayGoals:
                xg.expectedAwayGoals,

            poissonMatrix:
                poisson.matrix,

            learning
        }
    };


    CACHE.set(
        key,
        {
            time: Date.now(),
            data: result
        }
    );


    console.log(
        `👑 ${match.homeTeam.name} vs ${match.awayTeam.name}`,
        `| ${winner}`,
        `| CONF ${confidence}%`,
        `| AI ${finalRating}`,
        `| ${aiDecision.decision}`,
        `| ${aiDecision.risk}`
    );


    return result;
}


module.exports = {
    analyzeMatch
};
