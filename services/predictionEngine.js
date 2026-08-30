const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const {
    getTeamElo,
    calculateEloProbability
} = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");
const { buildLearningModel } = require("./learningEngine");

const CACHE = new Map();
const TTL = 10 * 60 * 1000;


/* =====================================================
   UTILS
===================================================== */

function clamp(n, min, max) {
    return Math.max(
        min,
        Math.min(max, Number(n) || 0)
    );
}


function avg(...values) {
    if (!values.length) return 0;

    return values.reduce(
        (sum, value) =>
            sum + (Number(value) || 0),
        0
    ) / values.length;
}


function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n)
        ? n
        : fallback;
}


/* =====================================================
   WINNER
===================================================== */

function getWinner(match, probabilities) {

    const values = [
        ["HOME", safeNumber(probabilities?.homeWin)],
        ["DRAW", safeNumber(probabilities?.draw)],
        ["AWAY", safeNumber(probabilities?.awayWin)]
    ];

    values.sort(
        (a, b) => b[1] - a[1]
    );

    const best = values[0][0];

    if (best === "HOME") {
        return match.homeTeam.name;
    }

    if (best === "AWAY") {
        return match.awayTeam.name;
    }

    return "DRAW";
}


/* =====================================================
   RISK
===================================================== */

function riskFromScore(score) {

    if (score >= 75)
        return "LOW";

    if (score >= 60)
        return "MEDIUM";

    if (score >= 45)
        return "HIGH";

    return "VERY HIGH";
}


/* =====================================================
   MARKET QUALITY
===================================================== */

function marketQuality({
    probability,
    confidence,
    xg,
    reliability,
    stability,
    market
}) {

    const p =
        clamp(probability, 0, 100);

    const c =
        clamp(confidence, 0, 100);

    const rel =
        clamp(reliability * 100, 0, 100);

    const stab =
        clamp(stability * 100, 0, 100);

    let score =
        p * 0.45 +
        c * 0.25 +
        rel * 0.15 +
        stab * 0.10;

    /*
     * Bonus / malus spécifiques
     */

    if (market === "OVER") {

        if (xg >= 3.5)
            score += 8;
        else if (xg >= 3)
            score += 4;
        else if (xg < 2.3)
            score -= 10;

    }


    if (market === "BTTS") {

        if (xg >= 3)
            score += 6;
        else if (xg >= 2.5)
            score += 3;
        else if (xg < 2.1)
            score -= 10;

    }


    return clamp(
        Math.round(score),
        0,
        100
    );
}


/* =====================================================
   1X2 SCORE
===================================================== */

function calculate1X2Quality({
    probabilities,
    confidence,
    homeStats,
    awayStats,
    eloProbability
}) {

    const home =
        safeNumber(probabilities?.homeWin);

    const draw =
        safeNumber(probabilities?.draw);

    const away =
        safeNumber(probabilities?.awayWin);

    const ordered = [
        home,
        draw,
        away
    ].sort(
        (a, b) => b - a
    );

    const favorite =
        ordered[0];

    const second =
        ordered[1];

    const separation =
        favorite - second;

    const strengthGap =
        Math.abs(
            safeNumber(homeStats?.strength, 50) -
            safeNumber(awayStats?.strength, 50)
        );

    const reliability =
        avg(
            homeStats?.reliability ?? 0.5,
            awayStats?.reliability ?? 0.5
        );

    const stability =
        avg(
            homeStats?.stability ?? 0.5,
            awayStats?.stability ?? 0.5
        );


    let score =
        favorite * 0.50 +
        clamp(separation * 2, 0, 30) * 0.20 +
        confidence * 0.15 +
        reliability * 100 * 0.10 +
        stability * 100 * 0.05;


    /*
     * ELO cohérent avec le favori
     */

    const eloHome =
        clamp(
            safeNumber(eloProbability, 0.5) * 100,
            0,
            100
        );

    const favoriteIsHome =
        home >= away &&
        home >= draw;

    const eloAgreement =
        favoriteIsHome
            ? eloHome
            : 100 - eloHome;

    if (eloAgreement >= 65)
        score += 5;

    if (eloAgreement < 50)
        score -= 8;


    /*
     * Match trop équilibré
     */

    if (separation < 5)
        score -= 20;
    else if (separation < 10)
        score -= 10;


    if (strengthGap < 5)
        score -= 10;


    return clamp(
        Math.round(score),
        0,
        100
    );
}


/* =====================================================
   MARKET DECISION
===================================================== */

function buildMarketDecision({
    market,
    probability,
    confidence,
    score,
    xg,
    reliability,
    stability
}) {

    const p =
        clamp(probability, 0, 100);

    let finalScore =
        score;


    /*
     * Marché trop incertain
     */

    if (p < 55)
        finalScore -= 15;

    if (p < 52)
        finalScore -= 20;


    /*
     * Qualité des données
     */

    if (reliability < 0.60)
        finalScore -= 10;

    if (stability < 0.55)
        finalScore -= 8;


    /*
     * Règles spécifiques
     */

    if (market === "OVER") {

        if (xg < 2.20)
            finalScore -= 15;

        if (xg < 2.00)
            finalScore -= 20;

    }


    if (market === "BTTS") {

        if (xg < 2.20)
            finalScore -= 15;

        if (xg < 2.00)
            finalScore -= 20;

    }


    finalScore =
        clamp(
            Math.round(finalScore),
            0,
            100
        );


    let decision =
        "NO BET";

    let risk =
        riskFromScore(finalScore);


    /*
     * GATE STRICT
     */

    if (
        finalScore >= 78 &&
        p >= 75 &&
        confidence >= 65 &&
        reliability >= 0.65 &&
        stability >= 0.60
    ) {

        decision =
            "VIP PICK";

        risk =
            "LOW";

    }
    else if (
        finalScore >= 65 &&
        p >= 65 &&
        confidence >= 58 &&
        reliability >= 0.60
    ) {

        decision =
            "NORMAL";

        risk =
            "MEDIUM";

    }
    else if (
        finalScore >= 52 &&
        p >= 55
    ) {

        decision =
            "WATCH";

        risk =
            "HIGH";

    }
    else {

        decision =
            "NO BET";

        risk =
            "VERY HIGH";

    }


    return {
        decision,
        risk,
        score: finalScore
    };
}


/* =====================================================
   MAIN ANALYSIS
===================================================== */

async function analyzeMatch(match) {

    if (
        !match?.homeTeam?.id ||
        !match?.awayTeam?.id
    ) {
        return null;
    }


    if (
        match.status !== "SCHEDULED" &&
        match.status !== "TIMED"
    ) {
        return null;
    }


    const key =
        `${match.homeTeam.id}_${match.awayTeam.id}_${match.utcDate}`;


    const cached =
        CACHE.get(key);


    if (
        cached &&
        Date.now() - cached.time < TTL
    ) {

        return cached.data;

    }


    console.log(
        "🔎 ANALYZING:",
        `${match.homeTeam.name} vs ${match.awayTeam.name}`
    );


    /* =================================================
       TEAM DATA
    ================================================= */

    const [
        homeStats,
        awayStats
    ] = await Promise.all([

        analyzeTeam(
            match.homeTeam
        ),

        analyzeTeam(
            match.awayTeam
        )

    ]);


    const minPlayed =
        Math.min(
            safeNumber(homeStats?.played),
            safeNumber(awayStats?.played)
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


    /* =================================================
       ELO
    ================================================= */

    const homeElo =
        getTeamElo(
            match.homeTeam.id
        );

    const awayElo =
        getTeamElo(
            match.awayTeam.id
        );


    const eloProbability =
        calculateEloProbability(
            homeElo,
            awayElo
        );


    /* =================================================
       EXPECTED GOALS
    ================================================= */

    const xg =
        calculateExpectedGoals(
            homeStats,
            awayStats,
            {
                home: homeElo,
                away: awayElo
            }
        );


    const expectedHomeGoals =
        safeNumber(
            xg?.expectedHomeGoals
        );

    const expectedAwayGoals =
        safeNumber(
            xg?.expectedAwayGoals
        );

    const totalExpectedGoals =
        safeNumber(
            xg?.totalExpectedGoals,
            expectedHomeGoals +
            expectedAwayGoals
        );


    /* =================================================
       POISSON
    ================================================= */

    const poisson =
        buildPoissonMatrix(
            expectedHomeGoals,
            expectedAwayGoals
        );


    const probabilities =
        poisson?.probabilities || {};


    /* =================================================
       BASE CONFIDENCE
    ================================================= */

    const baseConfidence =
        clamp(
            calculateConfidence({
                probabilities,
                homeStats,
                awayStats,
                eloProbability,
                poisson
            }),
            0,
            100
        );


    /* =================================================
       1X2
    ================================================= */

    const winner =
        getWinner(
            match,
            probabilities
        );


    const winnerQuality =
        calculate1X2Quality({
            probabilities,
            confidence: baseConfidence,
            homeStats,
            awayStats,
            eloProbability
        });


    const winnerDecision =
        buildMarketDecision({
            market: "1X2",
            probability:
                Math.max(
                    safeNumber(probabilities.homeWin),
                    safeNumber(probabilities.draw),
                    safeNumber(probabilities.awayWin)
                ),
            confidence: baseConfidence,
            score: winnerQuality,
            xg: totalExpectedGoals,
            reliability:
                avg(
                    homeStats.reliability ?? 0.5,
                    awayStats.reliability ?? 0.5
                ),
            stability:
                avg(
                    homeStats.stability ?? 0.5,
                    awayStats.stability ?? 0.5
                )
        });


    /* =================================================
       OVER 2.5
    ================================================= */

    const rawOver =
        clamp(
            safeNumber(poisson?.over25),
            0,
            100
        );


    const over25 =
        rawOver >= 50
            ? "OVER 2.5"
            : "UNDER 2.5";


    const overProbability =
        Math.max(
            rawOver,
            100 - rawOver
        );


    /*
     * Confiance volontairement légèrement
     * moins optimiste que la probabilité brute.
     */

    const over25Confidence =
        Math.round(
            clamp(
                overProbability * 0.90 +
                baseConfidence * 0.10,
                0,
                95
            )
        );


    const overQuality =
        marketQuality({
            probability:
                overProbability,
            confidence:
                over25Confidence,
            xg:
                totalExpectedGoals,
            reliability:
                avg(
                    homeStats.reliability ?? 0.5,
                    awayStats.reliability ?? 0.5
                ),
            stability:
                avg(
                    homeStats.stability ?? 0.5,
                    awayStats.stability ?? 0.5
                ),
            market: "OVER"
        });


    const overDecision =
        buildMarketDecision({
            market: "OVER",
            probability:
                overProbability,
            confidence:
                over25Confidence,
            score:
                overQuality,
            xg:
                totalExpectedGoals,
            reliability:
                avg(
                    homeStats.reliability ?? 0.5,
                    awayStats.reliability ?? 0.5
                ),
            stability:
                avg(
                    homeStats.stability ?? 0.5,
                    awayStats.stability ?? 0.5
                )
        });


    /* =================================================
       BTTS
    ================================================= */

    const rawBTTS =
        clamp(
            safeNumber(poisson?.btts),
            0,
            100
        );


    const btts =
        rawBTTS >= 50
            ? "OUI"
            : "NON";


    const bttsProbability =
        Math.max(
            rawBTTS,
            100 - rawBTTS
        );


    const bttsConfidence =
        Math.round(
            clamp(
                bttsProbability * 0.88 +
                baseConfidence * 0.12,
                0,
                95
            )
        );


    const bttsQuality =
        marketQuality({
            probability:
                bttsProbability,
            confidence:
                bttsConfidence,
            xg:
                totalExpectedGoals,
            reliability:
                avg(
                    homeStats.reliability ?? 0.5,
                    awayStats.reliability ?? 0.5
                ),
            stability:
                avg(
                    homeStats.stability ?? 0.5,
                    awayStats.stability ?? 0.5
                ),
            market: "BTTS"
        });


    const bttsDecision =
        buildMarketDecision({
            market: "BTTS",
            probability:
                bttsProbability,
            confidence:
                bttsConfidence,
            score:
                bttsQuality,
            xg:
                totalExpectedGoals,
            reliability:
                avg(
                    homeStats.reliability ?? 0.5,
                    awayStats.reliability ?? 0.5
                ),
            stability:
                avg(
                    homeStats.stability ?? 0.5,
                    awayStats.stability ?? 0.5
                )
        });


    /* =================================================
       AI SCORE GLOBAL
    ================================================= */

    /*
     * Le score global représente la qualité
     * générale du match.
     *
     * Il ne remplace PAS les scores des marchés.
     */

    const globalAIScore =
        Math.round(
            clamp(
                winnerQuality * 0.40 +
                overQuality * 0.30 +
                bttsQuality * 0.30,
                0,
                100
            )
        );


    /* =================================================
       LEARNING
    ================================================= */

    let learning = null;

    try {

        learning =
            buildLearningModel();

    } catch (error) {

        console.log(
            "⚠️ LEARNING:",
            error.message
        );

    }


    /* =================================================
       RESULT
    ================================================= */

    const result = {

        match: {

            id:
                match.id,

            utcDate:
                match.utcDate,

            status:
                match.status,

            competition:
                match.competition,

            homeTeam:
                match.homeTeam,

            awayTeam:
                match.awayTeam

        },


        predictions: {

            /* =========================
               1X2
            ========================= */

            winner,

            winnerConfidence:
                Math.round(
                    baseConfidence
                ),

            probabilities,

            winnerAIScore:
                winnerDecision.score,

            winnerRisk:
                winnerDecision.risk,

            winnerDecision:
                winnerDecision.decision,


            /* =========================
               OVER
            ========================= */

            over25,

            over25Confidence,

            over25AIScore:
                overDecision.score,

            over25Risk:
                overDecision.risk,

            over25Decision:
                overDecision.decision,


            /* =========================
               BTTS
            ========================= */

            btts,

            bttsConfidence,

            bttsAIScore:
                bttsDecision.score,

            bttsRisk:
                bttsDecision.risk,

            bttsDecision:
                bttsDecision.decision,


            /* =========================
               SCORE EXACT
            ========================= */

            correctScore:
                poisson?.exactScore?.score,

            correctScoreProbability:
                poisson?.exactScore?.probability,


            /* =========================
               GLOBAL AI
            ========================= */

            aiRating:
                globalAIScore,

            predictionStrength:
                Math.round(
                    avg(
                        winnerDecision.score,
                        overDecision.score,
                        bttsDecision.score
                    )
                ),

            quality:
                globalAIScore >= 75
                    ? "HIGH"
                    : globalAIScore >= 60
                        ? "MEDIUM"
                        : "LOW"

        },


        teamStats: {

            home:
                homeStats,

            away:
                awayStats

        },


        model: {

            elo: {

                home:
                    homeElo,

                away:
                    awayElo,

                homeProbability:
                    Math.round(
                        safeNumber(
                            eloProbability,
                            0.5
                        ) * 100
                    )

            },


            expectedGoals:
                totalExpectedGoals,

            expectedHomeGoals,

            expectedAwayGoals,

            poissonMatrix:
                poisson?.matrix,

            learning

        },


        /*
         * Informations internes utiles
         * au futur filtre VIP.
         */

        marketScores: {

            oneXtwo:
                winnerDecision.score,

            over25:
                overDecision.score,

            btts:
                bttsDecision.score

        }

    };


/* =================================================
       CACHE
    ================================================= */

    CACHE.set(
        key,
        {
            time:
                Date.now(),

            data:
                result

        }
    );


    /* =================================================
       LOG
    ================================================= */

    console.log(
        `👑 ${match.homeTeam.name} vs ${match.awayTeam.name}`
    );

    console.log(
        `1X2 | ${winner} | CONF ${Math.round(baseConfidence)} | AI ${winnerDecision.score} | ${winnerDecision.risk}`
    );

    console.log(
        `OVER | ${over25} | CONF ${over25Confidence} | AI ${overDecision.score} | ${overDecision.risk}`
    );

    console.log(
        `BTTS | ${btts} | CONF ${bttsConfidence} | AI ${bttsDecision.score} | ${bttsDecision.risk}`
    );

    console.log(
        `GLOBAL AI | ${globalAIScore}/100`
    );


    return result;

}


/* =====================================================
   EXPORT
===================================================== */

module.exports = {
    analyzeMatch
};
