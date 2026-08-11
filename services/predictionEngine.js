const { analyzeTeam } = require("./teamAnalyzer");

const {
    buildPoissonMatrix
} = require("./poissonEngine");

const {
    getTeamElo,
    calculateEloProbability
} = require("./eloEngine");

const {
    calculateExpectedGoals
} = require("./expectedGoals");

const {
    calculateConfidence
} = require("./confidenceEngine");

const {
    evaluateDecision
} = require("./decisionEngine");

const {
    buildLearningModel
} = require("./learningEngine");


/* =========================
   ANALYSIS CACHE
========================= */

const ANALYSIS_CACHE =
    new Map();

const ANALYSIS_TTL =
    24 * 60 * 60 * 1000;


/* =========================
   MATCH KEY
========================= */

function getMatchKey(match) {

    return (
        `${match.homeTeam.id}_` +
        `${match.awayTeam.id}_` +
        `${match.utcDate}`
    );

}


/* =========================
   WINNER FROM POISSON
========================= */

function getWinnerFromPoisson(
    match,
    probabilities
) {

    const home =
        Number(
            probabilities?.homeWin || 0
        );

    const draw =
        Number(
            probabilities?.draw || 0
        );

    const away =
        Number(
            probabilities?.awayWin || 0
        );


    if (
        home >= draw &&
        home >= away
    ) {

        return match.homeTeam.name;

    }


    if (
        away >= home &&
        away >= draw
    ) {

        return match.awayTeam.name;

    }


    return "DRAW";
}


/* =========================
   PREDICTION QUALITY
========================= */

function getPredictionQuality(
    confidence
) {

    if (confidence >= 70) {
        return "HIGH";
    }

    if (confidence >= 55) {
        return "MEDIUM";
    }

    return "LOW";
}


/* =========================
   ANALYZE MATCH
========================= */

async function analyzeMatch(match) {

    const name =
        `${match.homeTeam.name} vs ${match.awayTeam.name}`;

    const key =
        getMatchKey(match);


    console.log(
        "START ANALYSIS:",
        name
    );

    console.time(name);


    /* =========================
       IMPORTANT :
       ONLY UPCOMING MATCHES
    ========================= */

    if (
        match.status !== "SCHEDULED" &&
        match.status !== "TIMED"
    ) {

        console.log(
            "🚫 MATCH NOT PREDICTED:",
            name,
            "| STATUS:",
            match.status
        );

        console.timeEnd(name);

        return null;
    }


    /* =========================
       CACHE
    ========================= */

    const cached =
        ANALYSIS_CACHE.get(key);

    if (
        cached &&
        Date.now() - cached.time <
        ANALYSIS_TTL
    ) {

        console.log(
            "♻️ CACHE USED:",
            name
        );

        console.timeEnd(name);

        return cached.data;
    }


    /* =========================
       TEAM ANALYSIS
    ========================= */

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


    /* =========================
       DATA VALIDATION
    ========================= */

    if (
        !homeStats ||
        !awayStats ||
        Number(homeStats.played || 0) < 5 ||
        Number(awayStats.played || 0) < 5
    ) {

        console.log(
            "🚫 MATCH REJECTED:",
            name,
            "| HOME:",
            homeStats?.played || 0,
            "| AWAY:",
            awayStats?.played || 0
        );

        console.timeEnd(name);

        return null;
    }


    /* =========================
       ELO
    ========================= */

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


    console.log(
        "===== ELO =====",
        homeElo,
        awayElo,
        Math.round(
            eloProbability * 100
        )
    );


    /* =========================
       EXPECTED GOALS
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


    console.log(
        "XG:",
        xg
    );


    /* =========================
       POISSON
    ========================= */

    const poisson =
        buildPoissonMatrix(
            xg.expectedHomeGoals,
            xg.expectedAwayGoals
        );


    console.log(
        "POISSON:",
        poisson.probabilities,
        "| RISK:",
        poisson.risk
    );


    /* =========================
       CONFIDENCE
    ========================= */

    const confidence =
        calculateConfidence({

            probabilities:
                poisson.probabilities,

            homeStats,

            awayStats,

            eloProbability,

            poisson

        });


    /*
     * IMPORTANT :
     *
     * Il n'y a plus de
     * adjustedConfidence =
     * confidence.
     *
     * Une seule confidence.
     */

    const predictionQuality =
        getPredictionQuality(
            confidence
        );


    /* =========================
       LEARNING
    ========================= */

    const learning =
        buildLearningModel();


    /* =========================
       WINNER
       
       SOURCE PRINCIPALE :
       POISSON
    ========================= */

    const winner =
        getWinnerFromPoisson(
            match,
            poisson.probabilities
        );


    /* =========================
       OVER 2.5
    ========================= */

    let overScore =

        poisson.over25 * 0.70 +

        (
            (
                Number(homeStats.over25Rate || 0) +
                Number(awayStats.over25Rate || 0)
            ) / 2
        ) * 0.20 +

        (
            Math.min(
                xg.totalExpectedGoals,
                4
            ) / 4
        ) * 100 * 0.10;


    overScore =
        Math.max(
            5,
            Math.min(
                95,
                overScore
            )
        );


    const over25Confidence =
        Math.round(
            overScore
        );


    const over25Prediction =
        overScore >= 55
            ? "OVER 2.5"
            : "UNDER 2.5";


    /* =========================
       BTTS
    ========================= */

    let bttsScore =

        poisson.btts * 0.70 +

        (
            (
                Number(homeStats.bttsRate || 0) +
                Number(awayStats.bttsRate || 0)
            ) / 2
        ) * 0.20 +

        (
            Math.min(
                xg.totalExpectedGoals,
                4
            ) / 4
        ) * 100 * 0.10;


    bttsScore =
        Math.max(
            5,
            Math.min(
                95,
                bttsScore
            )
        );


    const bttsConfidence =
        Math.round(
            bttsScore
        );


    const bttsPrediction =
        bttsScore >= 55
            ? "OUI"
            : "NON";


    /* =========================
       CORRECT SCORE
       
       IMPORTANT :
       On ne remplace plus le score
       Poisson par des règles arbitraires.
    ========================= */

    const correctScore =
        poisson.exactScore.score;


    const correctScoreProbability =
        poisson.exactScore.probability;


    /* =========================
       AI RATING
    ========================= */

    const averageStability =
        (
            Number(homeStats.stability || 50) +
            Number(awayStats.stability || 50)
        ) / 2;


    const averageReliability =
        (
            Number(homeStats.reliability || 0.5) +
            Number(awayStats.reliability || 0.5)
        ) / 2;


    const aiRating =
        Math.round(
            Math.max(
                0,
                Math.min(
                    100,

                    confidence * 0.55 +

                    poisson.dominance * 0.20 +

                    averageStability * 0.10 +

                    averageReliability * 100 * 0.15

                )
            )
        );


    /* =========================
       DECISION ENGINE
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


    console.log(
        "👑 AI:",
        aiDecision.decision,
        "| RISK:",
        aiDecision.risk,
        "| SCORE:",
        aiDecision.score
    );


    /* =========================
       PREDICTION STRENGTH
    ========================= */

    const predictionStrength =
        Math.round(

            (
                aiRating +
                confidence +
                poisson.matchScore

            ) / 3

        );


    /* =========================
       FINAL RESULT
    ========================= */

    const result = {

        match: {

            id:
                match.id,

            utcDate:
                match.utcDate,

            competition:
                match.competition,

            homeTeam:
                match.homeTeam,

            awayTeam:
                match.awayTeam

        },


        predictions: {

            /*
             * 1X2
             */

            winner,

            winnerConfidence:
                confidence,

            aiDecision,

            aiRating,

            predictionStrength,

            quality:
                predictionQuality,

            probabilities:
                poisson.probabilities,


            /*
             * OVER 2.5
             */

            over25:
                over25Prediction,

            over25Confidence,


            /*
             * BTTS
             */

            btts:
                bttsPrediction,

            bttsConfidence,


            /*
             * SCORE EXACT
             */

            correctScore,

            correctScoreProbability

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
                        eloProbability * 100
                    )

            },


            learning,


            expectedGoals:
                xg.totalExpectedGoals,

            expectedHomeGoals:
                xg.expectedHomeGoals,

            expectedAwayGoals:
                xg.expectedAwayGoals,


            poissonMatrix:
                poisson.matrix

        }

    };


    /*
    =================================
    IMPORTANT
    =================================

    AUCUNE MISE À JOUR ELO ICI.

    L'ELO est construit séparément
    à partir de l'historique.

    analyzeMatch() = prédiction seulement.
    =================================
    */


    /* =========================
       CACHE
    ========================= */

    ANALYSIS_CACHE.set(
        key,
        {
            time:
                Date.now(),

            data:
                result
        }
    );


    console.log(
        "✅ MATCH ANALYZED:",
        name
    );

    console.timeEnd(name);


    return result;
}


/* =========================
   EXPORT
========================= */

module.exports = {
    analyzeMatch
};
