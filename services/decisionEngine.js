/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V24
 STRICT GATE / ANTI-TRAP
 NO WEAK PICKS
=========================================
*/

function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, num(v)));
}


/*
=================================================
 MAIN DECISION
=================================================
*/

function evaluateDecision({
    confidence = 0,
    poisson = {},
    homeStats = {},
    awayStats = {},
    eloProbability = 0.5,
    winner = "DRAW"
}) {

    const p = poisson.probabilities || {};

    const homeWin = num(p.homeWin);
    const draw = num(p.draw);
    const awayWin = num(p.awayWin);

    const ordered = [
        homeWin,
        draw,
        awayWin
    ].sort((a, b) => b - a);

    const favorite = ordered[0];
    const second = ordered[1];

    const separation =
        favorite - second;


    /*
    =================================================
    DATA
    =================================================
    */

    const homeStrength =
        num(homeStats.strength, 50);

    const awayStrength =
        num(awayStats.strength, 50);

    const strengthGap =
        Math.abs(
            homeStrength - awayStrength
        );

    const reliability =
        (
            num(homeStats.reliability, 0.5) +
            num(awayStats.reliability, 0.5)
        ) / 2;

    const uncertainty =
        num(poisson.uncertainty, 100);

    const dominance =
        num(poisson.dominance, 0);

    const eloHome =
        clamp(
            num(eloProbability, 0.5) * 100,
            0,
            100
        );


    /*
    =================================================
    MODEL AGREEMENT
    =================================================
    */

    let modelAgreement = 100;

    /*
     * Si le favori Poisson est différent
     * du signal ELO, on pénalise.
     */

    const eloDistance =
        Math.abs(
            favorite - eloHome
        );

    if (eloDistance >= 20)
        modelAgreement = 0;

    else if (eloDistance >= 15)
        modelAgreement = 30;

    else if (eloDistance >= 10)
        modelAgreement = 60;

    else if (eloDistance >= 5)
        modelAgreement = 80;


    /*
    =================================================
    TRAP SCORE
    =================================================
    */

    let trapScore = 0;
    const reasons = [];


    /*
    FAVORI FAIBLE
    */

    if (favorite < 50) {

        trapScore += 50;

        reasons.push(
            "No real favorite"
        );
    }

    else if (favorite < 55) {

        trapScore += 30;

        reasons.push(
            "Weak favorite"
        );
    }


    /*
    SEPARATION
    */

    if (separation < 5) {

        trapScore += 35;

        reasons.push(
            "Very low separation"
        );

    }

    else if (separation < 8) {

        trapScore += 20;

        reasons.push(
            "Low separation"
        );

    }

    else if (separation < 12) {

        trapScore += 8;
    }


    /*
    INCERTITUDE
    */

    if (uncertainty >= 60) {

        trapScore += 35;

        reasons.push(
            "Very high uncertainty"
        );

    }

    else if (uncertainty >= 50) {

        trapScore += 20;

        reasons.push(
            "High uncertainty"
        );

    }

    else if (uncertainty >= 45) {

        trapScore += 10;
    }


    /*
    ÉQUILIBRE DES ÉQUIPES
    */

    if (strengthGap <= 4) {

        trapScore += 25;

        reasons.push(
            "Teams too close"
        );

    }

    else if (strengthGap <= 8) {

        trapScore += 12;

        reasons.push(
            "Small strength gap"
        );
    }


    /*
    ELO ÉQUILIBRÉ
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


    /*
    FIABILITÉ
    */

    if (reliability < 0.55) {

        trapScore += 30;

        reasons.push(
            "Very low reliability"
        );

    }

    else if (reliability < 0.60) {

        trapScore += 20;

        reasons.push(
            "Low reliability"
        );

    }

    else if (reliability < 0.65) {

        trapScore += 8;
    }


    /*
    CONFIANCE
    */

    if (confidence < 50) {

        trapScore += 30;

        reasons.push(
            "Very low confidence"
        );

    }

    else if (confidence < 55) {

        trapScore += 20;

        reasons.push(
            "Low confidence"
        );

    }

    else if (confidence < 60) {

        trapScore += 10;
    }


    /*
    CONFLIT DES MODÈLES
    */

    if (eloDistance >= 20) {

        trapScore += 30;

        reasons.push(
            "Strong model disagreement"
        );

    }

    else if (eloDistance >= 12) {

        trapScore += 15;

        reasons.push(
            "Model disagreement"
        );
    }


    /*
    =================================================
    HARD REJECTION
    =================================================
    
    IMPORTANT :

    Ici on ne transforme PAS simplement
    le match en "HIGH".

    On le BLOQUE.
    =================================================
    */

    if (favorite < 50) {

        return {
            decision: "NO BET",
            risk: "VERY HIGH",
            score: 0,
            trapScore,
            reasons,
            winner,
            publish: false
        };
    }


    if (separation < 5) {

        return {
            decision: "NO BET",
            risk: "VERY HIGH",
            score: 0,
            trapScore,
            reasons,
            winner,
            publish: false
        };
    }


    if (uncertainty >= 60) {

        return {
            decision: "NO BET",
            risk: "VERY HIGH",
            score: 0,
            trapScore,
            reasons,
            winner,
            publish: false
        };
    }


    if (reliability < 0.55) {

        return {
            decision: "NO BET",
            risk: "VERY HIGH",
            score: 0,
            trapScore,
            reasons,
            winner,
            publish: false
        };
    }


    if (modelAgreement < 30) {

        return {
            decision: "NO BET",
            risk: "VERY HIGH",
            score: 0,
            trapScore,
            reasons,
            winner,
            publish: false
        };
    }


    /*
    =================================================
    QUALITY SCORE
    =================================================
    */

    let score = 0;

    score +=
        favorite * 0.40;

    score +=
        clamp(
            separation * 2,
            0,
            25
        ) * 0.25;

    score +=
        clamp(
            confidence,
            0,
            100
        ) * 0.15;

    score +=
        clamp(
            dominance,
            0,
            30
        ) * 0.10;

    score +=
        reliability * 100 * 0.10;


    /*
    PENALTIES
    */

    if (uncertainty >= 50)
        score -= 12;

    if (strengthGap <= 8)
        score -= 8;

    if (eloDistance >= 12)
        score -= 10;

    if (trapScore >= 30)
        score -= 10;


    score =
        Math.round(
            clamp(score, 0, 100)
        );


    /*
    =================================================
    VIP
    =================================================
    */

    if (
        favorite >= 72 &&
        separation >= 15 &&
        confidence >= 72 &&
        dominance >= 15 &&
        uncertainty < 45 &&
        reliability >= 0.65 &&
        modelAgreement >= 70 &&
        trapScore < 20 &&
        score >= 70
    ) {

        return {
            decision: "VIP PICK",
            risk: "LOW",
            score,
            trapScore,
            reasons,
            winner,
            publish: true
        };
    }


    /*
    =================================================
    NORMAL
    =================================================
    */

    if (
        favorite >= 62 &&
        separation >= 10 &&
        confidence >= 60 &&
        uncertainty < 50 &&
        reliability >= 0.60 &&
        modelAgreement >= 60 &&
        trapScore < 30 &&
        score >= 58
    ) {

        return {
            decision: "NORMAL",
            risk: "MEDIUM",
            score,
            trapScore,
            reasons,
            winner,
            publish: true
        };
    }


    /*
    =================================================
    EVERYTHING ELSE = NO BET
    =================================================
    */

    return {
        decision: "NO BET",
        risk: "HIGH",
        score,
        trapScore,
        reasons,
        winner,
        publish: false
    };
}


module.exports = {
    evaluateDecision
};
