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

    return {
        matrix,
        homeDistribution: home,
        awayDistribution: away
    };

}

module.exports = {
    buildPoissonMatrix
};
