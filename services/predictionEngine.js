const { analyzeTeam } = require("./teamAnalyzer");

function getBaseStrength(match) {
  let strength = 50;

  const bigTeams = [
    "Real Madrid", "Barcelona", "Liverpool",
    "Manchester City", "Arsenal", "Bayern Munich",
    "PSG", "Inter", "AC Milan", "Juventus"
  ];

  const home = match.homeTeam.name;
  const away = match.awayTeam.name;

  if (bigTeams.includes(home)) strength += 15;
  if (bigTeams.includes(away)) strength -= 5;

  if (bigTeams.includes(away)) strength += 15;
  if (bigTeams.includes(home)) strength -= 5;

  return strength;
}

/* =========================
   PROBABILITY ENGINE
========================= */
function calculateProbabilities(match) {
  const base = getBaseStrength(match);

  let homeWin = base;
  let awayWin = 100 - base;
  let draw = 20;

  // normalisation
  const total = homeWin + awayWin + draw;

  homeWin = Math.round((homeWin / total) * 100);
  awayWin = Math.round((awayWin / total) * 100);
  draw = 100 - homeWin - awayWin;

  return {
    homeWin,
    draw,
    awayWin
  };
}

/* =========================
   KING STATUS SYSTEM
========================= */
function getKingStatus(homeWin, draw, awayWin) {
  const max = Math.max(homeWin, draw, awayWin);

  if (max >= 80) return "KING SAFE";
  if (max >= 65) return "KING SOLID";
  if (max >= 50) return "KING RISK";
  return "KING AVOID";
}

/* =========================
   SCORE ESTIMATION
========================= */
function estimateScore(homeWin, awayWin) {
  if (homeWin > awayWin + 20) return "2-0 / 3-1";
  if (awayWin > homeWin + 20) return "0-2 / 1-3";
  return "1-1 / 2-2";
}

/* =========================
   MAIN ANALYSIS
========================= */
function analyzeMatch(match) {
  const probs = calculateProbabilities(match);

  const status = getKingStatus(
    probs.homeWin,
    probs.draw,
    probs.awayWin
  );

  const score = estimateScore(
    probs.homeWin,
    probs.awayWin
  );

  return {
    match,
    prediction: {
      probabilities: probs,
      status,
      recommended: probs.homeWin > probs.awayWin
        ? match.homeTeam.name
        : match.awayTeam.name,
      scoreGuess: score
    }
  };
}

/* =========================
   EXPORT
========================= */
module.exports = {
  analyzeMatch
};
