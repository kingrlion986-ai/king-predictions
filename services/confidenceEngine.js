/* =========================
   CONFIDENCE ENGINE V20
   CALIBRATED CONFIDENCE
========================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function calculateConfidence({

    probabilities,
    homeStats,
    awayStats,
    eloProbability

}) {

    /*
    =================================
    1. PROBABILITÉS POISSON
    =================================
    */

    const homeWin = Number(probabilities.homeWin || 0);
    const draw = Number(probabilities.draw || 0);
    const awayWin = Number(probabilities.awayWin || 0);

    const values = [
        homeWin,
        draw,
        awayWin
    ].sort((a, b) => b - a);

    const favoriteProbability = values[0];
    const secondProbability = values[1];

    const separation =
        favoriteProbability - secondProbability;


    /*
    =================================
    2. BASE DE CONFIANCE
    =================================

    La probabilité est maintenant
    la source principale.
    */

    let confidence = 20;

    if (favoriteProbability >= 80) {
        confidence = 78;
    }
    else if (favoriteProbability >= 75) {
        confidence = 73;
    }
    else if (favoriteProbability >= 70) {
        confidence = 68;
    }
    else if (favoriteProbability >= 65) {
        confidence = 62;
    }
    else if (favoriteProbability >= 60) {
        confidence = 56;
    }
    else if (favoriteProbability >= 55) {
        confidence = 49;
    }
    else {
        confidence = 42;
    }


    /*
    =================================
    3. SÉPARATION
    =================================
    */

    if (separation >= 25) {
        confidence += 7;
    }
    else if (separation >= 18) {
        confidence += 5;
    }
    else if (separation >= 12) {
        confidence += 3;
    }
    else if (separation < 6) {
        confidence -= 8;
    }


    /*
    =================================
    4. QUALITÉ DES DONNÉES
    =================================
    */

    const homePlayed =
        Number(homeStats.played || 0);

    const awayPlayed =
        Number(awayStats.played || 0);

    const minPlayed =
        Math.min(homePlayed, awayPlayed);


    if (minPlayed >= 8) {
        confidence += 4;
    }
    else if (minPlayed >= 6) {
        confidence += 2;
    }
    else if (minPlayed < 5) {
        confidence -= 6;
    }
    else if (minPlayed < 3) {
        confidence -= 12;
    }


    /*
    =================================
    5. FIABILITÉ
    =================================
    */

    const reliability =
        (
            Number(homeStats.reliability || 0.5) +
            Number(awayStats.reliability || 0.5)
        ) / 2;


    if (reliability >= 0.80) {
        confidence += 4;
    }
    else if (reliability >= 0.70) {
        confidence += 2;
    }
    else if (reliability < 0.60) {
        confidence -= 5;
    }


    /*
    =================================
    6. STABILITÉ
    =================================
    */

    const stability =
        (
            Number(homeStats.stability || 50) +
            Number(awayStats.stability || 50)
        ) / 2;


    if (stability >= 75) {
        confidence += 3;
    }
    else if (stability < 55) {
        confidence -= 4;
    }


    /*
    =================================
    7. ACCORD ELO / POISSON
    =================================
    */

    if (
        typeof eloProbability === "number" &&
        Number.isFinite(eloProbability)
    ) {

        /*
        eloProbability est supposé être
        compris entre 0 et 1.
        */

        const poissonHome =
            homeWin / 100;

        const eloDifference =
            Math.abs(
                poissonHome -
                eloProbability
            );

        if (eloDifference <= 0.05) {

            confidence += 5;

        }
        else if (eloDifference <= 0.10) {

            confidence += 2;

        }
        else if (eloDifference >= 0.20) {

            confidence -= 8;

        }
        else if (eloDifference >= 0.15) {

            confidence -= 5;

        }

    }


    /*
    =================================
    8. MATCH ÉQUILIBRÉ
    =================================
    */

    if (favoriteProbability < 55) {

        confidence -= 8;

    }

    if (favoriteProbability < 52) {

        confidence -= 8;

    }


    /*
    =================================
    9. LIMITE DE SÉCURITÉ
    =================================
    */

    confidence =
        clamp(
            confidence,
            30,
            85
        );


    /*
    =================================
    10. PROTECTION CRITIQUE
    =================================

    Impossible d'avoir 80%+
    avec un favori inférieur à 60%.
    */

    if (favoriteProbability < 60) {

        confidence =
            Math.min(
                confidence,
                59
            );

    }

    if (favoriteProbability < 55) {

        confidence =
            Math.min(
                confidence,
                52
            );

    }


    return Math.round(confidence);

}


module.exports = {
    calculateConfidence
};
