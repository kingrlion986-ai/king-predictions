const fetch = require("node-fetch");

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

/* =========================
   CACHE CONFIG
========================= */
const CACHE = {
  matches: {
    data: null,
    expiresAt: 0
  },
  teamRecentMatches: {}
};

const MATCHES_TTL = 5 * 60 * 1000; // 5 min
const TEAM_MATCHES_TTL = 15 * 60 * 1000; // 15 min

/* =========================
   API CORE
========================= */
async function apiGet(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "X-Auth-Token": API_KEY
      }
    });

    if (!res.ok) {
      console.log(`API ERROR ${res.status} on ${endpoint}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.log("FOOTBALL API ERROR:", err.message);
    return null;
  }
}

/* =========================
   MATCHES
========================= */
async function getMatches() {
  const now = Date.now();

  if (CACHE.matches.data && CACHE.matches.expiresAt > now) {
    return CACHE.matches.data;
  }

  const data = await apiGet("/matches");
  const matches = (data?.matches || []).filter(
    m =>
      m &&
      m.homeTeam &&
      m.awayTeam &&
      m.homeTeam.id &&
      m.awayTeam.id
  );

  CACHE.matches = {
    data: matches,
    expiresAt: now + MATCHES_TTL
  };

  return matches;
}

/* =========================
   TEAM RECENT MATCHES
========================= */
async function getTeamRecentMatches(teamId, limit = 5) {
  const now = Date.now();
  const cacheKey = `${teamId}_${limit}`;

  const cached = CACHE.teamRecentMatches[cacheKey];
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await apiGet(
    `/teams/${teamId}/matches?status=FINISHED&limit=${limit}`
  );

  const matches = (data?.matches || []).filter(
    m =>
      m &&
      m.homeTeam &&
      m.awayTeam &&
      m.score &&
      m.score.fullTime
  );

  CACHE.teamRecentMatches[cacheKey] = {
    data: matches,
    expiresAt: now + TEAM_MATCHES_TTL
  };

   console.log(
  matches.slice(0, 5).map(m => ({
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    status: m.status
  }))
);

  return matches;
}

/* =========================
   OPTIONAL DEBUG
========================= */
function getCacheStats() {
  return {
    matchesCached: !!CACHE.matches.data,
    teamCaches: Object.keys(CACHE.teamRecentMatches).length
  };
}

module.exports = {
  getMatches,
  getTeamRecentMatches,
  getCacheStats
};
