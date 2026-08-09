/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V20
 CALIBRATED / CONSERVATIVE
=========================================
*/

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function calculateConfidence({

    probabilities,
    homeStats,
    awayStats,
    eloProbability,
    poisson

}) {

    /*
    =================================
    1. PROBABILITÉS
    =================================
    */

    const homeWin = Number(probabilities?.homeWin || 0);
    const draw = Number(probabilities?.draw || 0);
    const awayWin = Number(probabilities?.awayWin || 0);

    const values = [
        homeWin,
        draw,
        awayWin
    ];

    const sorted = [...values].sort((a, b) => b - a);

    const favoriteProbability = sorted[0];
    const secondProbability = sorted[1];

    const separation =
        favoriteProbability - secondProbability;


    /*
    =================================
    2. QUALITÉ DES DONNÉES
    =================================
    */

    const homePlayed =
        Number(homeStats?.played || 0);

    const awayPlayed =
        Number(awayStats?.played || 0);

    const minPlayed =
        Math.min(homePlayed, awayPlayed);

    const dataQuality =
        clamp(
            (minPlayed / 8) * 100,
            0,
            100
        );


    /*
    =================================
    3. STABILITÉ
    =================================
    */

    const stability =
        (
            Number(homeStats?.stability || 50) +
            Number(awayStats?.stability || 50)
        ) / 2;


    /*
    =================================
    4. FIABILITÉ
    =================================
    */

    const reliability =
        (
            Number(homeStats?.reliability || 0.5) +
            Number(awayStats?.reliability || 0.5)
        ) / 2;


    /*
    =================================
    5. FORCE
    =================================
    */

    const strengthGap =
        Math.abs(
            Number(homeStats?.strength || 50) -
            Number(awayStats?.strength || 50)
        );


    /*
    =================================
    6. FORME
    =================================
    */

    const formGap =
        Math.abs(
            Number(homeStats?.formPoints || 0) -
            Number(awayStats?.formPoints || 0)
        );


    /*
    =================================
    7. ELO
    =================================
    */

    let eloAgreement = 50;

    if (
        typeof eloProbability === "number" &&
        Number.isFinite(eloProbability)
    ) {

        const eloHome =
            eloProbability > 1
                ? eloProbability / 100
                : eloProbability;

        const poissonHome =
            homeWin / 100;

        const difference =
            Math.abs(
                poissonHome - eloHome
            );

        eloAgreement =
            clamp(
                100 - difference * 100,
                0,
                100
            );
    }


    /*
    =================================
    8. POISSON
    =================================
    */

    const poissonDominance =
        Number(poisson?.dominance || 0);

    const poissonUncertainty =
        Number(poisson?.uncertainty || 0);


    /*
    =================================
    9. BASE
    =================================

    IMPORTANT :
    On commence bas.

    Un favori à 38 % ne doit jamais
    obtenir 70+ de confiance.
    */

    let confidence = 30;


    /*
    =================================
    10. FORCE DU FAVORI
    =================================
    */

    if (favoriteProbability >= 80) {

        confidence += 25;

    }
    else if (favoriteProbability >= 70) {

        confidence += 18;

    }
    else if (favoriteProbability >= 65) {

        confidence += 12;

    }
    else if (favoriteProbability >= 60) {

        confidence += 6;

    }
    else if (favoriteProbability < 50) {

        confidence -= 15;

    }


    /*
    =================================
    11. SÉPARATION
    =================================
    */

    if (separation >= 25) {

        confidence += 15;

    }
    else if (separation >= 15) {

        confidence += 10;

    }
    else if (separation >= 10) {

        confidence += 5;

    }
    else if (separation < 7) {

        confidence -= 12;

    }


    /*
    =================================
    12. DONNÉES
    =================================
    */

    confidence +=
        (dataQuality - 50) * 0.10;


    /*
    =================================
    13. STABILITÉ
    =================================
    */

    confidence +=
        (stability - 50) * 0.08;


    /*
    =================================
    14. FIABILITÉ
    =================================
    */

    confidence +=
        (reliability - 0.50) * 20;


    /*
    =================================
    15. FORCE DES ÉQUIPES
    =================================
    */

    if (strengthGap >= 20) {

        confidence += 8;

    }
    else if (strengthGap >= 10) {

        confidence += 4;

    }
    else if (strengthGap <= 4) {

        confidence -= 8;

    }


    /*
    =================================
    16. FORME
    =================================
    */

    if (formGap >= 1.0) {

        confidence += 6;

    }
    else if (formGap >= 0.5) {

        confidence += 3;

    }
    else if (formGap < 0.15) {

        confidence -= 5;

    }


    /*
    =================================
    17. ACCORD ELO
    =================================
    */

    if (eloAgreement >= 80) {

        confidence += 6;

    }
    else if (eloAgreement >= 65) {

        confidence += 3;

    }
    else if (eloAgreement < 55) {

        confidence -= 6;

    }


    /*
    =================================
    18. POISSON DOMINANCE
    =================================
    */

    if (poissonDominance >= 35) {

        confidence += 10;

    }
    else if (poissonDominance >= 25) {

        confidence += 6;

    }
    else if (poissonDominance >= 15) {

        confidence += 3;

    }
    else if (poissonDominance < 10) {

        confidence -= 8;

    }


    /*
    =================================
    19. POISSON UNCERTAINTY
    =================================
    */

    if (poissonUncertainty >= 60) {

        confidence -= 15;

    }
    else if (poissonUncertainty >= 50) {

        confidence -= 10;

    }
    else if (poissonUncertainty >= 40) {

        confidence -= 5;

    }


    /*
    =================================
    20. MATCH ÉQUILIBRÉ
    =================================
    */

    if (
        favoriteProbability < 50 &&
        separation < 10 &&
        strengthGap <= 5
    ) {

        confidence -= 10;

    }


    /*
    =================================
    21. HISTORIQUE INSUFFISANT
    =================================
    */

    if (minPlayed < 3) {

        confidence -= 15;

    }
    else if (minPlayed < 5) {

        confidence -= 8;

    }


    /*
    =================================
    22. LIMITE FINALE
    =================================
    */

    confidence =
        Math.round(
            clamp(
                confidence,
                20,
                95
            )
        );


    /*
    =================================
    DEBUG
    =================================
    */

    console.log("===== CONFIDENCE V20 =====");

    console.log({

        favoriteProbability,

        separation,

        dataQuality,

        stability,

        reliability,

        strengthGap,

        formGap,

        poissonDominance,

        poissonUncertainty,

        eloProbability,

        eloAgreement,

        confidence

    });


    return confidence;

}


module.exports = {

    calculateConfidence

};
