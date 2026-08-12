/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V23
 STRICT / ANTI-TRAP / VIP GATE
=========================================
*/

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}


function evaluateDecision({
    confidence = 0,
    poisson = {},
    homeStats = {},
    awayStats = {},
    eloProbability = 0.5,
    winner = "DRAW"
}) {

    const p = poisson.probabilities || {};

    const homeWin = Number(p.homeWin || 0);
    const draw = Number(p.draw || 0);
    const awayWin = Number(p.awayWin || 0);

    const probabilities = [
        homeWin,
        draw,
        awayWin
    ].sort((a, b) => b - a);

    const favorite = probabilities[0];
    const second = probabilities[1];

    const separation =
        favorite - second;

    const strengthGap =
        Math.abs(
            Number(homeStats.strength || 50) -
            Number(awayStats.strength || 50)
        );

    const reliability =
        (
            Number(homeStats.reliability ?? 0.5) +
            Number(awayStats.reliability ?? 0.5)
        ) / 2;

    const dominance =
        Number(poisson.dominance || 0);

    const uncertainty =
        Number(poisson.uncertainty || 100);

    const eloHome =
        Number(eloProbability || 0.5) * 100;

    const eloDifference =
        Math.abs(homeWin - eloHome);

    let trapScore = 0;
    const reasons = [];


    /* =================================
       1. TRAP DETECTION
    ================================= */

    if (favorite < 50) {
        trapScore += 40;
        reasons.push("No clear favorite");
    }

    if (separation < 5) {
        trapScore += 25;
        reasons.push("Very low separation");
    }
    else if (separation < 10) {
        trapScore += 12;
    }

    if (uncertainty >= 60) {
        trapScore += 30;
        reasons.push("Very high uncertainty");
    }
    else if (uncertainty >= 50) {
        trapScore += 20;
    }

    if (strengthGap <= 4) {
        trapScore += 20;
        reasons.push("Teams too close");
    }
    else if (strengthGap <= 8) {
        trapScore += 10;
    }

    if (
        eloProbability >= 0.46 &&
        eloProbability <= 0.54
    ) {
        trapScore += 20;
        reasons.push("Balanced ELO");
    }

    if (reliability < 0.60) {
        trapScore += 20;
        reasons.push("Low reliability");
    }

    if (confidence < 55) {
        trapScore += 20;
        reasons.push("Low confidence");
    }


    /* =================================
       2. MODEL CONFLICT
    ================================= */

    if (eloDifference >= 20) {
        trapScore += 20;
        reasons.push("Strong model disagreement");
    }
    else if (eloDifference >= 12) {
        trapScore += 10;
        reasons.push("Model disagreement");
    }


    /* =================================
       3. HARD TRAP
       
       Aucun calcul supplémentaire.
       Le match est simplement rejeté.
    ================================= */

    if (
        favorite < 50 ||
        uncertainty >= 60 ||
        separation < 5 ||
        trapScore >= 45
    ) {

        return {
            decision: "TRAP MATCH",
            risk: "VERY HIGH",
            score: 0,
            trapScore,
            reasons,
            winner
        };
    }


    /* =================================
       4. QUALITY SCORE
    ================================= */

    let score = 0;

    score +=
        clamp(favorite, 0, 100) * 0.35;

    score +=
        clamp(separation * 1.5, 0, 25) * 0.25;

    score +=
        clamp(confidence, 0, 100) * 0.20;

    score +=
        clamp(dominance * 1.5, 0, 20) * 0.10;

    score +=
        clamp(reliability * 100, 0, 100) * 0.10;


    /* =================================
       5. PENALTIES
    ================================= */

    if (uncertainty >= 50)
        score -= 15;

    if (strengthGap <= 8)
        score -= 10;

    if (eloDifference >= 12)
        score -= 10;


    score =
        clamp(
            Math.round(score),
            0,
            100
        );


    /* =================================
       6. VIP GATE
       
       Conditions volontairement strictes.
    ================================= */

    if (
        favorite >= 70 &&
        separation >= 15 &&
        confidence >= 70 &&
        dominance >= 20 &&
        uncertainty < 45 &&
        reliability >= 0.65 &&
        trapScore < 25 &&
        score >= 70
    ) {

        return {
            decision: "VIP PICK",
            risk: "LOW",
            score,
            trapScore,
            reasons,
            winner
        };
    }


    /* =================================
       7. NORMAL
    ================================= */

    if (
        favorite >= 60 &&
        separation >= 8 &&
        confidence >= 55 &&
        uncertainty < 55 &&
        trapScore < 35 &&
        score >= 50
    ) {

        return {
            decision: "NORMAL",
            risk: "MEDIUM",
            score,
            trapScore,
            reasons,
            winner
        };
    }


    /* =================================
       8. NO BET
    ================================= */

    return {
        decision: "NO BET",
        risk: "HIGH",
        score,
        trapScore,
        reasons,
        winner
    };
}


module.exports = {
    evaluateDecision
};
