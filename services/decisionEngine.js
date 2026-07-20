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


    /*
    ===============================
    CONFIDENCE SCORE
    ===============================
    */

    if (confidence >= 75) {

        score += 30;
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

    if (
        poisson &&
        poisson.dominance
    ) {

        if (poisson.dominance >= 0.65) {

            score += 25;

            reasons.push(
                "Poisson strong agreement"
            );

        }

        else if (
            poisson.dominance >= 0.50
        ) {

            score += 15;

            reasons.push(
                "Poisson moderate"
            );

        }

        else {

            score -= 10;

            reasons.push(
                "Poisson uncertain"
            );

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



    if (reliability >= 0.80) {

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



    /*
    ===============================
    FINAL DECISION
    ===============================
    */


    let decision = "NO BET";
    let risk = "HIGH";


    if (score >= 75) {

        decision = "VIP PICK";
        risk = "LOW";

    }

    else if (score >= 55) {

        decision = "NORMAL";
        risk = "MEDIUM";

    }



    return {

        decision,

        risk,

        score: Math.min(
            100,
            score
        ),

        reasons,

        winner

    };

}



module.exports = {

    evaluateDecision

};
