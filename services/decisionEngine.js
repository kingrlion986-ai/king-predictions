/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V22
 CALIBRATED / ANTI-TRAP
=========================================
*/

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function evaluateDecision({

    confidence,
    poisson,
    homeStats,
    awayStats,
    eloProbability,
    winner

}) {

    let score = 0;

    let reasons = [];

    let trapScore = 0;


    /*
    =================================
    VARIABLES DE BASE
    =================================
    */

    const homeWin =
        Number(poisson?.probabilities?.homeWin || 0);

    const draw =
        Number(poisson?.probabilities?.draw || 0);

    const awayWin =
        Number(poisson?.probabilities?.awayWin || 0);

    const favoriteProbability =
        Math.max(
            homeWin,
            draw,
            awayWin
        );

    const sorted = [
        homeWin,
        draw,
        awayWin
    ].sort((a, b) => b - a);

    const separation =
        sorted[0] - sorted[1];


    const strengthGap =
        Math.abs(
            Number(homeStats?.strength || 50) -
            Number(awayStats?.strength || 50)
        );


    const reliability =
        (
            Number(homeStats?.reliability ?? 0.5) +
            Number(awayStats?.reliability ?? 0.5)
        ) / 2;


    const poissonDominance =
        Number(poisson?.dominance || 0);

    const poissonUncertainty =
        Number(poisson?.uncertainty || 0);


    /*
    =================================
    1. PROBABILITÉ
    =================================
    */

    if (favoriteProbability >= 75) {

        score += 35;
        reasons.push("Very strong probability");

    }
    else if (favoriteProbability >= 70) {

        score += 30;
        reasons.push("Strong probability");

    }
    else if (favoriteProbability >= 65) {

        score += 22;

    }
    else if (favoriteProbability >= 60) {

        score += 12;

    }
    else {

        score -= 20;
        reasons.push("Weak favorite");

    }


    /*
    =================================
    2. SÉPARATION
    =================================
    */

    if (separation >= 20) {

        score += 15;

    }
    else if (separation >= 12) {

        score += 8;

    }
    else if (separation < 6) {

        score -= 15;

        reasons.push(
            "Very small probability separation"
        );

    }


    /*
    =================================
    3. POISSON
    =================================
    */

    if (poissonDominance >= 30) {

        score += 15;

    }
    else if (poissonDominance >= 20) {

        score += 8;

    }
    else if (poissonDominance < 10) {

        score -= 10;

        reasons.push(
            "Weak Poisson dominance"
        );

    }


    /*
    =================================
    4. INCERTITUDE
    =================================
    */

    if (poissonUncertainty >= 55) {

        trapScore += 30;

        reasons.push(
            "Very high Poisson uncertainty"
        );

    }
    else if (poissonUncertainty >= 45) {

        trapScore += 20;

    }
    else if (poissonUncertainty >= 35) {

        trapScore += 10;

    }


    /*
    =================================
    5. ÉQUIPES PROCHES
    =================================
    */

    if (strengthGap <= 4) {

        trapScore += 20;

        reasons.push(
            "Teams almost equal"
        );

    }
    else if (strengthGap <= 8) {

        trapScore += 10;

    }


    /*
    =================================
    6. ELO
    =================================
    */

    if (
        eloProbability >= 0.46 &&
        eloProbability <= 0.54
    ) {

        trapScore += 20;

        reasons.push(
            "Balanced ELO"
        );

    }
    else if (
        eloProbability >= 0.60 ||
        eloProbability <= 0.40
    ) {

        score += 8;

        reasons.push(
            "ELO advantage"
        );

    }


    /*
    =================================
    7. FIABILITÉ
    =================================
    */

    if (reliability >= 0.75) {

        score += 8;

    }
    else if (reliability < 0.60) {

        trapScore += 20;

        reasons.push(
            "Low reliability"
        );

    }


    /*
    =================================
    8. CONFIDENCE
    =================================
    */

    if (confidence >= 75) {

        score += 15;

    }
    else if (confidence >= 65) {

        score += 10;

    }
    else if (confidence >= 55) {

        score += 5;

    }
    else {

        score -= 15;

        reasons.push(
            "Low confidence"
        );

    }


    /*
    =================================
    9. CONFLIT MODÈLES
    =================================
    */

    const eloHome =
        eloProbability * 100;

    if (
        Math.abs(
            homeWin - eloHome
        ) >= 15
    ) {

        trapScore += 15;

        reasons.push(
            "Model disagreement"
        );

    }


    /*
    =================================
    10. SCORE FINAL
    =================================
    */

    score -= trapScore * 0.35;

    score = clamp(
        Math.round(score),
        0,
        100
    );


    /*
    =================================
    11. DECISION
    =================================
    */

    let decision = "NO BET";
    let risk = "HIGH";


    /*
    DANGER ABSOLU
    */

    if (
        trapScore >= 45 ||
        favoriteProbability < 50
    ) {

        decision = "TRAP MATCH";
        risk = "VERY HIGH";

    }

    /*
    VIP
    */

    else if (
        favoriteProbability >= 70 &&
        confidence >= 70 &&
        score >= 70 &&
        trapScore < 25 &&
        poissonDominance >= 20
    ) {

        decision = "VIP PICK";
        risk = "LOW";

    }

    /*
    NORMAL
    */

    else if (
        favoriteProbability >= 62 &&
        confidence >= 60 &&
        score >= 55 &&
        trapScore < 35
    ) {

        decision = "NORMAL";
        risk = "MEDIUM";

    }


    /*
    =================================
    DEBUG
    =================================
    */

    console.log("===== DECISION V22 =====");

    console.log({

        confidence,

        homeWin,
        draw,
        awayWin,

        favoriteProbability,

        separation,

        strengthGap,

        reliability,

        poissonDominance,

        poissonUncertainty,

        trapScore,

        score,

        decision,

        risk

    });


    return {

        decision,

        risk,

        score,

        trapScore,

        reasons,

        winner

    };

}


module.exports = {
    evaluateDecision
};
