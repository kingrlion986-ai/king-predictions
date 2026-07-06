function computeMatchScore(match) {
  let score = 50;

  const bigTeams = [
    "Real Madrid", "Barcelona", "Liverpool",
    "Manchester City", "Arsenal", "Bayern Munich",
    "PSG", "Inter", "AC Milan", "Juventus"
  ];

  const home = match.homeTeam.name;
  const away = match.awayTeam.name;

  if (bigTeams.some(t => home.includes(t) || away.includes(t))) {
    score += 25;
  }

  const elite = ["CL", "PL", "PD", "SA", "BL1", "FL1"];
  if (elite.includes(match.competition?.code)) {
    score += 15;
  }

  if (match.importance) {
    score += match.importance * 0.2;
  }

  return score;
}

/* =========================
   TOP 3 MATCHES (NEW)
========================= */
function rankMatches(matches) {
  return matches
    .map(m => ({
      ...m,
      score: computeMatchScore(m)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* =========================
   VIP FUNCTIONS (KEEP THEM)
========================= */
function rankOver25Matches(matches) {
  return matches;
}

function rankBTTSMatches(matches) {
  return matches;
}

function rankScoreMatches(matches) {
  return matches;
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  rankMatches,
  rankOver25Matches,
  rankBTTSMatches,
  rankScoreMatches
};
