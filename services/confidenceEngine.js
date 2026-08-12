/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V23
 STRICT / CALIBRATED / ANTI-OVERCONFIDENCE
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

    /* =========================
       PROBABILITIES
    ========================= */

    const probs = [
        num(probabilities.homeWin),
        num(probabilities.draw),
        num(probabilities.awayWin)
    ].sort((a, b) => b - a);

    const favorite = probs[0];
    const second = probs[1];

    const separation =
        favorite - second;


    /* =========================
       DATA
    ========================= */

    const played =
        Math.min(
            num(homeStats.played),
            num(awayStats.played)
        );

    const dataQuality =
        clamp(
            played / 8 * 100,
            0,
            100
        );


    /* =========================
       RELIABILITY
    ========================= */

    const reliability =
        (
            num(homeStats.reliability, 0.5) +
            num(awayStats.reliability, 0.5)
        ) / 2;

    const reliabilityScore =
        reliability * 100;


    /* =========================
       STRENGTH
    ========================= */

    const strengthGap =
        Math.abs(
            num(homeStats.strength, 50) -
            num(awayStats.strength, 50)
        );


    /* =========================
       ELO AGREEMENT
    ========================= */

    const eloHome =
        clamp(
            num(eloProbability, 0.5) * 100,
            0,
            100
        );

    const eloAgreement =
        clamp(
            100 -
            Math.abs(favorite - eloHome) * 2,
            0,
            100
        );


    /* =========================
       POISSON
    ========================= */

    const uncertainty =
        num(poisson?.uncertainty, 50);

    const dominance =
        num(poisson?.dominance, separation);


    /* =========================
       BASE SCORE
    ========================= */

    let confidence =
        favorite * 0.45 +
        separation * 0.25 +
        eloAgreement * 0.10 +
        dataQuality * 0.08 +
        reliabilityScore * 0.07 +
        dominance * 0.05;


    /* =========================
       RISK PENALTIES
    ========================= */

    if (uncertainty >= 60)
        confidence -= 20;

    else if (uncertainty >= 50)
        confidence -= 12;

    else if (uncertainty >= 40)
        confidence -= 6;


    if (separation < 5)
        confidence -= 15;

    else if (separation < 8)
        confidence -= 8;


    if (strengthGap <= 4)
        confidence -= 10;

    else if (strengthGap <= 8)
        confidence -= 5;


    if (reliability < 0.60)
        confidence -= 10;


    if (played < 5)
        confidence -= 12;

    else if (played < 8)
        confidence -= 5;


    /* =========================
       HARD CAPS
    ========================= */

    let cap = 85;

    if (favorite < 45)
        cap = 35;

    else if (favorite < 50)
        cap = 45;

    else if (favorite < 55)
        cap = 55;

    else if (favorite < 60)
        cap = 65;

    else if (favorite < 65)
        cap = 72;

    else if (favorite < 70)
        cap = 78;


    if (separation < 5)
        cap = Math.min(cap, 45);

    if (uncertainty >= 60)
        cap = Math.min(cap, 40);

    if (reliability < 0.60)
        cap = Math.min(cap, 60);


    confidence =
        clamp(
            Math.round(
                Math.min(confidence, cap)
            ),
            5,
            85
        );


    /* =========================
       DEBUG
    ========================= */

    console.log(
        "===== CONFIDENCE V23 =====",
        {
            favorite,
            second,
            separation,
            played,
            dataQuality,
            reliability,
            strengthGap,
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
