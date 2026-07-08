const fetch = require("node-fetch");

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

/* =========================
   COMPETITIONS PRIORITY
========================= */

const PRIMARY_COMPETITIONS = [
  "CL",
  "PL",
  "PD",
  "SA",
  "BL1",
  "FL1",
  "DED",
  "BSA"
];

const SECONDARY_COMPETITIONS = [
  "ELC",
  "PPL"
];
/* =========================
   CACHE
========================= */
const CACHE = {
  matches: {
    data: null,
    expiresAt: 0
  },

  teamMatches: {}
};

const MATCHES_TTL = 5 * 60 * 1000;
const TEAM_MATCHES_TTL = 15 * 60 * 1000;

/* =========================
   API CALL
========================= */
async function apiGet(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "X-Auth-Token": API_KEY
      }
    });

    if (!res.ok) {
      console.log(`❌ API ERROR ${res.status} → ${endpoint}`);
      return null;
    }

    const data = await res.json();
    return data;

  } catch (err) {
    console.log("❌ API FAILURE:", err.message);
    return null;
  }
}

/* =========================
   FORMAT MATCH
========================= */
function formatMatch(m) {
  if (!m?.homeTeam || !m?.awayTeam) return null;

  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    competition: {
      code: m.competition?.code,
      name: m.competition?.name
    },
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.name
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.name
    },
    score: m.score
  };
}

/* =========================
   FETCH COMPETITION MATCHES
========================= */
async function getCompetitionMatches(code) {

  const data = await apiGet(
    `/competitions/${code}/matches`
  );

  if (!data || !data.matches) return [];

  return data.matches
    .filter(match =>
      ["SCHEDULED", "TIMED"].includes(match.status)
    )
    .map(formatMatch)
    .filter(Boolean);
}
/* =========================
   FILTER MATCHES
========================= */
function filterMatches(matches) {

  const today = new Date();
  today.setHours(0,0,0,0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 10);

  return matches.filter(m => {

    const d = new Date(m.utcDate);

    return (
      m.homeTeam &&
      m.awayTeam &&
      ["TIMED", "SCHEDULED"].includes(m.status) &&
      d >= today &&
      d <= maxDate
    );

  });

}

function addMatchQuality(matches) {
  return matches.map(m => {
    let score = 50;

    const bigTeams = [
      "Real Madrid", "Barcelona", "Liverpool",
      "Manchester City", "Arsenal", "Bayern Munich",
      "PSG", "Inter", "AC Milan", "Juventus"
    ];

    const home = m.homeTeam.name;
    const away = m.awayTeam.name;

    if (bigTeams.some(t => home.includes(t) || away.includes(t))) {
      score += 30;
    }

    m.quality = score;
    return m;
  });
}

/* =========================
   REMOVE DUPLICATES
========================= */
function removeDuplicates(matches) {
  const seen = new Set();
  return matches.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/* =========================
   MAIN GET MATCHES (V18)
========================= */
async function getMatches() {

  const cached = CACHE.matches;
  if (cached.data && Date.now() < cached.expiresAt) {
    console.log("⚡ CACHE MATCHES");
    return cached.data;
  }

  let allMatches = [];

  // 1. PRIMARY
  for (const code of PRIMARY_COMPETITIONS) {

    console.log(`📡 PRIMARY: ${code}`);

    const matches = await getCompetitionMatches(code);

    allMatches = allMatches.concat(matches);

    // éviter le blocage API 429
    await new Promise(resolve => 
        setTimeout(resolve, 1500)
    );
  }

  // 2. IF NOT ENOUGH MATCHES → SECONDARY
  if (allMatches.length < 50) {
    for (const code of SECONDARY_COMPETITIONS) {
      console.log(`📡 SECONDARY: ${code}`);
      const matches = await getCompetitionMatches(code);
      allMatches = allMatches.concat(matches);
    }
  }

  // FILTER
  allMatches = removeDuplicates(allMatches);
  allMatches = filterMatches(allMatches);
  allMatches = addMatchQuality(allMatches);

  // SORT BY DATE
  allMatches.sort((a,b)=>{

  if (b.quality !== a.quality) {
    return b.quality - a.quality;
  }

  return new Date(a.utcDate) - new Date(b.utcDate);

});

  // CACHE
  CACHE.matches = {
    data: allMatches,
    expiresAt: Date.now() + MATCHES_TTL
  };

  console.log("🔥 TOTAL MATCHES V18:", allMatches.length);

   console.log(
  allMatches.map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    status: m.status,
    date: m.utcDate
  }))
);

   console.log("MATCHES FINAL =", allMatches.length);
   console.log(JSON.stringify(allMatches, null, 2));

  return allMatches;
}

/* =========================
   TEAM MATCHES
========================= */
async function getTeamMatches(teamId) {

  const cached = CACHE.teamMatches[teamId];

  if (cached && Date.now() < cached.expiresAt) {
    console.log(`⚡ TEAM CACHE ${teamId}`);
    return cached.data;
  }

  const data = await apiGet(`/teams/${teamId}/matches?status=FINISHED`);

if (!data?.matches) {

  // Si on possède déjà un cache pour cette équipe,
  // on le réutilise au lieu de perdre toutes les statistiques.
  if (CACHE.teamMatches[teamId]) {
    console.log(`⚠️ USING STALE CACHE FOR TEAM ${teamId}`);
    return CACHE.teamMatches[teamId].data;
  }

  return [];
}

  const matches = data.matches
    .map(formatMatch)
    .filter(Boolean);

  CACHE.teamMatches[teamId] = {
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
