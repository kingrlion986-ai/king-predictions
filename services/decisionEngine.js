/*
=========================================
 KING PREDICTIONS AI
 DECISION ENGINE V18
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
    ===============================
    CONFIDENCE SCORE
    ===============================
    */

    if (confidence >= 85) {
    score += 35;
}
else if (confidence >= 70) {
    score += 30;
}
    reasons.push(
        "High confidence"
    );

}

else if (confidence >= 60) {

    score += 20;
    reasons.push(
        "Good confidence"
    );

}

else {

    score += 5;
    reasons.push(
        "Low confidence"
    );

}

     
/*
===============================
POISSON VALIDATION
===============================
*/

if (poisson && poisson.dominance) {

    if (poisson.dominance >= 35) {
    score += 30;
}
else if (poisson.dominance >= 25) {
    score += 25;
}
    else if (poisson.dominance >= 15) {

        score += 15;
        reasons.push("Poisson moderate");

    }
    else {

        score -= 10;
        reasons.push("Poisson uncertain");

    }

}
    /*
    ===============================
    TEAM STRENGTH
    ===============================
    */

    const strengthGap =
        Math.abs(
            homeStats.strength -
            awayStats.strength
        );


    if (strengthGap >= 20) {

        score += 15;

        reasons.push(
            "Large team difference"
        );

    }

    else if (strengthGap >= 10) {

        score += 8;

    }



    /*
    ===============================
    RELIABILITY
    ===============================
    */

    const reliability =
        (
            homeStats.reliability +
            awayStats.reliability
        ) / 2;



    if (reliability >= 0.75) {

    score += 10;

    reasons.push(
        "Reliable data"
    );

    }



    /*
    ===============================
    ELO CHECK
    ===============================
    */

    if (
        eloProbability >= 0.60 ||
        eloProbability <= 0.40
    ) {

        score += 10;

        reasons.push(
            "ELO advantage confirmed"
        );

    }

 const favoriteProbability = Math.max(
    poisson.probabilities.homeWin,
    poisson.probabilities.draw,
    poisson.probabilities.awayWin
);

if (favoriteProbability >= 65) {
    score += 15;
}
else if (favoriteProbability >= 60) {
    score += 10;
}
else if (favoriteProbability < 45) {

    score -= 10;
    reasons.push("No clear favorite");

}


 /*
===============================
TRAP MATCH DETECTOR V20
===============================
*/

// Équipes trop proches
if (strengthGap <= 6) {

    trapScore += 20;
    reasons.push("Balanced teams");

}

// Elo très proche
if (
    eloProbability > 0.46 &&
    eloProbability < 0.54
) {

    trapScore += 20;
    reasons.push("Balanced Elo");

}

// Trop de risque selon Poisson
if (poisson.uncertainty >= 45) {

    trapScore += 20;
    reasons.push("High uncertainty");

}

// Données peu fiables
if (reliability < 0.60) {

    trapScore += 20;
    reasons.push("Low reliability");

}

 if (confidence < 55) {

    trapScore += 15;
    reasons.push("Low confidence");

}

if (Math.abs(homeStats.formScore - awayStats.formScore) <= 5) {

    trapScore += 10;
    reasons.push("Similar form");

}

// Beaucoup de matchs nuls récents
if (
    homeStats.draws >= 3 ||
    awayStats.draws >= 3
) {

    trapScore += 10;
    reasons.push("Draw tendency");

}

// Match très ouvert
if (
    poisson.btts > 65 &&
    poisson.over25 > 65
) {

    trapScore += 10;
    reasons.push("Open game");

}

// On retire le score des matchs dangereux
score -= trapScore * 0.35;



    /*
    ===============================
    FINAL DECISION
    ===============================
    */


    let decision = "NO BET";
let risk = "HIGH";

if (trapScore >= 45) {

    decision = "TRAP MATCH";
    risk = "VERY HIGH";

}


    if (trapScore < 45 && score >= 72) {

        decision = "VIP PICK";
        risk = "LOW";

    }

    else if (trapScore < 45 && score >= 50) {

        decision = "NORMAL";
        risk = "MEDIUM";

    }


  console.log("===== DECISION DEBUG =====");

console.log({
    confidence,
    strengthGap,
    reliability,
    favoriteProbability,
    trapScore,
    score,
    poissonDominance: poisson.dominance,
    poissonUncertainty: poisson.uncertainty,
    eloProbability
});



    return {

        decision,

        risk,

        score: Math.max(
    0,
    Math.min(100, score)
),

     trapScore,

        reasons,

        winner

    };

}



module.exports = {

    evaluateDecision

};
