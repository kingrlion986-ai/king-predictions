/*
=========================================
 KING PREDICTIONS AI
 POISSON ENGINE V21
 CALIBRATED & STABLE
=========================================
*/

const MAX_GOALS = 10;


/* =========================
   FACTORIAL
========================= */

function factorial(n) {

    if (n <= 1) return 1;

    let result = 1;

    for (let i = 2; i <= n; i++) {
        result *= i;
    }

    return result;
}


/* =========================
   POISSON
========================= */

function poissonProbability(lambda, goals) {

    if (!Number.isFinite(lambda) || lambda < 0) {
        return 0;
    }

    return (
        Math.exp(-lambda) *
        Math.pow(lambda, goals)
    ) / factorial(goals);
}


/* =========================
   DISTRIBUTION
========================= */

function buildGoalDistribution(expectedGoals) {

    const distribution = [];

    for (let goals = 0; goals <= MAX_GOALS; goals++) {

        distribution.push(
            poissonProbability(
                expectedGoals,
                goals
            )
        );

    }

    return distribution;
}


/* =========================
   MAIN
========================= */

function buildPoissonMatrix(homeXG, awayXG) {

    homeXG = Number(homeXG);
    awayXG = Number(awayXG);

    if (!Number.isFinite(homeXG) || homeXG < 0) {
        homeXG = 0;
    }

    if (!Number.isFinite(awayXG) || awayXG < 0) {
        awayXG = 0;
    }

    /*
    Évite des XG absurdes
    */

    homeXG = Math.min(homeXG, 5);
    awayXG = Math.min(awayXG, 5);

    console.log("HOME XG =", homeXG);
    console.log("AWAY XG =", awayXG);

    const homeDistribution =
        buildGoalDistribution(homeXG);

    const awayDistribution =
        buildGoalDistribution(awayXG);

    const matrix = [];

    for (let h = 0; h <= MAX_GOALS; h++) {

        matrix[h] = [];

        for (let a = 0; a <= MAX_GOALS; a++) {

            matrix[h][a] =
                homeDistribution[h] *
                awayDistribution[a];

        }

    }

    return {

        matrix,

        homeDistribution,

        awayDistribution,

        ...analyzeMatrix(matrix)

    };

}


/* =========================
   ANALYSE
========================= */

function analyzeMatrix(matrix) {

    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;

    let btts = 0;

    let over15 = 0;
    let over25 = 0;
    let over35 = 0;

    let cleanSheetHome = 0;
    let cleanSheetAway = 0;

    let total = 0;

    let homeGoalsExpectation = 0;
    let awayGoalsExpectation = 0;

    let bestProbability = 0;
    let exactScore = "0-0";


    /* =========================
       MATRIX
    ========================= */

    for (
        let h = 0;
        h <= MAX_GOALS;
        h++
    ) {

        for (
            let a = 0;
            a <= MAX_GOALS;
            a++
        ) {

            const probability =
                matrix[h][a];

            total += probability;

            homeGoalsExpectation +=
                h * probability;

            awayGoalsExpectation +=
                a * probability;


            /* WINNER */

            if (h > a) {

                homeWin += probability;

            }

            else if (h === a) {

                draw += probability;

            }

            else {

                awayWin += probability;

            }


            /* BTTS */

            if (h > 0 && a > 0) {

                btts += probability;

            }


            /* TOTAL GOALS */

            const totalGoals = h + a;

            if (totalGoals >= 2) {
                over15 += probability;
            }

            if (totalGoals >= 3) {
                over25 += probability;
            }

            if (totalGoals >= 4) {
                over35 += probability;
            }


            /* CLEAN SHEET */

            if (a === 0) {
                cleanSheetHome += probability;
            }

            if (h === 0) {
                cleanSheetAway += probability;
            }


            /* EXACT SCORE */

            if (probability > bestProbability) {

                bestProbability =
                    probability;

                exactScore =
                    `${h}-${a}`;

            }

        }

    }


    if (total <= 0) {

        throw new Error(
            "Poisson matrix has invalid total probability"
        );

    }


    /* =========================
       NORMALISATION
    ========================= */

    homeWin /= total;
    draw /= total;
    awayWin /= total;

    btts /= total;

    over15 /= total;
    over25 /= total;
    over35 /= total;

    homeGoalsExpectation /= total;
    awayGoalsExpectation /= total;

    cleanSheetHome /= total;
    cleanSheetAway /= total;


    /* =========================
       PROBABILITIES
    ========================= */

    const probabilities = [

        homeWin,
        draw,
        awayWin

    ].sort(
        (a, b) => b - a
    );


    const favoriteProbability =
        probabilities[0];

    const secondProbability =
        probabilities[1];


    /*
    Écart réel entre le favori
    et le deuxième scénario.
    */

    const predictionGap =
        favoriteProbability -
        secondProbability;


    /*
    DOMINANCE

    0 = match totalement équilibré
    20+ = avantage important
    35+ = très fort avantage
    */

    const dominance =
        Number(
            (
                predictionGap * 100
            ).toFixed(2)
        );


    /*
    INCERTITUDE

    Plus le favori est faible,
    plus le match est incertain.
    */

    const uncertainty =
        Number(
            (
                (1 - favoriteProbability) * 100
            ).toFixed(2)
        );


    /* =========================
       DOUBLE CHANCE
    ========================= */

    const doubleChance = {

        homeOrDraw:
            Number(
                (
                    (homeWin + draw) * 100
                ).toFixed(2)
            ),

        awayOrDraw:
            Number(
                (
                    (awayWin + draw) * 100
                ).toFixed(2)
            ),

        homeOrAway:
            Number(
                (
                    (homeWin + awayWin) * 100
                ).toFixed(2)
            )

    };


    /* =========================
       EXPECTED GOALS
    ========================= */

    const expectedGoals =
        homeGoalsExpectation +
        awayGoalsExpectation;


    /* =========================
       MATCH SCORE
    =========================

       IMPORTANT :

       Ce score ne doit PAS
       transformer un match équilibré
       en bon pari.

    */

    const matchScore = Math.max(
        0,
        Math.min(
            100,

            favoriteProbability * 70 +

            dominance * 0.30

        )
    );


    /* =========================
       RISK
    ========================= */

    let risk = "VERY HIGH";

    if (
        favoriteProbability >= 0.70 &&
        dominance >= 20
    ) {

        risk = "LOW";

    }

    else if (
        favoriteProbability >= 0.60 &&
        dominance >= 12
    ) {

        risk = "MEDIUM";

    }

    else if (
        favoriteProbability >= 0.50
    ) {

        risk = "HIGH";

    }


    /* =========================
       DEBUG
    ========================= */

    console.log(
        "===== POISSON V21 ====="
    );

    console.log({

        homeWin:
            Number(
                (homeWin * 100).toFixed(2)
            ),

        draw:
            Number(
                (draw * 100).toFixed(2)
            ),

        awayWin:
            Number(
                (awayWin * 100).toFixed(2)
            ),

        favoriteProbability:
            Number(
                (favoriteProbability * 100).toFixed(2)
            ),

        predictionGap:
            dominance,

        uncertainty,

        matchScore:
            Number(
                matchScore.toFixed(2)
            ),

        expectedGoals:
            Number(
                expectedGoals.toFixed(2)
            ),

        exactScore,

        risk

    });


    /* =========================
       RETURN
    ========================= */

    return {

        matrix,

        homeDistribution: null,

        awayDistribution: null,

        probabilities: {

            homeWin:
                Number(
                    (homeWin * 100).toFixed(2)
                ),

            draw:
                Number(
                    (draw * 100).toFixed(2)
                ),

            awayWin:
                Number(
                    (awayWin * 100).toFixed(2)
                )

        },

        doubleChance,

        btts:
            Number(
                (btts * 100).toFixed(2)
            ),

        over15:
            Number(
                (over15 * 100).toFixed(2)
            ),

        over25:
            Number(
                (over25 * 100).toFixed(2)
            ),

        over35:
            Number(
                (over35 * 100).toFixed(2)
            ),

        under25:
            Number(
                ((1 - over25) * 100).toFixed(2)
            ),

        expectedGoals:
            Number(
                expectedGoals.toFixed(2)
            ),

        expectedHomeGoals:
            Number(
                homeGoalsExpectation.toFixed(2)
            ),

        expectedAwayGoals:
            Number(
                awayGoalsExpectation.toFixed(2)
            ),

        cleanSheetHome:
            Number(
                (cleanSheetHome * 100).toFixed(2)
            ),

        cleanSheetAway:
            Number(
                (cleanSheetAway * 100).toFixed(2)
            ),

        matchScore:
            Number(
                matchScore.toFixed(2)
            ),

        uncertainty,

        dominance,

        risk,

        exactScore: {

            score:
                exactScore,

            probability:
                Number(
                    (
                        (bestProbability / total) *
                        100
                    ).toFixed(2)
                )

        }

    };

}


module.exports = {

    buildPoissonMatrix

};
