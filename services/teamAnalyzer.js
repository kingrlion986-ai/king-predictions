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

  homeAttack: 0,
  awayAttack: 0,

  homeDefense: 0,
  awayDefense: 0,

  homeWins: 0,
  awayWins: 0,

  failedToScore: 0,

  recentGoals: [],
  recentConceded: [],

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

   let failedToScore = 0;

let homeWins = 0;
let awayWins = 0;

let homeGoals = 0;
let awayGoals = 0;

let homeConceded = 0;
let awayConceded = 0;

let homeMatches = 0;
let awayMatches = 0;

const recentGoals = [];
const recentConceded = [];

  const form = [];

  for (const match of matches) {
    const isHome = match.homeTeam.id === team.id;

    const scored = isHome
      ? (match.score?.fullTime?.home ?? 0)
      : (match.score?.fullTime?.away ?? 0);

    const conceded = isHome
      ? (match.score?.fullTime?.away ?? 0)
      : (match.score?.fullTime?.home ?? 0);

     recentGoals.push(scored);
recentConceded.push(conceded);

if (scored === 0) {
  failedToScore++;
}

if (isHome) {
  homeMatches++;
  homeGoals += scored;
  homeConceded += conceded;

  if (scored > conceded) {
    homeWins++;
  }

} else {

  awayMatches++;
  awayGoals += scored;
  awayConceded += conceded;

  if (scored > conceded) {
    awayWins++;
  }
}

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

   const homeAttack =
  homeMatches > 0 ? homeGoals / homeMatches : 0;

const awayAttack =
  awayMatches > 0 ? awayGoals / awayMatches : 0;

const homeDefense =
  homeMatches > 0 ? homeConceded / homeMatches : 0;

const awayDefense =
  awayMatches > 0 ? awayConceded / awayMatches : 0;

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

     homeAttack: round(homeAttack, 2),
awayAttack: round(awayAttack, 2),

homeDefense: round(homeDefense, 2),
awayDefense: round(awayDefense, 2),

homeWins,
awayWins,

failedToScore,

recentGoals: recentGoals.slice(0, 5),
recentConceded: recentConceded.slice(0, 5),

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
