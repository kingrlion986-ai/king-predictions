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

/* =========================
   XG MODEL
========================= */
function calculateExpectedGoals(home, away) {
  let homeXG =
    1.1 +
    (home.homeAttack - away.awayDefense) * 0.22 +
    (home.avgScored - away.avgConceded) * 0.35 +
    (home.strength - away.strength) * 0.012 +
    0.2;

  let awayXG =
    0.95 +
    (away.awayAttack - home.homeDefense) * 0.22 +
    (away.avgScored - home.avgConceded) * 0.35 -
    (home.strength - away.strength) * 0.012;

  return {
    home: clamp(homeXG, 0.2, 3.5),
    away: clamp(awayXG, 0.2, 3.5)
  };
}

/* =========================
   POISSON
========================= */
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(l, k) {
  return (Math.exp(-l) * Math.pow(l, k)) / factorial(k);
}

/* =========================
   MONTE CARLO
========================= */
function runMonteCarlo(home, away, sims = 10000) {
  const xg = calculateExpectedGoals(home, away);

  let homeW = 0,
    draw = 0,
    awayW = 0,
    btts = 0,
    over = 0;

  const scores = {};

  for (let i = 0; i < sims; i++) {
    const hg = Math.round(xg.home);
    const ag = Math.round(xg.away);

    const homeGoals = hg;
    const awayGoals = ag;

    const key = `${homeGoals}-${awayGoals}`;
    scores[key] = (scores[key] || 0) + 1;

    if (homeGoals > awayGoals) homeW++;
    else if (homeGoals < awayGoals) awayW++;
    else draw++;

    if (homeGoals > 0 && awayGoals > 0) btts++;
    if (homeGoals + awayGoals >= 3) over++;
  }

  const bestScore = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    probabilities: {
      home: round((homeW / sims) * 100),
      draw: round((draw / sims) * 100),
      away: round((awayW / sims) * 100)
    },
    score: bestScore,
    btts: round((btts / sims) * 100),
    over25: round((over / sims) * 100)
  };
}

/* =========================
   SCORE (FIXED)
========================= */
function predictScore(home, away, winner) {
  const xg = calculateExpectedGoals(home, away);
  const scores = [];

  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      let p = poisson(xg.home, h) * poisson(xg.away, a);

      if (winner !== "DRAW") {
        if (winner === home.teamName && h <= a) continue;
        if (winner === away.teamName && a <= h) continue;
      }

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

  const p = (1 - Math.exp(-xg.home)) * (1 - Math.exp(-xg.away));

  return {
    prediction: p >= 0.5 ? "YES" : "NO",
    confidence: round(p * 100)
  };
}

/* =========================
   MAIN ENGINE (CLEAN VIP)
========================= */
async function analyzeMatch(match) {
  const home = await analyzeTeam(match.homeTeam);
  const away = await analyzeTeam(match.awayTeam);

  if (!home || !away) {
    return {
      match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
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

  const mc = runMonteCarlo(home, away, 15000);
  const xg = calculateExpectedGoals(home, away);

  /* WINNER */
  let winner = "DRAW";

  const max = Math.max(mc.probabilities.home, mc.probabilities.away);

  if (mc.probabilities.home === max && max >= 55) winner = home.teamName;
  if (mc.probabilities.away === max && max >= 55) winner = away.teamName;

  const score = predictScore(home, away, winner).best;

  const btts = predictBTTS(home, away);

  return {
    match: `${home.teamName} vs ${away.teamName}`,

    predictions: {
      winner,
      winnerConfidence: max,

      probabilities: mc.probabilities,

      btts: btts.prediction,
      bttsConfidence: btts.confidence,

      over25: mc.over25 >= 50 ? "OVER 2.5" : "UNDER 2.5",
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
