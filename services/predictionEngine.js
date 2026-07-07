const { analyzeTeam } = require("./teamAnalyzer");

/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(2));
}


/* =========================
   WINNER MODEL
========================= */

function calculateWinner(home, away) {

  const homePower =
    home.strength +
    home.avgScored * 12 +
    home.formPoints * 20 +
    6; // avantage domicile

  const awayPower =
    away.strength +
    away.avgScored * 12 +
    away.formPoints * 20;

  const diff = Math.abs(homePower - awayPower);

  let drawPower = 18 - diff / 5;

  drawPower = clamp(drawPower, 6, 18);

  const total =
    homePower +
    awayPower +
    drawPower;

  const homeWin = Math.round(homePower / total * 100);
  const awayWin = Math.round(awayPower / total * 100);
  const draw = 100 - homeWin - awayWin;

  let winner = "DRAW";
  let confidence = draw;

  if (homeWin > awayWin && homeWin > draw) {
    winner = home.teamName;
    confidence = homeWin;
  }

  if (awayWin > homeWin && awayWin > draw) {
    winner = away.teamName;
    confidence = awayWin;
  }

  return {
    winner,
    winnerConfidence: clamp(confidence, 45, 90),
    probabilities: {
      homeWin,
      draw,
      awayWin
    }
  };

}

/* =========================
   OVER 2.5 MODEL
========================= */

function calculateOver25(home, away) {

  const expected =
    home.avgScored +
    away.avgScored +
    home.avgConceded +
    away.avgConceded;


  const confidence =
    Math.round(
      clamp(
        expected * 18,
        20,
        90
      )
    );


  return {
    value: confidence >= 55 ? "YES" : "NO",
    confidence,
    expectedGoals: round(expected)
  };
} 
/* =========================
   BTTS MODEL
========================= */

function calculateBTTS(home, away) {

  const attack =
    home.bttsRate +
    away.bttsRate;


  const confidence =
    Math.round(
      clamp(
        attack / 2,
        20,
        90
      )
    );


  return {
    value: confidence >= 55
  ? "OVER 2.5"
  : "UNDER 2.5",
    confidence
  };
}


/* =========================
   GOALS MODEL
========================= */

function calculateExpectedGoals(home, away) {

  const homeGoals =
    (
      home.avgScored +
      away.avgConceded +
      home.homeAttack
    ) / 3;


  const awayGoals =
    (
      away.avgScored +
      home.avgConceded +
      away.awayAttack
    ) / 3;


  return {
    expectedHomeGoals: round(
      clamp(homeGoals, 0, 4)
    ),

    expectedAwayGoals: round(
      clamp(awayGoals, 0, 4)
    )
  };
}


/* =========================
   SCORE EXACT MODEL
========================= */

function generateScore(model, winner) {

  let homeGoals =
    Math.round(model.expectedHomeGoals);

  let awayGoals =
    Math.round(model.expectedAwayGoals);


  // cohérence avec le vainqueur

  if (winner !== "DRAW") {

    if (
      winner === model.homeTeam
      &&
      homeGoals <= awayGoals
    ) {
      homeGoals = awayGoals + 1;
    }


    if (
      winner === model.awayTeam
      &&
      awayGoals <= homeGoals
    ) {
      awayGoals = homeGoals + 1;
    }

  }


  // match nul cohérent

  if (winner === "DRAW") {
    awayGoals = homeGoals;
  }


  return `${homeGoals}-${awayGoals}`;
      }

/* =========================
   ANALYSIS CACHE
========================= */

const ANALYSIS_CACHE = new Map();

function getMatchKey(match) {
  return `${match.homeTeam.id}_${match.awayTeam.id}_${match.utcDate}`;
}

/* =========================
   MAIN ANALYSIS V19
========================= */

async function analyzeMatch(match) {

  const key = getMatchKey(match);

  if (ANALYSIS_CACHE.has(key)) {
    return ANALYSIS_CACHE.get(key);
  }

  const homeStats = await analyzeTeam(match.homeTeam);
  const awayStats = await analyzeTeam(match.awayTeam);

  const winnerModel = calculateWinner(
    homeStats,
    awayStats
  );


  const over25Model = calculateOver25(
    homeStats,
    awayStats
  );


  const bttsModel = calculateBTTS(
    homeStats,
    awayStats
  );


  const goalsModel = calculateExpectedGoals(
    homeStats,
    awayStats
  );


  const scoreModel = {
    ...goalsModel,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name
  };


  const correctScore = generateScore(
    scoreModel,
    winnerModel.winner
  );


  const result = {

  match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,

  predictions: {

    winner: winnerModel.winner,
    winnerConfidence: winnerModel.winnerConfidence,
    probabilities: winnerModel.probabilities,

    over25: over25Model.value,
    over25Confidence: over25Model.confidence,

    btts: bttsModel.value,
    bttsConfidence: bttsModel.confidence,

    correctScore

  },

  teamStats: {

    home: homeStats,
    away: awayStats

  },

  model: {

    expectedGoals:
      goalsModel.expectedHomeGoals +
      goalsModel.expectedAwayGoals,

    expectedHomeGoals:
      goalsModel.expectedHomeGoals,

    expectedAwayGoals:
      goalsModel.expectedAwayGoals

  }

};

ANALYSIS_CACHE.set(key, result);

return result;

}

/* =========================
   EXPORT
========================= */

module.exports = {
  analyzeMatch
};
