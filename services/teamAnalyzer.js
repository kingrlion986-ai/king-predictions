const { analyzeTeam } = require("./teamAnalyzer");

/* =========================
   HELPERS
========================= */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function round(v, d = 2) {
  return Number(v.toFixed(d));
}

function normalizeProb(p) {
  return clamp(p, 5, 92);
}

/* =========================
   EXPECTED GOALS MODEL
========================= */
function calculateExpectedGoals(home, away) {
  let homeXG =
    1.1 +
    (home.homeAttack - away.awayDefense) * 0.2 +
    (home.avgScored - away.avgConceded) * 0.3 +
    (home.strength - away.strength) * 0.01 +
    0.15;

  let awayXG =
    1.0 +
    (away.awayAttack - home.homeDefense) * 0.2 +
    (away.avgScored - home.avgConceded) * 0.3 -
    (home.strength - away.strength) * 0.01;

  return {
    home: clamp(homeXG, 0.25, 3.2),
    away: clamp(awayXG, 0.25, 3.2)
  };
}

/* =========================
   POISSON SIMULATION
========================= */
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(l, k) {
  return (Math.exp(-l) * Math.pow(l, k)) / factorial(k);
}

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

/* =========================
   MONTE CARLO (REALISTIC)
========================= */
function runMonteCarlo(home, away, sims = 8000) {
  const xg = calculateExpectedGoals(home, away);

  let homeW = 0,
    draw = 0,
    awayW = 0,
    btts = 0,
    over = 0;

  const scores = {};

  for (let i = 0; i < sims; i++) {
    const hg = simulatePoisson(xg.home);
    const ag = simulatePoisson(xg.away);

    const key = `${hg}-${ag}`;
    scores[key] = (scores[key] || 0) + 1;

    if (hg > ag) homeW++;
    else if (hg < ag) awayW++;
    else draw++;

    if (hg > 0 && ag > 0) btts++;
    if (hg + ag >= 3) over++;
  }

  const bestScore = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    probabilities: {
      home: normalizeProb(round((homeW / sims) * 100)),
      draw: normalizeProb(round((draw / sims) * 100)),
      away: normalizeProb(round((awayW / sims) * 100))
    },
    score: bestScore,
    btts: round((btts / sims) * 100),
    over25: round((over / sims) * 100)
  };
}

/* =========================
   SCORE MODEL
========================= */
function predictScore(home, away, winner) {
  const xg = calculateExpectedGoals(home, away);
  const scores = [];

  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      let p =
        poisson(xg.home, h) * poisson(xg.away, a);

      if (winner === home.teamName && h < a) continue;
      if (winner === away.teamName && a < h) continue;
      if (winner === "DRAW" && h !== a) continue;

      scores.push({
        score: `${h}-${a}`,
        probability: p
      });
    }
  }

  scores.sort((a, b) => b.probability - a.probability);

  return {
    best: scores[0]?.score || "0-0",
    top3: scores.slice(0, 3)
  };
}

/* =========================
   BTTS
========================= */
function predictBTTS(home, away) {
  const xg = calculateExpectedGoals(home, away);

  const p =
    (1 - Math.exp(-xg.home)) *
    (1 - Math.exp(-xg.away));

  return {
    prediction: p >= 0.52 ? "YES" : "NO",
    confidence: round(p * 100)
  };
}

/* =========================
   MAIN ENGINE (FINAL VIP)
========================= */
async function analyzeMatch(match) {
  const home = await analyzeTeam(match.homeTeam);
  const away = await analyzeTeam(match.awayTeam);

  if (!home || !away) {
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

  const mc = runMonteCarlo(home, away, 8000);
  const xg = calculateExpectedGoals(home, away);

  /* =========================
     WINNER (CALIBRATED)
  ========================= */
  let winner = "DRAW";

  const max = Math.max(
    mc.probabilities.home,
    mc.probabilities.draw,
    mc.probabilities.away
  );

  const diff =
    Math.abs(mc.probabilities.home - mc.probabilities.away);

  if (mc.probabilities.home === max && max >= 57 && diff >= 10) {
    winner = home.teamName;
  } else if (mc.probabilities.away === max && max >= 57 && diff >= 10) {
    winner = away.teamName;
  }

  const winnerConfidence = normalizeProb(max);

  /* =========================
     SCORE
  ========================= */
  const score = predictScore(home, away, winner).best;

  /* =========================
     BTTS / OVER
  ========================= */
  const btts = predictBTTS(home, away);

  const over25 =
    mc.over25 >= 53 ? "OVER 2.5" : "UNDER 2.5";

  /* =========================
     CONFIDENCE FINAL
  ========================= */
  let confidence =
    60 +
    Math.abs(xg.home - xg.away) * 16;

  confidence = clamp(confidence, 50, 88);

  return {
    match: `${home.teamName} vs ${away.teamName}`,

    predictions: {
      winner,
      winnerConfidence,

      probabilities: mc.probabilities,

      btts: btts.prediction,
      bttsConfidence: btts.confidence,

      over25,
      over25Confidence: mc.over25,

      correctScore: score,
      topScores: predictScore(home, away, winner).top3,

      htft: "X/X",
      htftConfidence: 60
    },

    teamStats: { home, away },

    model: {
      expectedGoals: round(xg.home + xg.away, 2),
      expectedHomeGoals: round(xg.home, 2),
      expectedAwayGoals: round(xg.away, 2)
    }
  };
}

module.exports = { analyzeMatch };
