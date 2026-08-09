/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V21
 CALIBRATED
=========================================
*/


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


/*
=========================================
 EVALUATE DECISION
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

    let trapScore = 0;

    const reasons = [];


    /*
    =====================================
    SÉCURISATION
    =====================================
    */

    const safePoisson =
        poisson || {};


    const probabilities =
        safePoisson.probabilities || {};


    const homeWin =
        Number(
            probabilities.homeWin || 0
        );


    const draw =
        Number(
            probabilities.draw || 0
        );


    const awayWin =
        Number(
            probabilities.awayWin || 0
        );


    /*
    =====================================
    FAVORI
    =====================================
    */

    const favoriteProbability =
        Math.max(
            homeWin,
            draw,
            awayWin
        );


    const sortedProbabilities = [

        homeWin,
        draw,
        awayWin

    ].sort(
        (a, b) => b - a
    );


    const secondProbability =
        sortedProbabilities[1] || 0;


    const separation =
        favoriteProbability -
        secondProbability;


    /*
    =====================================
    FORCE
    =====================================
    */

    const strengthGap =
        Math.abs(

            Number(
                homeStats?.strength || 50
            ) -

            Number(
                awayStats?.strength || 50
            )

        );


    /*
    =====================================
    FIABILITÉ
    =====================================
    */

    const reliability = (

        Number(
            homeStats?.reliability || 0.5
        ) +

        Number(
            awayStats?.reliability || 0.5
        )

    ) / 2;


    /*
    =====================================
    POISSON
    =====================================
    */

    const poissonDominance =
        Number(
            safePoisson.dominance || 0
        );


    const poissonUncertainty =
        Number(
            safePoisson.uncertainty || 0
        );


    /*
    =====================================
    TRAP DETECTOR
    =====================================
    */

    /*
    Équipes proches
    */

    if (strengthGap <= 4) {

        trapScore += 15;

        reasons.push(
            "Teams very close"
        );

    }
    else if (strengthGap <= 8) {

        trapScore += 8;

    }


    /*
    ELO équilibré
    */

    if (
        typeof eloProbability === "number" &&
        eloProbability > 0.46 &&
        eloProbability < 0.54
    ) {

        trapScore += 20;

        reasons.push(
            "Balanced ELO"
        );

    }


    /*
    Poisson incertain
    */

    if (poissonUncertainty >= 60) {

        trapScore += 25;

        reasons.push(
            "Very high Poisson uncertainty"
        );

    }
    else if (poissonUncertainty >= 50) {

        trapScore += 18;

        reasons.push(
            "High Poisson uncertainty"
        );

    }
    else if (poissonUncertainty >= 45) {

        trapScore += 10;

    }


    /*
    Poisson dominance faible
    */

    if (poissonDominance < 10) {

        trapScore += 20;

        reasons.push(
            "No clear Poisson favorite"
        );

    }
    else if (poissonDominance < 15) {

        trapScore += 10;

    }


    /*
    Fiabilité faible
    */

    if (reliability < 0.60) {

        trapScore += 20;

        reasons.push(
            "Low reliability"
        );

    }
    else if (reliability < 0.65) {

        trapScore += 10;

    }


    /*
    Confiance faible
    */

    if (confidence < 50) {

        trapScore += 15;

        reasons.push(
            "Low confidence"
        );

    }


    /*
    Favori faible
    */

    if (favoriteProbability < 45) {

        trapScore += 20;

        reasons.push(
            "Weak favorite"
        );

    }
    else if (favoriteProbability < 50) {

        trapScore += 12;

    }
    else if (favoriteProbability < 55) {

        trapScore += 6;

    }


    /*
    Match très équilibré
    */

    if (
        favoriteProbability < 45 &&
        separation < 8
    ) {

        trapScore += 15;

        reasons.push(
            "Extremely balanced match"
        );

    }


    /*
    =====================================
    SCORE DE QUALITÉ
    =====================================
    */

    /*
    Le score ne doit pas dépasser
    la qualité réelle du favori.
    */

    if (favoriteProbability >= 70) {

        score += 40;

    }
    else if (favoriteProbability >= 65) {

        score += 34;

    }
    else if (favoriteProbability >= 60) {

        score += 27;

    }
    else if (favoriteProbability >= 55) {

        score += 18;

    }
    else {

        score += 5;

    }


    /*
    Séparation
    */

    if (separation >= 20) {

        score += 25;

    }
    else if (separation >= 15) {

        score += 20;

    }
    else if (separation >= 10) {

        score += 12;

    }
    else if (separation >= 5) {

        score += 5;

    }
    else {

        score -= 10;

    }


    /*
    Confiance
    */

    if (confidence >= 75) {

        score += 20;

    }
    else if (confidence >= 65) {

        score += 15;

    }
    else if (confidence >= 55) {

        score += 10;

    }
    else {

        score -= 5;

    }


    /*
    Force
    */

    if (strengthGap >= 15) {

        score += 10;

    }
    else if (strengthGap >= 10) {

        score += 6;

    }


    /*
    Accord ELO
    */

    if (
        typeof eloProbability === "number"
    ) {

        const favoriteIsHome =
            homeWin >= awayWin &&
            homeWin >= draw;


        const favoriteElo =
            favoriteIsHome
                ? eloProbability
                : 1 - eloProbability;


        if (favoriteElo >= 0.60) {

            score += 10;

        }
        else if (favoriteElo >= 0.55) {

            score += 5;

        }

    }


    /*
    =====================================
    PÉNALITÉ TRAP
    =====================================
    */

    score -=
        trapScore * 0.40;


    /*
    =====================================
    PLAFOND DE SÉCURITÉ
    =====================================
    */

    /*
    Favori < 50%
    */

    if (favoriteProbability < 50) {

        score =
            Math.min(
                score,
                25
            );

    }


    /*
    Poisson très incertain
    */

    if (poissonDominance < 10) {

        score =
            Math.min(
                score,
                35
            );

    }


    /*
    ELO équilibré
    */

    if (
        typeof eloProbability === "number" &&
        eloProbability > 0.47 &&
        eloProbability < 0.53
    ) {

        score =
            Math.min(
                score,
                40
            );

    }


    score =
        Math.round(
            clamp(
                score,
                0,
                100
            )
        );


    /*
    =====================================
    FINAL DECISION
    =====================================
    */

    let decision =
        "NO BET";

    let risk =
        "HIGH";


    /*
    =====================================
    TRAP ABSOLU
    =====================================
    */

    if (
        trapScore >= 45 ||
        favoriteProbability < 50
    ) {

        decision =
            "TRAP MATCH";

        risk =
            "VERY HIGH";

    }


    /*
    =====================================
    VIP
    =====================================
    */

    else if (

        favoriteProbability >= 70 &&

        confidence >= 70 &&

        separation >= 15 &&

        poissonDominance >= 20 &&

        trapScore < 25 &&

        score >= 72

    ) {

        decision =
            "VIP PICK";

        risk =
            "LOW";

    }


    /*
    =====================================
    NORMAL FORT
    =====================================
    */

    else if (

        favoriteProbability >= 65 &&

        confidence >= 60 &&

        separation >= 10 &&

        poissonDominance >= 15 &&

        trapScore < 35 &&

        score >= 58

    ) {

        decision =
            "NORMAL";

        risk =
            "MEDIUM";

    }


    /*
    =====================================
    NORMAL MODÉRÉ
    =====================================
    */

    else if (

        favoriteProbability >= 60 &&

        confidence >= 55 &&

        separation >= 8 &&

        trapScore < 30 &&

        score >= 50

    ) {

        decision =
            "NORMAL";

        risk =
            "MEDIUM";

    }


    /*
    =====================================
    TOUT LE RESTE
    =====================================
    */

    else {

        decision =
            "NO BET";

        risk =
            "HIGH";

    }


    /*
    =====================================
    DEBUG
    =====================================
    */

    console.log(
        "===== DECISION V21 ====="
    );


    console.log({

        confidence,

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


    /*
    =====================================
    RETURN
    =====================================
    */

    return {

        decision,

        risk,

        score,

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
