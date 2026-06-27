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

function adjustLowQualityMatch(home, away, confidence) {
  const avgStrength =
    (home.strength + away.strength) / 2;

  if (avgStrength < 15) {
    confidence -= 15;
  } else if (avgStrength < 25) {
    confidence -= 10;
  } else if (avgStrength < 40) {
    confidence -= 5;
  }

  return confidence;
}

/* =========================
   1X2 MODEL
========================= */
function build1X2(home, away) {

  const xg = calculateExpectedGoals(home, away);

  const diff = xg.home - xg.away;

  let homeProb = 33;
let drawProb = 34;
let awayProb = 33;

if (diff > 0) {
  homeProb += diff * 20;
  awayProb -= diff * 15;
  drawProb -= diff * 5;
} else {
  awayProb += (-diff) * 20;
  homeProb -= (-diff) * 15;
  drawProb -= (-diff) * 5;
}

homeProb = clamp(homeProb, 5, 90);
drawProb = clamp(drawProb, 5, 40);
awayProb = clamp(awayProb, 5, 90);

const total = homeProb + drawProb + awayProb;

return {
  home: round(homeProb * 100 / total),
  draw: round(drawProb * 100 / total),
  away: round(awayProb * 100 / total)
};

  const total = homeProb + drawProb + awayProb;

  return {
    home: round(homeProb * 100 / total),
    draw: round(drawProb * 100 / total),
    away: round(awayProb * 100 / total)
  };
}

/* =========================
   WINNER PICK
========================= */
function pickWinner(home, away) {
  const diff = home.strength - away.strength;

  if (Math.abs(diff) < 2.5) return "DRAW";
  if (diff >= 6) return home.teamName;
  if (diff <= -6) return away.teamName;

  return diff > 0 ? home.teamName : away.teamName;
}

/* =========================
   OVER 2.5
========================= */
function predictOver25(home, away) {

  const xg = calculateExpectedGoals(home, away);

  const totalXG = xg.home + xg.away;

  return {
    prediction: totalXG >= 2.5 ? "OVER 2.5" : "UNDER 2.5",
    confidence: round(clamp(totalXG / 4, 0, 1) * 100)
  };

}

/* =========================
   SCORE ENGINE
========================= */

function calculateExpectedGoals(home, away) {

  let homeXG =
    (home.homeAttack * 0.45) +
    (away.awayDefense * 0.20) +
    (home.avgScored * 0.25) +
    (away.avgConceded * 0.15);

  let awayXG =
    (away.awayAttack * 0.45) +
    (home.homeDefense * 0.20) +
    (away.avgScored * 0.25) +
    (home.avgConceded * 0.15);

  const diff = home.strength - away.strength;

  homeXG += diff * 0.018;
  awayXG -= diff * 0.018;

  // avantage domicile
  homeXG += 0.15;

  // difficulté à marquer
  if (home.failedToScore >= 4) homeXG -= 0.40;
  if (away.failedToScore >= 4) awayXG -= 0.40;

  // défenses solides
  if (away.cleanSheets >= 4) homeXG -= 0.30;
  if (home.cleanSheets >= 4) awayXG -= 0.30;

   // Bonus offensif
if (home.avgScored >= 1.8) homeXG += 0.20;
if (away.avgScored >= 1.8) awayXG += 0.20;

// Mauvaise défense
if (home.avgConceded >= 1.5) awayXG += 0.20;
if (away.avgConceded >= 1.5) homeXG += 0.20;

  homeXG = clamp(homeXG, 0, 4);
  awayXG = clamp(awayXG, 0, 4);
   
  return {
    home: homeXG,
    away: awayXG
  };
}

function factorial(n) {
  if (n <= 1) return 1;

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

function poisson(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function predictScore(home, away) {

  const xg = calculateExpectedGoals(home, away);

  let bestScore = "0-0";
  let bestProbability = -1;

  for (let homeGoals = 0; homeGoals <= 4; homeGoals++) {

    for (let awayGoals = 0; awayGoals <= 4; awayGoals++) {

      const probability =
        poisson(xg.home, homeGoals) *
        poisson(xg.away, awayGoals);

      if (probability > bestProbability) {

        bestProbability = probability;
        bestScore = `${homeGoals}-${awayGoals}`;

      }

    }

  }

  return bestScore;
}

function predictBTTS(home, away) {

  const xg = calculateExpectedGoals(home, away);

  const homeProb = 1 - Math.exp(-xg.home);
  const awayProb = 1 - Math.exp(-xg.away);

  const probability = homeProb * awayProb;

  return {
    prediction: probability >= 0.50 ? "YES" : "NO",
    confidence: round(probability * 100)
  };

}


/* =========================
   CONFIDENCE ENGINE
========================= */
function getConfidence(home, away, winnerPick) {
  const diff = Math.abs(home.strength - away.strength);

  let base = 60 + diff * 0.4;

  if (winnerPick === "DRAW") {
    base = 55 + diff * 0.2;
  }

  return clamp(Math.round(base), 55, 92);
}

/* =========================
   MAIN ENGINE
========================= */
async function analyzeMatch(match) {
  const homeStats = await analyzeTeam(match.homeTeam);
  const awayStats = await analyzeTeam(match.awayTeam);

   console.log(homeStats);
console.log(awayStats);

     /* =========================
     VIP PRO MAX ENGINE
  ========================= */

  const strengthDiff =
    Math.abs(homeStats.strength - awayStats.strength);

  const goalIndex =
    (homeStats.avgScored + awayStats.avgScored) -
    (homeStats.avgConceded + awayStats.avgConceded);

  let vipScore =
    (strengthDiff * 1.2) +
    (goalIndex * 2.5) +
    (homeStats.formPoints + awayStats.formPoints);

  vipScore = round(vipScore, 1);

  let riskLevel = "MEDIUM";

  if (vipScore >= 25) riskLevel = "HIGH CONFIDENCE";
  if (vipScore >= 40) riskLevel = "SAFE BET";
  if (vipScore < 15) riskLevel = "RISKY";

  const valuePick =
    vipScore >= 35
      ? "STRONG BET"
      : vipScore >= 20
      ? "NORMAL BET"
      : "AVOID";

  // fallback sécurité
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
        correctScore: "0-0"
      },
      teamStats: null,
      model: {}
    };
  }

  const winnerPick = pickWinner(homeStats, awayStats);
  const probabilities = build1X2(homeStats, awayStats);

  const xg = calculateExpectedGoals(homeStats, awayStats);
  const score = predictScore(homeStats, awayStats);

  const [hg, ag] = score.split("-").map(Number);

  const finalWinner =
    hg > ag ? homeStats.teamName :
    ag > hg ? awayStats.teamName : "DRAW";

  const bttsResult = predictBTTS(homeStats, awayStats);

  const over25 = (hg + ag >= 3) ? "OVER 2.5" : "UNDER 2.5";

  let confidence = getConfidence(homeStats, awayStats, finalWinner);

  confidence = adjustLowQualityMatch(homeStats, awayStats, confidence);
  confidence = clamp(confidence, 50, 92);

   let htft = "X/X";

if (finalWinner === homeStats.teamName) {
  htft = "1/1";
} else if (finalWinner === awayStats.teamName) {
  htft = "2/2";
}

const htftConfidence = confidence;

  return {
    match: `${homeStats.teamName} vs ${awayStats.teamName}`,

    predictions: {
  winner: finalWinner,
  winnerConfidence: confidence,

  probabilities,

  btts: bttsResult.prediction,
bttsConfidence: bttsResult.confidence,

  over25,
  over25Confidence: 70,

  correctScore: score,

  htft,
  htftConfidence
},

teamStats: {
      home: homeStats,
      away: awayStats
    },

    model: {
      expectedGoals: round(xg.home + xg.away, 2),
expectedHomeGoals: round(xg.home, 2),
expectedAwayGoals: round(xg.away, 2),
      winnerDiff: homeStats.strength - awayStats.strength
    }
  };
}

module.exports = {
  analyzeMatch
};
