/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V22
 CALIBRATED / ANTI-OVERCONFIDENCE
=========================================
*/

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function calculateConfidence({
    probabilities,
    homeStats,
    awayStats,
    eloProbability,
    poisson = null
}) {

    /*
    =================================
    1. PROBABILITÉS
    =================================
    */

    const values = [
        num(probabilities?.homeWin),
        num(probabilities?.draw),
        num(probabilities?.awayWin)
    ];

    const sorted = [...values].sort((a, b) => b - a);

    const favoriteProbability = sorted[0];
    const secondProbability = sorted[1];

    const separation =
        favoriteProbability - secondProbability;


    /*
    =================================
    2. DONNÉES
    =================================
    */

    const homePlayed = num(
        homeStats?.played ??
        homeStats?.matchesPlayed ??
        homeStats?.matches
    );

    const awayPlayed = num(
        awayStats?.played ??
        awayStats?.matchesPlayed ??
        awayStats?.matches
    );

    const minPlayed =
        Math.min(homePlayed, awayPlayed);

    const dataQuality = clamp(
        (minPlayed / 8) * 100,
        0,
        100
    );


    /*
    =================================
    3. FIABILITÉ
    =================================
    */

    const reliability =
        (
            num(homeStats?.reliability, 0.5) +
            num(awayStats?.reliability, 0.5)
        ) / 2;

    const reliabilityScore =
        clamp(reliability * 100, 0, 100);


    /*
    =================================
    4. STABILITÉ
    =================================
    */

    const stability =
        (
            num(homeStats?.stability, 50) +
            num(awayStats?.stability, 50)
        ) / 2;


    /*
    =================================
    5. FORCE
    =================================
    */

    const strengthGap =
        Math.abs(
            num(homeStats?.strength, 50) -
            num(awayStats?.strength, 50)
        );


    /*
    =================================
    6. FORME
    =================================
    */

    const formGap =
        Math.abs(
            num(homeStats?.formPoints) -
            num(awayStats?.formPoints)
        );


    /*
    =================================
    7. ACCORD ELO / POISSON
    =================================
    */

    let modelAgreement = 50;

    if (
        typeof eloProbability === "number" &&
        Number.isFinite(eloProbability)
    ) {

        /*
         * ELO probability est comprise
         * entre 0 et 1.
         */

        const poissonHome =
            num(probabilities?.homeWin) / 100;

        const difference =
            Math.abs(
                poissonHome -
                eloProbability
            );

        modelAgreement = clamp(
            100 - difference * 200,
            0,
            100
        );
    }


    /*
    =================================
    8. RISQUE POISSON
    =================================
    */

    let poissonRisk = 0;

    if (poisson) {

        const uncertainty =
            num(poisson.uncertainty);

        const dominance =
            num(poisson.dominance);

        if (uncertainty >= 60) {

            poissonRisk -= 25;

        } else if (uncertainty >= 50) {

            poissonRisk -= 18;

        } else if (uncertainty >= 40) {

            poissonRisk -= 10;

        } else if (uncertainty >= 30) {

            poissonRisk -= 5;

        }


        /*
         * Une domination importante
         * donne seulement un petit bonus.
         */

        if (dominance >= 25) {

            poissonRisk += 5;

        } else if (dominance >= 15) {

            poissonRisk += 2;

        }

    }


    /*
    =================================
    9. SCORE DE BASE
    =================================

    IMPORTANT :

    La probabilité réelle du favori
    devient maintenant le facteur
    principal.

    Cela empêche le système de créer
    artificiellement des 85%.
    */

    let confidence =

        favoriteProbability * 0.70 +

        separation * 0.20 +

        dataQuality * 0.05 +

        reliabilityScore * 0.025 +

        modelAgreement * 0.025 +

        poissonRisk;


    /*
    =================================
    10. MATCH TRÈS ÉQUILIBRÉ
    =================================
    */

    if (favoriteProbability < 40) {

        confidence -= 20;

    } else if (favoriteProbability < 45) {

        confidence -= 15;

    }


    if (separation < 3) {

        confidence -= 15;

    } else if (separation < 5) {

        confidence -= 10;

    } else if (separation < 8) {

        confidence -= 5;

    }


    /*
    =================================
    11. FORCE DES ÉQUIPES
    =================================
    */

    if (strengthGap <= 4) {

        confidence -= 8;

    } else if (strengthGap <= 8) {

        confidence -= 4;

    }


    /*
    =================================
    12. ELO ÉQUILIBRÉ
    =================================
    */

    if (
        typeof eloProbability === "number" &&
        eloProbability >= 0.46 &&
        eloProbability <= 0.54
    ) {

        confidence -= 10;

    }


    /*
    =================================
    13. DONNÉES INSUFFISANTES
    =================================
    */

    if (minPlayed < 3) {

        confidence -= 20;

    } else if (minPlayed < 5) {

        confidence -= 12;

    } else if (minPlayed < 8) {

        confidence -= 5;

    }


    /*
    =================================
    14. PLAFOND SELON PROBABILITÉ
    =================================

    RÈGLE ESSENTIELLE :

    Impossible d'avoir 85% de confiance
    avec un favori à seulement 52%.

    */

    let probabilityCap = 85;

    if (favoriteProbability < 45) {

        probabilityCap = 40;

    } else if (favoriteProbability < 50) {

        probabilityCap = 50;

    } else if (favoriteProbability < 55) {

        probabilityCap = 60;

    } else if (favoriteProbability < 60) {

        probabilityCap = 68;

    } else if (favoriteProbability < 65) {

        probabilityCap = 75;

    } else if (favoriteProbability < 70) {

        probabilityCap = 80;

    } else {

        probabilityCap = 85;

    }


    confidence =
        Math.min(
            confidence,
            probabilityCap
        );


    /*
    =================================
    15. TRÈS MAUVAIS MATCH
    =================================
    */

    if (
        favoriteProbability < 40 ||
        separation < 3
    ) {

        confidence =
            Math.min(
                confidence,
                35
            );

    }


    /*
    =================================
    16. LIMITE FINALE
    =================================
    */

    confidence =
        clamp(
            Math.round(confidence),
            5,
            85
        );


    /*
    =================================
    DEBUG
    =================================
    */

    console.log(
        "===== CONFIDENCE V22 ====="
    );

    console.log({

        favoriteProbability,

        secondProbability,

        separation,

        minPlayed,

        dataQuality,

        stability,

        reliability,

        strengthGap,

        formGap,

        modelAgreement,

        poissonRisk,

        probabilityCap,

        confidence

    });


    return confidence;
}


module.exports = {
    calculateConfidence
};
