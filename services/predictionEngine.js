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
  const homeAdv = 1.08;

  const homePower = home.strength * homeAdv;
  const awayPower = away.strength;

  const drawFactor = clamp(100 - Math.abs(homePower - awayPower), 10, 60);

  let homeProb = homePower / (homePower + awayPower);
  let awayProb = awayPower / (homePower + awayPower);

  homeProb *= 100;
  awayProb *= 100;

  const drawProb = drawFactor;

  const total = homeProb + awayProb + drawProb;

  return {
    home: round((homeProb / total) * 100),
    draw: round((drawProb / total) * 100),
    away: round((awayProb / total) * 100)
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
   BTTS
========================= */
function predictBTTS(home, away) {
  const attack = (home.avgScored + away.avgScored) / 2;
  const defense = (home.avgConceded + away.avgConceded) / 2;

  const score = (attack * 0.6) + (defense * 0.4);

  if (score > 2.4) return "YES";
  return "NO";
}

/* =========================
   OVER 2.5
========================= */
function predictOver25(home, away) {
  const expectedGoals =
    home.avgScored +
    away.avgScored +
    (home.avgConceded + away.avgConceded) * 0.5;

  return expectedGoals >= 2.7 ? "OVER 2.5" : "UNDER 2.5";
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

  homeXG += diff * 0.025;
  awayXG -= diff * 0.025;

  homeXG += 0.20;

  if (home.failedToScore >= 4) homeXG -= 0.40;
  if (away.failedToScore >= 4) awayXG -= 0.40;

  if (away.cleanSheets >= 4) homeXG -= 0.30;
  if (home.cleanSheets >= 4) awayXG -= 0.30;

  return {
    home: clamp(homeXG, 0, 4),
    away: clamp(awayXG, 0, 4)
  };
}
function predictScore(home, away) {

  const xg = calculateExpectedGoals(home, away);

  const possibleScores = [
    "0-0","1-0","0-1","1-1",
    "2-0","0-2","2-1","1-2",
    "2-2","3-1","1-3","3-2",
    "2-3","3-3","4-1","1-4"
  ];

  let bestScore = "1-1";
  let bestValue = 999;

  for (const score of possibleScores) {

    const [h, a] = score.split("-").map(Number);

    const value =
      Math.abs(h - xg.home) +
      Math.abs(a - xg.away);

    if (value < bestValue) {
      bestValue = value;
      bestScore = score;
    }
  }

  return bestScore;
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

  const btts = (hg > 0 && ag > 0) ? "YES" : "NO";

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

  btts,
  bttsConfidence: 70,

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
