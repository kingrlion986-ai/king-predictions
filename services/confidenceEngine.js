/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V20
 CALIBRATED / ANTI-OVERCONFIDENCE
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
    poisson = null
}) {

    /*
    =================================
    1. PROBABILITÉ DU FAVORI
    =================================
    */

    const values = [
        Number(probabilities?.homeWin || 0),
        Number(probabilities?.draw || 0),
        Number(probabilities?.awayWin || 0)
    ];

    const sorted = [...values].sort((a, b) => b - a);

    const favoriteProbability = sorted[0];
    const secondProbability = sorted[1];

    /*
    Écart réel entre le favori et le second choix.
    */

    const separation =
        favoriteProbability - secondProbability;


    /*
    =================================
    2. QUALITÉ DES DONNÉES
    =================================
    */

    const homePlayed = Number(
        homeStats?.played ||
        homeStats?.matchesPlayed ||
        homeStats?.matches ||
        0
    );

    const awayPlayed = Number(
        awayStats?.played ||
        awayStats?.matchesPlayed ||
        awayStats?.matches ||
        0
    );

    const minPlayed = Math.min(
        homePlayed,
        awayPlayed
    );

    /*
    8 matchs = données complètes.
    */

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
            Number(homeStats?.reliability ?? 0.5) +
            Number(awayStats?.reliability ?? 0.5)
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
            Number(homeStats?.stability ?? 50) +
            Number(awayStats?.stability ?? 50)
        ) / 2;


    /*
    =================================
    5. FORCE DES ÉQUIPES
    =================================
    */

    const strengthGap = Math.abs(
        Number(homeStats?.strength ?? 50) -
        Number(awayStats?.strength ?? 50)
    );


    /*
    =================================
    6. FORME
    =================================
    */

    const formGap = Math.abs(
        Number(homeStats?.formPoints ?? 0) -
        Number(awayStats?.formPoints ?? 0)
    );


    /*
    =================================
    7. ELO / POISSON
    =================================
    */

    let modelAgreement = 50;

    if (
        typeof eloProbability === "number" &&
        Number.isFinite(eloProbability)
    ) {

        const poissonHome =
            Number(probabilities?.homeWin || 0) / 100;

        const eloHome =
            eloProbability;

        const difference =
            Math.abs(poissonHome - eloHome);

        /*
        0 différence = 100%
        0.50 différence = 0%
        */

        modelAgreement = clamp(
            100 - difference * 200,
            0,
            100
        );
    }


    /*
    =================================
    8. POISSON RISK
    =================================
    */

    let poissonRisk = 0;

    if (poisson) {

        const uncertainty =
            Number(poisson.uncertainty || 0);

        const dominance =
            Number(poisson.dominance || 0);

        /*
        Forte incertitude = pénalité.
        */

        if (uncertainty >= 55) {
            poissonRisk -= 25;
        }
        else if (uncertainty >= 45) {
            poissonRisk -= 15;
        }
        else if (uncertainty >= 35) {
            poissonRisk -= 8;
        }

        /*
        Une forte dominance peut légèrement
        améliorer la confiance.
        */

        if (dominance >= 30) {
            poissonRisk += 8;
        }
        else if (dominance >= 20) {
            poissonRisk += 4;
        }

    }


    /*
    =================================
    9. SCORE DE BASE
    =================================

    IMPORTANT :

    La confiance ne doit PAS être
    une simple copie de la probabilité.

    Elle mesure :

    - qualité des données
    - séparation
    - stabilité
    - fiabilité
    - accord des modèles
    - risque Poisson
    */

    let confidence =

        20 +

        /*
        Séparation
        */

        separation * 0.35 +

        /*
        Probabilité du favori
        */

        Math.max(
            0,
            favoriteProbability - 33
        ) * 0.30 +

        /*
        Données
        */

        dataQuality * 0.12 +

        /*
        Stabilité
        */

        stability * 0.06 +

        /*
        Fiabilité
        */

        reliabilityScore * 0.08 +

        /*
        Accord ELO
        */

        modelAgreement * 0.08 +

        /*
        Force
        */

        Math.min(strengthGap, 20) * 0.10 +

        /*
        Forme
        */

        Math.min(formGap, 10) * 0.08 +

        poissonRisk;


    /*
    =================================
    10. PÉNALITÉ MATCH ÉQUILIBRÉ
    =================================
    */

    if (favoriteProbability < 45) {

        confidence -= 15;

    }

    if (favoriteProbability < 40) {

        confidence -= 10;

    }


    /*
    =================================
    11. PÉNALITÉ FAIBLE SÉPARATION
    =================================
    */

    if (separation < 5) {

        confidence -= 10;

    }
    else if (separation < 10) {

        confidence -= 5;

    }


    /*
    =================================
    12. PÉNALITÉ ÉQUIPES PROCHES
    =================================
    */

    if (strengthGap <= 4) {

        confidence -= 10;

    }
    else if (strengthGap <= 8) {

        confidence -= 5;

    }


    /*
    =================================
    13. PÉNALITÉ ELO ÉQUILIBRÉ
    =================================
    */

    if (
        eloProbability >= 0.46 &&
        eloProbability <= 0.54
    ) {

        confidence -= 10;

    }


    /*
    =================================
    14. PÉNALITÉ DONNÉES INSUFFISANTES
    =================================
    */

    if (minPlayed < 3) {

        confidence -= 20;

    }
    else if (minPlayed < 5) {

        confidence -= 12;

    }
    else if (minPlayed < 8) {

        confidence -= 5;

    }


    /*
    =================================
    15. LIMITES FINALES
    =================================
    */

    confidence = clamp(
        Math.round(confidence),
        20,
        85
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

        minPlayed,

        stability,

        reliability,

        strengthGap,

        formGap,

        modelAgreement,

        poissonRisk,

        confidence

    });


    return confidence;
}


module.exports = {
    calculateConfidence
};
