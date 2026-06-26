const { getTeamRecentMatches } = require("./footballApi");

/* =========================
   CACHE
========================= */
const CACHE = {};
const TTL = 15 * 60 * 1000;

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
   MAIN ANALYSIS
========================= */
async function analyzeTeam(team) {
  const now = Date.now();
  const cached = CACHE[team.id];

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const matches = await getTeamRecentMatches(team.id, 10);

  if (!matches || matches.length === 0) {
    const empty = {
      teamId: team.id,
      teamName: team.name,
      matchesAnalyzed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      avgScored: 0,
      avgConceded: 0,
      cleanSheets: 0,
      bttsRate: 0,
      over25Rate: 0,
      formPoints: 0,
      strength: 50,
      attackIndex: 50,
      defenseIndex: 50,
      recentForm: []
    };

    CACHE[team.id] = {
      data: empty,
      expiresAt: now + TTL
    };

    return empty;
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsFor = 0;
  let goalsAgainst = 0;

  let cleanSheets = 0;
  let bttsCount = 0;
  let over25Count = 0;

  const form = [];

  for (const match of matches) {
    const isHome = match.homeTeam.id === team.id;

    const scored = isHome
      ? (match.score?.fullTime?.home ?? 0)
      : (match.score?.fullTime?.away ?? 0);

    const conceded = isHome
      ? (match.score?.fullTime?.away ?? 0)
      : (match.score?.fullTime?.home ?? 0);

    goalsFor += scored;
    goalsAgainst += conceded;

    if (scored > conceded) {
      wins++;
      form.push("W");
    } else if (scored === conceded) {
      draws++;
      form.push("D");
    } else {
      losses++;
      form.push("L");
    }

    if (scored > 0 && conceded > 0) bttsCount++;
    if (scored + conceded >= 3) over25Count++;
    if (conceded === 0) cleanSheets++;
  }

  const matchesCount = matches.length;

  const avgScored = goalsFor / matchesCount;
  const avgConceded = goalsAgainst / matchesCount;

  const bttsRate = (bttsCount / matchesCount) * 100;
  const over25Rate = (over25Count / matchesCount) * 100;

  const formPoints = wins * 3 + draws;

  /* =========================
     INDICES V17
  ========================= */

  const attackIndex = clamp(avgScored * 35, 0, 100);
  const defenseIndex = clamp((1 - avgConceded / 3) * 100, 0, 100);

  const formIndex = (formPoints / (matchesCount * 3)) * 100;

  const strength = clamp(
    round(
      (attackIndex * 0.35) +
      (defenseIndex * 0.35) +
      (formIndex * 0.30),
      1
    ),
    0,
    100
  );

  const result = {
    teamId: team.id,
    teamName: team.name,

    matchesAnalyzed: matchesCount,

    wins,
    draws,
    losses,

    avgScored: round(avgScored, 2),
    avgConceded: round(avgConceded, 2),

    cleanSheets,
    bttsRate: round(bttsRate, 1),
    over25Rate: round(over25Rate, 1),

    formPoints,

    attackIndex: round(attackIndex, 1),
    defenseIndex: round(defenseIndex, 1),

    strength,

    recentForm: form.slice(0, 5)
  };

  CACHE[team.id] = {
    data: result,
    expiresAt: now + TTL
  };

  return result;
}

module.exports = {
  analyzeTeam
};
