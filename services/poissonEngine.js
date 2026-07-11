const MAX_GOALS = 7;

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
   POISSON PROBABILITY
========================= */

function poisson(lambda, goals) {
    return (
        Math.exp(-lambda) *
        Math.pow(lambda, goals)
    ) / factorial(goals);
}

/* =========================
   GOAL DISTRIBUTION
========================= */

function buildGoalDistribution(expectedGoals) {

    const probabilities = [];

    for (let goals = 0; goals <= MAX_GOALS; goals++) {

        probabilities.push(
            poisson(expectedGoals, goals)
        );

    }

    return probabilities;
}

/* =========================
   BUILD MATRIX
========================= */

function buildPoissonMatrix(homeXG, awayXG) {

    const home = buildGoalDistribution(homeXG);

    const away = buildGoalDistribution(awayXG);

    const matrix = [];

    for (let h = 0; h <= MAX_GOALS; h++) {

        matrix[h] = [];

        for (let a = 0; a <= MAX_GOALS; a++) {

            matrix[h][a] =
                home[h] * away[a];

        }

    }

    const analysis = analyzeMatrix(matrix);

return {

    matrix,

    homeDistribution: home,

    awayDistribution: away,

    ...analysis

};

}

/* =========================
   ANALYSE DE LA MATRICE
========================= */

function analyzeMatrix(matrix) {

    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;

    let btts = 0;
    let over25 = 0;

    let bestProbability = 0;
    let exactScore = "0-0";

    let total = 0;

    for (let h = 0; h <= MAX_GOALS; h++) {

        for (let a = 0; a <= MAX_GOALS; a++) {

            const p = matrix[h][a];

            total += p;

            if (h > a)
                homeWin += p;

            else if (h === a)
                draw += p;

            else
                awayWin += p;

            if (h > 0 && a > 0)
                btts += p;

            if ((h + a) >= 3)
                over25 += p;

            if (p > bestProbability) {

                bestProbability = p;
                exactScore = `${h}-${a}`;

            }

        }

    }

    /*
      Normalisation
    */

    homeWin /= total;
    draw /= total;
    awayWin /= total;

    btts /= total;
    over25 /= total;

    return {

        probabilities: {

            homeWin: Number((homeWin * 100).toFixed(2)),

            draw: Number((draw * 100).toFixed(2)),

            awayWin: Number((awayWin * 100).toFixed(2))

        },

        btts: Number((btts * 100).toFixed(2)),

        over25: Number((over25 * 100).toFixed(2)),

        under25: Number(((1 - over25) * 100).toFixed(2)),

        exactScore: {

            score: exactScore,

            probability: Number(
                ((bestProbability / total) * 100).toFixed(2)
            )

        }

    };

}

module.exports = {
    buildPoissonMatrix
};
