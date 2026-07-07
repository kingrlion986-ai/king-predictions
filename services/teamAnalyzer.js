const { getTeamMatches } = require("./footballApi");

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

  let over25 = 0;
  let under25 = 0;
  let btts = 0;

  matches.forEach((match, index) => {

  // Les matchs les plus récents ont plus d'importance
  const weight = 1 + (index / Math.max(matches.length - 1, 1));

    const isHome = match.homeTeam.id === teamId;

    const gf = isHome
      ? safe(match.score.fullTime.home)
      : safe(match.score.fullTime.away);

    const ga = isHome
      ? safe(match.score.fullTime.away)
      : safe(match.score.fullTime.home);

    scored += gf * weight;
    conceded += ga * weight;
     
    if (isHome) {
      homeGames++;
      homeScored += gf * weight;
      homeConceded += ga * weight;
    } else {
      awayGames++;
      awayScored += gf * weight;
      awayConceded += ga * weight;
    }

    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;

    if (ga === 0) cleanSheets++;
    if (gf === 0) failedToScore++;

    const totalGoals = gf + ga;

    if (totalGoals >= 3) over25++;
    else under25++;

    if (gf > 0 && ga > 0) btts++;

  });

  const played = matches.length || 1;

  return {
    played,

    wins,
    draws,
    losses,

    cleanSheets,
    failedToScore,

    over25Rate: round((over25 / played) * 100),
    under25Rate: round((under25 / played) * 100),
    bttsRate: round((btts / played) * 100),

    avgScored: round(scored / played),
    avgConceded: round(conceded / played),

    homeAttack: round(homeScored / Math.max(homeGames, 1)),
    awayAttack: round(awayScored / Math.max(awayGames, 1)),

    homeDefense: round(homeConceded / Math.max(homeGames, 1)),
    awayDefense: round(awayConceded / Math.max(awayGames, 1))
  };
}
   
/* =========================
   FORM + STRENGTH VIP
========================= */

function computeStrength(stats) {

  let strength = 0;

  // Attaque
  strength += stats.avgScored * 18;

  // Défense (moins on encaisse, mieux c'est)
  strength += (3 - stats.avgConceded) * 15;

  // Forme
  strength +=
    ((stats.wins * 3 + stats.draws) /
    (stats.played * 3)) * 30;

  // Domicile
  strength += stats.homeAttack * 8;

  // Extérieur
  strength += stats.awayAttack * 5;

  // Défense domicile
  strength += (2 - stats.homeDefense) * 6;

  // Clean sheets
  strength += stats.cleanSheets * 2;

  return clamp(
    Math.round(strength),
    10,
    100
  );
}
/* =========================
   MAIN ANALYZER
========================= */

async function analyzeTeam(team) {

  if (CACHE.has(team.id)) {
    return CACHE.get(team.id);
  }

  const matches = await getTeamMatches(team.id);

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

  const recentMatches = matches
  .filter(m => m.status === "FINISHED")
  .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
  .slice(0, 5);

const stats = buildStats(recentMatches, team.id);

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

    over25Rate: stats.over25Rate,
    under25Rate: stats.under25Rate,
    bttsRate: stats.bttsRate,

    formPoints:
      (stats.wins * 3 + stats.draws) /
      (stats.played * 3)

  };

   console.log("===== TEAM ANALYZER =====");
   console.log(result);

  CACHE.set(team.id, result);

  return result;

}
module.exports = {
  analyzeTeam
};
