const { analyzeMatch } = require("./predictionEngine");

function calculateRankingScore(match) {

  let score = 0;

  // Confiance 1X2
  score += match.predictions.winnerConfidence * 0.45;

  // Fiabilité des statistiques
  score +=
    (match.teamStats.home.reliability * 100) * 0.20;

  score +=
    (match.teamStats.away.reliability * 100) * 0.20;

  // Différence de niveau
  const strengthGap =
    Math.abs(
      match.teamStats.home.strength -
      match.teamStats.away.strength
    );

  score += strengthGap * 0.15;

  return Number(score.toFixed(2));
}

async function rankMatches(matches) {

  const analyses =
    await Promise.all(
      matches.map(analyzeMatch)
    );

  return analyses
    .map(match => ({
      ...match,
      rankingScore:
        calculateRankingScore(match)
    }))
    .sort(
      (a, b) =>
        b.rankingScore -
        a.rankingScore
    );

}

module.exports = {
  rankMatches
};
