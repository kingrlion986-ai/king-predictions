const { analyzeMatch } = require("./predictionEngine");

async function rankMatches(matches) {

  const analyses = await Promise.all(
    matches.map(analyzeMatch)
  );

  return analyses
    .sort((a, b) => {

      const scoreA =
        a.predictions.winnerConfidence +
        a.teamStats.home.reliability * 10 +
        a.teamStats.away.reliability * 10;

      const scoreB =
        b.predictions.winnerConfidence +
        b.teamStats.home.reliability * 10 +
        b.teamStats.away.reliability * 10;

      return scoreB - scoreA;
    });

}

module.exports = {
  rankMatches
};
