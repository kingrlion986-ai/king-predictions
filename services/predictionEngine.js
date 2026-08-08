const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const {
    getTeamElo,
    calculateEloProbability
} = require("./eloEngine");
const {
    calculateExpectedGoals
} = require("./expectedGoals");
const {
    calculateConfidence
} = require("./confidenceEngine");
const {
    savePrediction
} = require("./historyEngine");

const {
    evaluateDecision
} = require("./decisionEngine");

const {
    buildLearningModel
} = require("./learningEngine");

const {
    updateMatchElo
} = require("./eloEngine");

const {
    getWeights
} = require("./adaptiveWeightEngine");
const {
    updateWeights
} = require("./adaptiveWeightEngine");
/* =========================
   CACHE
========================= */

const ANALYSIS_CACHE = new Map();

const ANALYSIS_TTL = 24 * 60 * 60 * 1000;

/* =========================
   HELPERS
========================= */

function getMatchKey(match) {

    return (
        match.homeTeam.id +
        "_" +
        match.awayTeam.id +
        "_" +
        match.utcDate
    );

}

/* =========================
   MAIN ANALYZER
========================= */

async function analyzeMatch(match) {

    console.log(
        "START ANALYSIS:",
        match.homeTeam.name,
        "vs",
        match.awayTeam.name
    );

    const timer = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
console.time(timer);

    const key = getMatchKey(match);

    const cached = ANALYSIS_CACHE.get(key);

    if (
        cached &&
        Date.now() - cached.time < ANALYSIS_TTL
    ) {
        return cached.data;
    }

    const [homeStats, awayStats] = await Promise.all([
    analyzeTeam(match.homeTeam),
    analyzeTeam(match.awayTeam)
]);
    const homeElo =
        getTeamElo(match.homeTeam.id);

    const awayElo =
        getTeamElo(match.awayTeam.id);

    const weights =
    getWeights();

    console.log("1 - ELO");

    const eloProbability =
    calculateEloProbability(
        homeElo,
        awayElo
    );

console.log("===== ELO DEBUG =====");
console.log(
    match.homeTeam.name,
    "ELO:",
    homeElo
);
console.log(
    match.awayTeam.name,
    "ELO:",
    awayElo
);
console.log(
    "ELO PROBABILITY:",
    Math.round(eloProbability * 100)
);
console.log("=====================");

console.log("2 - XG");

    console.log("HOME STATS =", {
    attackPower: homeStats.attackPower,
    defensePower: homeStats.defensePower,
    homeAttack: homeStats.homeAttack,
    homeDefense: homeStats.homeDefense,
    avgScored: homeStats.avgScored,
    avgConceded: homeStats.avgConceded,
    formPoints: homeStats.formPoints,
    strength: homeStats.strength
});

console.log("AWAY STATS =", {
    attackPower: awayStats.attackPower,
    defensePower: awayStats.defensePower,
    awayAttack: awayStats.awayAttack,
    awayDefense: awayStats.awayDefense,
    avgScored: awayStats.avgScored,
    avgConceded: awayStats.avgConceded,
    formPoints: awayStats.formPoints,
    strength: awayStats.strength
});
    
    const xg =
        calculateExpectedGoals(
            homeStats,
            awayStats,
            {
                home: homeElo,
                away: awayElo
            }
        );

    console.log("XG =", xg);

    console.log("3 - POISSON");

    const poisson =
        buildPoissonMatrix(
            xg.expectedHomeGoals,
            xg.expectedAwayGoals
        );

            

    
    console.log(
    "POISSON DEBUG:",
    poisson.uncertainty,
    poisson.dominance
);
    console.log("5 - CONFIDENCE");

    const confidence =
        calculateConfidence({

            probabilities:
                poisson.probabilities,

            homeStats,

            awayStats,

            eloProbability

        });

    console.log("4 - LEARNING");
    const learning =
    buildLearningModel();

        let adjustedConfidence =
    confidence *
    learning.confidenceWeight;

adjustedConfidence += poisson.dominance * 20;
adjustedConfidence -= poisson.uncertainty * 0.15;

adjustedConfidence = Math.max(
    20,
    Math.min(95, Math.round(adjustedConfidence))
);
            // =========================
// ADAPTIVE CONFIDENCE V17
// =========================

const strengthGap =
    Math.abs(
        homeStats.strength -
        awayStats.strength
    );

// Bonus domination équipe

if (strengthGap >= 20) {

    adjustedConfidence += 12;

}

else if (strengthGap >= 10) {

    adjustedConfidence += 6;

}


// Bonus fiabilité

const reliabilityGap =
    Math.abs(
        homeStats.reliability -
        awayStats.reliability
    );


if (reliabilityGap >= 0.20) {

    adjustedConfidence += 5;

}


const probabilityGap =
    Math.abs(
        poisson.probabilities.homeWin -
        Math.max(
            poisson.probabilities.draw,
            poisson.probabilities.awayWin
        )
    );

    adjustedConfidence += probabilityGap * 0.12;

adjustedConfidence =
    Math.round(
        adjustedConfidence * 0.75 +
        probabilityGap * 0.35
    );

adjustedConfidence = Math.max(
    40,
    Math.min(92, adjustedConfidence)
);

    let predictionQuality = "LOW";

if (adjustedConfidence >= 75) {
    predictionQuality = "HIGH";
}
else if (adjustedConfidence >= 60) {
    predictionQuality = "MEDIUM";
}
else {
    predictionQuality = "LOW";
}
    const homeScore =
    poisson.probabilities.homeWin * weights.poisson +
    homeStats.strength * weights.strength +
    homeStats.formScore * weights.form +
    homeStats.momentum * weights.momentum +
    homeStats.reliability * weights.reliability +
    eloProbability * 100 * weights.elo;

const awayScore =
    poisson.probabilities.awayWin * weights.poisson +
    awayStats.strength * weights.strength +
    awayStats.formScore * weights.form +
    awayStats.momentum * weights.momentum +
    awayStats.reliability * weights.reliability +
    (1 - eloProbability) * 100 * weights.elo;
    
const homeProbability =
(
    poisson.probabilities.homeWin * 0.45
) +
(
    eloProbability * 100 * 0.25
) +
(
    homeStats.strength * 0.20
) +
(
    homeStats.formScore * 0.10
);

const awayProbability =
(
    poisson.probabilities.awayWin * 0.45
) +
(
    (1 - eloProbability) * 100 * 0.25
) +
(
    awayStats.strength * 0.20
) +
(
    awayStats.formScore * 0.10
);

const drawProbability =
(
    poisson.probabilities.draw * 0.80
) +
(
    Math.max(
        0,
        20 - Math.abs(homeStats.strength - awayStats.strength)
    )
);

let winner = "DRAW";

    const winnerGap =
Math.abs(homeProbability - awayProbability);

if (winnerGap < 5 && drawProbability >= 35) {

    winner = "DRAW";

}
else if (homeProbability > awayProbability) {

    winner = match.homeTeam.name;

}
else {

    winner = match.awayTeam.name;

}

    // =========================
// OVER 2.5
// =========================

let overScore =
    (poisson.over25 * 0.45) +
    (((homeStats.over25Rate + awayStats.over25Rate) / 2) * 0.20) +
    (Math.min(xg.totalExpectedGoals, 4) / 4 * 100 * 0.25) +
    (((homeStats.reliability + awayStats.reliability) / 2) * 100 * 0.05) +
    (((homeStats.momentum + awayStats.momentum) / 2) * 10 * 0.05);

overScore = Math.max(5, Math.min(95, overScore));

const over25Prediction =
    overScore >= 55
        ? "OVER 2.5"
        : "UNDER 2.5";

const over25Confidence =
    Math.round(overScore);


// =========================
// BTTS
// =========================

let bttsScore =
    (poisson.btts * 0.45) +
    (((homeStats.bttsRate + awayStats.bttsRate) / 2) * 0.25) +
    (((homeStats.avgScored + awayStats.avgScored) / 2) * 15 * 0.15) +
    (((homeStats.reliability + awayStats.reliability) / 2) * 100 * 0.05) +
    (Math.min(xg.expectedHomeGoals + xg.expectedAwayGoals, 4) / 4 * 100 * 0.10);

bttsScore = Math.max(5, Math.min(95, bttsScore));

const bttsPrediction =
    bttsScore >= 55
        ? "OUI"
        : "NON";

const bttsConfidence =
    Math.round(bttsScore);

const goalDiff =
    Math.abs(homeStats.strength - awayStats.strength);

let correctScore =
    poisson.exactScore.score;

/*
    Ajustement intelligent
*/

if (xg.totalExpectedGoals >= 3.2) {

    if (winner === match.homeTeam.name)
        correctScore = "2-1";

    else if (winner === match.awayTeam.name)
        correctScore = "1-2";

    else
        correctScore = "2-2";

}

else if (goalDiff >= 20) {

    if (winner === match.homeTeam.name)
        correctScore = "2-0";

    else if (winner === match.awayTeam.name)
        correctScore = "0-2";

}

else if (xg.totalExpectedGoals <= 2) {

    if (winner === "DRAW")
        correctScore = "0-0";

    else if (winner === match.homeTeam.name)
        correctScore = "1-0";

    else
        correctScore = "0-1";

}


console.log("OVER CONF:", over25Confidence);
console.log("BTTS CONF:", bttsConfidence);

    // =========================
// FINAL AI SCORE V18
// =========================

const finalAIScore =
(
    adjustedConfidence * 0.40
)
+
(
    poisson.dominance * 100 * 0.25
)
+
(
    (homeStats.stability + awayStats.stability) / 2 * 0.20
)
+
(
    (homeStats.reliability + awayStats.reliability) * 50 * 0.15
);


const aiRating =
Math.round(
    Math.min(
        100,
        finalAIScore
    )
);

    const aiDecision =
evaluateDecision({

    confidence: adjustedConfidence,

    poisson,

    homeStats,

    awayStats,

    eloProbability,

    winner

});

    console.log(
    "👑 AI DECISION:",
    aiDecision.decision,
    "| RISK:",
    aiDecision.risk,
    "| SCORE:",
    aiDecision.score
);

    const predictionStrength =
    Math.round(
        (
            aiRating +
            adjustedConfidence +
            poisson.matchScore
        ) / 3
    );
    
    const result = {

        match: {

            id: match.id,

            utcDate: match.utcDate,

            competition: match.competition,

            homeTeam: match.homeTeam,

            awayTeam: match.awayTeam

        },

        predictions: {

    winner,

    winnerConfidence: adjustedConfidence,

            aiDecision,

            aiRating,

            predictionStrength,

                quality: predictionQuality,

    probabilities:
        poisson.probabilities,

    over25:
        over25Prediction,

    over25Confidence,

    btts:
    bttsPrediction,

bttsConfidence,

    correctScore,

    correctScoreProbability:
        poisson.exactScore.probability

},
        
        teamStats: {

            home: homeStats,

            away: awayStats

        },

        model: {

            elo: {

                home: homeElo,

                away: awayElo,

                homeProbability:
                    Math.round(
                        eloProbability * 100
                    )

            },

            learning,

            expectedGoals:
                xg.totalExpectedGoals,

            expectedHomeGoals:
                xg.expectedHomeGoals,

            expectedAwayGoals:
                xg.expectedAwayGoals,

            poissonMatrix:
                poisson.matrix

        }

    };

    // savePrediction(result);

    if (match.status === "FINISHED") {

    updateMatchElo(
        match.homeTeam.id,
        match.awayTeam.id,
        match.score.fullTime.home,
        match.score.fullTime.away
    );

    }

    ANALYSIS_CACHE.set(
        key,
        {
            time: Date.now(),
            data: result
        }
    );

    console.log(
        "MATCH ANALYZED:",
        match.homeTeam.name,
        "vs",
        match.awayTeam.name
    );

    console.timeEnd(timer);

    return result;
}

module.exports = {
    analyzeMatch
};
