/* =========================
VIP FILTER ENGINE V19
========================= */

function clamp(value, min, max) {

return Math.max(
    min,
    Math.min(
        max,
        value
    )
);

}

/*
Récupère la confiance principale
de manière compatible avec le modèle
*/

function getModelConfidence(predictions) {

return (

    predictions.winnerConfidence ??

    predictions.confidence ??

    0

);

}

/*
Vérifie si un match possède
un avantage statistique réel
*/

function calculateVIPScore(match) {

let score = 0;


const predictions =
    match.predictions;


const home =
    match.teamStats.home;


const away =
    match.teamStats.away;


/*
   =========================
   QUALITÉ GLOBALE
   =========================
*/

score +=
    (
        match.qualityScore || 0
    )
    *
    0.35;


/*
   =========================
   CONFIANCE MODÈLE
   =========================
*/

const confidence =
    getModelConfidence(
        predictions
    );


score +=
    confidence
    *
    0.30;


/*
   =========================
   ÉCART PROBABILITÉS
   =========================
*/

const probabilities =
    predictions.probabilities;


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


    const edge =
        sorted[0] -
        sorted[1];


    score +=
        edge
        *
        0.20;

}


/*
   =========================
   STABILITÉ
   =========================
*/

const homeStability =
    home.stability ?? 50;


const awayStability =
    away.stability ?? 50;


score +=

    (
        homeStability +
        awayStability
    )
    /
    2
    *
    0.10;


/*
   =========================
   QUALITÉ DES DONNÉES
   =========================
*/

if (

    home.played < 5 ||
    away.played < 5

) {

    score -= 15;

}


/*
   =========================
   FORME RÉCENTE
   =========================
*/

const homeForm =
    home.formPoints ?? 0;


const awayForm =
    away.formPoints ?? 0;


const formGap =
    Math.abs(
        homeForm -
        awayForm
    );


score +=
    clamp(
        formGap * 1.5,
        0,
        10
    );


/*
   =========================
   FORCE DES ÉQUIPES
   =========================
*/

const strengthGap =
    Math.abs(
        (home.strength ?? 0) -
        (away.strength ?? 0)
    );


score +=
    clamp(
        strengthGap * 0.25,
        0,
        10
    );


/*
   =========================
   SCORE FINAL
   =========================
*/

return Math.round(
    clamp(
        score,
        0,
        100
    )
);

}

/*
Filtre VIP strict
*/

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


        return (

            match.vipScore >= 75

            &&

            confidence >= 65

        );

    })


    .sort(
        (a, b) =>
            b.vipScore -
            a.vipScore
    );

}

module.exports = {

filterVipMatches,

calculateVIPScore

};
