/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V24
 CALIBRATED / STRICT / ANTI-OVERCONFIDENCE
=========================================
*/

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function calculateConfidence({
    probabilities = {},
    homeStats = {},
    awayStats = {},
    eloProbability = 0.5,
    poisson = null
}) {

    /* =================================
       1. PROBABILITÉS
    ================================= */

    const home = clamp(num(probabilities.homeWin), 0, 100);
    const draw = clamp(num(probabilities.draw), 0, 100);
    const away = clamp(num(probabilities.awayWin), 0, 100);

    const probs = [home, draw, away]
        .sort((a, b) => b - a);

    const favorite = probs[0];
    const second = probs[1];

    const separation =
        favorite - second;


    /* =================================
       2. DONNÉES
    ================================= */

    const played =
        Math.min(
            num(homeStats.played),
            num(awayStats.played)
        );

    /*
     * 8 matchs = données correctes,
     * mais on ne transforme jamais cela
     * directement en grosse confiance.
     */

    const dataQuality =
        clamp(
            played / 10 * 100,
            0,
            100
        );


    /* =================================
       3. FIABILITÉ
    ================================= */

    const reliability =
        clamp(
            (
                num(homeStats.reliability, 0.5) +
                num(awayStats.reliability, 0.5)
            ) / 2,
            0,
            1
        );

    const reliabilityScore =
        reliability * 100;


    /* =================================
       4. FORCE DES ÉQUIPES
    ================================= */

    const strengthGap =
        Math.abs(
            num(homeStats.strength, 50) -
            num(awayStats.strength, 50)
        );


    /* =================================
       5. ELO
    ================================= */

    const eloHome =
        clamp(
            num(eloProbability, 0.5) * 100,
            0,
            100
        );

    /*
     * IMPORTANT :
     * on compare uniquement l'orientation
     * du modèle à l'ELO.
     */

    const eloAgreement =
        clamp(
            100 -
            Math.abs(favorite - eloHome) * 1.5,
            0,
            100
        );


    /* =================================
       6. POISSON
    ================================= */

    const uncertainty =
        clamp(
            num(poisson?.uncertainty, 50),
            0,
            100
        );

    const dominance =
        clamp(
            num(poisson?.dominance, separation),
            0,
            100
        );


    /* =================================
       7. SCORE DE BASE
       
       La probabilité favorite n'a plus
       autant de poids.
    ================================= */

    let confidence =
        favorite * 0.35 +
        separation * 0.25 +
        eloAgreement * 0.10 +
        dataQuality * 0.10 +
        reliabilityScore * 0.10 +
        dominance * 0.10;


    /* =================================
       8. PÉNALITÉS
    ================================= */

    /*
     * Match serré
     */

    if (separation < 5)
        confidence -= 20;

    else if (separation < 8)
        confidence -= 12;

    else if (separation < 12)
        confidence -= 5;


    /*
     * Incertitude
     */

    if (uncertainty >= 60)
        confidence -= 25;

    else if (uncertainty >= 50)
        confidence -= 15;

    else if (uncertainty >= 40)
        confidence -= 8;


    /*
     * Équipes proches
     */

    if (strengthGap <= 4)
        confidence -= 15;

    else if (strengthGap <= 8)
        confidence -= 8;


    /*
     * Fiabilité faible
     */

    if (reliability < 0.50)
        confidence -= 18;

    else if (reliability < 0.60)
        confidence -= 10;

    else if (reliability < 0.70)
        confidence -= 5;


    /*
     * Peu de données
     */

    if (played < 5)
        confidence -= 20;

    else if (played < 8)
        confidence -= 8;


    /* =================================
       9. CAPS STRICTS
       
       Même si le calcul produit 80+,
       le moteur ne doit pas mentir.
    ================================= */

    let cap = 80;


    if (favorite < 50)
        cap = 45;

    else if (favorite < 55)
        cap = 52;

    else if (favorite < 60)
        cap = 60;

    else if (favorite < 65)
        cap = 68;

    else if (favorite < 70)
        cap = 74;

    else if (favorite < 75)
        cap = 78;


    /*
     * Séparation faible
     */

    if (separation < 5)
        cap = Math.min(cap, 45);

    else if (separation < 8)
        cap = Math.min(cap, 55);

    else if (separation < 12)
        cap = Math.min(cap, 65);


    /*
     * Incertitude élevée
     */

    if (uncertainty >= 60)
        cap = Math.min(cap, 40);

    else if (uncertainty >= 50)
        cap = Math.min(cap, 52);


    /*
     * Fiabilité faible
     */

    if (reliability < 0.50)
        cap = Math.min(cap, 45);

    else if (reliability < 0.60)
        cap = Math.min(cap, 55);


    /* =================================
       10. CONFIANCE FINALE
    ================================= */

    confidence =
        clamp(
            Math.round(
                Math.min(confidence, cap)
            ),
            5,
            80
        );


    /* =================================
       11. DEBUG
    ================================= */

    console.log(
        "===== CONFIDENCE ENGINE V24 =====",
        {
            favorite,
            second,
            separation,
            played,
            dataQuality,
            reliability,
            strengthGap,
            eloHome,
            eloAgreement,
            dominance,
            uncertainty,
            cap,
            confidence
        }
    );


    return confidence;
}


module.exports = {
    calculateConfidence
};
