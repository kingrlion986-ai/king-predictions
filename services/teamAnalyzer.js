const { analyzeTeam } = require("./teamAnalyzer");

/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number(Number(value).toFixed(decimals));
}

/* =========================
   POISSON
========================= */

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/* =========================
   EXPECTED GOALS
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

  const diff = (home.strength || 50) - (away.strength || 50);

  homeXG += diff * 0.01;
  awayXG -= diff * 0.01;

  homeXG += 0.15;

  if (home.failedToScore >= 4) homeXG -= 0.2;
  if (away.failedToScore >= 4) awayXG -= 0.2;

  if (home.cleanSheets >= 4) awayXG -= 0.15;
  if (away.cleanSheets >= 4) homeXG -= 0.15;

  homeXG = clamp(homeXG, 0.2, 3.0);
  awayXG = clamp(awayXG, 0.2, 3.0);

  return { home: homeXG, away: awayXG };
}

/* =========================
   MONTE CARLO SAFE
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

function runMonteCarlo(home, away, simulations = 10000) {
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
    const ft = hg > ag ? "2" : hg < ag ? "1" : "X";

    const key = `${ht}/${ft}`;
    htft[key] = (htft[key] || 0) + 1;

    const score = `${hg}-${ag}`;
    scores[score] = (scores[score] || 0) + 1;

    if (hg > ag) homeWins++;
    else if (hg < ag) awayWins++;
    else draws++;

    if (hg > 0 && ag > 0) btts++;
    if (hg + ag >= 3) over25++;
  }

  const bestScore = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "0-0";
  const bestHTFT = Object.entries(htft).sort((a, b) => b[1] - a[1])[0]?.[0] || "X/X";

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
   SCORE PREDICTION SAFE
========================= */

function predictScore(home, away, winner) {
  const xg = calculateExpectedGoals(home, away);

  const scores = [];

  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const p = poisson(xg.home, h) * poisson(xg.away, a);

      scores.push({
        score: `${h}-${a}`,
        probability: round(p * 100, 4)
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
   BTTS SAFE
========================= */

function predictBTTS(home, away) {
  const xg = calculateExpectedGoals(home, away);

  const pHome = 1 - Math.exp(-xg.home);
  const pAway = 1 - Math.exp(-xg.away);

  const p = pHome * pAway;

  return {
    prediction: p >= 0.5 ? "YES" : "NO",
    confidence: round(p * 100)
  };
}

/* =========================
   CONFIDENCE
========================= */

function getConfidence(xg) {
  const diff = Math.abs(xg.home - xg.away);
  return clamp(Math.round(58 + diff * 15), 50, 88);
}

/* =========================
   MAIN ENGINE SAFE
========================= */

async function analyzeMatch(match) {
  try {
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

    const mc = runMonteCarlo(homeStats, awayStats, 10000);
    const probabilities = mc.probabilities;

    const xg = calculateExpectedGoals(homeStats, awayStats);

    /* =========================
       WINNER SAFE
    ========================= */

    let finalWinner = "DRAW";

    const max = Math.max(
      probabilities.home,
      probabilities.draw,
      probabilities.away
    );

    if (probabilities.home === max && probabilities.home >= 52) {
      finalWinner = homeStats.teamName;
    } else if (probabilities.away === max && probabilities.away >= 52) {
      finalWinner = awayStats.teamName;
    }

    const winnerConfidence = max;

    const scorePrediction = predictScore(
      homeStats,
      awayStats,
      finalWinner
    );

    const btts = predictBTTS(homeStats, awayStats);

    const over25 =
      mc.over25 >= 53 ? "OVER 2.5" : "UNDER 2.5";

    let confidence = getConfidence(xg);

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
  } catch (e) {
    console.log("ANALYZE ERROR:", e.message);

    return {
      match: "ERROR",
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
}

module.exports = {
  analyzeMatch
};
