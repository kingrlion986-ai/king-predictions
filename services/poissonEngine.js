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

    console.log("HOME XG =", homeXG);
    console.log("AWAY XG =", awayXG);

    const home = buildGoalDistribution(homeXG);
    const away = buildGoalDistribution(awayXG);

    const matrix = [];

    for (let h = 0; h <= MAX_GOALS; h++) {

        matrix[h] = [];

        for (let a = 0; a <= MAX_GOALS; a++) {

            matrix[h][a] = home[h] * away[a];

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
    let over15 = 0;
    let over25 = 0;
    let over35 = 0;

    let bestProbability = 0;
    let exactScore = "0-0";

    let total = 0;

   let homeGoalsExpectation = 0;
let awayGoalsExpectation = 0;

let cleanSheetHome = 0;
let cleanSheetAway = 0;

    for (let h = 0; h <= MAX_GOALS; h++) {

        for (let a = 0; a <= MAX_GOALS; a++) {

            const p = matrix[h][a];

            total += p;

           homeGoalsExpectation += h * p;
awayGoalsExpectation += a * p;

if (a === 0)
    cleanSheetHome += p;

if (h === 0)
    cleanSheetAway += p;

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

           if ((h + a) >= 2)
    over15 += p;

if ((h + a) >= 4)
    over35 += p;

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

   const doubleChance = {

    homeOrDraw: Number(((homeWin + draw) * 100).toFixed(2)),

    awayOrDraw: Number(((awayWin + draw) * 100).toFixed(2)),

    homeOrAway: Number(((homeWin + awayWin) * 100).toFixed(2))

};

let expectedGoals = 0;

for (let h = 0; h <= MAX_GOALS; h++) {

    for (let a = 0; a <= MAX_GOALS; a++) {

        expectedGoals +=
            (h + a) * matrix[h][a];

    }

}

expectedGoals /= total;

const favoriteProbability = Math.max(
    homeWin,
    draw,
    awayWin
);

   const probabilities = [homeWin, draw, awayWin]
.sort((a,b)=>b-a);
   
const secondProbability = probabilities[1];
   
const predictionGap =
    favoriteProbability -
    secondProbability;

const uncertainty =
    Number(
        ((1 - favoriteProbability) * 100)
        .toFixed(2)
    );

const dominance =
    Number(
        (
            predictionGap * 100
        ).toFixed(2)
    );

   const matchScore =
(
favoriteProbability * 55 +
dominance * 0.25 +
((100 - uncertainty) * 0.20)
);

       /*
   Calibration des probabilités
*/

const calibration = 0.96;

homeWin *= calibration;
draw *= (2 - calibration);
awayWin *= calibration;

const sum = homeWin + draw + awayWin;

homeWin /= sum;
draw /= sum;
awayWin /= sum;

   let risk = "HIGH";

if (favoriteProbability >= 0.70)
    risk = "LOW";

else if (favoriteProbability >= 0.55)
    risk = "MEDIUM";
   
return {

    probabilities: {

        homeWin: Number((homeWin * 100).toFixed(2)),

        draw: Number((draw * 100).toFixed(2)),

        awayWin: Number((awayWin * 100).toFixed(2))

    },

    doubleChance,

    btts: Number((btts * 100).toFixed(2)),

    over15: Number((over15 * 100).toFixed(2)),

    over25: Number((over25 * 100).toFixed(2)),

    over35: Number((over35 * 100).toFixed(2)),

    under25: Number(((1 - over25) * 100).toFixed(2)),

    expectedGoals: Number(expectedGoals.toFixed(2)),

   expectedHomeGoals:
    Number(
        (homeGoalsExpectation / total).toFixed(2)
    ),

expectedAwayGoals:
    Number(
        (awayGoalsExpectation / total).toFixed(2)
    ),

cleanSheetHome:
    Number(
        ((cleanSheetHome / total) * 100).toFixed(2)
    ),

cleanSheetAway:
    Number(
        ((cleanSheetAway / total) * 100).toFixed(2)
    ),

   matchScore:
Number(matchScore.toFixed(2)),

    uncertainty,

       dominance,

       risk,

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
