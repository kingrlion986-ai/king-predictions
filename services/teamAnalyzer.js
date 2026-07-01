const { analyzeTeam } = require("./teamAnalyzer");

/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

/* évite les matchs trop faibles qui explosent les scores */
function adjustLowQualityMatch(home, away, confidence) {
  const avgStrength = (home.strength + away.strength) / 2;

  if (avgStrength < 15) confidence -= 12;
  else if (avgStrength < 25) confidence -= 8;
  else if (avgStrength < 40) confidence -= 4;

  return confidence;
}

/* =========================
   POISSON
========================= */

function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/* =========================
   EXPECTED GOALS MODEL
========================= */

function calculateExpectedGoals(home, away) {
  let homeXG =
    1.05 +
    (home.homeAttack - away.awayDefense) * 0.18 +
    (home.avgScored - away.avgConceded) * 0.28;

  let awayXG =
    0.95 +
    (away.awayAttack - home.homeDefense) * 0.18 +
    (away.avgScored - home.avgConceded) * 0.28;

  const diff = home.strength - away.strength;

  homeXG += diff * 0.01;
  awayXG -= diff * 0.01;

  // home advantage
  homeXG += 0.18;

  // corrections réalistes
  if (home.failedToScore >= 4) homeXG -= 0.2;
  if (away.failedToScore >= 4) awayXG -= 0.2;

  if (home.cleanSheets >= 4) awayXG -= 0.15;
  if (away.cleanSheets >= 4) homeXG -= 0.15;

  homeXG = clamp(homeXG, 0.25, 2.8);
  awayXG = clamp(awayXG, 0.25, 2.8);

  return { home: homeXG, away: awayXG };
}

/* =========================
   MONTE CARLO (STABLE)
========================= */

function simulatePoisson(lambda) {
  let L = Math.exp(-lambda);
  let p = 1;
  let k = 0;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

function runMonteCarlo(home, away, simulations = 12000) {
  const xg = calculateExpectedGoals(home, away);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let btts = 0;
  let over25 = 0;

  const scores = {};
  const htft = {};

  for (let i = 0; i < simulations; i++) {
    const hg = simulatePoisson(xg.home);
    const ag = simulatePoisson(xg.away);

    const hgHT = simulatePoisson(xg.home * 0.45);
    const agHT = simulatePoisson(xg.away * 0.45);

    const ht = hgHT > agHT ? "1" : hgHT < agHT ? "2" : "X";
    const ft = hg > ag ? "1" : hg < ag ? "2" : "X";

    const key = `${ht}/${ft}`;
    htft[key] = (htft[key] || 0) + 1;

    const score = `${hg}-${ag}`;
    scores[score] = (scores[score] || 0) + 1;

    if (hg > ag) homeWins++;
    else if (ag > hg) awayWins++;
    else draws++;

    if (hg > 0 && ag > 0) btts++;
    if (hg + ag >= 3) over25++;
  }

  const bestScore = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const bestHTFT = Object.entries(htft).sort((a, b) => b[1] - a[1])[0][0];

  return {
    probabilities: {
      home: round((homeWins / simulations) * 100),
      draw: round((draws / simulations) * 100),
      away: round((awayWins / simulations) * 100)
    },
    score: bestScore,
    htft: bestHTFT,
    btts: round((btts / simulations) * 100),
    over25: round((over25 / simulations) * 100)
  };
}

/* =========================
   SCORE PREDICTION
========================= */

function predictScore(home, away, winner) {
  const xg = calculateExpectedGoals(home, away);

  const scores = [];

  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const p = poisson(xg.home, h) * poisson(xg.away, a);

      scores.push({
        score: `${h}-${a}`,
        probability: round(p * 100, 3)
      });
    }
  }

  let filtered = scores;

  if (winner === home.teamName) {
    filtered = scores.filter(s => {
      const [h, a] = s.score.split("-").map(Number);
      return h > a;
    });
  } else if (winner === away.teamName) {
    filtered = scores.filter(s => {
      const [h, a] = s.score.split("-").map(Number);
      return a > h;
    });
  } else {
    filtered = scores.filter(s => {
      const [h, a] = s.score.split("-").map(Number);
      return h === a;
    });
  }

  filtered.sort((a, b) => b.probability - a.probability);

  return {
    best: filtered[0]?.score || "0-0",
    top3: filtered.slice(0, 3)
  };
}

/* =========================
   BTTS
========================= */

function predictBTTS(home, away) {
  const xg = calculateExpectedGoals(home, away);

  const homeP = 1 - Math.exp(-xg.home);
  const awayP = 1 - Math.exp(-xg.away);

  const prob = homeP * awayP;

  return {
    prediction: prob >= 0.52 ? "YES" : "NO",
    confidence: round(prob * 100)
  };
}

/* =========================
   CONFIDENCE ENGINE
========================= */

function getConfidence(xg) {
  const diff = Math.abs(xg.home - xg.away);
  return clamp(Math.round(58 + diff * 16), 50, 88);
}

/* =========================
   MAIN ENGINE
========================= */

async function analyzeMatch(match) {
  const homeStats = await analyzeTeam(match.homeTeam);
  const awayStats = await analyzeTeam(match.awayTeam);

  if (!homeStats || !awayStats) {
    return {
      match: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
      predictions: {
        winner: "DRAW",
        winnerConfidence: 50,
        btts: "NO",
        bttsConfidence: 50,
        over25: "UNDER 2.5",
        over25Confidence: 50,
        correctScore: "0-0",
        topScores: [],
        htft: "X/X",
        htftConfidence: 50,
        probabilities: { home: 33, draw: 34, away: 33 }
      },
      teamStats: null,
      model: {}
    };
  }

  /* =========================
     MONTE CARLO
  ========================= */

  const mc = runMonteCarlo(homeStats, awayStats, 12000);
  const probabilities = mc.probabilities;

  const xg = calculateExpectedGoals(homeStats, awayStats);

  /* =========================
     WINNER STABLE
  ========================= */

  let finalWinner = "DRAW";

  const max = Math.max(probabilities.home, probabilities.draw, probabilities.away);

  if (probabilities.home === max && probabilities.home >= 52) {
    finalWinner = homeStats.teamName;
  } else if (probabilities.away === max && probabilities.away >= 52) {
    finalWinner = awayStats.teamName;
  }

  const winnerConfidence = max;

  /* =========================
     SCORE
  ========================= */

  const scorePrediction = predictScore(homeStats, awayStats, finalWinner);

  /* =========================
     BTTS + OVER
  ========================= */

  const btts = predictBTTS(homeStats, awayStats);

  const over25 = mc.over25 >= 53 ? "OVER 2.5" : "UNDER 2.5";

  /* =========================
     CONFIDENCE FINAL
  ========================= */

  let confidence = getConfidence(xg);
  confidence = adjustLowQualityMatch(homeStats, awayStats, confidence);
  confidence = clamp(confidence, 50, 88);

  return {
    match: `${homeStats.teamName} vs ${awayStats.teamName}`,

    predictions: {
      winner: finalWinner,
      winnerConfidence,

      probabilities,

      btts: btts.prediction,
      bttsConfidence: btts.confidence,

      over25,
      over25Confidence: mc.over25,

      correctScore: scorePrediction.best,
      topScores: scorePrediction.top3,

      htft: mc.htft,
      htftConfidence: confidence
    },

    teamStats: {
      home: homeStats,
      away: awayStats
    },

    model: {
      expectedGoals: round(xg.home + xg.away, 2),
      expectedHomeGoals: round(xg.home, 2),
      expectedAwayGoals: round(xg.away, 2)
    }
  };
}

module.exports = {
  analyzeMatch
};
