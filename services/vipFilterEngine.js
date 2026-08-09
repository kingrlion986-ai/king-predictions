/* =========================================
   KING PREDICTIONS AI
   VIP FILTER ENGINE V20
   MARKET-SPECIFIC FILTER
========================================= */


/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


/* =========================
   MAIN CONFIDENCE
========================= */

function getModelConfidence(predictions) {

    return Number(
        predictions?.winnerConfidence ??
        predictions?.confidence ??
        0
    );

}


/* =========================
   GENERAL QUALITY
========================= */

function getQuality(match) {

    return Number(
        match?.qualityScore ??
        match?.predictions?.aiRating ??
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

    let score = 0;


    /*
    CONFIDENCE
    */

    const confidence =
        getModelConfidence(predictions);

    score += confidence * 0.40;


    /*
    PROBABILITY EDGE
    */

    const probabilities =
        predictions.probabilities;

    let favoriteProbability = 0;
    let separation = 0;

    if (
        probabilities &&
        typeof probabilities.homeWin === "number" &&
        typeof probabilities.draw === "number" &&
        typeof probabilities.awayWin === "number"
    ) {

        const values = [

            probabilities.homeWin,
            probabilities.draw,
            probabilities.awayWin

        ];

        const sorted =
            [...values].sort(
                (a, b) => b - a
            );

        favoriteProbability =
            sorted[0];

        separation =
            sorted[0] - sorted[1];

        score +=
            favoriteProbability * 0.35;

        score +=
            clamp(
                separation * 0.50,
                0,
                10
            );

    }


    /*
    STABILITÉ
    */

    const stability =

        (
            Number(home.stability ?? 50) +
            Number(away.stability ?? 50)
        ) / 2;

    score +=
        stability * 0.10;


    /*
    FIABILITÉ
    */

    const reliability =

        (
            Number(home.reliability ?? 0.5) +
            Number(away.reliability ?? 0.5)
        ) / 2;

    score +=
        reliability * 100 * 0.10;


    /*
    FORCE
    */

    const strengthGap =
        Math.abs(
            Number(home.strength ?? 0) -
            Number(away.strength ?? 0)
        );

    score +=
        clamp(
            strengthGap * 0.25,
            0,
            5
        );


    /*
    DONNÉES INSUFFISANTES
    */

    if (
        Number(home.played ?? 0) < 5 ||
        Number(away.played ?? 0) < 5
    ) {

        score -= 15;

    }


    /*
    MATCH TROP ÉQUILIBRÉ
    */

    if (favoriteProbability < 55) {

        score -= 20;

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


    const poisson =
        Number(
            predictions.over25Confidence ?? 0
        );

    const homeRate =
        Number(home.over25Rate ?? 0);

    const awayRate =
        Number(away.over25Rate ?? 0);

    const reliability =

        (
            Number(home.reliability ?? 0.5) +
            Number(away.reliability ?? 0.5)
        ) / 2;


    const xg =
        Number(
            match?.model?.expectedGoals ?? 0
        );


    let score = 0;


    /*
    POISSON OVER
    */

    score += poisson * 0.55;


    /*
    HISTORIQUE OVER
    */

    score +=
        (
            (homeRate + awayRate) / 2
        ) * 100 * 0.20;


    /*
    XG
    */

    score +=
        clamp(
            xg / 3 * 100,
            0,
            100
        ) * 0.15;


    /*
    FIABILITÉ
    */

    score +=
        reliability * 100 * 0.10;


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


    const poisson =
        Number(
            predictions.bttsConfidence ?? 0
        );


    const homeRate =
        Number(home.bttsRate ?? 0);

    const awayRate =
        Number(away.bttsRate ?? 0);


    const reliability =

        (
            Number(home.reliability ?? 0.5) +
            Number(away.reliability ?? 0.5)
        ) / 2;


    let score = 0;


    /*
    POISSON BTTS
    */

    score +=
        poisson * 0.55;


    /*
    HISTORIQUE BTTS
    */

    score +=
        (
            (homeRate + awayRate) / 2
        ) * 100 * 0.25;


    /*
    FIABILITÉ
    */

    score +=
        reliability * 100 * 0.10;


    /*
    ATTAQUE DES DEUX ÉQUIPES
    */

    const avgScored =

        (
            Number(home.avgScored ?? 0) +
            Number(away.avgScored ?? 0)
        ) / 2;


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

function filterVipMatches(matches) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateVIPScore(match)

        }))

        .filter(match => {

            const confidence =
                getModelConfidence(
                    match.predictions
                );


            const decision =
                match.predictions?.aiDecision
                    ?.decision;


            return (

                match.vipScore >= 70 &&

                confidence >= 65 &&

                (
                    decision === "VIP PICK" ||
                    confidence >= 75
                )

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );

}


/* =========================
   VIP OVER 2.5
========================= */

function filterVipOver25(matches) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateOver25Score(match)

        }))

        .filter(match => {

            const confidence =
                Number(
                    match.predictions
                        ?.over25Confidence ?? 0
                );

            return (

                match.vipScore >= 65 &&
                confidence >= 60 &&
                match.predictions?.over25

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

function filterVipBtts(matches) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateBttsScore(match)

        }))

        .filter(match => {

            const confidence =
                Number(
                    match.predictions
                        ?.bttsConfidence ?? 0
                );

            return (

                match.vipScore >= 65 &&
                confidence >= 60 &&
                match.predictions?.btts

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
