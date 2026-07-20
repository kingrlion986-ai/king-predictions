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

    const homeStats =
    await analyzeTeam(match.homeTeam);

const awayStats =
    await analyzeTeam(match.awayTeam);
    const homeElo =
        getTeamElo(match.homeTeam.id);

    const awayElo =
        getTeamElo(match.awayTeam.id);

    const eloProbability =
        calculateEloProbability(
            homeElo,
            awayElo
        );

    const xg =
        calculateExpectedGoals(
            homeStats,
            awayStats,
            {
                home: homeElo,
                away: awayElo
            }
        );

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

    const confidence =
        calculateConfidence({

            probabilities:
                poisson.probabilities,

            homeStats,

            awayStats,

            eloProbability

        });

        let adjustedConfidence = confidence;

adjustedConfidence += poisson.dominance * 20;
adjustedConfidence -= poisson.uncertainty * 0.15;

adjustedConfidence = Math.max(
    20,
    Math.min(85, Math.round(adjustedConfidence))
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


adjustedConfidence =
Math.min(
    Math.round(adjustedConfidence),
    85
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
    poisson.probabilities.homeWin +
    (homeStats.strength - awayStats.strength) * 0.35 +
    (homeStats.reliability - awayStats.reliability) * 15;

const awayScore =
    poisson.probabilities.awayWin +
    (awayStats.strength - homeStats.strength) * 0.35 +
    (awayStats.reliability - homeStats.reliability) * 15;

let winner = "DRAW";

if (Math.abs(homeScore - awayScore) > 4) {

    winner =
        homeScore > awayScore
            ? match.homeTeam.name
            : match.awayTeam.name;

}

    const overScore =
    (poisson.over25 * 0.60) +
    (((homeStats.over25Rate + awayStats.over25Rate) / 2) * 0.25) +
    (Math.min(xg.totalExpectedGoals, 4) / 4 * 100 * 0.15);

const over25Prediction =
    overScore >= 55
        ? "OVER 2.5"
        : "UNDER 2.5";

const over25Confidence =
    Math.round(overScore);

    const bttsScore =
    (poisson.btts * 0.60) +
    (((homeStats.bttsRate + awayStats.bttsRate) / 2) * 0.25) +
    (((homeStats.avgScored + awayStats.avgScored) / 2) * 20 * 0.15);

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
