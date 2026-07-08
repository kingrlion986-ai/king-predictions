const { getTeamMatches } = require("./footballApi");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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
  // Les matchs les plus récents ont le poids le plus élevé
const maxIndex = Math.max(matches.length - 1, 1);
const weight = 2 - (index / maxIndex);

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

  // Puissance offensive
  strength += stats.avgScored * 20;

  // Solidité défensive
  strength += Math.max(0, (2.5 - stats.avgConceded)) * 18;

  // Forme (victoires et nuls)
  const formRate =
    (stats.wins * 3 + stats.draws) /
    (stats.played * 3);
  strength += formRate * 25;

  // Performances domicile / extérieur
  strength += stats.homeAttack * 6;
  strength += stats.awayAttack * 6;

  // Défense domicile / extérieur
  strength += Math.max(0, (2 - stats.homeDefense)) * 5;
  strength += Math.max(0, (2 - stats.awayDefense)) * 5;

  // Clean sheets
  strength += (stats.cleanSheets / stats.played) * 10;

  // Capacité à marquer régulièrement
  strength -= (stats.failedToScore / stats.played) * 10;

  // Profil offensif
  strength += (stats.over25Rate / 100) * 5;

  // Légère pénalité pour une équipe très souvent en Under
  strength -= (stats.under25Rate / 100) * 2;

  return clamp(
    Math.round(strength),
    10,
    100
  );
}

/* =========================
   RELIABILITY
========================= */

function computeReliability(stats) {

  let reliability = 0.30;

  // Plus on a de matchs, plus c'est fiable
  reliability += Math.min(stats.played, 10) * 0.05;

  // Une équipe qui gagne régulièrement est plus prévisible
  reliability += (stats.wins / Math.max(stats.played, 1)) * 0.20;

  return Number(
    Math.min(reliability, 1).toFixed(2)
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

    played: stats.played,

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
