const fetch = require("node-fetch");

/* =========================
   CONFIGURATION
========================= */

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

/* =========================
   API QUEUE V17
========================= */

let API_QUEUE = Promise.resolve();

const API_DELAY = 2200;


function wait(ms){

  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );

}



function queueRequest(task){

  API_QUEUE =
    API_QUEUE.then(async()=>{

      await wait(API_DELAY);

      return task();

    });


  return API_QUEUE;

}


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
  "CL",
  "DED",
  "BSA",
  "ELC",
  "PPL"
];


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
const TEAM_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures



/* =========================
   API QUEUE SYSTEM
========================= */

// Nombre maximum d'appels API simultanés
const MAX_CONCURRENT_REQUESTS = 2;

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

  processQueue();

}



/* =========================
   API RETRY CONFIG
========================= */

const MAX_RETRIES = 4;


/*
 La vraie requête API sera ajoutée
 dans la partie 2.
*/

/* =========================
   API REQUEST V17
========================= */

async function apiGet(endpoint, retry = 0) {

  return queueRequest(async () => {

    try {

      const res = await fetch(
        `${BASE_URL}${endpoint}`,
        {
          headers: {
            "X-Auth-Token": API_KEY
          }
        }
      );

      if (res.status === 429) {

        console.log("⚠️ RATE LIMIT 429:", endpoint);

        if (retry < 3) {

          const delay = 5000 * (retry + 1);

          console.log(`⏳ RETRY ${retry + 1} AFTER ${delay}ms`);

          await wait(delay);

          return apiGet(endpoint, retry + 1);
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
      name: match.competition?.name
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

  const data = await apiGet(`/competitions/${code}/matches`);

  console.log("DATA =", !!data);

  if (data) {
    console.log("MATCHES =", data.matches?.length);
    console.log(data.matches?.[0]);
  }

  if (!data || !Array.isArray(data.matches)) {
    return [];
  }

  return data.matches
    .filter(match =>
      ["SCHEDULED", "TIMED"].includes(match.status)
    )
    .map(formatMatch)
    .filter(Boolean);

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

  console.log("Avant filter :", matches.length);

  const filtered = matches.filter(match => {

    if (!match.homeTeam || !match.awayTeam) {
      return false;
    }

    const date = new Date(match.utcDate);

    return date > new Date();

  });

  console.log("Après filter :", filtered.length);

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



  return matches.map(match => {


    let quality = 50;


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

  console.log("📡 PRIMARY:", competition);

  const result = await getCompetitionMatches(competition);

  console.log(competition, "=>", result.length);

  matches.push(...result);

  console.log("TOTAL =", matches.length);

      }


      }



      /*
        On ajoute les compétitions secondaires
        seulement si nécessaire
      */

      if (matches.length < 30) {


        for (
          const competition of SECONDARY_COMPETITIONS
        ) {


          console.log(
            "📡 SECONDARY:",
            competition
          );


          const result =
            await getCompetitionMatches(
              competition
            );


          matches.push(
            ...result
          );



        }

      }


     console.log("AVANT removeDuplicates =", matches.length);

matches = removeDuplicates(matches);

console.log("APRÈS removeDuplicates =", matches.length);

matches = filterMatches(matches);

console.log("APRÈS filterMatches =", matches.length);

matches = addMatchQuality(matches);


      matches.sort((a,b)=> {


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



  return MATCH_LOADING;

}



/* =========================
   TEAM MATCHES
========================= */

async function getTeamMatches(teamId) {


  const cached =
    CACHE.teamMatches.get(teamId);



  if (
    cached &&
    Date.now() <
    cached.expiresAt
  ) {


    console.log(
      "⚡ TEAM CACHE:",
      teamId
    );


    return cached.data;

  }




  await sleep(1200);



  const data =
    await apiGet(
      `/teams/${teamId}/matches?status=FINISHED`
    );



  if (
    !data ||
    !Array.isArray(data.matches)
  ) {


    if (cached) {

      return cached.data;

    }


    return [];

  }





  const matches =
    data.matches

    .map(formatMatch)

    .filter(Boolean);





  CACHE.teamMatches.set(
    teamId,
    {

      data: matches,

      expiresAt:
        Date.now() + TEAM_CACHE_TTL

    }

  );



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
