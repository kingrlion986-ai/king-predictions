const fetch = require("node-fetch");

/*
========================================================
 KING PREDICTIONS AI
 FOOTBALL API ENGINE V31
 SIMPLE / STABLE / ANTI-429
========================================================
*/

const API_KEY = process.env.API_KEY;

const BASE_URL =
    "https://api.football-data.org/v4";


/* ======================================================
   SAISONS
====================================================== */

const CURRENT_SEASON = 2026;
const PREVIOUS_SEASON = 2025;


/* ======================================================
   COMPETITIONS
====================================================== */

const COMPETITIONS = [
    "PL",
    "PD",
    "SA",
    "BL1",
    "FL1"
];


const COMPETITION_WEIGHTS = {

    PL: 1.20,
    PD: 1.20,
    SA: 1.15,
    BL1: 1.15,
    FL1: 1.10

};


/* ======================================================
   DATABASE
====================================================== */

let HISTORY = [];
let UPCOMING = [];

let INITIALIZING = null;


/* ======================================================
   CACHE
====================================================== */

let HISTORY_TIME = 0;
let UPCOMING_TIME = 0;

const HISTORY_TTL =
    24 * 60 * 60 * 1000;

const UPCOMING_TTL =
    30 * 60 * 1000;


/* ======================================================
   API RATE CONTROL
====================================================== */

let LAST_REQUEST = 0;

const REQUEST_DELAY = 6500;


/* ======================================================
   SLEEP
====================================================== */

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


/* ======================================================
   API GET
====================================================== */

async function apiGet(endpoint) {

    const elapsed =
        Date.now() - LAST_REQUEST;

    if (
        elapsed < REQUEST_DELAY
    ) {

        await sleep(
            REQUEST_DELAY - elapsed
        );

    }


    LAST_REQUEST =
        Date.now();


    for (
        let attempt = 1;
        attempt <= 3;
        attempt++
    ) {

        try {

            console.log(
                "➡️ API:",
                endpoint
            );


            const response =
                await fetch(
                    `${BASE_URL}${endpoint}`,
                    {
                        headers: {
                            "X-Auth-Token": API_KEY
                        }
                    }
                );


            console.log(
                "STATUS:",
                response.status
            );


            if (
                response.status === 429
            ) {

                const retry =
                    attempt * 10000;

                console.log(
                    `⚠️ RATE LIMIT → attente ${retry / 1000}s`
                );

                await sleep(retry);

                continue;

            }


            if (!response.ok) {

                console.log(
                    "❌ API ERROR:",
                    response.status
                );

                return null;

            }


            return await response.json();

        }
        catch (error) {

            console.log(
                "❌ API ERROR:",
                error.message
            );


            if (
                attempt < 3
            ) {

                await sleep(5000);

            }

        }

    }


    return null;

}


/* ======================================================
   FORMAT MATCH
====================================================== */

function formatMatch(match) {

    if (
        !match?.homeTeam ||
        !match?.awayTeam
    ) {

        return null;

    }


    return {

        id:
            match.id,

        utcDate:
            match.utcDate,

        status:
            match.status,

        competition: {

            code:
                match.competition?.code,

            name:
                match.competition?.name,

            weight:
                COMPETITION_WEIGHTS[
                    match.competition?.code
                ] || 0.80

        },

        homeTeam: {

            id:
                match.homeTeam.id,

            name:
                match.homeTeam.name

        },

        awayTeam: {

            id:
                match.awayTeam.id,

            name:
                match.awayTeam.name

        },

        score:
            match.score

    };

}


/* ======================================================
   VALID FINISHED
====================================================== */

function isFinished(match) {

    return (

        match?.status === "FINISHED" &&

        match?.score?.fullTime &&

        Number.isFinite(
            Number(match.score.fullTime.home)
        ) &&

        Number.isFinite(
            Number(match.score.fullTime.away)
        )

    );

}


/* ======================================================
   UNIQUE
====================================================== */

function unique(matches) {

    const map =
        new Map();

    for (
        const match of matches
    ) {

        if (
            match?.id
        ) {

            map.set(
                match.id,
                match
            );

        }

    }

    return [
        ...map.values()
    ];

}


/* ======================================================
   LOAD HISTORY
====================================================== */

async function loadHistoryDatabase() {

    if (
        HISTORY.length > 0 &&
        Date.now() - HISTORY_TIME <
        HISTORY_TTL
    ) {

        return HISTORY;

    }


    console.log(
        "📚 LOADING HISTORY..."
    );


    const history = [];


    for (
        const competition of COMPETITIONS
    ) {

        const data =
            await apiGet(
                `/competitions/${competition}/matches?season=${PREVIOUS_SEASON}`
            );


        if (
            !data?.matches
        ) {

            continue;

        }


        const matches =
            data.matches

                .filter(isFinished)

                .map(formatMatch)

                .filter(Boolean);


        history.push(
            ...matches
        );


        console.log(
            `📚 ${competition}: ${matches.length}`
        );

    }


    HISTORY =
        unique(history);


    HISTORY.sort(
        (a, b) =>
            new Date(b.utcDate) -
            new Date(a.utcDate)
    );


    HISTORY_TIME =
        Date.now();


    /*
     * ELO
     */

    try {

        const {
            buildHistoricalElo
        } = require("./eloEngine");

        buildHistoricalElo(
            HISTORY
        );

        console.log(
            "✅ HISTORICAL ELO BUILT"
        );

    }
    catch (error) {

        console.log(
            "⚠️ ELO ERROR:",
            error.message
        );

    }


    console.log(
        "📚 TOTAL HISTORY:",
        HISTORY.length
    );


    return HISTORY;

}


/* ======================================================
   LOAD UPCOMING
====================================================== */

async function loadUpcomingDatabase() {

    if (
        UPCOMING.length > 0 &&
        Date.now() - UPCOMING_TIME <
        UPCOMING_TTL
    ) {

        return UPCOMING;

    }


    console.log(
        "🔮 LOADING UPCOMING..."
    );


    const today =
        new Date();


    const future =
        new Date();


    future.setDate(
        future.getDate() + 14
    );


    const from =
        today
            .toISOString()
            .slice(0, 10);


    const to =
        future
            .toISOString()
            .slice(0, 10);


    const upcoming = [];


    for (
        const competition of COMPETITIONS
    ) {

        const data =
            await apiGet(
                `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${to}`
            );


        if (
            !data?.matches
        ) {

            continue;

        }


        const matches =
            data.matches

                .filter(
                    match =>
                        match.status === "SCHEDULED" ||
                        match.status === "TIMED"
                )

                .map(formatMatch)

                .filter(Boolean);


        upcoming.push(
            ...matches
        );


        console.log(
            `🔮 ${competition}: ${matches.length}`
        );

    }


    UPCOMING =
        unique(upcoming);


    UPCOMING.sort(
        (a, b) =>
            new Date(a.utcDate) -
            new Date(b.utcDate)
    );


    UPCOMING_TIME =
        Date.now();


    console.log(
        "🔮 TOTAL UPCOMING:",
        UPCOMING.length
    );


    return UPCOMING;

}


/* ======================================================
   GET MATCHES
====================================================== */

async function getMatches() {

    if (
        UPCOMING.length === 0
    ) {

        await initializeDatabase();

    }


    const now =
        Date.now();


    const max =
        now +
        14 * 24 * 60 * 60 * 1000;


    const matches =
        UPCOMING.filter(
            match => {

                const time =
                    new Date(
                        match.utcDate
                    ).getTime();


                return (
                    time >= now &&
                    time <= max
                );

            }
        );


    console.log(
        "🔥 MATCHES READY:",
        matches.length
    );


    return matches;

}


/* ======================================================
   GET TEAM MATCHES
======================================================

IMPORTANT :

On utilise d'abord la base historique
déjà chargée.

Cela évite 10 appels API supplémentaires
pour 5 matchs.

====================================================== */

async function getTeamMatches(teamId) {

    if (
        HISTORY.length === 0
    ) {

        await loadHistoryDatabase();

    }


    const matches =
        HISTORY

            .filter(
                match =>
                    match.homeTeam.id === teamId ||
                    match.awayTeam.id === teamId
            )

            .sort(
                (a, b) =>
                    new Date(b.utcDate) -
                    new Date(a.utcDate)
            )

            .slice(0, 8);


    console.log(
        `📊 TEAM ${teamId}: ${matches.length} matchs`
    );


    return matches;

}


/* ======================================================
   SAFE MATCHES
====================================================== */

function getSafeMatches(matches) {

    if (
        !Array.isArray(matches)
    ) {

        return [];

    }


    return matches.filter(
        isFinished
    );

}


/* ======================================================
   INITIALIZATION
====================================================== */

async function initializeDatabase() {

    if (
        INITIALIZING
    ) {

        return INITIALIZING;

    }


    INITIALIZING =
        (async () => {

            console.log(
                "🚀 INITIALIZING DATABASE..."
            );


            await loadHistoryDatabase();


            await loadUpcomingDatabase();


            console.log(
                "=========================="
            );

            console.log(
                "✅ DATABASE READY"
            );

            console.log(
                "📚 HISTORY:",
                HISTORY.length
            );

            console.log(
                "🔮 UPCOMING:",
                UPCOMING.length
            );

            console.log(
                "=========================="
            );

        })();


    try {

        await INITIALIZING;

    }
    finally {

        INITIALIZING = null;

    }

}


/* ======================================================
   EXPORTS
====================================================== */

module.exports = {

    apiGet,

    getMatches,

    getTeamMatches,

    loadHistoryDatabase,

    loadUpcomingDatabase,

    initializeDatabase,

    getSafeMatches

};
