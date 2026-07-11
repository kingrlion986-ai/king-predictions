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


    const separation =
        sorted[0] -
        sorted[1];



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

        (
            separation * 0.40
        )
        +
        (
            dataQuality * 0.25
        )
        +
        (
            stability * 0.20
        )
        +
        (
            eloAgreement * 0.15
        );



    return Math.round(

        clamp(
            confidence,
            20,
            95
        )

    );

}



module.exports = {

    calculateConfidence

};
