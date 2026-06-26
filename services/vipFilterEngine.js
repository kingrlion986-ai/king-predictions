function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* =========================
   VIP QUALITY SCORE
========================= */
function getMatchQuality(home, away) {
  const avgStrength = (home.strength + away.strength) / 2;
  const strengthDiff = Math.abs(home.strength - away.strength);

  let score = 50;

  // niveau global des équipes
  score += clamp(avgStrength, 0, 40);

  // équilibre du match
  if (strengthDiff < 5) score += 20;
  else if (strengthDiff < 10) score += 10;
  else score -= 10;

  // forme
  const formAvg = (home.formPoints + away.formPoints) / 2;
  score += clamp(formAvg, 0, 20);

  return clamp(Math.round(score), 0, 100);
}

/* =========================
   VIP CHECK
========================= */
function isVipMatch(home, away) {
  const quality = getMatchQuality(home, away);
  const avgStrength = (home.strength + away.strength) / 2;

  if (avgStrength < 20) return false;
  if (Math.abs(home.strength - away.strength) > 25) return false;
  if (quality < 55) return false;

  return true;
}

/* =========================
   FILTER MATCHES
========================= */
function filterVipMatches(matches) {
  return matches.filter(m =>
    isVipMatch(m.homeTeam, m.awayTeam)
  );
}

module.exports = {
  getMatchQuality,
  isVipMatch,
  filterVipMatches
};
