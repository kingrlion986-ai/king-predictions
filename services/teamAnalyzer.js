const { getTeamRecentMatches } = require("./footballService");

/* =========================
   CACHE
========================= */
const CACHE = new Map();

/* =========================
   SAFE NUMBER
========================= */
function safe(n) {
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

/* =========================
   FORM ANALYSIS
========================= */
function computeForm(matches) {
  let points = 0;

  matches.forEach(m => {
    const home = m.score?.fullTime?.home ?? 0;
    const away = m.score?.fullTime?.away ?? 0;

    if (home > away) points += 3;
    else if (home === away) points += 1;
  });

  return matches.length ? points / (matches.length * 3) : 0.5;
}

/* =========================
   ATTACK / DEFENSE
========================= */
function computeStats(matches, teamId) {
  let scored = 0;
  let conceded = 0;

  matches.forEach(m => {
    const isHome = m.homeTeam.id === teamId;

    const goalsFor = isHome
      ? safe(m.score?.fullTime?.home)
      : safe(m.score?.fullTime?.away);

    const goalsAgainst = isHome
      ? safe(m.score?.fullTime?.away)
      : safe(m.score?.fullTime?.home);

    scored += goalsFor;
    conceded += goalsAgainst;
  });

  const played = matches.length || 1;

  return {
    avgScored: scored / played,
    avgConceded: conceded / played
  };
}

/* =========================
   STRENGTH ENGINE VIP
========================= */
function computeStrength(stats, form) {
  const attack = stats.avgScored * 35;
  const defense = (2 - stats.avgConceded) * 30;
  const formBonus = form * 35;

  const raw = attack + defense + formBonus;

  return {
    rawStrength: raw,
    strength: Math.min(100, Math.max(10, raw))
  };
}

/* =========================
   MAIN ANALYZER
========================= */
async function analyzeTeam(team) {
  const cacheKey = team.id;

  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }

  const matches = await getTeamRecentMatches(team.id, 8);

  if (!matches || matches.length < 2) {
    const fallback = {
      teamName: team.name,
      strength: 50,
      rawStrength: 50,
      avgScored: 1,
      avgConceded: 1,
      formPoints: 0.5,
      reliability: 0.2
    };

    CACHE.set(cacheKey, fallback);
    return fallback;
  }

  const form = computeForm(matches);
  const stats = computeStats(matches, team.id);
  const strength = computeStrength(stats, form);

  const result = {
    teamName: team.name,
    teamId: team.id,

    avgScored: stats.avgScored,
    avgConceded: stats.avgConceded,

    formPoints: form,
    reliability: matches.length / 8,

    ...strength
  };

  CACHE.set(cacheKey, result);
  return result;
}

/* =========================
   EXPORT FIX IMPORTANT
========================= */
module.exports = {
  analyzeTeam
};
