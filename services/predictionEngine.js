const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const {
    getTeamElo,
    calculateEloProbability,
    updateMatchElo
} = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");
const { evaluateDecision } = require("./decisionEngine");
const { buildLearningModel } = require("./learningEngine");

const ANALYSIS_CACHE = new Map();
const ANALYSIS_TTL = 24 * 60 * 60 * 1000;

function getMatchKey(match) {
    return `${match.homeTeam.id}_${match.awayTeam.id}_${match.utcDate}`;
}

async function analyzeMatch(match) {

    const name = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const key = getMatchKey(match);

    console.log("START ANALYSIS:", name);
    console.time(name);

    // CACHE
    const cached = ANALYSIS_CACHE.get(key);

    if (cached && Date.now() - cached.time < ANALYSIS_TTL) {
        console.log("♻️ CACHE USED:", name);
        return cached.data;
    }

    // TEAM ANALYSIS
    const [homeStats, awayStats] = await Promise.all([
        analyzeTeam(match.homeTeam),
        analyzeTeam(match.awayTeam)
    ]);

    // DATA VALIDATION
    if (
        !homeStats ||
        !awayStats ||
        Number(homeStats.played || 0) < 5 ||
        Number(awayStats.played || 0) < 5
    ) {
        console.log(
            "🚫 MATCH REJECTED:",
            name,
            "| HOME:",
            homeStats?.played || 0,
            "| AWAY:",
            awayStats?.played || 0
        );

        console.timeEnd(name);
        return null;
    }

    // ELO
    const homeElo = getTeamElo(match.homeTeam.id);
    const awayElo = getTeamElo(match.awayTeam.id);

    const eloProbability = calculateEloProbability(
        homeElo,
        awayElo
    );

    console.log(
        "===== ELO =====",
        homeElo,
        awayElo,
        Math.round(eloProbability * 100)
    );

    // EXPECTED GOALS
    const xg = calculateExpectedGoals(
        homeStats,
        awayStats,
        {
            home: homeElo,
            away: awayElo
        }
    );

    console.log("XG:", xg);

    // POISSON
    const poisson = buildPoissonMatrix(
        xg.expectedHomeGoals,
        xg.expectedAwayGoals
    );

    console.log(
        "POISSON:",
        poisson.probabilities,
        "| RISK:",
        poisson.risk
    );

    // CONFIDENCE
    const confidence = calculateConfidence({
        probabilities: poisson.probabilities,
        homeStats,
        awayStats,
        eloProbability,
        poisson
    });

    const adjustedConfidence = confidence;

    // LEARNING
    const learning = buildLearningModel();

    const predictionQuality =
        adjustedConfidence >= 70
            ? "HIGH"
            : adjustedConfidence >= 55
                ? "MEDIUM"
                : "LOW";

    // WINNER PROBABILITIES
    const homeProbability =
        poisson.probabilities.homeWin * 0.50 +
        eloProbability * 100 * 0.25 +
        homeStats.strength * 0.15 +
        homeStats.formScore * 0.10;

    const awayProbability =
        poisson.probabilities.awayWin * 0.50 +
        (1 - eloProbability) * 100 * 0.25 +
        awayStats.strength * 0.15 +
        awayStats.formScore * 0.10;

    const drawProbability =
        poisson.probabilities.draw * 0.85 +
        Math.max(
            0,
            15 - Math.abs(
                homeStats.strength - awayStats.strength
            )
        ) * 0.15;

    const winnerGap = Math.abs(
        homeProbability - awayProbability
    );

    let winner;

    if (
        winnerGap < 5 &&
        drawProbability >=
        Math.max(homeProbability, awayProbability) - 3
    ) {
        winner = "DRAW";
    } else if (homeProbability > awayProbability) {
        winner = match.homeTeam.name;
    } else {
        winner = match.awayTeam.name;
    }

    // OVER 2.5
    let overScore =
        poisson.over25 * 0.50 +
        ((homeStats.over25Rate + awayStats.over25Rate) / 2) * 0.20 +
        (Math.min(xg.totalExpectedGoals, 4) / 4) * 100 * 0.20 +
        ((homeStats.reliability + awayStats.reliability) / 2) * 100 * 0.10;

    overScore = Math.max(5, Math.min(95, overScore));

    const over25Confidence = Math.round(overScore);
    const over25Prediction =
        overScore >= 55 ? "OVER 2.5" : "UNDER 2.5";

    // BTTS
    let bttsScore =
        poisson.btts * 0.50 +
        ((homeStats.bttsRate + awayStats.bttsRate) / 2) * 0.20 +
        ((homeStats.avgScored + awayStats.avgScored) / 2) * 15 * 0.10 +
        ((homeStats.reliability + awayStats.reliability) / 2) * 100 * 0.10 +
        (Math.min(xg.totalExpectedGoals, 4) / 4) * 100 * 0.10;

    bttsScore = Math.max(5, Math.min(95, bttsScore));

    const bttsConfidence = Math.round(bttsScore);
    const bttsPrediction =
        bttsScore >= 55 ? "OUI" : "NON";

    // CORRECT SCORE
    const goalDiff = Math.abs(
        homeStats.strength - awayStats.strength
    );

    let correctScore = poisson.exactScore.score;

    if (xg.totalExpectedGoals >= 3.2) {
        correctScore =
            winner === match.homeTeam.name
                ? "2-1"
                : winner === match.awayTeam.name
                    ? "1-2"
                    : "2-2";
    } else if (goalDiff >= 20) {
        correctScore =
            winner === match.homeTeam.name
                ? "2-0"
                : winner === match.awayTeam.name
                    ? "0-2"
                    : correctScore;
    } else if (xg.totalExpectedGoals <= 2) {
        correctScore =
            winner === "DRAW"
                ? "0-0"
                : winner === match.homeTeam.name
                    ? "1-0"
                    : "0-1";
    }

    // AI RATING
    const finalAIScore =
        adjustedConfidence * 0.45 +
        poisson.dominance * 0.20 +
        ((homeStats.stability + awayStats.stability) / 2) * 0.15 +
        ((homeStats.reliability + awayStats.reliability) * 50) * 0.20;

    const aiRating = Math.round(
        Math.max(0, Math.min(100, finalAIScore))
    );

    // DECISION ENGINE
    const aiDecision = evaluateDecision({
        confidence: adjustedConfidence,
        poisson,
        homeStats,
        awayStats,
        eloProbability,
        winner
    });

    console.log(
        "👑 AI:",
        aiDecision.decision,
        "| RISK:",
        aiDecision.risk,
        "| SCORE:",
        aiDecision.score
    );

    // PREDICTION STRENGTH
    const predictionStrength = Math.round(
        (
            aiRating +
            adjustedConfidence +
            poisson.matchScore
        ) / 3
    );

    // FINAL RESULT
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
            probabilities: poisson.probabilities,

            over25: over25Prediction,
            over25Confidence,

            btts: bttsPrediction,
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
                    Math.round(eloProbability * 100)
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

    // UPDATE ELO UNIQUEMENT POUR UN MATCH TERMINÉ
    if (
        match.status === "FINISHED" &&
        match.score?.fullTime
    ) {
        updateMatchElo(
            match.homeTeam.id,
            match.awayTeam.id,
            match.score.fullTime.home,
            match.score.fullTime.away
        );
    }

    // CACHE
    ANALYSIS_CACHE.set(key, {
        time: Date.now(),
        data: result
    });

    console.log("✅ MATCH ANALYZED:", name);
    console.timeEnd(name);

    return result;
}

module.exports = {
    analyzeMatch
};
