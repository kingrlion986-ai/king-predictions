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
    home.strength * 0.30 +
    home.avgScored * 10 +
    (3 - home.avgConceded) * 8 +
    home.formPoints * 30 +
    home.reliability * 20 +
    12;


  const awayPower =
    away.strength * 0.30 +
    away.avgScored * 10 +
    (3 - away.avgConceded) * 8 +
    away.formPoints * 30 +
    away.reliability * 20;


  const drawFactor =
    15 -
    Math.abs(homePower - awayPower) / 8;


  let drawPower = clamp(
    drawFactor,
    8,
    18
);

const strengthDiff = Math.abs(
    home.strength - away.strength
);

if (strengthDiff < 8) {
    drawPower += 3;
}

drawPower = clamp(drawPower, 8, 20);


  const total =
    homePower +
    awayPower +
    drawPower;


  const homeWin =
    Math.round(homePower / total * 100);

  const awayWin =
    Math.round(awayPower / total * 100);


  const draw =
    100 - homeWin - awayWin;


  let winner = "DRAW";
  let confidence = draw;


  if (
    homeWin > awayWin &&
    homeWin > draw
  ) {
    winner = home.teamName;
    confidence = homeWin;
  }


  if (
    awayWin > homeWin &&
    awayWin > draw
  ) {
    winner = away.teamName;
    confidence = awayWin;
  }


  return {

    winner,

    winnerConfidence:
        clamp(confidence, 45, 90),

    probabilities:{
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
    value: confidence >= 55 ? "OVER 2.5" : "UNDER 2.5",
    confidence,
    expectedGoals: round(expected)
  };
} 
/* =========================
   BTTS MODEL
========================= */

function calculateBTTS(home, away) {

  let score = 0;

  // Les deux équipes marquent souvent
  score += (home.bttsRate + away.bttsRate) * 0.35;

  // Les deux équipes savent marquer
  score += (home.avgScored + away.avgScored) * 8;

  // Les deux équipes encaissent
  score += (home.avgConceded + away.avgConceded) * 6;

  // Équipes qui gardent rarement leur cage inviolée
  score -= (home.cleanSheets + away.cleanSheets) * 3;

   // Forme récente
score += (home.formPoints + away.formPoints) * 8;

  const confidence = Math.round(
    clamp(score, 15, 90)
  );

  return {
    value: confidence >= 60 ? "OUI" : "NON",
    confidence
  };
}


/* =========================
   GOALS MODEL
========================= */

function calculateExpectedGoals(home, away) {

  // Attaque domicile
  const homeAttack =
    (home.homeAttack * 0.45) +
    (home.avgScored * 0.35) +
    (home.formPoints * 0.20);


  // Attaque extérieur
  const awayAttack =
    (away.awayAttack * 0.45) +
    (away.avgScored * 0.35) +
    (away.formPoints * 0.20);


  // Défense adverse
  const homeDefenseFactor =
    (away.avgConceded * 0.60) +
    (away.awayDefense * 0.40);


  const awayDefenseFactor =
    (home.avgConceded * 0.60) +
    (home.homeDefense * 0.40);

   
  // Calcul de base amélioré
let expectedHomeGoals =
    (homeAttack * 0.60) +
    (homeDefenseFactor * 0.40);

let expectedAwayGoals =
    (awayAttack * 0.60) +
    (awayDefenseFactor * 0.40);

  // Avantage domicile réaliste
  expectedHomeGoals += 0.20;


// Réduction des excès offensifs
expectedHomeGoals *= 0.75;
expectedAwayGoals *= 0.75;


  expectedHomeGoals =
    clamp(expectedHomeGoals, 0.3, 2.8);

  expectedAwayGoals =
    clamp(expectedAwayGoals, 0.3, 2.8);

  return {

    expectedHomeGoals:
      round(expectedHomeGoals),

    expectedAwayGoals:
      round(expectedAwayGoals)

  };
}

/* =========================
   SCORE EXACT MODEL
========================= */

function generateScore(model, winner) {

  let homeGoals = Math.round(model.expectedHomeGoals);
  let awayGoals = Math.round(model.expectedAwayGoals);

  // Empêcher des scores trop élevés
  homeGoals = clamp(homeGoals, 0, 3);
  awayGoals = clamp(awayGoals, 0, 3);

  if (winner === "DRAW") {

    const avg = Math.round(
      (homeGoals + awayGoals) / 2
    );

    homeGoals = avg;
    awayGoals = avg;

  } else if (winner === model.homeTeam) {

    if (homeGoals <= awayGoals) {
      homeGoals = awayGoals + 1;
    }

  } else if (winner === model.awayTeam) {

    if (awayGoals <= homeGoals) {
      awayGoals = homeGoals + 1;
    }

  }

  // Limiter les scores finaux
  homeGoals = clamp(homeGoals, 0, 3);
  awayGoals = clamp(awayGoals, 0, 3);

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
