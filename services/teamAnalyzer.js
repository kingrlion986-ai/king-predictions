const { getTeamRecentMatches } = require("./footballApi");

/* =========================
   CACHE
========================= */
const CACHE = new Map();

/* =========================
   HELPERS
========================= */

function safe(n) {
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

function round(n) {
  return Number(n.toFixed(2));
}

/* =========================
   TEAM STATS
========================= */

function buildStats(matches, teamId) {

  let scored = 0;
  let conceded = 0;

  let homeScored = 0;
  let homeConceded = 0;
  let awayScored = 0;
  let awayConceded = 0;

  let homeGames = 0;
  let awayGames = 0;

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let cleanSheets = 0;
  let failedToScore = 0;

  matches.forEach(match => {

    const isHome = match.homeTeam.id === teamId;

    const gf = isHome
      ? safe(match.score.fullTime.home)
      : safe(match.score.fullTime.away);

    const ga = isHome
      ? safe(match.score.fullTime.away)
      : safe(match.score.fullTime.home);

    scored += gf;
    conceded += ga;

    if (isHome) {
      homeGames++;
      homeScored += gf;
      homeConceded += ga;
    } else {
      awayGames++;
      awayScored += gf;
      awayConceded += ga;
    }

    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;

    if (ga === 0) cleanSheets++;
    if (gf === 0) failedToScore++;

  });

  const played = matches.length || 1;

  return {

    played,

    wins,
    draws,
    losses,

    cleanSheets,
    failedToScore,

    avgScored: round(scored / played),
    avgConceded: round(conceded / played),

    homeAttack: round(homeScored / Math.max(homeGames,1)),
    awayAttack: round(awayScored / Math.max(awayGames,1)),

    homeDefense: round(homeConceded / Math.max(homeGames,1)),
    awayDefense: round(awayConceded / Math.max(awayGames,1))

  };

}
/* =========================
   FORM + STRENGTH VIP
========================= */

function computeStrength(stats) {

  const attackIndex =
    stats.avgScored * 25;

  const defenseIndex =
    (2 - stats.avgConceded) * 20;

  const homeBonus =
    stats.homeAttack * 8;

  const awayBonus =
    stats.awayAttack * 8;

  const cleanSheetBonus =
    stats.cleanSheets * 2;

  const formIndex =
    (
      stats.wins * 3 +
      stats.draws
    ) / Math.max(stats.played * 3, 1) * 30;

  let strength =
    attackIndex +
    defenseIndex +
    homeBonus +
    awayBonus +
    cleanSheetBonus +
    formIndex;

  strength = Math.max(10, Math.min(100, strength));

  return Number(strength.toFixed(1));
}

function computeReliability(stats) {

  let reliability =
    stats.played / 8;

  reliability = Math.max(
    0.30,
    Math.min(1, reliability)
  );

  return Number(reliability.toFixed(2));
}
/* =========================
   MAIN ANALYZER
========================= */

async function analyzeTeam(team) {

  if (CACHE.has(team.id)) {
    return CACHE.get(team.id);
  }

  const matches = await getTeamRecentMatches(team.id, 8);

  if (!matches || matches.length === 0) {

    const fallback = {
      teamName: team.name,
      teamId: team.id,

      strength: 50,
      rawStrength: 50,
      reliability: 0.30,

      avgScored: 1,
      avgConceded: 1,

      homeAttack: 1,
      awayAttack: 1,

      homeDefense: 1,
      awayDefense: 1,

      wins: 0,
      draws: 0,
      losses: 0,

      cleanSheets: 0,
      failedToScore: 0,

      formPoints: 0
    };

    CACHE.set(team.id, fallback);
    return fallback;
  }

  const stats = buildStats(matches, team.id);

  const result = {

    teamName: team.name,
    teamId: team.id,

    strength: computeStrength(stats),
    rawStrength: computeStrength(stats),

    reliability: computeReliability(stats),

    avgScored: stats.avgScored,
    avgConceded: stats.avgConceded,

    homeAttack: stats.homeAttack,
    awayAttack: stats.awayAttack,

    homeDefense: stats.homeDefense,
    awayDefense: stats.awayDefense,

    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,

    cleanSheets: stats.cleanSheets,
    failedToScore: stats.failedToScore,

    formPoints:
      (stats.wins * 3 + stats.draws) /
      (stats.played * 3)

  };

  CACHE.set(team.id, result);

  return result;

}
module.exports = {
  analyzeTeam
};
