/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V20
 CALIBRATED DECISION SYSTEM
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
        Number(confidence) || 0;

    const safeElo =
        Number(eloProbability);

    const safeHomeStrength =
        Number(homeStats?.strength) || 50;

    const safeAwayStrength =
        Number(awayStats?.strength) || 50;

    const safeHomeReliability =
        Number(homeStats?.reliability) || 0.5;

    const safeAwayReliability =
        Number(awayStats?.reliability) || 0.5;

    const safePoisson =
        poisson || {};

    const probabilities =
        safePoisson.probabilities || {};


    /*
    =================================
    FAVORITE PROBABILITY
    =================================
    */

    const homeWin =
        Number(probabilities.homeWin) || 0;

    const draw =
        Number(probabilities.draw) || 0;

    const awayWin =
        Number(probabilities.awayWin) || 0;

    const favoriteProbability =
        Math.max(
            homeWin,
            draw,
            awayWin
        );


    /*
    =================================
    STRENGTH GAP
    =================================
    */

    const strengthGap =
        Math.abs(
            safeHomeStrength -
            safeAwayStrength
        );


    /*
    =================================
    RELIABILITY
    =================================
    */

    const reliability =
        (
            safeHomeReliability +
            safeAwayReliability
        ) / 2;


    /*
    =================================
    1. CONFIDENCE
    =================================
    */

    if (safeConfidence >= 85) {

        score += 35;

        reasons.push(
            "Very high model confidence"
        );

    }

    else if (safeConfidence >= 75) {

        score += 30;

        reasons.push(
            "High model confidence"
        );

    }

    else if (safeConfidence >= 65) {

        score += 22;

        reasons.push(
            "Good model confidence"
        );

    }

    else if (safeConfidence >= 55) {

        score += 12;

        reasons.push(
            "Moderate model confidence"
        );

    }

    else {

        score += 0;

        reasons.push(
            "Low model confidence"
        );

    }


    /*
    =================================
    2. POISSON
    =================================
    */

    const poissonDominance =
        Number(
            safePoisson.dominance
        ) || 0;

    const poissonUncertainty =
        Number(
            safePoisson.uncertainty
        ) || 0;


    if (poissonDominance >= 35) {

        score += 30;

        reasons.push(
            "Strong Poisson dominance"
        );

    }

    else if (poissonDominance >= 25) {

        score += 22;

        reasons.push(
            "Good Poisson dominance"
        );

    }

    else if (poissonDominance >= 15) {

        score += 12;

        reasons.push(
            "Moderate Poisson dominance"
        );

    }

    else {

        score -= 5;

        reasons.push(
            "Weak Poisson dominance"
        );

    }


    /*
    =================================
    3. TEAM STRENGTH
    =================================
    */

    if (strengthGap >= 20) {

        score += 15;

        reasons.push(
            "Large team strength difference"
        );

    }

    else if (strengthGap >= 12) {

        score += 10;

        reasons.push(
            "Clear team strength difference"
        );

    }

    else if (strengthGap >= 7) {

        score += 5;

    }

    else {

        reasons.push(
            "Teams have similar strength"
        );

    }


    /*
    =================================
    4. RELIABILITY
    =================================
    */

    if (reliability >= 0.80) {

        score += 10;

        reasons.push(
            "Very reliable data"
        );

    }

    else if (reliability >= 0.70) {

        score += 7;

        reasons.push(
            "Reliable data"
        );

    }

    else if (reliability >= 0.60) {

        score += 3;

    }

    else {

        score -= 5;

        reasons.push(
            "Low reliability"
        );

    }


    /*
    =================================
    5. ELO
    =================================
    */

    if (Number.isFinite(safeElo)) {

        if (
            safeElo >= 0.65 ||
            safeElo <= 0.35
        ) {

            score += 12;

            reasons.push(
                "Strong ELO advantage"
            );

        }

        else if (
            safeElo >= 0.60 ||
            safeElo <= 0.40
        ) {

            score += 8;

            reasons.push(
                "ELO advantage confirmed"
            );

        }

        else if (
            safeElo >= 0.55 ||
            safeElo <= 0.45
        ) {

            score += 3;

        }

        else {

            reasons.push(
                "Balanced ELO"
            );

        }

    }


    /*
    =================================
    6. FAVORITE PROBABILITY
    =================================
    */

    if (favoriteProbability >= 75) {

        score += 15;

        reasons.push(
            "Strong statistical favorite"
        );

    }

    else if (favoriteProbability >= 70) {

        score += 12;

        reasons.push(
            "Clear statistical favorite"
        );

    }

    else if (favoriteProbability >= 65) {

        score += 8;

    }

    else if (favoriteProbability >= 60) {

        score += 4;

    }

    else {

        score -= 8;

        reasons.push(
            "No clear favorite"
        );

    }


    /*
    =================================
    TRAP MATCH DETECTOR
    =================================
    */


    /*
    Teams too close
    */

    if (strengthGap <= 4) {

        trapScore += 15;

        reasons.push(
            "Very similar team strength"
        );

    }

    else if (strengthGap <= 8) {

        trapScore += 8;

    }


    /*
    ELO too close
    */

    if (Number.isFinite(safeElo)) {

        if (
            safeElo > 0.47 &&
            safeElo < 0.53
        ) {

            trapScore += 20;

            reasons.push(
                "Very balanced ELO"
            );

        }

        else if (
            safeElo > 0.44 &&
            safeElo < 0.56
        ) {

            trapScore += 8;

        }

    }


    /*
    Poisson uncertainty
    */

    if (poissonUncertainty >= 55) {

        trapScore += 20;

        reasons.push(
            "Very high Poisson uncertainty"
        );

    }

    else if (poissonUncertainty >= 45) {

        trapScore += 10;

        reasons.push(
            "High Poisson uncertainty"
        );

    }


    /*
    Low reliability
    */

    if (reliability < 0.60) {

        trapScore += 20;

    }

    else if (reliability < 0.65) {

        trapScore += 8;

    }


    /*
    Low confidence
    */

    if (safeConfidence < 55) {

        trapScore += 15;

    }

    else if (safeConfidence < 60) {

        trapScore += 8;

    }


    /*
    =================================
    FORM CHECK
    =================================
    */

    const homeForm =
        Number(homeStats?.formScore);

    const awayForm =
        Number(awayStats?.formScore);


    if (
        Number.isFinite(homeForm) &&
        Number.isFinite(awayForm)
    ) {

        const formGap =
            Math.abs(
                homeForm -
                awayForm
            );

        if (formGap <= 5) {

            trapScore += 10;

            reasons.push(
                "Similar recent form"
            );

        }

    }


    /*
    =================================
    DRAW TENDENCY
    =================================
    */

    const homeDraws =
        Number(homeStats?.draws) || 0;

    const awayDraws =
        Number(awayStats?.draws) || 0;


    if (
        homeDraws >= 3 ||
        awayDraws >= 3
    ) {

        trapScore += 10;

        reasons.push(
            "Draw tendency detected"
        );

    }


    /*
    =================================
    OPEN GAME
    =================================
    */

    const btts =
        Number(safePoisson.btts) || 0;

    const over25 =
        Number(safePoisson.over25) || 0;


    if (
        btts > 65 &&
        over25 > 65
    ) {

        trapScore += 10;

        reasons.push(
            "Open game profile"
        );

    }


    /*
    =================================
    PENALTY FOR TRAP MATCH
    =================================
    */

    score -=
        trapScore * 0.25;


    /*
    =================================
    ADDITIONAL CONSISTENCY CHECK
    =================================
    */

    let modelAgreement = true;


    if (Number.isFinite(safeElo)) {

        /*
        ELO favors home
        */

        if (
            safeElo >= 0.60 &&
            homeWin < awayWin
        ) {

            modelAgreement = false;

        }


        /*
        ELO favors away
        */

        if (
            safeElo <= 0.40 &&
            awayWin < homeWin
        ) {

            modelAgreement = false;

        }

    }


    if (!modelAgreement) {

        trapScore += 15;

        score -= 8;

        reasons.push(
            "ELO and Poisson disagreement"
        );

    }


    /*
    =================================
    FINAL SCORE
    =================================
    */

    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


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

    if (trapScore >= 45) {

        decision =
            "TRAP MATCH";

        risk =
            "VERY HIGH";

    }


    /*
    FAVORITE TOO WEAK
    */

    else if (
        favoriteProbability < 55
    ) {

        decision =
            "NO BET";

        risk =
            "HIGH";

    }


    /*
    VIP PICK
    */

    else if (
        favoriteProbability >= 70 &&
        safeConfidence >= 72 &&
        score >= 72 &&
        trapScore < 25 &&
        modelAgreement
    ) {

        decision =
            "VIP PICK";

        risk =
            "LOW";

    }


    /*
    NORMAL PICK
    */

    else if (
        favoriteProbability >= 65 &&
        safeConfidence >= 62 &&
        score >= 58 &&
        trapScore < 35
    ) {

        decision =
            "NORMAL";

        risk =
            "MEDIUM";

    }


    /*
    WEAKER NORMAL
    */

    else if (
        favoriteProbability >= 60 &&
        safeConfidence >= 58 &&
        score >= 52 &&
        trapScore < 30
    ) {

        decision =
            "NORMAL";

        risk =
            "MEDIUM";

    }


    /*
    EVERYTHING ELSE
    */

    else {

        decision =
            "NO BET";

        risk =
            "HIGH";

    }


    /*
    =================================
    DEBUG
    =================================
    */

    console.log(
        "===== DECISION V20 ====="
    );

    console.log({

        confidence:
            safeConfidence,

        favoriteProbability,

        trapScore,

        score,

        decision,

        risk,

        homeWin,

        draw,

        awayWin,

        poissonDominance,

        poissonUncertainty,

        eloProbability:
            safeElo,

        modelAgreement

    });


    /*
    =================================
    RETURN
    =================================
    */

    return {

        decision,

        risk,

        score:
            Math.round(score),

        trapScore,

        reasons,

        winner

    };

}


/*
=========================================
 EXPORT
=========================================
*/

module.exports = {

    evaluateDecision

};
