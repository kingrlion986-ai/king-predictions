const { getTeamMatches } = require("./footballApi");
const { getTeamElo } = require("./eloEngine");

const CACHE = new Map();
const RUNNING = new Map();
const TTL = 6 * 60 * 60 * 1000;

const COMP_WEIGHT = {
  CL: 1.25,
  PL: 1.20,
  PD: 1.20,
  SA: 1.18,
  BL1: 1.18,
  FL1: 1.16,
  DED: 1.08,
  BSA: 1.08,
  PPL: 1.10,
  ELC: 1.05,
  DEFAULT: 1
};

const clamp = (v, a, b) =>
  Math.max(a, Math.min(b, v));

const avg = (a, b) =>
  b ? a / b : 0;

function analyzeStats(matches, teamId) {

  let w = 0;
  let gf = 0;
  let ga = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let over25 = 0;
  let btts = 0;
  let clean = 0;
  let failed = 0;
  let opponentStrength = 0;

  matches.forEach((m, i) => {

    const home = m.homeTeam.id === teamId;

    const scored = home
      ? m.score.fullTime.home
      : m.score.fullTime.away;

    const conceded = home
      ? m.score.fullTime.away
      : m.score.fullTime.home;

    const opponent =
      home ? m.awayTeam : m.homeTeam;

    const elo = getTeamElo(opponent.id);

    const oppStrength = clamp(
      ((elo - 1200) / 800) * 100,
      20,
      95
    );

    const recency = 1.25 - i * 0.04;

    const weight =
      recency *
      (COMP_WEIGHT[m.competition?.code] || 1) *
      (0.8 + oppStrength / 250);

    w += weight;
    gf += scored * weight;
    ga += conceded * weight;
    opponentStrength += oppStrength * weight;

    if (scored > conceded) wins++;
    else if (scored === conceded) draws++;
    else losses++;

    if (scored + conceded >= 3) over25++;
    if (scored > 0 && conceded > 0) btts++;
    if (conceded === 0) clean++;
    if (scored === 0) failed++;
  });

  const played = matches.length;

  const avgScored = avg(gf, w);
  const avgConceded = avg(ga, w);

  const pointsRate =
    (wins * 3 + draws) /
    Math.max(played * 3, 1);

  const goalBalance =
    avgScored - avgConceded;

  const strength = Math.round(
    clamp(
      50 +
      (avg(opponentStrength, w) - 50) * 0.12 +
      (avgScored - 1) * 7 +
      goalBalance * 5 +
      (1.8 - avgConceded) * 4 +
      (pointsRate - 0.5) * 20 +
      (clean / played) * 4 -
      (failed / played) * 4,
      25,
      90
    )
  );

  const stability = Math.round(
    clamp(
      50 +
      (avgScored - 1) * 8 -
      (avgConceded - 1.2) * 8,
      25,
      90
    )
  );

  const reliability = Number(
    clamp(
      0.35 +
      Math.min(played / 10, 1) * 0.2 +
      pointsRate * 0.25 +
      (stability / 100) * 0.2,
      0.3,
      0.85
    ).toFixed(2)
  );

  return {
    teamId,
    played,
    wins,
    draws,
    losses,

    strength,
    stability,
    reliability,

    avgScored: +avgScored.toFixed(2),
    avgConceded: +avgConceded.toFixed(2),
    goalBalance: +goalBalance.toFixed(2),

    over25Rate: Math.round(over25 / played * 100),
    bttsRate: Math.round(btts / played * 100),

    cleanSheets: clean,
    failedToScore: failed,

    averageOpponentStrength:
      Math.round(avg(opponentStrength, w)),

    formPoints:
      +((wins * 3 + draws) / played).toFixed(2),

    dataAvailable: true
  };
}

async function analyzeTeam(team) {

  if (CACHE.has(team.id)) {
    const c = CACHE.get(team.id);

    if (Date.now() - c.time < TTL)
      return c.data;

    CACHE.delete(team.id);
  }

  if (RUNNING.has(team.id))
    return RUNNING.get(team.id);

  const promise = (async () => {

    const all =
      await getTeamMatches(team.id);

    const matches = (all || [])
      .filter(m =>
        m.status === "FINISHED" &&
        m.score?.fullTime &&
        Number.isFinite(m.score.fullTime.home) &&
        Number.isFinite(m.score.fullTime.away)
      )
      .sort(
        (a, b) =>
          new Date(b.utcDate) -
          new Date(a.utcDate)
      )
      .slice(0, 8);

    /*
     * RÈGLE ABSOLUE :
     * moins de 5 matchs = pas d'analyse.
     */

    if (matches.length < 5) {

      console.warn(
        `🚫 SKIP ${team.name}: ${matches.length}/5 matchs`
      );

      return null;
    }

    const result =
      analyzeStats(matches, team.id);

    result.teamName = team.name;

    CACHE.set(team.id, {
      time: Date.now(),
      data: result
    });

    console.log(
      `✅ ${team.name} | STR ${result.strength} | REL ${result.reliability} | DATA ${result.played}`
    );

    return result;

  })();

  RUNNING.set(team.id, promise);

  try {
    return await promise;
  } finally {
    RUNNING.delete(team.id);
  }
}

module.exports = {
  analyzeTeam
};
