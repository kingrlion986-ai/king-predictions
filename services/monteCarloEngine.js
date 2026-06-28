function runMonteCarlo(homeXG, awayXG, iterations = 10000) {

  console.log("RUN MONTE CARLO OK");

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  let over25 = 0;
  let btts = 0;

  const scoreMap = {};

  for (let i = 0; i < iterations; i++) {

    const result = simulateMatch(homeXG, awayXG);

    if (result.homeGoals + result.awayGoals >= 3) over25++;

    if (result.homeGoals > 0 && result.awayGoals > 0) btts++;

    const score = `${result.homeGoals}-${result.awayGoals}`;
    scoreMap[score] = (scoreMap[score] || 0) + 1;

    if (result.homeGoals > result.awayGoals) homeWins++;
    else if (result.homeGoals === result.awayGoals) draws++;
    else awayWins++;
  }

  let bestScore = "";
  let bestCount = 0;

  for (const s in scoreMap) {
    if (scoreMap[s] > bestCount) {
      bestScore = s;
      bestCount = scoreMap[s];
    }
  }

  return {
    "1X2": {
      home: (homeWins / iterations) * 100,
      draw: (draws / iterations) * 100,
      away: (awayWins / iterations) * 100
    },

    over25: (over25 / iterations) * 100,
    btts: (btts / iterations) * 100,

    bestScore,
    bestScoreProbability: (bestCount / iterations) * 100
  };
}
