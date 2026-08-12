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

    const values = [
        Number(probabilities?.homeWin || 0),
        Number(probabilities?.draw || 0),
        Number(probabilities?.awayWin || 0)
    ].sort((a, b) => b - a);

    const favorite = values[0];
    const second = values[1];
    const separation = favorite - second;

    const homePlayed = Number(homeStats?.played || 0);
    const awayPlayed = Number(awayStats?.played || 0);
    const minPlayed = Math.min(homePlayed, awayPlayed);

    const stability = (
        Number(homeStats?.stability ?? 50) +
        Number(awayStats?.stability ?? 50)
    ) / 2;

    const reliability = (
        Number(homeStats?.reliability ?? 0.5) +
        Number(awayStats?.reliability ?? 0.5)
    ) / 2;

    const strengthGap = Math.abs(
        Number(homeStats?.strength ?? 50) -
        Number(awayStats?.strength ?? 50)
    );

    let confidence = 0;

    /*
    FAVORI
    */
    confidence += favorite * 0.45;

    /*
    SÉPARATION
    */
    confidence += Math.min(separation * 2, 25);

    /*
    STABILITÉ
    */
    confidence += stability * 0.10;

    /*
    FIABILITÉ
    */
    confidence += reliability * 100 * 0.10;

    /*
    DONNÉES
    */
    confidence += Math.min(minPlayed, 8) * 1.5;

    /*
    FORCE
    */
    confidence += Math.min(strengthGap, 20) * 0.5;


    /*
    =========================
    PÉNALITÉS IMPORTANTES
    =========================
    */

    // Match pratiquement équilibré
    if (favorite < 40)
        confidence -= 30;

    else if (favorite < 45)
        confidence -= 20;

    // Séparation très faible
    if (separation < 3)
        confidence -= 30;

    else if (separation < 5)
        confidence -= 20;

    else if (separation < 8)
        confidence -= 10;

    // Équipes proches
    if (strengthGap <= 4)
        confidence -= 20;

    else if (strengthGap <= 8)
        confidence -= 10;


    /*
    =========================
    POISSON
    =========================
    */

    if (poisson) {

        const uncertainty =
            Number(poisson.uncertainty || 0);

        const dominance =
            Number(poisson.dominance || 0);

        if (uncertainty >= 60)
            confidence -= 30;

        else if (uncertainty >= 50)
            confidence -= 20;

        else if (uncertainty >= 40)
            confidence -= 10;

        if (dominance >= 30)
            confidence += 8;
    }


    /*
    =========================
    ELO
    =========================
    */

    if (
        typeof eloProbability === "number" &&
        eloProbability >= 0.45 &&
        eloProbability <= 0.55
    ) {
        confidence -= 15;
    }


    /*
    =========================
    LIMITE FINALE
    =========================
    */

    confidence = Math.round(
        clamp(confidence, 5, 95)
    );


    console.log("===== CONFIDENCE V21 =====");

    console.log({
        favorite,
        second,
        separation,
        minPlayed,
        stability,
        reliability,
        strengthGap,
        confidence
    });

    return confidence;
}
        

module.exports = {
    calculateConfidence
};
