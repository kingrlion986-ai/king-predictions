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
  console.log("📡 CALL API:", endpoint);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "X-Auth-Token": API_KEY
      }
    });

    if (!res.ok) {
      console.log(`❌ API ERROR ${res.status} on ${endpoint}`);
      return null;
    }

    const data = await res.json();

    console.log("📊 API RESPONSE KEYS:", Object.keys(data));

    return data;

  } catch (err) {
    console.log("❌ FOOTBALL API ERROR:", err.message);
    return null;
  }
}

/* =========================
   GET MATCHES (SAFE VERSION)
========================= */
async function getMatches() {

  const cached = CACHE.matches;

  // cache actif
  if (cached.data && Date.now() < cached.expiresAt) {
    console.log("⚡ MATCHES FROM CACHE");
    return cached.data;
  }

  const data = await apiGet("/matches");

  if (!data || !data.matches) {
    console.log("⚠️ No matches returned by API");
    return [];
  }

  const matches = data.matches.map(m => ({
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    stage: m.stage,
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.name
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.name
    },
    score: m.score
  }));

  CACHE.matches = {
    data: matches,
    expiresAt: Date.now() + MATCHES_TTL
  };

  return matches;
}

/* =========================
   TEAM MATCHES (FIXED)
========================= */
async function getTeamMatches(teamId) {

  const cache = CACHE.teamRecentMatches[teamId];

  if (cache && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  const data = await apiGet(
    `/teams/${teamId}/matches?status=FINISHED`
  );

  if (!data || !data.matches) {
    return [];
  }

  const matches = data.matches.map(m => ({
  id: m.id,
  utcDate: m.utcDate,
  status: m.status,

  homeTeam: {
    id: m.homeTeam.id,
    name: m.homeTeam.name
  },

  awayTeam: {
    id: m.awayTeam.id,
    name: m.awayTeam.name
  },

  score: {
    fullTime: {
      home: m.score.fullTime.home ?? 0,
      away: m.score.fullTime.away ?? 0
    }
  }
}));

  CACHE.teamRecentMatches[teamId] = {
    data: matches,
    expiresAt: Date.now() + TEAM_MATCHES_TTL
  };

  return matches;
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  apiGet,
  getMatches,
  getTeamMatches
};
