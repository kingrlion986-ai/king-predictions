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
    reasons.push("High confidence");

}
else if (confidence >= 70) {

    score += 30;
    reasons.push("High confidence");

}
else if (confidence >= 60) {

    score += 20;
    reasons.push("Good confidence");

}
else {

    score += 5;
    reasons.push("Low confidence");

}
     
/*
===============================
POISSON VALIDATION
===============================
*/

if (poisson && poisson.dominance) {

    if (poisson.dominance >= 35) {

        score += 30;
        reasons.push("Poisson very strong");

    }
    else if (poisson.dominance >= 25) {

        score += 25;
        reasons.push("Poisson strong");

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
if (strengthGap <= 4) {

    trapScore += 15;

}
else if (strengthGap <= 8) {

    trapScore += 8;

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
if (poisson.uncertainty >= 55) {

    trapScore += 20;

}
else if (poisson.uncertainty >= 45) {

    trapScore += 10;

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
score -= trapScore * 0.25;



/*
=================================
FINAL DECISION V20
CALIBRATED
=================================
*/

let decision = "NO BET";
let risk = "HIGH";

const favoriteProbability =
    Math.max(
        poisson.probabilities.homeWin,
        poisson.probabilities.draw,
        poisson.probabilities.awayWin
    );


/*
=================================
DANGER ABSOLU
=================================
*/

if (trapScore >= 45) {

    decision = "TRAP MATCH";
    risk = "VERY HIGH";

}


/*
=================================
PROBABILITÉ TROP FAIBLE
=================================
*/

else if (favoriteProbability < 55) {

    decision = "NO BET";
    risk = "HIGH";

}


/*
=================================
VIP
=================================
*/

else if (
    favoriteProbability >= 70 &&
    confidence >= 70 &&
    score >= 72
) {

    decision = "VIP PICK";
    risk = "LOW";

}


/*
=================================
BON MATCH
=================================
*/

else if (
    favoriteProbability >= 65 &&
    confidence >= 60 &&
    score >= 58
) {

    decision = "NORMAL";
    risk = "MEDIUM";

}


/*
=================================
MATCH MOYEN
=================================
*/

else if (
    favoriteProbability >= 60 &&
    confidence >= 50 &&
    score >= 50
) {

    decision = "NORMAL";
    risk = "MEDIUM";

}


/*
=================================
TOUT LE RESTE
=================================
*/

else {

    decision = "NO BET";
    risk = "HIGH";

}


console.log("===== DECISION V20 =====");

console.log({

    confidence,

    favoriteProbability,

    trapScore,

    score,

    decision,

    risk,

    poissonDominance:
        poisson.dominance,

    poissonUncertainty:
        poisson.uncertainty,

    eloProbability

});


return {

    decision,

    risk,

    score: Math.round(
        Math.max(
            0,
            Math.min(100, score)
        )
    ),

    trapScore,

    reasons,

    winner

};


module.exports = {

    evaluateDecision

};
