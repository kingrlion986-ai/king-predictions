/*
=========================================
 KING PREDICTIONS AI
 POISSON ENGINE V25
 CALIBRATED / STABLE
=========================================
*/

const MAX_GOALS = 10;


/* =====================================================
   UTILITIES
===================================================== */

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, Number(value) || 0)
    );
}


/* =====================================================
   FACTORIAL
===================================================== */

function factorial(n) {

    if (n <= 1)
        return 1;

    let result = 1;

    for (let i = 2; i <= n; i++)
        result *= i;

    return result;
}


/* =====================================================
   POISSON PROBABILITY
===================================================== */

function poissonProbability(lambda, goals) {

    lambda = Number(lambda);

    if (
        !Number.isFinite(lambda) ||
        lambda < 0
    ) {
        return 0;
    }

    return (
        Math.exp(-lambda) *
        Math.pow(lambda, goals)
    ) / factorial(goals);
}


/* =====================================================
   GOAL DISTRIBUTION
===================================================== */

function buildGoalDistribution(expectedGoals) {

    expectedGoals =
        clamp(
            expectedGoals,
            0.05,
            4.50
        );

    const distribution = [];

    let total = 0;


    /*
     * Distribution 0 → MAX_GOALS
     */

    for (
        let goals = 0;
        goals <= MAX_GOALS;
        goals++
    ) {

        const probability =
            poissonProbability(
                expectedGoals,
                goals
            );

        distribution.push(probability);

        total += probability;
    }


    /*
     * IMPORTANT :
     *
     * On normalise ici.
     *
     * La distribution est limitée
     * à MAX_GOALS et doit donc
     * représenter 100 % de sa masse
     * utilisée par la matrice.
     */

    if (total <= 0)
        return distribution.map(() => 0);

    return distribution.map(
        probability =>
            probability / total
    );
}


/* =====================================================
   MAIN POISSON ENGINE
===================================================== */

function buildPoissonMatrix(
    homeXG,
    awayXG
) {

    homeXG = Number(homeXG);
    awayXG = Number(awayXG);


    /*
     * ==========================================
     * VALIDATION
     * ==========================================
     */

    if (
        !Number.isFinite(homeXG) ||
        homeXG < 0
    ) {
        homeXG = 0.05;
    }

    if (
        !Number.isFinite(awayXG) ||
        awayXG < 0
    ) {
        awayXG = 0.05;
    }


    /*
     * ==========================================
     * SAFETY LIMIT
     * ==========================================
     */

    homeXG =
        clamp(
            homeXG,
            0.05,
            4.50
        );

    awayXG =
        clamp(
            awayXG,
            0.05,
            4.50
        );


    console.log(
        "🎯 POISSON INPUT:",
        {
            homeXG,
            awayXG,
            totalXG:
                Number(
                    (
                        homeXG +
                        awayXG
                    ).toFixed(2)
                )
        }
    );


    /*
     * ==========================================
     * DISTRIBUTIONS
     * ==========================================
     */

    const homeDistribution =
        buildGoalDistribution(
            homeXG
        );

    const awayDistribution =
        buildGoalDistribution(
            awayXG
        );


    /*
     * ==========================================
     * MATRIX
     * ==========================================
     */

    const matrix = [];

    for (
        let h = 0;
        h <= MAX_GOALS;
        h++
    ) {

        matrix[h] = [];

        for (
            let a = 0;
            a <= MAX_GOALS;
            a++
        ) {

            matrix[h][a] =
                homeDistribution[h] *
                awayDistribution[a];

        }
    }


    /*
     * ==========================================
     * ANALYSE
     * ==========================================
     */

    const analysis =
        analyzeMatrix(
            matrix,
            homeXG,
            awayXG
        );


    return {

        matrix,

        homeDistribution,

        awayDistribution,

        ...analysis
    };
}


/* =====================================================
   ANALYZE MATRIX
===================================================== */

function analyzeMatrix(
    matrix,
    homeXG,
    awayXG
) {

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

    let bestProbability = 0;
    let exactScore = "0-0";


    /*
     * ==========================================
     * MATRIX SCAN
     * ==========================================
     */

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
                Number(
                    matrix[h]?.[a] || 0
                );


            if (
                !Number.isFinite(probability) ||
                probability < 0
            ) {
                continue;
            }


            total += probability;


            /*
             * 1X2
             */

            if (h > a)
                homeWin += probability;

            else if (h === a)
                draw += probability;

            else
                awayWin += probability;


            /*
             * BTTS
             */

            if (
                h > 0 &&
                a > 0
            ) {
                btts += probability;
            }


            /*
             * TOTAL GOALS
             */

            const goals = h + a;

            if (goals >= 2)
                over15 += probability;

            if (goals >= 3)
                over25 += probability;

            if (goals >= 4)
                over35 += probability;


            /*
             * CLEAN SHEETS
             */

            if (a === 0)
                cleanSheetHome += probability;

            if (h === 0)
                cleanSheetAway += probability;


            /*
             * EXACT SCORE
             */

            if (
                probability >
                bestProbability
            ) {

                bestProbability =
                    probability;

                exactScore =
                    `${h}-${a}`;
            }
        }
    }


    /*
     * ==========================================
     * VALIDATION
     * ==========================================
     */

    if (
        !Number.isFinite(total) ||
        total <= 0
    ) {

        throw new Error(
            "Invalid Poisson probability"
        );
    }


    /*
     * ==========================================
     * NORMALISATION
     * ==========================================
     */

    homeWin /= total;
    draw /= total;
    awayWin /= total;

    btts /= total;

    over15 /= total;
    over25 /= total;
    over35 /= total;

    cleanSheetHome /= total;
    cleanSheetAway /= total;

    bestProbability /= total;


    /*
     * ==========================================
     * FAVORITE
     * ==========================================
     */

    const outcomes = [

        {
            name: "HOME",
            probability: homeWin
        },

        {
            name: "DRAW",
            probability: draw
        },

        {
            name: "AWAY",
            probability: awayWin
        }

    ].sort(
        (a, b) =>
            b.probability -
            a.probability
    );


    const favorite =
        outcomes[0];

    const second =
        outcomes[1];


    const favoriteProbability =
        favorite.probability;

    const secondProbability =
        second.probability;


    /*
     * ==========================================
     * SEPARATION
     * ==========================================
     */

    const predictionGap =
        Math.max(
            0,
            favoriteProbability -
            secondProbability
        );


    const dominance =
        clamp(
            predictionGap * 100,
            0,
            100
        );


    /*
     * ==========================================
     * UNCERTAINTY
     * ==========================================
     */

    let uncertainty =
        (1 - favoriteProbability) * 100;


    if (predictionGap < 0.05)
        uncertainty += 10;

    else if (predictionGap < 0.08)
        uncertainty += 5;


    uncertainty =
        clamp(
            uncertainty,
            0,
            100
        );


    /*
     * ==========================================
     * DOUBLE CHANCE
     * ==========================================
     */

    const doubleChance = {

        homeOrDraw:
            Number(
                (
                    (homeWin + draw) *
                    100
                ).toFixed(2)
            ),

        awayOrDraw:
            Number(
                (
                    (awayWin + draw) *
                    100
                ).toFixed(2)
            ),

        homeOrAway:
            Number(
                (
                    (homeWin + awayWin) *
                    100
                ).toFixed(2)
            )
    };


    /*
     * ==========================================
     * EXPECTED GOALS
     * ==========================================
     */

    const expectedHomeGoals =
        homeXG;

    const expectedAwayGoals =
        awayXG;

    const expectedGoals =
        expectedHomeGoals +
        expectedAwayGoals;


    /*
     * ==========================================
     * MARKET PROBABILITIES
     * ==========================================
     */

    const over25Probability =
        over25 * 100;

    const bttsProbability =
        btts * 100;


    const over25Confidence =
        Math.round(
            Math.max(
                over25Probability,
                100 - over25Probability
            )
        );


    const bttsConfidence =
        Math.round(
            Math.max(
                bttsProbability,
                100 - bttsProbability
            )
        );


    /*
     * ==========================================
     * MATCH SCORE
     * ==========================================
     */

    let matchScore =
        favoriteProbability * 100;


    if (predictionGap >= 0.20)
        matchScore += 10;

    else if (predictionGap >= 0.15)
        matchScore += 6;

    else if (predictionGap >= 0.10)
        matchScore += 3;


    if (predictionGap < 0.05)
        matchScore -= 15;

    else if (predictionGap < 0.08)
        matchScore -= 8;


    matchScore =
        clamp(
            Math.round(matchScore),
            0,
            100
        );


    /*
     * ==========================================
     * RISK
     *
     * Ce risque reste une information
     * statistique du moteur Poisson.
     *
     * Le predictionEngine peut appliquer
     * un filtre final différent.
     * ==========================================
     */

    let risk = "VERY HIGH";


    if (
        favoriteProbability >= 0.72 &&
        predictionGap >= 0.20 &&
        uncertainty < 40
    ) {

        risk = "LOW";

    }

    else if (
        favoriteProbability >= 0.62 &&
        predictionGap >= 0.12 &&
        uncertainty < 50
    ) {

        risk = "MEDIUM";

    }

    else if (
        favoriteProbability >= 0.50
    ) {

        risk = "HIGH";
    }


    /*
     * ==========================================
     * DEBUG
     * ==========================================
     */

    console.log(
        "===== POISSON ENGINE V25 ====="
    );

    console.log({

        homeWin:
            Number(
                (homeWin * 100)
                .toFixed(2)
            ),

        draw:
            Number(
                (draw * 100)
                .toFixed(2)
            ),

        awayWin:
            Number(
                (awayWin * 100)
                .toFixed(2)
            ),

        sum1X2:
            Number(
                (
                    (
                        homeWin +
                        draw +
                        awayWin
                    ) * 100
                ).toFixed(2)
            ),

        favorite:
            favorite.name,

        favoriteProbability:
            Number(
                (
                    favoriteProbability *
                    100
                ).toFixed(2)
            ),

        dominance:
            Number(
                dominance.toFixed(2)
            ),

        uncertainty:
            Number(
                uncertainty.toFixed(2)
            ),

        over25:
            Number(
                over25Probability.toFixed(2)
            ),

        btts:
            Number(
                bttsProbability.toFixed(2)
            ),

        expectedHomeGoals:
            Number(
                expectedHomeGoals.toFixed(2)
            ),

        expectedAwayGoals:
            Number(
                expectedAwayGoals.toFixed(2)
            ),

        expectedGoals:
            Number(
                expectedGoals.toFixed(2)
            ),

        matchScore,

        risk,

        exactScore
    });


    /*
     * ==========================================
     * RETURN
     * ==========================================
     */

    return {

        probabilities: {

            homeWin:
                Number(
                    (
                        homeWin * 100
                    ).toFixed(2)
                ),

            draw:
                Number(
                    (
                        draw * 100
                    ).toFixed(2)
                ),

            awayWin:
                Number(
                    (
                        awayWin * 100
                    ).toFixed(2)
                )
        },


        favorite: {

            outcome:
                favorite.name,

            probability:
                Number(
                    (
                        favoriteProbability *
                        100
                    ).toFixed(2)
                )
        },


        predictionGap:
            Number(
                (
                    predictionGap * 100
                ).toFixed(2)
            ),


        doubleChance,


        btts:
            Number(
                (
                    btts * 100
                ).toFixed(2)
            ),


        bttsConfidence,


        over15:
            Number(
                (
                    over15 * 100
                ).toFixed(2)
            ),


        over25:
            Number(
                (
                    over25 * 100
                ).toFixed(2)
            ),


        over25Confidence,


        over35:
            Number(
                (
                    over35 * 100
                ).toFixed(2)
            ),


        under25:
            Number(
                (
                    (1 - over25) * 100
                ).toFixed(2)
            ),


        expectedGoals:
            Number(
                expectedGoals.toFixed(2)
            ),


        expectedHomeGoals:
            Number(
                expectedHomeGoals.toFixed(2)
            ),


        expectedAwayGoals:
            Number(
                expectedAwayGoals.toFixed(2)
            ),


        cleanSheetHome:
            Number(
                (
                    cleanSheetHome * 100
                ).toFixed(2)
            ),


        cleanSheetAway:
            Number(
                (
                    cleanSheetAway * 100
                ).toFixed(2)
            ),


        matchScore,


        uncertainty:
            Number(
                uncertainty.toFixed(2)
            ),


        dominance:
            Number(
                dominance.toFixed(2)
            ),


        risk,


        exactScore: {

            score:
                exactScore,

            probability:
                Number(
                    (
                        bestProbability * 100
                    ).toFixed(2)
                )
        }
    };
}


module.exports = {
    buildPoissonMatrix
};
