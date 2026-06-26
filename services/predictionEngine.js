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

/* =========================
   1X2 MODEL (V17 PROBABILISTIC)
========================= */
function build1X2(home, away) {
  const homeAdv = 1.08; // avantage domicile réaliste

  const homePower = home.strength * homeAdv;
  const awayPower = away.strength;

  const diff = homePower - awayPower;

  // Draw increases when teams are close
  const drawFactor = clamp(100 - Math.abs(diff), 10, 60);

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
   WINNER SELECTION (SMART)
========================= */
function pickWinner(home, away) {
  const diff = home.strength - away.strength;

  if (Math.abs(diff) < 5) {
    return "DRAW";
  }

  return diff > 0 ? home.teamName : away.teamName;
}

/* =========================
   BTTS MODEL (FIXED)
========================= */
function predictBTTS(home, away) {
  const attack = (home.avgScored + away.avgScored) / 2;
  const defense = (home.avgConceded + away.avgConceded) / 2;

  const score = (attack * 0.6) + (defense * 0.4);

  if (score > 2.4) return "YES";
  if (score < 1.6) return "NO";

  return "NO";
}

/* =========================
   OVER / UNDER 2.5 (REALISTIC)
========================= */
function predictOver25(home, away) {
  const expectedGoals =
    home.avgScored +
    away.avgScored +
    (home.avgConceded + away.avgConceded) * 0.5;

  if (expectedGoals >= 2.7) return "OVER 2.5";
  return "UNDER 2.5";
}

/* =========================
   SCORE ENGINE (FIXED REALISM)
========================= */
function predictScore(home, away) {
  const homeGoals =
    (home.avgScored * 0.7) +
    (away.avgConceded * 0.3);

  const awayGoals =
    (away.avgScored * 0.7) +
    (home.avgConceded * 0.3);

  const h = clamp(Math.round(homeGoals), 0, 4);
  const a = clamp(Math.round(awayGoals), 0, 4);

  return `${h}-${a}`;
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
  const home = await analyzeTeam(match.homeTeam);
  const away = await analyzeTeam(match.awayTeam);

  const winnerPick = pickWinner(home, away);
  const probabilities = build1X2(home, away);
  const score = predictScore(home, away);

  const [hg, ag] = score.split("-").map(Number);

  const finalWinner =
    hg > ag ? home.teamName :
    ag > hg ? away.teamName : "DRAW";

  const btts = (hg > 0 && ag > 0) ? "YES" : "NO";

  const over25 = (hg + ag >= 3) ? "OVER 2.5" : "UNDER 2.5";

  const confidence = getConfidence(home, away, finalWinner);

  return {
    match: `${home.teamName} vs ${away.teamName}`,
    teamStats: { home, away },

    predictions: {
      winner: finalWinner,
      winnerConfidence: confidence,

      probabilities,

      btts,
      over25,

      correctScore: score
    },

    model: {
      expectedGoals: round((hg + ag) / 2, 2)
    }
  };
}

module.exports = {
  analyzeMatch
};
