/*
=========================================
 KING PREDICTIONS AI
 VIP FILTER ENGINE V21
 MARKET SPECIFIC
=========================================
*/


/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


function num(value, fallback = 0) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}


/* =========================
   MAIN CONFIDENCE
========================= */

function getModelConfidence(predictions = {}) {

    return num(
        predictions.winnerConfidence ??
        predictions.confidence,
        0
    );

}


/* =========================
   1X2 VIP SCORE
========================= */
function calculateVIPScore(match) {

    const predictions =
        match?.predictions || {};

    const home =
        match?.teamStats?.home || {};

    const away =
        match?.teamStats?.away || {};

    const model =
        match?.model || {};

    let score = 0;

    /* =========================
       MODEL CONFIDENCE
    ========================= */

    const confidence =
        getModelConfidence(predictions);

    score += confidence * 0.30;

    /* =========================
       AI RATING
    ========================= */

    const aiRating =
        num(predictions.aiRating);

    score += aiRating * 0.15;

    /* =========================
       PREDICTION STRENGTH
    ========================= */

    const predictionStrength =
        num(predictions.predictionStrength);

    score += predictionStrength * 0.10;

    /* =========================
       PROBABILITIES
    ========================= */

    const probabilities =
        predictions.probabilities || {};

    const values = [

        num(probabilities.homeWin),

        num(probabilities.draw),

        num(probabilities.awayWin)

    ];

    const sorted =
        [...values].sort(
            (a, b) => b - a
        );

    const favoriteProbability =
        sorted[0];

    const secondProbability =
        sorted[1];

    const separation =
        favoriteProbability -
        secondProbability;

    score += favoriteProbability * 0.20;

    score += clamp(
        separation * 0.70,
        0,
        15
    );

    /* =========================
       STRENGTH GAP
    ========================= */

    const strengthGap =
        Math.abs(
            num(home.strength) -
            num(away.strength)
        );

    score += clamp(
        strengthGap * 0.40,
        0,
        10
    );

    /* =========================
       STABILITY
    ========================= */

    const stability =
        (
            num(home.stability, 50) +
            num(away.stability, 50)
        ) / 2;

    score += stability * 0.08;

    /* =========================
       RELIABILITY
    ========================= */

    const reliability =
        (
            num(home.reliability, 0.5) +
            num(away.reliability, 0.5)
        ) / 2;

    score += reliability * 100 * 0.08;

    /* =========================
       EXPECTED GOALS
    ========================= */

    const xg =
        num(model.expectedGoals);

    score += clamp(
        xg * 5,
        0,
        10
    );

    /* =========================
       POISSON DOMINANCE
    ========================= */

    const dominance =
        num(
            predictions?.aiDecision?.score
        );

    score += dominance * 0.05;

    /* =========================
       DATA QUALITY
    ========================= */

    if (
        num(home.played) < 5 ||
        num(away.played) < 5
    ) {
        score -= 25;
    }

    /* =========================
       FAVORITE TOO LOW
    ========================= */

    if (favoriteProbability < 55) {
        score -= 20;
    }

    if (favoriteProbability < 50) {
        score -= 35;
    }

    /* =========================
       LOW CONFIDENCE
    ========================= */

    if (confidence < 60) {
        score -= 20;
    }

    if (confidence < 50) {
        score -= 30;
    }

    /* =========================
       AI RISK
    ========================= */

    const risk =
        predictions?.aiDecision?.risk;

    if (risk === "HIGH") {
        score -= 20;
    }

    if (risk === "VERY HIGH") {
        score -= 40;
    }

    /* =========================
       TRAP MATCH
    ========================= */

    const decision =
        predictions?.aiDecision?.decision;

    if (decision === "TRAP MATCH") {
        score -= 50;
    }

    /* =========================
       BONUS ELITE PICK
    ========================= */

    if (
        confidence >= 80 &&
        favoriteProbability >= 65 &&
        separation >= 20
    ) {
        score += 10;
    }

    return Math.round(
        clamp(score, 0, 100)
    );
}

/* =========================
   OVER 2.5 SCORE
========================= */

function calculateOver25Score(match) {

    const predictions =
        match?.predictions || {};

    const home =
        match?.teamStats?.home || {};

    const away =
        match?.teamStats?.away || {};


    const overConfidence =
        num(
            predictions.over25Confidence
        );


    const homeRate =
        num(home.over25Rate);

    const awayRate =
        num(away.over25Rate);


    const averageOverRate =
        (
            homeRate +
            awayRate
        ) / 2;


    const reliability =
        (
            num(home.reliability, 0.5) +
            num(away.reliability, 0.5)
        ) / 2;


    const expectedGoals =
        num(
            match?.model?.expectedGoals
        );


    let score = 0;


    /*
       Poisson / model
    */

    score +=
        overConfidence * 0.55;


    /*
       Historical OVER rate
    */

    score +=
        averageOverRate *
        100 *
        0.20;


    /*
       Expected goals
    */

    score +=
        clamp(
            expectedGoals / 3 * 100,
            0,
            100
        ) * 0.15;


    /*
       Reliability
    */

    score +=
        reliability *
        100 *
        0.10;


    return Math.round(
        clamp(score, 0, 100)
    );

}


/* =========================
   BTTS SCORE
========================= */

function calculateBttsScore(match) {

    const predictions =
        match?.predictions || {};

    const home =
        match?.teamStats?.home || {};

    const away =
        match?.teamStats?.away || {};


    const bttsConfidence =
        num(
            predictions.bttsConfidence
        );


    const homeRate =
        num(home.bttsRate);

    const awayRate =
        num(away.bttsRate);


    const averageBttsRate =
        (
            homeRate +
            awayRate
        ) / 2;


    const reliability =
        (
            num(home.reliability, 0.5) +
            num(away.reliability, 0.5)
        ) / 2;


    const avgScored =
        (
            num(home.avgScored) +
            num(away.avgScored)
        ) / 2;


    let score = 0;


    /*
       Model BTTS
    */

    score +=
        bttsConfidence * 0.55;


    /*
       Historical BTTS
    */

    score +=
        averageBttsRate *
        100 *
        0.25;


    /*
       Reliability
    */

    score +=
        reliability *
        100 *
        0.10;


    /*
       Attacking strength
    */

    score +=
        clamp(
            avgScored * 20,
            0,
            10
        );


    return Math.round(
        clamp(score, 0, 100)
    );

}


/* =========================
   VIP 1X2
========================= */

function filterVipMatches(matches = []) {

    return matches

        .map(match => ({
            ...match,
            vipScore:
                calculateVIPScore(match)
        }))

        .filter(match => {

            const predictions =
                match.predictions || {};

            const confidence =
                getModelConfidence(
                    predictions
                );

            const decision =
                predictions?.aiDecision?.decision;

            const risk =
                predictions?.aiDecision?.risk;

            return (

                match.vipScore >= 75 &&

                confidence >= 65 &&

                risk !== "HIGH" &&

                risk !== "VERY HIGH" &&

                decision !== "TRAP MATCH"

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        )

        .slice(0, 5);
}

/* =========================
   VIP OVER 2.5
========================= */

function filterVipOver25(matches = []) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateOver25Score(match)

        }))

        .filter(match => {

            const predictions =
                match.predictions || {};


            const confidence =
                num(
                    predictions
                        .over25Confidence
                );


            const prediction =
                predictions.over25;


            /*
               On veut uniquement
               OVER 2.5
            */

            const isOver =
                prediction === "OVER 2.5";


            return (

                match.vipScore >= 60 &&

                confidence >= 55 &&

                isOver

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );

}


/* =========================
   VIP BTTS
========================= */

function filterVipBtts(matches = []) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateBttsScore(match)

        }))

        .filter(match => {

            const predictions =
                match.predictions || {};


            const confidence =
                num(
                    predictions
                        .bttsConfidence
                );


            const prediction =
                predictions.btts;


            /*
               On veut uniquement
               BTTS OUI
            */

            const isBttsYes =
                prediction === "OUI";


            return (

                match.vipScore >= 60 &&

                confidence >= 55 &&

                isBttsYes

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );

}


/* =========================
   EXPORTS
========================= */

module.exports = {

    filterVipMatches,

    filterVipOver25,

    filterVipBtts,

    calculateVIPScore,

    calculateOver25Score,

    calculateBttsScore

};
