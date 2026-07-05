const fetch = require("node-fetch");

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

const ALLOWED_COMPETITIONS = [
  "PL",
  "PD",
  "SA",
  "BL1",
  "FL1",
  "DED",
  "PPL",
  "ELC",
  "BSA",
  "CL",
  "WC"
];

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
   GET MATCHES (V17)
========================= */
async function getMatches() {

  const cached = CACHE.matches;

  if (cached.data && Date.now() < cached.expiresAt) {
    console.log("⚡ MATCHES FROM CACHE");
    return cached.data;
  }

  const data = await apiGet("/matches");

  if (!data || !data.matches) {
    return [];
  }

  const ALLOWED_COMPETITIONS = [
    "PL","PD","SA","BL1","FL1","DED","PPL","ELC","BSA","CL","WC"
  ];

  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(now.getDate() + 7); // 👈 IMPORTANT : 7 jours (pas 14)

  let allMatches = data.matches
    .filter(m =>
      m?.homeTeam &&
      m?.awayTeam &&
      m.homeTeam?.id &&
      m.awayTeam?.id &&
      m.competition?.code
    )
    .filter(m =>
      ALLOWED_COMPETITIONS.includes(m.competition.code)
    )
    .filter(m => {
      const d = new Date(m.utcDate);
      return (
        ["TIMED", "SCHEDULED"].includes(m.status) &&
        d >= now &&
        d <= maxDate
      );
    })
    .map(m => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      competition: m.competition.code,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      score: m.score
    }))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  CACHE.matches = {
    data: allMatches,
    expiresAt: Date.now() + MATCHES_TTL
  };

  console.log("🔥 TOTAL MATCHES:", allMatches.length);

  return allMatches;
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  apiGet,
  getMatches,
  getTeamMatches
};
