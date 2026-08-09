/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V19
 CALIBRATED
=========================================

OBJECTIF :

La confiance ne représente PAS simplement
la qualité des données.

Elle doit refléter :

- force du favori
- séparation des probabilités
- qualité des données
- stabilité
- fiabilité
- accord ELO / Poisson
- forme
- momentum

IMPORTANT :

Une forte qualité de données ne peut pas
transformer un match 30% / 32% / 38%
en confiance 75%.

=========================================
*/


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


/*
=========================================
 CALCUL CONFIDENCE
=========================================
*/

function calculateConfidence({

    probabilities,
    homeStats,
    awayStats,
    eloProbability,
    poisson

}) {

    /*
    =====================================
    1. SÉCURISATION
    =====================================
    */

    const homeWin =
        Number(probabilities?.homeWin || 0);

    const draw =
        Number(probabilities?.draw || 0);

    const awayWin =
        Number(probabilities?.awayWin || 0);


    const values = [
        homeWin,
        draw,
        awayWin
    ].sort((a, b) => b - a);


    const favoriteProbability =
        values[0];

    const secondProbability =
        values[1];


    /*
    =====================================
    2. SÉPARATION DU FAVORI
    =====================================
    */

    const separation =
        Math.max(
            0,
            favoriteProbability -
            secondProbability
        );


    /*
    =====================================
    3. FORCE DU FAVORI
    =====================================
    */

    let probabilityScore = 0;


    if (favoriteProbability >= 75) {

        probabilityScore = 32;

    }
    else if (favoriteProbability >= 70) {

        probabilityScore = 28;

    }
    else if (favoriteProbability >= 65) {

        probabilityScore = 23;

    }
    else if (favoriteProbability >= 60) {

        probabilityScore = 17;

    }
    else if (favoriteProbability >= 55) {

        probabilityScore = 10;

    }
    else {

        probabilityScore = 0;

    }


    /*
    =====================================
    4. SÉPARATION
    =====================================
    */

    let separationScore = 0;


    if (separation >= 25) {

        separationScore = 20;

    }
    else if (separation >= 20) {

        separationScore = 16;

    }
    else if (separation >= 15) {

        separationScore = 12;

    }
    else if (separation >= 10) {

        separationScore = 7;

    }
    else if (separation >= 5) {

        separationScore = 3;

    }


    /*
    =====================================
    5. QUALITÉ DES DONNÉES
    =====================================
    */

    const homePlayed =
        Number(homeStats?.played || 0);

    const awayPlayed =
        Number(awayStats?.played || 0);


    const minPlayed =
        Math.min(
            homePlayed,
            awayPlayed
        );


    let dataQuality = 0;


    if (minPlayed >= 8) {

        dataQuality = 12;

    }
    else if (minPlayed >= 6) {

        dataQuality = 10;

    }
    else if (minPlayed >= 5) {

        dataQuality = 8;

    }
    else if (minPlayed >= 3) {

        dataQuality = 5;

    }
    else {

        dataQuality = 0;

    }


    /*
    =====================================
    6. STABILITÉ
    =====================================
    */

    const stability = (

        Number(homeStats?.stability || 50) +

        Number(awayStats?.stability || 50)

    ) / 2;


    let stabilityScore =
        clamp(
            (stability - 50) * 0.12,
            0,
            8
        );


    /*
    =====================================
    7. FIABILITÉ
    =====================================
    */

    const reliability = (

        Number(homeStats?.reliability || 0.5) +

        Number(awayStats?.reliability || 0.5)

    ) / 2;


    let reliabilityScore =
        clamp(
            (reliability - 0.50) * 20,
            0,
            8
        );


    /*
    =====================================
    8. ÉCART DE FORCE
    =====================================
    */

    const strengthGap =
        Math.abs(

            Number(homeStats?.strength || 50) -

            Number(awayStats?.strength || 50)

        );


    let strengthScore =
        clamp(
            strengthGap * 0.25,
            0,
            7
        );


    /*
    =====================================
    9. FORME
    =====================================
    */

    const formGap =
        Math.abs(

            Number(homeStats?.formPoints || 0) -

            Number(awayStats?.formPoints || 0)

        );


    let formScore =
        clamp(
            formGap * 2,
            0,
            6
        );


    /*
    =====================================
    10. MOMENTUM
    =====================================
    */

    const momentumGap =
        Math.abs(

            Number(homeStats?.momentum || 0) -

            Number(awayStats?.momentum || 0)

        );


    let momentumScore =
        clamp(
            momentumGap * 3,
            0,
            5
        );


    /*
    =====================================
    11. ACCORD ELO / POISSON
    =====================================
    */

    let modelAgreementScore = 0;


    if (
        typeof eloProbability === "number" &&
        Number.isFinite(eloProbability)
    ) {

        /*
        eloProbability est généralement
        compris entre 0 et 1.

        On compare l'ELO au favori
        correspondant.
        */

        let poissonFavoriteProbability =
            favoriteProbability / 100;


        const eloDistance =
            Math.abs(

                poissonFavoriteProbability -
                eloProbability

            );


        if (eloDistance <= 0.05) {

            modelAgreementScore = 8;

        }
        else if (eloDistance <= 0.10) {

            modelAgreementScore = 5;

        }
        else if (eloDistance <= 0.15) {

            modelAgreementScore = 2;

        }
        else {

            modelAgreementScore = -6;

        }

    }


    /*
    =====================================
    12. POISSON
    =====================================
    */

    let poissonScore = 0;

    const poissonDominance =
        Number(
            poisson?.dominance || 0
        );

    const poissonUncertainty =
        Number(
            poisson?.uncertainty || 0
        );


    if (poissonDominance >= 30) {

        poissonScore += 10;

    }
    else if (poissonDominance >= 20) {

        poissonScore += 7;

    }
    else if (poissonDominance >= 15) {

        poissonScore += 4;

    }
    else if (poissonDominance < 10) {

        poissonScore -= 10;

    }


    /*
    =====================================
    13. INCERTITUDE POISSON
    =====================================
    */

    if (poissonUncertainty >= 60) {

        poissonScore -= 15;

    }
    else if (poissonUncertainty >= 50) {

        poissonScore -= 10;

    }
    else if (poissonUncertainty >= 45) {

        poissonScore -= 6;

    }


    /*
    =====================================
    14. SCORE BRUT
    =====================================
    */

    let confidence =

        30 +

        probabilityScore +

        separationScore +

        dataQuality +

        stabilityScore +

        reliabilityScore +

        strengthScore +

        formScore +

        momentumScore +

        modelAgreementScore +

        poissonScore;


    /*
    =====================================
    15. MATCH TRÈS ÉQUILIBRÉ
    =====================================
    */

    if (
        favoriteProbability < 45 &&
        separation < 8
    ) {

        confidence -= 18;

    }


    /*
    =====================================
    16. FAVORI FAIBLE
    =====================================
    */

    if (favoriteProbability < 50) {

        confidence -= 12;

    }
    else if (favoriteProbability < 55) {

        confidence -= 7;

    }


    /*
    =====================================
    17. ELO ÉQUILIBRÉ
    =====================================
    */

    if (
        typeof eloProbability === "number" &&
        eloProbability > 0.47 &&
        eloProbability < 0.53
    ) {

        confidence -= 10;

    }


    /*
    =====================================
    18. TRÈS FORTE INCERTITUDE
    =====================================
    */

    if (poissonUncertainty >= 60) {

        confidence -= 8;

    }


    /*
    =====================================
    19. DONNÉES INSUFFISANTES
    =====================================
    */

    if (minPlayed < 3) {

        confidence -= 15;

    }
    else if (minPlayed < 5) {

        confidence -= 8;

    }


    /*
    =====================================
    20. PLAFOND DE SÉCURITÉ
    =====================================
    */

    /*
    Si le favori est inférieur à 50%,
    il est impossible d'afficher une
    confiance élevée.
    */

    if (favoriteProbability < 50) {

        confidence =
            Math.min(
                confidence,
                45
            );

    }


    /*
    Favori entre 50 et 55 :
    confiance limitée.
    */

    else if (favoriteProbability < 55) {

        confidence =
            Math.min(
                confidence,
                52
            );

    }


    /*
    Favori entre 55 et 60 :
    */

    else if (favoriteProbability < 60) {

        confidence =
            Math.min(
                confidence,
                62
            );

    }


    /*
    =====================================
    21. PLAFOND SI POISSON TRÈS FAIBLE
    =====================================
    */

    if (poissonDominance < 10) {

        confidence =
            Math.min(
                confidence,
                48
            );

    }


    /*
    =====================================
    22. PLAFOND SI ELO ÉQUILIBRÉ
    =====================================
    */

    if (
        typeof eloProbability === "number" &&
        eloProbability > 0.47 &&
        eloProbability < 0.53
    ) {

        confidence =
            Math.min(
                confidence,
                50
            );

    }


    /*
    =====================================
    23. LIMITE FINALE
    =====================================
    */

    confidence =
        clamp(
            Math.round(confidence),
            25,
            90
        );


    /*
    =====================================
    DEBUG
    =====================================
    */

    console.log(
        "===== CONFIDENCE V19 ====="
    );

    console.log({

        favoriteProbability,

        separation,

        dataQuality,

        stability,

        reliability,

        strengthGap,

        formGap,

        momentumGap,

        poissonDominance,

        poissonUncertainty,

        eloProbability,

        confidence

    });


    return confidence;

}


/*
=========================================
 EXPORT
=========================================
*/

module.exports = {

    calculateConfidence

};
