const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

/* =====================================================
   KING PREDICTIONS V16
   FOOTBALL API ENGINE
   HISTORICAL DATABASE SYSTEM
===================================================== */


/* =========================
   DATABASES
========================= */

// Matchs à venir pour les prédictions
const UPCOMING_MATCH_DATABASE = [];

// Matchs terminés pour analyser les équipes
const HISTORY_MATCH_DATABASE = [];


/* =========================
   CONFIGURATION
========================= */

const API_KEY = process.env.API_KEY;

const BASE_URL =
    "https://api.football-data.org/v4";



/* =========================
   COMPETITIONS
========================= */

const PRIMARY_COMPETITIONS = [

    // Top 5
    "PL",
    "PD",
    "SA",
    "BL1",
    "FL1",

    // Europe
    "DED",
    "PPL",
    "BSA",
    "ELC",
    "BL2",
    "FL2",
    "SD",
    "SA2",

    // Coupes d'Europe
    "CL",
    "EL",
    "ECL",

    // Championnats jouant l'été
    "ALLSV", // Suède
    "ELITESERIEN", // Norvège
    "BRL1" // Brésil Série A

];


const SECONDARY_COMPETITIONS = [

    "CL",
    "DED",
    "BSA",
    "PPL",

    "ELC",
    "BL2",
    "FL2",
    "SD",
    "SA2"

];



/* =========================
   COMPETITION WEIGHTS
========================= */

const COMPETITION_WEIGHTS = {

    // Top 5
    PL: 1.20,
    PD: 1.20,
    SA: 1.15,
    BL1: 1.15,
    FL1: 1.10,

    // Coupes d'Europe
    CL: 1.10,
    EL: 1.05,
    ECL: 1.00,

    // Europe
    DED: 0.90,
    BSA: 0.95,
    PPL: 0.80,
    ELC: 0.85,
    BL2: 0.95,
    FL2: 0.95,
    SD: 0.95,
    SA2: 0.90,

    // Championnats été
    ALLSV: 0.85,
    ELITESERIEN: 0.90,
    BRL1: 1.00

};



/* =========================
   MEMORY CACHE
========================= */


const CACHE = {


    upcoming:{

        data:null,

        expiresAt:0

    },


    history:{

        data:null,

        expiresAt:0

    },


    teamMatches:new Map()


};



const MATCH_CACHE_TTL =
    30 * 60 * 1000;


const HISTORY_CACHE_TTL =
    24 * 60 * 60 * 1000;


const TEAM_CACHE_TTL =
    7 *
    24 *
    60 *
    60 *
    1000;



/* =========================
   API QUEUE
========================= */


const MAX_CONCURRENT_REQUESTS = 1;


let activeRequests = 0;


const REQUEST_QUEUE = [];



function sleep(ms){

    return new Promise(
        resolve=>setTimeout(resolve,ms)
    );

}



function enqueue(task){

    return new Promise(
        (resolve,reject)=>{


            REQUEST_QUEUE.push({

                task,

                resolve,

                reject

            });


            processQueue();


        }
    );

}




async function processQueue(){


    if(
        activeRequests >=
        MAX_CONCURRENT_REQUESTS
        ||
        REQUEST_QUEUE.length===0
    ){

        return;

    }



    const job =
        REQUEST_QUEUE.shift();



    activeRequests++;



    try{

        const result =
            await job.task();


        job.resolve(result);



    }catch(error){

        job.reject(error);

    }



    activeRequests--;


    setImmediate(
        processQueue
    );


}




/* =========================
   API REQUEST
========================= */


const MAX_RETRIES = 3;



async function apiGet(
    endpoint,
    retry=0
){


    return enqueue(async()=>{


        try{


            await sleep(2500);



            console.log(
                "➡️ API:",
                endpoint
            );



            const controller =
                new AbortController();



            const timeout =
                setTimeout(
                    ()=>controller.abort(),
                    10000
                );



            const response =
                await fetch(

                    `${BASE_URL}${endpoint}`,

                    {

                        headers:{

                            "X-Auth-Token":
                                API_KEY

                        },

                        signal:
                            controller.signal

                    }

                );



            clearTimeout(timeout);



            console.log(
                "STATUS:",
                response.status
            );



            if(
                response.status===429
            ){

                if(
                    retry <
                    MAX_RETRIES
                ){

                    const delay =
                        15000 *
                        (retry+1);


                    console.log(
                        "RETRY:",
                        delay
                    );


                    await sleep(delay);


                    return apiGet(
                        endpoint,
                        retry+1
                    );

                }


                return null;

            }



            if(
                !response.ok
            ){

                return null;

            }



            return await response.json();



        }catch(error){


            console.log(
                "API ERROR:",
                error.message
            );


            return null;


        }


    });


}




/* =========================
   FORMAT MATCH
========================= */


function formatMatch(match){


    if(
        !match ||
        !match.homeTeam ||
        !match.awayTeam
    ){

        return null;

    }



    return {


        id:
            match.id,


        utcDate:
            match.utcDate,


        status:
            match.status,



        competition:{


            code:
                match.competition?.code,


            name:
                match.competition?.name,


            weight:
                COMPETITION_WEIGHTS[
                    match.competition?.code
                ]
                ||
                0.70


        },



        homeTeam:{


            id:
                match.homeTeam.id,


            name:
                match.homeTeam.name


        },



        awayTeam:{


            id:
                match.awayTeam.id,


            name:
                match.awayTeam.name


        },



        score:
            match.score


    };


           }
/* =========================
   LOAD HISTORY DATABASE
========================= */

async function loadHistoryDatabase(){

   if (HISTORY_MATCH_DATABASE.length > 0) {
    return HISTORY_MATCH_DATABASE;
   }

    if(
        CACHE.history.data &&
        Date.now() < CACHE.history.expiresAt
    ){
        HISTORY_MATCH_DATABASE.length = 0;
        HISTORY_MATCH_DATABASE.push(...CACHE.history.data);
        return HISTORY_MATCH_DATABASE;
    }

    console.log("📚 LOADING HISTORY DATABASE");

    const history = [];

    for(const competition of PRIMARY_COMPETITIONS){

        await sleep(2500);

        const data = await apiGet(
    `/competitions/${competition}/matches?season=2025`
);


        if(
            !data ||
            !Array.isArray(data.matches)
        ){
            console.log(
                "❌ NO HISTORY:",
                competition
            );
            continue;
        }


        console.log(
            "COMPETITION:",
            competition
        );


        console.log(
            "RAW HISTORY:",
            data.matches.length
        );


        const formatted =
            data.matches
            .filter(
                match =>
                match.status === "FINISHED"
            )
            .map(formatMatch)
            .filter(Boolean);


        console.log(
            competition,
            "FINISHED:",
            formatted.length
        );


        history.push(
            ...formatted
        );

    }


    // Suppression doublons
    const unique = [];
    const seen = new Set();


    for(const match of history){

        if(!seen.has(match.id)){

            seen.add(match.id);
            unique.push(match);

        }

    }


    HISTORY_MATCH_DATABASE.length = 0;

    HISTORY_MATCH_DATABASE.push(
        ...unique
    );


    CACHE.history = {

    data: [...HISTORY_MATCH_DATABASE],

    expiresAt:
        Date.now()+HISTORY_CACHE_TTL

};


    console.log(
        "📚 TOTAL HISTORY:",
        HISTORY_MATCH_DATABASE.length
    );


    return HISTORY_MATCH_DATABASE;

}

/* =========================
   LOAD UPCOMING DATABASE
========================= */


async function loadUpcomingDatabase(){

   if (UPCOMING_MATCH_DATABASE.length > 0) {
    return UPCOMING_MATCH_DATABASE;
   }

    if(
    CACHE.upcoming.data &&
    CACHE.upcoming.data.length > 0 &&
    Date.now() < CACHE.upcoming.expiresAt
){

    UPCOMING_MATCH_DATABASE.length = 0;

    UPCOMING_MATCH_DATABASE.push(
        ...CACHE.upcoming.data
    );


    console.log(
        "🔮 CACHE UPCOMING USED:",
        UPCOMING_MATCH_DATABASE.length
    );


    return UPCOMING_MATCH_DATABASE;
    }

    console.log(
        "🔮 LOADING UPCOMING MATCHES"
    );


    const upcoming=[];


    const today =
        new Date();


    const future =
        new Date();


    future.setDate(
        future.getDate()+60
    );


    const from =
        today.toISOString()
        .split("T")[0];


    const to =
        future.toISOString()
        .split("T")[0];



    for(const competition of PRIMARY_COMPETITIONS){

        const data =
            await apiGet(
                `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${to}`
            );


        if(
            !data ||
            !Array.isArray(data.matches)
        ){
            continue;
        }


        const formatted =
            data.matches
            .map(formatMatch)
            .filter(Boolean);


        upcoming.push(
            ...formatted
        );


        console.log(
            competition,
            "UPCOMING:",
            formatted.length
        );


        await sleep(2000);

    }



    const unique=[];

    const seen=new Set();


    for(const match of upcoming){

        if(!seen.has(match.id)){

            seen.add(match.id);

            unique.push(match);

        }

    }



    UPCOMING_MATCH_DATABASE.length=0;

    UPCOMING_MATCH_DATABASE.push(
        ...unique
    );



    CACHE.upcoming = {

    data: [...UPCOMING_MATCH_DATABASE],

    expiresAt:
        Date.now()+MATCH_CACHE_TTL

};


    console.log(
        "🔮 TOTAL UPCOMING:",
        UPCOMING_MATCH_DATABASE.length
    );


    return UPCOMING_MATCH_DATABASE;

}

/* =========================
   GET UPCOMING MATCHES
========================= */
async function getMatches() {

    let matches = UPCOMING_MATCH_DATABASE;

    if (!matches || matches.length === 0) {
        matches = await loadUpcomingDatabase();
    }

    const now = new Date();

    matches = matches
        .filter(match => new Date(match.utcDate) > now)
        .sort(
            (a, b) =>
                new Date(a.utcDate) -
                new Date(b.utcDate)
        );

    if (matches.length === 0) {

        console.log("🔥 MATCHES READY: 0");

        return [];

    }

    const firstDay =
        matches[0].utcDate.split("T")[0];

    matches = matches.filter(
        match =>
            match.utcDate.startsWith(firstDay)
    );

    console.log("📅 FIRST MATCH DAY:", firstDay);
    console.log("🔥 MATCHES READY:", matches.length);

    return matches;

}


/* =========================
   GET TEAM HISTORY
========================= */

async function getTeamMatches(teamId){


    if(
        HISTORY_MATCH_DATABASE.length===0
    ){

        await loadHistoryDatabase();

    }



    const matches =
        HISTORY_MATCH_DATABASE
        .filter(match=>

            match.status==="FINISHED" &&

            (
                match.homeTeam.id===teamId ||
                match.awayTeam.id===teamId
            )

        )
        .sort((a,b)=>

            new Date(b.utcDate) -
            new Date(a.utcDate)

        )
        .slice(0,8);



    console.log(
        "📊 TEAM HISTORY:",
        teamId,
        matches.length
    );



    return matches;

}



/* =========================
   SAFE TEAM STATS
========================= */

function getSafeMatches(matches){

    if(
        !Array.isArray(matches)
    ){
        return [];
    }


    return matches.filter(match=>

        match &&
        match.score &&
        match.score.fullTime &&
        typeof match.score.fullTime.home==="number" &&
        typeof match.score.fullTime.away==="number"

    );

}

/* =========================
   INITIALIZATION
========================= */

async function initializeDatabase(){

    try{

        console.log(
            "🚀 INITIALIZING DATABASE..."
        );


        const history =
            await loadHistoryDatabase();


        console.log(
            "✅ HISTORY LOADED:",
            history.length
        );


        const upcoming =
            await loadUpcomingDatabase();


        console.log(
            "✅ UPCOMING LOADED:",
            upcoming.length
        );


        console.log(
            "======================"
        );


        console.log(
            "✅ DATABASE READY"
        );


        console.log(
            "📚 HISTORY:",
            HISTORY_MATCH_DATABASE.length
        );


        console.log(
            "🔮 UPCOMING:",
            UPCOMING_MATCH_DATABASE.length
        );


        console.log(
            "======================"
        );


        return {
            history,
            upcoming
        };


    }catch(error){

        console.log(
            "❌ DATABASE INIT ERROR:",
            error.message
        );


        return {
            history:[],
            upcoming:[]
        };

    }

}



/* =========================
   EXPORTS
========================= */

module.exports = {

    apiGet,

    getMatches,

    getTeamMatches,

    loadHistoryDatabase,

    loadUpcomingDatabase,

    initializeDatabase,

    getSafeMatches

};
