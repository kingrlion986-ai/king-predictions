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

  // Force globale
  let homeScore = home.strength * 0.35;
  let awayScore = away.strength * 0.35;

  // Forme récente
  homeScore += home.formPoints * 20;
  awayScore += away.formPoints * 20;

  // Fiabilité
  homeScore += home.reliability * 12;
  awayScore += away.reliability * 12;

  // Attaque
  homeScore += home.avgScored * 8;
  awayScore += away.avgScored * 8;

  // Défense (moins on encaisse, mieux c'est)
  homeScore += Math.max(0, (2.5 - home.avgConceded)) * 6;
  awayScore += Math.max(0, (2.5 - away.avgConceded)) * 6;

  // Avantage domicile
  homeScore += 4;

  // Faiblesse défensive adverse
  homeScore += away.avgConceded * 2;
  awayScore += home.avgConceded * 2;

  // Difficulté à marquer
  homeScore -= home.failedToScore;
  awayScore -= away.failedToScore;

  // Clean sheets
  homeScore += home.cleanSheets * 1.5;
  awayScore += away.cleanSheets * 1.5;

  const diff = Math.abs(homeScore - awayScore);

  // Match nul moins fréquent lorsque l'écart est important
  let drawScore = Math.max(8, 22 - diff * 0.5);

  const total = homeScore + awayScore + drawScore;

  let homeWin = Math.round((homeScore / total) * 100);
  let awayWin = Math.round((awayScore / total) * 100);
  let draw = 100 - homeWin - awayWin;

  let winner = "DRAW";
  let confidence = draw;

  if (homeWin > awayWin && homeWin > draw) {
    winner = home.teamName;
    confidence = homeWin;
  } else if (awayWin > homeWin && awayWin > draw) {
    winner = away.teamName;
    confidence = awayWin;
  }

  return {
    winner,
    winnerConfidence: clamp(confidence, 45, 92),
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

  const confidence = Math.round(
    clamp(score, 15, 90)
  );

  return {
    value: confidence >= 55 ? "YES" : "NO",
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


  // Calcul de base
  let expectedHomeGoals =
    (homeAttack + homeDefenseFactor) / 2;


  let expectedAwayGoals =
    (awayAttack + awayDefenseFactor) / 2;


  // Avantage domicile réaliste
  expectedHomeGoals += 0.20;


  // Réduction des excès offensifs
  expectedHomeGoals =
    expectedHomeGoals * 0.55;

  expectedAwayGoals =
    expectedAwayGoals * 0.55;


  // Limites réalistes football
  expectedHomeGoals =
    clamp(expectedHomeGoals, 0.2, 3.2);

  expectedAwayGoals =
    clamp(expectedAwayGoals, 0.2, 3.0);


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
