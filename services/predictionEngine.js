const { analyzeTeam } = require("./teamAnalyzer");

const { getTeamRecentMatches } = require("./footballApi");

/* =========================
   CACHE
========================= */
const ANALYSIS_CACHE = {
  teams: {},
  matches: {}
};

const TEAM_ANALYSIS_TTL = 15 * 60 * 1000; // 15 min
const MATCH_ANALYSIS_TTL = 10 * 60 * 1000; // 10 min

/* =========================
   HELPERS
========================= */
function build1X2Probabilities(homeStats, awayStats) {
  const homePower = homeStats.strength + 4;
  const awayPower = awayStats.strength;

  const drawPower =
    20 - Math.min(
      Math.abs(homePower - awayPower),
      20
    );

  const total =
    homePower +
    awayPower +
    drawPower;

  return {
    home: Math.round((homePower / total) * 100),
    draw: Math.round((drawPower / total) * 100),
    away: Math.round((awayPower / total) * 100)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function safeAvg(total, count) {
  return count ? total / count : 0;
}

function getMatchCacheKey(match) {
  return `${match.homeTeam?.id}_${match.awayTeam?.id}_${match.utcDate}`;
}

/* =========================
   TEAM ANALYSIS
========================= */
async function analyzeTeamOLD(team) {
  const now = Date.now();
  const teamCache = ANALYSIS_CACHE.teams[team.id];

  if (teamCache && teamCache.expiresAt > now) {
    return teamCache.data;
  }

  const recentMatches = await getTeamRecentMatches(team.id, 10);
  let result;

  if (!recentMatches.length) {
    result = {
      teamId: team.id,
      teamName: team.name,
      matchesAnalyzed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsScored: 0,
      goalsConceded: 0,
      avgScored: 0,
      avgConceded: 0,
      bttsRate: 0,
      over25Rate: 0,
      cleanSheets: 0,
      formPoints: 0,
      strength: 50
    };
  } else {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsScored = 0;
    let goalsConceded = 0;
    let bttsCount = 0;
    let over25Count = 0;
    let cleanSheets = 0;

    for (const match of recentMatches) {
      const isHome = match.homeTeam?.id === team.id;

      const scored = isHome
        ? (match.score?.fullTime?.home ?? 0)
        : (match.score?.fullTime?.away ?? 0);

      const conceded = isHome
        ? (match.score?.fullTime?.away ?? 0)
        : (match.score?.fullTime?.home ?? 0);

      goalsScored += scored;
      goalsConceded += conceded;

      if (scored > conceded) wins++;
      else if (scored === conceded) draws++;
      else losses++;

      if (scored > 0 && conceded > 0) bttsCount++;
      if (scored + conceded > 2) over25Count++;
      if (conceded === 0) cleanSheets++;
    }

    const matchesCount = recentMatches.length;
    const avgScored = safeAvg(goalsScored, matchesCount);
    const avgConceded = safeAvg(goalsConceded, matchesCount);
    const bttsRate = safeAvg(bttsCount, matchesCount) * 100;
    const over25Rate = safeAvg(over25Count, matchesCount) * 100;
    const formPoints = wins * 3 + draws;

    const formScore = (formPoints / (matchesCount * 3)) * 40;
    const attackScore = clamp((avgScored / 2.5) * 25, 0, 25);
    const defenseScore = clamp((1 - avgConceded / 2.5) * 20, 0, 20);
    const bttsScore = clamp((bttsRate / 100) * 5, 0, 5);
    const overScore = clamp((over25Rate / 100) * 10, 0, 10);

    const strength = round(
      formScore + attackScore + defenseScore + bttsScore + overScore,
      1
    );

    result = {
      teamId: team.id,
      teamName: team.name,
      matchesAnalyzed: matchesCount,
      wins,
      draws,
      losses,
      goalsScored,
      goalsConceded,
      avgScored: round(avgScored, 2),
      avgConceded: round(avgConceded, 2),
      bttsRate: round(bttsRate, 1),
      over25Rate: round(over25Rate, 1),
      cleanSheets,
      formPoints,
      strength
    };
  }

  ANALYSIS_CACHE.teams[team.id] = {
    data: result,
    expiresAt: now + TEAM_ANALYSIS_TTL
  };

  return result;
}

/* =========================
   PREDICTIONS
========================= */
function buildWinnerPrediction(homeStats, awayStats) {

  const homePower =
    (homeStats.strength * 0.45) +
    (homeStats.formPoints * 1.5) +
    (homeStats.avgScored * 8) -
    (homeStats.avgConceded * 5) +
    4; // avantage domicile

  const awayPower =
    (awayStats.strength * 0.45) +
    (awayStats.formPoints * 1.5) +
    (awayStats.avgScored * 8) -
    (awayStats.avgConceded * 5);

  const diff = Math.abs(homePower - awayPower);

  let pick = "DRAW";

  if (homePower > awayPower + 5) {
    pick = homeStats.teamName;
  } else if (awayPower > homePower + 5) {
    pick = awayStats.teamName;
  }

  let confidence;

  if (pick === "DRAW") {
    confidence = 58;
  } else {
    confidence = 60 + (diff * 0.6);
  }

  confidence = clamp(
    Math.round(confidence),
    60,
    88
  );

  return {
    pick,
    confidence,
    homeScore: round(homePower, 1),
    awayScore: round(awayPower, 1),
    diff: round(diff, 1)
  };
}

function buildBTTSPrediction(homeStats, awayStats) {
  const attackIndex =
    (
      homeStats.avgScored +
      awayStats.avgScored +
      homeStats.avgConceded +
      awayStats.avgConceded
    ) / 4;

  const bttsProbability =
    (homeStats.bttsRate * 0.35) +
    (awayStats.bttsRate * 0.35) +
    (clamp(attackIndex / 2.5, 0, 1) * 30);

  return {
    pick: bttsProbability >= 58 ? "YES" : "NO",
    confidence: clamp(Math.round(bttsProbability), 50, 90)
  };
}

function buildOver25Prediction(homeStats, awayStats) {
  const expectedGoals =
    (
      homeStats.avgScored +
      awayStats.avgScored +
      homeStats.avgConceded +
      awayStats.avgConceded
    ) / 2;

  const overProbability =
    (homeStats.over25Rate * 0.35) +
    (awayStats.over25Rate * 0.35) +
    (clamp(expectedGoals / 3.5, 0, 1) * 30);

  return {
    market: overProbability >= 57 ? "OVER 2.5" : "UNDER 2.5",
    confidence: clamp(Math.round(overProbability), 50, 90),
    expectedGoals: round(expectedGoals, 2)
  };
}

function buildCorrectScore(homeStats, awayStats) {
  let homeExpected =
    (homeStats.avgScored * 0.65) +
    (awayStats.avgConceded * 0.35) +
    0.25;

  let awayExpected =
    (awayStats.avgScored * 0.65) +
    (homeStats.avgConceded * 0.35);

  homeExpected = clamp(homeExpected, 0, 3.5);
  awayExpected = clamp(awayExpected, 0, 3.5);

  const homeGoals = clamp(Math.round(homeExpected), 0, 4);
  const awayGoals = clamp(Math.round(awayExpected), 0, 4);

  return {
    score: `${homeGoals}-${awayGoals}`,
    expectedHomeGoals: round(homeExpected, 2),
    expectedAwayGoals: round(awayExpected, 2)
  };
}

function buildHTFTPrediction(homeStats, awayStats, winnerData) {
  if (winnerData.pick === "DRAW") {
    return {
      pick: "DRAW/DRAW",
      confidence: 60
    };
  }

  const strongHome =
    winnerData.pick === homeStats.teamName && winnerData.diff >= 8;

  const strongAway =
    winnerData.pick === awayStats.teamName && winnerData.diff >= 8;

  if (strongHome) {
    return {
      pick: "HOME/HOME",
      confidence: clamp(65 + Math.round(winnerData.diff), 65, 88)
    };
  }

  if (strongAway) {
    return {
      pick: "AWAY/AWAY",
      confidence: clamp(65 + Math.round(winnerData.diff), 65, 88)
    };
  }

  return {
    pick: winnerData.pick === homeStats.teamName ? "DRAW/HOME" : "DRAW/AWAY",
    confidence: 62
  };
}

/* =========================
   MATCH ANALYSIS
========================= */
async function analyzeMatch(match) {
  const now = Date.now();
  const cacheKey = getMatchCacheKey(match);
  const cached = ANALYSIS_CACHE.matches[cacheKey];

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const [homeStats, awayStats] = await Promise.all([
    analyzeTeam(homeTeam),
    analyzeTeam(awayTeam)
  ]);

  const winner = buildWinnerPrediction(homeStats, awayStats);

const probabilities = build1X2Probabilities(
  homeStats,
  awayStats
);

   const score = buildCorrectScore(
  homeStats,
  awayStats
);

/* =========================
   V17 CONSISTENCY ENGINE
========================= */
const [homeGoals, awayGoals] =
  score.score.split("-").map(Number);

let finalWinner;

if (homeGoals > awayGoals) {
  finalWinner = homeStats.teamName;
} else if (awayGoals > homeGoals) {
  finalWinner = awayStats.teamName;
} else {
  finalWinner = "DRAW";
}

const finalBTTS =
  homeGoals > 0 && awayGoals > 0
    ? "YES"
    : "NO";

const finalOver25 =
  homeGoals + awayGoals >= 3
    ? "OVER 2.5"
    : "UNDER 2.5";

const btts = {
  pick: finalBTTS,
  confidence: 70
};

const over25 = {
  market: finalOver25,
  confidence: 70,
  expectedGoals:
    score.expectedHomeGoals +
    score.expectedAwayGoals
};

const winnerFixed = {
  ...winner,
  pick: finalWinner
};

const htft = buildHTFTPrediction(
  homeStats,
  awayStats,
  winnerFixed
);
const result = {
    match: `${homeTeam.name} vs ${awayTeam.name}`,
    date: match.utcDate,
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,

    teamStats: {
  home: homeStats,
  away: awayStats
},

predictions: {
  winner: winnerFixed.pick,
  winnerConfidence: winner.confidence,

  probabilities,

  btts: btts.pick,
  bttsConfidence: btts.confidence,

  over25: over25.market,
  over25Confidence: over25.confidence,

  correctScore: score.score,

  htft: htft.pick,
  htftConfidence: htft.confidence
},

    model: {
      winnerDiff: winnerFixed.diff || winner.diff,
      expectedGoals: over25.expectedGoals,
      expectedHomeGoals: score.expectedHomeGoals,
      expectedAwayGoals: score.expectedAwayGoals
    }
  };

  ANALYSIS_CACHE.matches[cacheKey] = {
    data: result,
    expiresAt: now + MATCH_ANALYSIS_TTL
  };

  return result;
}

module.exports = {
  analyzeTeam,
  analyzeMatch
};
