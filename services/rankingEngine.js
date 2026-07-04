const { analyzeMatch } = require("./predictionEngine");

function calculateRankingScore(match) {

  const home = match.teamStats.home;
  const away = match.teamStats.away;

  let score = 0;

  // Confiance du marché 1X2
  score += match.predictions.winnerConfidence * 0.30;

  // Différence de niveau
  score += Math.abs(home.strength - away.strength) * 0.20;

  // Forme récente
  score += home.formPoints * 100 * 0.10;
  score += away.formPoints * 100 * 0.10;

  // Fiabilité
  score += home.reliability * 100 * 0.10;
  score += away.reliability * 100 * 0.10;

  // Puissance offensive
  score += (home.avgScored + away.avgScored) * 4;

  // Solidité défensive
  score += (home.cleanSheets + away.cleanSheets);

  // Bonus si les deux équipes marquent souvent
  score += (home.bttsRate + away.bttsRate) / 20;

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
