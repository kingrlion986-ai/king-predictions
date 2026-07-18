/* =========================
   CONFIDENCE ENGINE V18
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
    Calcul de confiance

    Sources :
    - écart des probabilités
    - qualité données
    - stabilité
    - accord Elo / Poisson
*/


function calculateConfidence({

    probabilities,
    homeStats,
    awayStats,
    eloProbability

}) {


    /*
        Séparation du favori
    */

    const values = [

        probabilities.homeWin,

        probabilities.draw,

        probabilities.awayWin

    ];


    const sorted =
        [...values].sort(
            (a,b)=>b-a
        );


    const favoriteProbability = sorted[0];

const separation =
    (sorted[0] - sorted[1]) * 2;

const favoriteBonus =
    clamp(
        (favoriteProbability - 35) * 1.8,
        0,
        25
    );



    /*
        Qualité données
    */

    const dataQuality =

        (
            Math.min(
                homeStats.played,
                15
            )
            +
            Math.min(
                awayStats.played,
                15
            )
        )
        /
        30
        *
        100;



    /*
    Stabilité moyenne
*/

const stability =

    (
        homeStats.stability +
        awayStats.stability
    )
    /
    2;


/*
    Différence de niveau
*/

const strengthGap = Math.abs(

    homeStats.strength -
    awayStats.strength

);

const strengthBonus = clamp(

    strengthGap * 0.8,

    0,

    20

);


/*
    Forme récente
*/

const formGap = Math.abs(

    homeStats.formPoints -
    awayStats.formPoints

);

const formBonus = clamp(

    formGap * 2,

    0,

    20

);


/*
    Accord Elo / modèle

    Si Elo donne un favori
    proche du modèle Poisson,
    confiance augmentée
*/

let eloAgreement = 50;

if (eloProbability) {

    const poissonHome =
        probabilities.homeWin / 100;

    const difference =
        Math.abs(
            poissonHome -
            eloProbability
        );

    eloAgreement =
        100 -
        difference * 100;

}


/*
    Score final
*/

let confidence =

    10 +

    separation * 0.35 +

    favoriteBonus +

    dataQuality * 0.15 +

    stability * 0.12 +

    eloAgreement * 0.10 +

    strengthBonus * 0.18 +

    formBonus * 0.10;


    if (favoriteProbability >= 70)
    confidence += 8;

else if (favoriteProbability >= 60)
    confidence += 5;

else if (favoriteProbability >= 50)
    confidence += 2;

return Math.round(
    clamp(
        confidence,
        25,
        95
    )
);

}



module.exports = {

    calculateConfidence

};
