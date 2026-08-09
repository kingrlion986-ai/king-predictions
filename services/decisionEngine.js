/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V22
 CALIBRATED
=========================================
*/

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
    SAFE VALUES
    =================================
    */

    const safeConfidence =
        Number(confidence || 0);

    const safePoisson =
        poisson || {};

    const safeHomeStats =
        homeStats || {};

    const safeAwayStats =
        awayStats || {};


    const homeWin =
        Number(safePoisson.probabilities?.homeWin || 0);

    const draw =
        Number(safePoisson.probabilities?.draw || 0);

    const awayWin =
        Number(safePoisson.probabilities?.awayWin || 0);


    const favoriteProbability =
        Math.max(
            homeWin,
            draw,
            awayWin
        );


    const separation =
        [...[homeWin, draw, awayWin]]
            .sort((a, b) => b - a)
            .slice(0, 2)
            .reduce(
                (difference, value, index, array) =>
                    index === 0
                        ? value
                        : array[0] - value,
                0
            );


    const strengthGap =
        Math.abs(
            Number(safeHomeStats.strength || 50) -
            Number(safeAwayStats.strength || 50)
        );


    const reliability =
        (
            Number(safeHomeStats.reliability || 0.5) +
            Number(safeAwayStats.reliability || 0.5)
        ) / 2;


    const poissonDominance =
        Number(
            safePoisson.dominance || 0
        );


    const poissonUncertainty =
        Number(
            safePoisson.uncertainty || 0
        );


    /*
    =================================
    BASE SCORE
    =================================
    */

    score =
        safeConfidence * 0.70;


    /*
    =================================
    FAVORITE
    =================================
    */

    if (favoriteProbability >= 70) {

        score += 20;

        reasons.push(
            "Strong probability"
        );

    }
    else if (favoriteProbability >= 65) {

        score += 12;

        reasons.push(
            "Good probability"
        );

    }
    else if (favoriteProbability >= 60) {

        score += 6;

    }
    else {

        score -= 15;

        reasons.push(
            "Weak favorite"
        );

    }


    /*
    =================================
    POISSON
    =================================
    */

    if (poissonDominance >= 35) {

        score += 12;

        reasons.push(
            "Strong Poisson"
        );

    }
    else if (poissonDominance >= 25) {

        score += 8;

    }
    else if (poissonDominance >= 15) {

        score += 4;

    }
    else {

        score -= 8;

        reasons.push(
            "Weak Poisson separation"
        );

    }


    /*
    =================================
    TEAM GAP
    =================================
    */

    if (strengthGap >= 20) {

        score += 10;

    }
    else if (strengthGap >= 10) {

        score += 5;

    }
    else if (strengthGap <= 4) {

        score -= 8;

        reasons.push(
            "Teams very close"
        );

    }


    /*
    =================================
    ELO
    =================================
    */

    const elo =
        typeof eloProbability === "number"
            ? (
                eloProbability > 1
                    ? eloProbability / 100
                    : eloProbability
            )
            : 0.5;


    const eloDistance =
        Math.abs(elo - 0.5);


    if (eloDistance >= 0.15) {

        score += 8;

    }
    else if (eloDistance >= 0.08) {

        score += 4;

    }
    else if (eloDistance < 0.04) {

        score -= 8;

        reasons.push(
            "Balanced Elo"
        );

    }


    /*
    =================================
    TRAP DETECTOR
    =================================
    */

    if (strengthGap <= 4) {

        trapScore += 25;

    }
    else if (strengthGap <= 8) {

        trapScore += 10;

    }


    if (Math.abs(elo - 0.5) < 0.04) {

        trapScore += 25;

        reasons.push(
            "ELO almost equal"
        );

    }


    if (favoriteProbability < 50) {

        trapScore += 25;

        reasons.push(
            "No real favorite"
        );

    }
    else if (favoriteProbability < 55) {

        trapScore += 15;

    }


    if (separation < 8) {

        trapScore += 15;

        reasons.push(
            "Very small probability gap"
        );

    }
    else if (separation < 12) {

        trapScore += 8;

    }


    if (poissonUncertainty >= 60) {

        trapScore += 20;

        reasons.push(
            "High Poisson uncertainty"
        );

    }
    else if (poissonUncertainty >= 50) {

        trapScore += 12;

    }
    else if (poissonUncertainty >= 40) {

        trapScore += 6;

    }


    if (reliability < 0.60) {

        trapScore += 15;

        reasons.push(
            "Low reliability"
        );

    }


    if (safeConfidence < 45) {

        trapScore += 15;

        reasons.push(
            "Low confidence"
        );

    }


    /*
    =================================
    SCORE PENALTY
    =================================
    */

    score -=
        trapScore * 0.30;


    /*
    =================================
    FINAL DECISION
    =================================
    */

    let decision =
        "NO BET";

    let risk =
        "HIGH";


    /*
    ABSOLUTE TRAP
    */

    if (
        trapScore >= 60 ||
        favoriteProbability < 50
    ) {

        decision =
            "TRAP MATCH";

        risk =
            "VERY HIGH";

    }


    /*
    VIP
    */

    else if (
        trapScore < 30 &&
        favoriteProbability >= 70 &&
        safeConfidence >= 70 &&
        score >= 70
    ) {

        decision =
            "VIP PICK";

        risk =
            "LOW";

    }


    /*
    NORMAL
    */

    else if (
        trapScore < 45 &&
        favoriteProbability >= 65 &&
        safeConfidence >= 60 &&
        score >= 55
    ) {

        decision =
            "NORMAL";

        risk =
            "MEDIUM";

    }


    /*
    NO BET
    */

    else {

        decision =
            "NO BET";

        risk =
            "HIGH";

    }


    /*
    =================================
    FINAL SCORE
    =================================
    */

    score =
        Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    score
                )
            )
        );


    /*
    =================================
    DEBUG
    =================================
    */

    console.log(
        "===== DECISION V22 ====="
    );

    console.log({

        confidence:
            safeConfidence,

        homeWin,

        draw,

        awayWin,

        favoriteProbability,

        separation,

        strengthGap,

        reliability,

        trapScore,

        score,

        poissonDominance,

        poissonUncertainty,

        eloProbability,

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
