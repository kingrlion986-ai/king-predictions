const fetch = require("node-fetch");

/*
========================================================
 KING PREDICTIONS AI
 FOOTBALL API ENGINE V3.3
 FAST / STABLE / ANTI-429 / DATE DIAGNOSTIC
========================================================
*/

const API_KEY = process.env.API_KEY;

const BASE_URL =
    "https://api.football-data.org/v4";

/* ======================================================
   CONFIGURATION
====================================================== */

const CURRENT_SEASON = 2026;
const PREVIOUS_SEASON = 2025;

const COMPETITIONS = [
    "PL",
    "PD",
    "SA",
    "BL1",
    "FL1",
    "CL",
    "DED",
    "BSA",
    "ELC",
    "PPL",
    "EC",
    "WC"
];

const COMPETITION_WEIGHTS = {
    PL: 1.20,
    PD: 1.20,
    SA: 1.15,
    BL1: 1.15,
    FL1: 1.10,

    CL: 1.25,
    DED: 1.05,
    BSA: 1.05,
    ELC: 1.00,
    PPL: 1.00,

    EC: 1.15,
    WC: 1.25
};

const REQUEST_DELAY = 2500;
const MAX_RETRIES = 3;

const UPCOMING_DAYS = 14;

/* ======================================================
   DATABASE
====================================================== */

let HISTORY = [];
let UPCOMING = [];

let INITIALIZING = null;
let HISTORY_LOADING = null;
let UPCOMING_LOADING = null;

/* ======================================================
   CACHE
====================================================== */

let HISTORY_TIME = 0;
let UPCOMING_TIME = 0;

const HISTORY_TTL =
    24 * 60 * 60 * 1000;

const UPCOMING_TTL =
    30 * 60 * 1000;

const EMPTY_CACHE_TTL =
    2 * 60 * 1000;

/* ======================================================
   API CONTROL
====================================================== */

let LAST_REQUEST = 0;

/* ======================================================
   SLEEP
====================================================== */

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

/* ======================================================
   LOCAL DATE
   AFRICA / BRAZZAVILLE
====================================================== */

function getLocalDate(date) {

    if (!date) {
        return null;
    }

    const parsed =
        new Date(date);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Africa/Brazzaville",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(parsed);
}

/* ======================================================
   API GET
====================================================== */

async function apiGet(endpoint) {

    if (!API_KEY) {

        console.error(
            "❌ API_KEY MANQUANTE"
        );

        return null;
    }

    const elapsed =
        Date.now() - LAST_REQUEST;

    if (
        elapsed < REQUEST_DELAY
    ) {

        await sleep(
            REQUEST_DELAY - elapsed
        );
    }

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {

        try {

            LAST_REQUEST =
                Date.now();

            console.log(
                `➡️ API ${attempt}/${MAX_RETRIES}:`,
                endpoint
            );

            const response =
                await fetch(
                    `${BASE_URL}${endpoint}`,
                    {
                        headers: {
                            "X-Auth-Token":
                                API_KEY,
                            "Accept":
                                "application/json"
                        }
                    }
                );

            console.log(
                "STATUS:",
                response.status
            );

            /* ------------------------------------------
               RATE LIMIT
            ------------------------------------------ */

            if (
                response.status === 429
            ) {

                let waitTime =
                    attempt * 10000;

                const retryAfter =
                    response.headers.get(
                        "Retry-After"
                    );

                if (retryAfter) {

                    const seconds =
                        Number(
                            retryAfter
                        );

                    if (
                        Number.isFinite(
                            seconds
                        )
                    ) {

                        waitTime =
                            seconds * 1000;
                    }
                }

                console.warn(
                    `⚠️ RATE LIMIT → attente ${Math.round(waitTime / 1000)}s`
                );

                await sleep(
                    waitTime
                );

                continue;
            }

            /* ------------------------------------------
               SERVER ERROR
            ------------------------------------------ */

            if (
                response.status >= 500 &&
                response.status <= 599
            ) {

                console.warn(
                    "⚠️ API SERVER ERROR:",
                    response.status
                );

                if (
                    attempt <
                    MAX_RETRIES
                ) {

                    await sleep(
                        attempt * 5000
                    );

                    continue;
                }

                return null;
            }

            /* ------------------------------------------
               OTHER ERRORS
            ------------------------------------------ */

            if (!response.ok) {

                let message = "";

                try {

                    message =
                        await response.text();

                } catch (_) {}

                console.error(
                    "❌ API ERROR:",
                    response.status,
                    message
                );

                return null;
            }

            /* ------------------------------------------
               JSON
            ------------------------------------------ */

            const data =
                await response.json();

            return data;

        }
        catch (error) {

            console.error(
                "❌ API NETWORK ERROR:",
                error.message
            );

            if (
                attempt <
                MAX_RETRIES
            ) {

                await sleep(
                    attempt * 3000
                );

                continue;
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
            match.score || null
    };
}

/* ======================================================
   FINISHED MATCH
====================================================== */

function isFinished(match) {

    return (
        match?.status === "FINISHED" &&
        match?.score?.fullTime &&
        Number.isFinite(
            Number(
                match.score.fullTime.home
            )
        ) &&
        Number.isFinite(
            Number(
                match.score.fullTime.away
            )
        )
    );
}

/* ======================================================
   UPCOMING MATCH
====================================================== */

function isUpcoming(match) {

    return (
        match?.status === "SCHEDULED" ||
        match?.status === "TIMED"
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
                String(match.id),
                match
            );
        }
    }

    return [
        ...map.values()
    ];
}

/* ======================================================
   DATE COUNTS
====================================================== */

function getUpcomingDateCounts() {

    const counts = {};

    for (
        const match of UPCOMING
    ) {

        if (
            !match?.utcDate
        ) {
            continue;
        }

        const date =
            getLocalDate(
                match.utcDate
            );

        if (!date) {
            continue;
        }

        counts[date] =
            (counts[date] || 0) + 1;
    }

    return counts;
}

/* ======================================================
   DATE DIAGNOSTIC
====================================================== */

function logUpcomingDateDiagnostic() {

    console.log(
        "📅 UPCOMING PAR DATE:"
    );

    const counts =
        getUpcomingDateCounts();

    const dates =
        Object.keys(counts)
            .sort();

    if (
        dates.length === 0
    ) {

        console.log(
            "📅 AUCUNE DATE DANS UPCOMING"
        );

        return;
    }

    for (
        const date of dates
    ) {

        console.log(
            `📅 ${date}: ${counts[date]} matchs`
        );
    }
}

/* ======================================================
   SAMPLE MATCHES DIAGNOSTIC
====================================================== */

function logUpcomingSamples() {

    console.log(
        "🔎 PREMIERS MATCHS UPCOMING:"
    );

    UPCOMING
        .slice(0, 10)
        .forEach(match => {

            console.log(
                `🔎 ${getLocalDate(match.utcDate)} | ${match.utcDate} | ${match.competition?.code} | ${match.homeTeam?.name} - ${match.awayTeam?.name}`
            );

        });
}

/* ======================================================
   LOAD UPCOMING
   PRIORITÉ V1
====================================================== */

async function loadUpcomingDatabase() {

    /*
     * CACHE VALIDE
     */

    if (
        UPCOMING.length > 0 &&
        Date.now() - UPCOMING_TIME < UPCOMING_TTL
    ) {

        return UPCOMING;
    }

    /*
     * CACHE VIDE TEMPORAIRE
     */

    if (
        UPCOMING.length === 0 &&
        UPCOMING_TIME > 0 &&
        Date.now() - UPCOMING_TIME < EMPTY_CACHE_TTL
    ) {

        return UPCOMING;
    }

    /*
     * LOCK
     */

    if (UPCOMING_LOADING) {

        console.log(
            "⏳ UPCOMING LOADING ALREADY RUNNING"
        );

        return UPCOMING_LOADING;
    }

    UPCOMING_LOADING =
        (async () => {

            console.log(
                "🔮 LOADING UPCOMING..."
            );

            /*
             * Date système
             */

            const now =
                new Date();

            console.log(
                "🕐 UTC NOW:",
                now.toISOString()
            );

            console.log(
                "🇨🇬 LOCAL NOW:",
                getLocalDate(now)
            );

            /*
             * Fenêtre API
             */

            const fromDate =
                new Date(
                    now.getTime() -
                    24 * 60 * 60 * 1000
                );

            const toDate =
                new Date(
                    now.getTime() +
                    (UPCOMING_DAYS + 1) *
                    24 * 60 * 60 * 1000
                );

            const from =
                fromDate
                    .toISOString()
                    .slice(0, 10);

            const to =
                toDate
                    .toISOString()
                    .slice(0, 10);

            console.log(
                "📆 API DATE FROM:",
                from
            );

            console.log(
                "📆 API DATE TO:",
                to
            );

            const upcoming = [];

            for (
                const competition
                of COMPETITIONS
            ) {

                try {

                    const endpoint =
                        `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${to}`;

                    const data =
                        await apiGet(
                            endpoint
                        );

                    if (
                        !data?.matches
                    ) {

                        console.warn(
                            `⚠️ ${competition}: aucune réponse`
                        );

                        continue;
                    }

                    const matches =
                        data.matches
                            .filter(
                                isUpcoming
                            )
                            .map(
                                formatMatch
                            )
                            .filter(
                                Boolean
                            );

                    upcoming.push(
                        ...matches
                    );

                    console.log(
                        `🔮 ${competition}: ${matches.length}`
                    );

                }
                catch (error) {

                    console.error(
                        `❌ UPCOMING ${competition}:`,
                        error.message
                    );
                }
            }

            const newUpcoming =
                unique(
                    upcoming
                );

            newUpcoming.sort(
                (a, b) =>
                    new Date(
                        a.utcDate
                    ) -
                    new Date(
                        b.utcDate
                    )
            );

            /*
             * Remplacement du cache
             */

            UPCOMING =
                newUpcoming;

            UPCOMING_TIME =
                Date.now();

            console.log(
                "🔮 TOTAL UPCOMING:",
                UPCOMING.length
            );

            /*
             * DIAGNOSTIC OBLIGATOIRE
             */

            logUpcomingDateDiagnostic();

            logUpcomingSamples();

            return UPCOMING;

        })();

    try {

        return await UPCOMING_LOADING;

    }
    finally {

        UPCOMING_LOADING = null;
    }
}

/* ======================================================
   LOAD HISTORY
====================================================== */

async function loadHistoryDatabase() {

    /*
     * CACHE VALIDE
     */

    if (
        HISTORY.length > 0 &&
        Date.now() - HISTORY_TIME < HISTORY_TTL
    ) {

        console.log(
            "⚡ HISTORY CACHE:",
            HISTORY.length
        );

        return HISTORY;
    }

    /*
     * LOCK
     */

    if (HISTORY_LOADING) {

        console.log(
            "⏳ HISTORY LOADING ALREADY RUNNING"
        );

        return HISTORY_LOADING;
    }

    HISTORY_LOADING =
        (async () => {

            console.log(
                "📚 LOADING HISTORY..."
            );

            const history = [];

            for (
                const competition
                of COMPETITIONS
            ) {

                try {

                    const currentData =
                        await apiGet(
                            `/competitions/${competition}/matches?season=${CURRENT_SEASON}`
                        );

                    const previousData =
                        await apiGet(
                            `/competitions/${competition}/matches?season=${PREVIOUS_SEASON}`
                        );

                    const allMatches = [
                        ...(currentData?.matches || []),
                        ...(previousData?.matches || [])
                    ];

                    if (
                        !allMatches.length
                    ) {

                        console.warn(
                            `⚠️ ${competition}: historique indisponible`
                        );

                        continue;
                    }

                    const matches =
                        allMatches
                            .filter(
                                isFinished
                            )
                            .map(
                                formatMatch
                            )
                            .filter(
                                Boolean
                            );

                    history.push(
                        ...matches
                    );

                    console.log(
                        `📚 ${competition}: ${matches.length}`
                    );

                }
                catch (error) {

                    console.error(
                        `❌ HISTORY ${competition}:`,
                        error.message
                    );
                }
            }

            const newHistory =
                unique(
                    history
                );

            newHistory.sort(
                (a, b) =>
                    new Date(b.utcDate) -
                    new Date(a.utcDate)
            );

            /*
             * Protection contre une base historique vide
             */

            if (
                newHistory.length === 0
            ) {

                console.warn(
                    "⚠️ HISTORIQUE VIDE → conservation de l'ancien historique"
                );

                return HISTORY;
            }

            /*
             * Protection contre une base manifestement incomplète
             */

            if (
                HISTORY.length > 0 &&
                newHistory.length <
                    HISTORY.length * 0.70
            ) {

                console.warn(
                    `⚠️ HISTORIQUE SUSPECT: ${newHistory.length} vs ${HISTORY.length} → conservation de l'ancien historique`
                );

                return HISTORY;
            }

            HISTORY =
                newHistory;

            HISTORY_TIME =
                Date.now();

            /*
             * ELO
             */

            try {

                const {
                    buildHistoricalElo
                } = require(
                    "./eloEngine"
                );

                buildHistoricalElo(
                    HISTORY
                );

                console.log(
                    "✅ HISTORICAL ELO BUILT"
                );

            }
            catch (error) {

                console.warn(
                    "⚠️ ELO ERROR:",
                    error.message
                );
            }

            console.log(
                "📚 TOTAL HISTORY:",
                HISTORY.length
            );

            return HISTORY;

        })();

    try {

        return await HISTORY_LOADING;

    }
    finally {

        HISTORY_LOADING = null;
    }
}

/* ======================================================
   GET MATCHES
====================================================== */

async function getMatches(
    targetDate = null
) {

    await loadUpcomingDatabase();

    const date =
        targetDate ||
        getLocalDate(
            new Date()
        );

    console.log(
        "🎯 DATE DEMANDÉE:",
        date
    );

    /*
     * Sélection stricte de la date locale
     */

    const matches =
        UPCOMING
            .filter(match => {

                if (
                    !match?.utcDate
                ) {
                    return false;
                }

                return (
                    getLocalDate(
                        match.utcDate
                    ) === date
                );
            })
            .sort(
                (a, b) =>
                    new Date(
                        a.utcDate
                    ) -
                    new Date(
                        b.utcDate
                    )
            );

    console.log(
        `🇨🇬 MATCHS DU ${date}:`,
        matches.length
    );

    /*
     * DIAGNOSTIC SI AUCUN MATCH
     */

    if (
        matches.length === 0
    ) {

        console.warn(
            `⚠️ AUCUN MATCH POUR ${date}`
        );

        const counts =
            getUpcomingDateCounts();

        const availableDates =
            Object.keys(counts)
                .sort();

        console.warn(
            "📅 DATES DISPONIBLES DANS UPCOMING:",
            availableDates.join(", ")
        );

        /*
         * Affiche uniquement les 10 premiers
         * pour éviter de polluer les logs.
         */

        UPCOMING
            .slice(0, 10)
            .forEach(match => {

                console.warn(
                    `🔎 DISPONIBLE: ${getLocalDate(match.utcDate)} | ${match.competition?.code} | ${match.homeTeam?.name} - ${match.awayTeam?.name}`
                );

            });
    }

    return matches;
}

/* ======================================================
   GET TEAM MATCHES
====================================================== */

async function getTeamMatches(
    teamId
) {

    if (
        HISTORY.length === 0
    ) {

        await loadHistoryDatabase();
    }

    const id =
        Number(teamId);

    const matches =
        HISTORY
            .filter(
                match =>
                    Number(
                        match.homeTeam?.id
                    ) === id ||
                    Number(
                        match.awayTeam?.id
                    ) === id
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

function getSafeMatches(
    matches
) {

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

        console.log(
            "⏳ DATABASE INITIALIZATION ALREADY RUNNING"
        );

        return INITIALIZING;
    }

    INITIALIZING =
        (async () => {

            console.log(
                "🚀 INITIALIZING DATABASE..."
            );

            /*
             * UPCOMING EN PREMIER
             */

            try {

                await loadUpcomingDatabase();

            }
            catch (error) {

                console.error(
                    "❌ UPCOMING INIT:",
                    error.message
                );
            }

            /*
             * HISTORY ENSUITE
             */

            try {

                await loadHistoryDatabase();

            }
            catch (error) {

                console.error(
                    "❌ HISTORY INIT:",
                    error.message
                );
            }

            console.log(
                "=========================="
            );

            console.log(
                "✅ DATABASE INITIALIZATION FINISHED"
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
   DATABASE STATUS
====================================================== */

function getDatabaseStatus() {

    return {

        history:
            HISTORY.length,

        upcoming:
            UPCOMING.length,

        historyUpdated:
            HISTORY_TIME
                ? new Date(
                    HISTORY_TIME
                ).toISOString()
                : null,

        upcomingUpdated:
            UPCOMING_TIME
                ? new Date(
                    UPCOMING_TIME
                ).toISOString()
                : null,

        initializing:
            !!INITIALIZING
    };
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

    getSafeMatches,

    getDatabaseStatus
};
