const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

/* =========================
   CONFIGURATION
========================= */

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";
const TEAM_CACHE_FILE = path.join(__dirname, "..", "teamCache.json");

/* =========================
   COMPETITIONS
========================= */

const PRIMARY_COMPETITIONS = [
  "PL",
  "PD",
  "SA",
  "BL1",
  "FL1"
];


const SECONDARY_COMPETITIONS = [

  // Bons championnats
  "CL",
  "DED",
  "BSA",
  "PPL",

  // Deuxièmes divisions
  "ELC",   // Championship Angleterre
  "BL2",   // Bundesliga 2
  "FL2",   // Ligue 2 France
  "SD",    // Segunda Espagne
  "SA2"    // Serie B Italie
];
/* =========================
   COMPETITION WEIGHT SYSTEM
========================= */

const COMPETITION_WEIGHTS = {

  PL: 1.20,
  PD: 1.20,
  SA: 1.15,
  BL1: 1.15,
  FL1: 1.10,

  CL: 1.10,
  DED: 0.90,
  BSA: 0.95,
  ELC: 0.85,
  PPL: 0.80,

  // Deuxièmes divisions
  BL2: 0.95,
  FL2: 0.95,
  SD: 0.95,
  SA2: 0.90

};
function loadPersistentTeamCache() {

  try {

    if (!fs.existsSync(TEAM_CACHE_FILE)) {
      fs.writeFileSync(
        TEAM_CACHE_FILE,
        JSON.stringify({})
      );
    }

    return JSON.parse(
      fs.readFileSync(
        TEAM_CACHE_FILE,
        "utf8"
      )
    );

  } catch (err) {

    console.log("❌ TEAM CACHE LOAD:", err.message);

    return {};

  }

}

function savePersistentTeamCache(cache) {

  try {

    fs.writeFileSync(
      TEAM_CACHE_FILE,
      JSON.stringify(cache, null, 2)
    );

  } catch (err) {

    console.log("❌ TEAM CACHE SAVE:", err.message);

  }

}


/* =========================
   CACHE SYSTEM
========================= */

const CACHE = {

  matches: {
    data: null,
    expiresAt: 0
  },

  teamMatches: new Map()

};


const MATCH_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const TEAM_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const PERSISTENT_TEAM_CACHE =
  loadPersistentTeamCache();



/* =========================
   API QUEUE SYSTEM
========================= */

// Nombre maximum d'appels API simultanés
const MAX_CONCURRENT_REQUESTS = 1;

let activeRequests = 0;

const REQUEST_QUEUE = [];


/* =========================
   HELPERS
========================= */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/*
  Gestionnaire de file d'attente.
  Empêche Football-Data de recevoir
  trop de requêtes en même temps.
*/

function enqueue(task) {

  return new Promise((resolve, reject) => {

    REQUEST_QUEUE.push({
      task,
      resolve,
      reject
    });

    processQueue();

  });

}


async function processQueue() {

  if (
    activeRequests >= MAX_CONCURRENT_REQUESTS ||
    REQUEST_QUEUE.length === 0
  ) {
    return;
  }


  const job = REQUEST_QUEUE.shift();

  activeRequests++;


  try {

    const result = await job.task();

    job.resolve(result);

  } catch (error) {

    job.reject(error);

  }


  activeRequests--;

setImmediate(processQueue);

}



/* =========================
   API RETRY CONFIG
========================= */

const MAX_RETRIES = 3;


/*
 La vraie requête API sera ajoutée
 dans la partie 2.
*/

/* =========================
   API REQUEST V17
========================= */

async function apiGet(endpoint, retry = 0) {

  return enqueue(async () => {

    try {

      const controller = new AbortController();

const timeout = setTimeout(
  () => controller.abort(),
  10000
);

       await sleep(3000);
       
       console.log("➡️ API CALL:", endpoint);


const res = await fetch(
 `${BASE_URL}${endpoint}`,
 {
   headers:{
    "X-Auth-Token": API_KEY
   },
   signal: controller.signal
 }
);
       console.log("✅ API RESPONSE:", endpoint, res.status);


clearTimeout(timeout);

      if (res.status === 429) {

    console.log("⚠️ RATE LIMIT 429:", endpoint);

    if (retry < MAX_RETRIES) {

        const delay = 15000 * (retry + 1);

        console.log(`⏳ RETRY ${retry + 1} AFTER ${delay}ms`);

        await sleep(delay);

        return await apiGet(endpoint, retry + 1);

    }

    return null;
      }

      if (!res.ok) {

        console.log(`❌ API ERROR ${res.status} → ${endpoint}`);

        return null;
      }

      return await res.json();

    } catch (error) {

      console.log("❌ API FAILURE:", error.message);

      return null;
    }

  });

}

/* =========================
   FORMAT MATCH
========================= */

function formatMatch(match) {

  if (!match || !match.homeTeam || !match.awayTeam) {
    return null;
  }

  return {

    id: match.id,

    utcDate: match.utcDate,

    status: match.status,

    competition: {

  code: match.competition?.code,

  name: match.competition?.name,

  weight:
    COMPETITION_WEIGHTS[
      match.competition?.code
    ] || 0.70

},

    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name
    },

    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name
    },

    score: match.score

  };

}

console.log("FORMAT MATCH TYPE =", typeof formatMatch);

/* =========================
   GET COMPETITION MATCHES
========================= */

async function getCompetitionMatches(code) {

  console.log(">>> GET COMPETITION", code);

  const today = new Date();

  const dateFrom = today.toISOString().split("T")[0];

  const dateTo = new Date(
    today.getTime() + 14 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];


  const data = await apiGet(
    `/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
  );


  if (!data || !Array.isArray(data.matches)) {
    return [];
  }


  return data.matches
    .map(formatMatch)
    .filter(Boolean);

}

async function getCompetitionMatchesSmart(code) {

  for (let start = 0; start <= 14; start += 3) {

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() + start);

    const dateTo = new Date();
    dateTo.setDate(dateTo.getDate() + start + 2);

    const from = dateFrom.toISOString().split("T")[0];
    const to = dateTo.toISOString().split("T")[0];

    console.log(
      `🔍 ${code} : ${from} -> ${to}`
    );

    const data = await apiGet(
      `/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`
    );

     if (
    data &&
    data.resultSet &&
    data.resultSet.count === 0
) {

    console.log(
        `ℹ️ ${code}: aucun match sur cette période`
    );

     }

     console.log("RÉPONSE API :", JSON.stringify(data, null, 2));

     console.log(`${code} : API a renvoyé ${data?.matches?.length || 0} matchs`);

    if (
      data &&
      Array.isArray(data.matches) &&
      data.matches.length > 0
    ) {

      console.log(
        `✅ ${code} : ${data.matches.length} matchs trouvés`
      );

      return data.matches
        .map(formatMatch)
        .filter(Boolean);
    }

  }

  return [];
}

  
/* =========================
   MATCH CLEANERS
========================= */

function removeDuplicates(matches) {

  const seen = new Set();

  return matches.filter(match => {

    if (seen.has(match.id)) {
      return false;
    }

    seen.add(match.id);

    return true;

  });

}



function filterMatches(matches) {

  console.log("AVANT FILTER:", matches.length);

  const now = new Date();

  const filtered = matches.filter(match => {

    if (!match.homeTeam || !match.awayTeam) {
      return false;
    }

    const matchDate = new Date(match.utcDate);

    const diffHours =
      (matchDate - now) / (1000 * 60 * 60);

    console.log(
      "CHECK:",
      match.homeTeam.name,
      "vs",
      match.awayTeam.name,
      match.utcDate,
      "dans",
      Math.round(diffHours),
      "heures"
    );


    return diffHours >= 0 && diffHours <= 168;

  });

  console.log("APRES FILTER:", filtered.length);

  return filtered;

}

function addMatchQuality(matches) {

  const bigTeams = [
    "Real Madrid",
    "Barcelona",
    "Manchester City",
    "Liverpool",
    "Arsenal",
    "Bayern",
    "PSG",
    "Inter",
    "Juventus",
    "Milan"
  ];

  const result = matches.map(match => {

    let quality =
50 *
(match.competition?.weight || 1);

    if (
      bigTeams.some(team =>
        match.homeTeam.name.includes(team) ||
        match.awayTeam.name.includes(team)
      )
    ) {
      quality += 25;
    }

    return {
      ...match,
      quality
    };

  });

  console.log("QUALITY TEST:", result.length);

  return result;

}

/* =========================
   MATCH RUNNING LOCK
========================= */

let MATCH_LOADING = null;



/* =========================
   GET ALL MATCHES V17
========================= */

async function getMatches() {


  if (
    CACHE.matches.data &&
    Date.now() <
    CACHE.matches.expiresAt
  ) {

    console.log(
      "⚡ CACHE MATCHES"
    );

    return CACHE.matches.data;

  }



  if (MATCH_LOADING) {

    console.log(
      "⏳ WAIT MATCH LOADING"
    );

    return MATCH_LOADING;

  }



  MATCH_LOADING =
  (async () => {


    let matches = [];



    try {



      for (const competition of PRIMARY_COMPETITIONS) {

  await sleep(3000);

  console.log("📡 PRIMARY:", competition);

  const result = await getCompetitionMatches(competition);

  console.log(competition, "=>", result.length);

  matches.push(...result);

  console.log("COMPÉTITION :", competition);
  console.log("APRÈS PUSH =", matches.length);

  console.log("TOTAL =", matches.length);

      }


      /*
        On ajoute les compétitions secondaires
        seulement si nécessaire
      */

      const MIN_MATCHES = 20;

if (matches.length < MIN_MATCHES) {

  console.log(
    `📦 Seulement ${matches.length} matchs trouvés. Chargement des compétitions secondaires...`
  );

  for (const competition of SECONDARY_COMPETITIONS) {

    console.log("📡 SECONDARY:", competition);

    const result = await getCompetitionMatches(competition);

    console.log("TYPE :", typeof result);
    console.log("IS ARRAY :", Array.isArray(result));
    console.log("RESULT :", result);

    if (Array.isArray(result)) {
      matches.push(...result);
    } else {
      console.error("❌ getCompetitionMatches ne retourne pas un tableau");
    }

    console.log("COMPÉTITION :", competition);
    console.log("APRÈS PUSH =", matches.length);

    // Arrête dès qu'on a assez de matchs
    if (matches.length >= MIN_MATCHES) {
      console.log("✅ Nombre minimum de matchs atteint.");
      break;
    }
  }

}

       matches = removeDuplicates(matches);

matches = filterMatches(matches);

matches = addMatchQuality(matches);

matches.sort((a, b) => {


        if (
          b.quality !== a.quality
        ) {

          return b.quality - a.quality;

        }


        return (
          new Date(a.utcDate) -
          new Date(b.utcDate)
        );


      });



      CACHE.matches = {

        data: matches,

        expiresAt:
          Date.now() + MATCH_CACHE_TTL

      };



      console.log(
  "🔥 MATCHES TOTAL:",
  matches.length
);

console.log("TOTAL MATCHES RETURNED =", matches.length);
console.log(matches.slice(0,3));

return matches;

} finally {

  MATCH_LOADING = null;

}

})();



/* =========================
   TEAM MATCHES
========================= */
async function getTeamMatches(teamId) {

  // 1. Cache mémoire
  const cached = CACHE.teamMatches.get(teamId);

  if (cached && Date.now() < cached.expiresAt) {
    console.log("⚡ MEMORY CACHE:", teamId);
    return cached.data;
  }

  // 2. Cache disque
  const persistent = PERSISTENT_TEAM_CACHE[teamId];

  if (
    persistent &&
    Date.now() < persistent.expiresAt
  ) {

    console.log("💾 DISK CACHE:", teamId);

    CACHE.teamMatches.set(teamId, persistent);

    return persistent.data;
  }

  // 3. API
  const data = await apiGet(
    `/teams/${teamId}/matches?status=FINISHED`
  );

  if (!data || !Array.isArray(data.matches)) {
    return [];
  }

  const matches = data.matches
    .slice(0, 8)
    .map(formatMatch)
    .filter(Boolean);

  const cacheEntry = {
    data: matches,
    expiresAt: Date.now() + TEAM_CACHE_TTL
  };

  // Sauvegarde mémoire
  CACHE.teamMatches.set(teamId, cacheEntry);

  // Sauvegarde disque
  PERSISTENT_TEAM_CACHE[teamId] = cacheEntry;
  savePersistentTeamCache(PERSISTENT_TEAM_CACHE);

  console.log("💾 TEAM SAVED:", teamId);

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
