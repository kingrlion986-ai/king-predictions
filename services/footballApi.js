const fetch = require("node-fetch");

/*
========================================================
 KING PREDICTIONS AI
 FOOTBALL API ENGINE V3.2
 FAST / STABLE / ANTI-429
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
    "FL1"
];

const COMPETITION_WEIGHTS = {
    PL: 1.20,
    PD: 1.20,
    SA: 1.15,
    BL1: 1.15,
    FL1: 1.10
};

/*
 * IMPORTANT :
 * On évite de bombarder l'API.
 *
 * 6500 ms était très lent pour ta V1.
 * On garde une marge raisonnable tout en ayant
 * un système de retry en cas de 429.
 */
const REQUEST_DELAY = 2500;

const MAX_RETRIES = 3;

const UPCOMING_DAYS = 14;

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

/*
 * Même si aucune donnée n'est reçue,
 * on évite de relancer l'API à chaque requête.
 */
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
   API GET
====================================================== */

async function apiGet(endpoint) {

    if (!API_KEY) {

        console.error(
            "❌ API_KEY MANQUANTE"
        );

        return null;
    }

    /*
     * Respect du délai minimum entre deux requêtes.
     */
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

                /*
                 * Si l'API fournit Retry-After,
                 * on l'utilise.
                 */

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
               ERREUR SERVEUR
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
               AUTRES ERREURS
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
   LOAD UPCOMING
   PRIORITÉ V1
====================================================== */

async function loadUpcomingDatabase() {

    if (
        UPCOMING.length > 0 &&
        Date.now() - UPCOMING_TIME < UPCOMING_TTL
    ) {
        return UPCOMING;
    }

    if (
        UPCOMING.length === 0 &&
        UPCOMING_TIME > 0 &&
        Date.now() - UPCOMING_TIME < EMPTY_CACHE_TTL
    ) {
        return UPCOMING;
    }

    console.log("🔮 LOADING UPCOMING...");

    /*
     * On récupère une marge de dates autour
     * du jour local afin de gérer correctement
     * Africa/Brazzaville.
     */

    const now = new Date();

    const fromDate = new Date(
        now.getTime() - 24 * 60 * 60 * 1000
    );

    const toDate = new Date(
        now.getTime() +
        (UPCOMING_DAYS + 1) * 24 * 60 * 60 * 1000
    );

    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);

    const upcoming = [];

    for (const competition of COMPETITIONS) {

        try {

            const endpoint =
                `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${to}`;

            const data = await apiGet(endpoint);

            if (!data?.matches) {
                console.warn(`⚠️ ${competition}: aucune réponse`);
                continue;
            }

            const matches = data.matches
                .filter(isUpcoming)
                .map(formatMatch)
                .filter(Boolean);

            upcoming.push(...matches);

            console.log(
                `🔮 ${competition}: ${matches.length}`
            );

        } catch (error) {

            console.error(
                `❌ UPCOMING ${competition}:`,
                error.message
            );
        }
    }

    UPCOMING = unique(upcoming);

    UPCOMING.sort(
        (a, b) =>
            new Date(a.utcDate) -
            new Date(b.utcDate)
    );

    UPCOMING_TIME = Date.now();

    console.log(
        "🔮 TOTAL UPCOMING:",
        UPCOMING.length
    );

    return UPCOMING;
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

        console.log(
            "⚡ HISTORY CACHE:",
            HISTORY.length
        );

        return HISTORY;
    }

    console.log(
        "📚 LOADING HISTORY..."
    );

    const history = [];

    for (
        const competition of COMPETITIONS
    ) {

        try {

            const data =
                await apiGet(
                    `/competitions/${competition}/matches?season=${PREVIOUS_SEASON}`
                );

            if (
                !data?.matches
            ) {

                console.warn(
                    `⚠️ ${competition}: historique indisponible`
                );

                continue;
            }

            const matches =
                data.matches
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

    HISTORY =
        unique(
            history
        );

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
        } =
            require(
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
}

/* ======================================================
   GET MATCHES
====================================================== */
function getLocalDate(date) {

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Brazzaville",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date(date));
}


async function getMatches() {

    await loadUpcomingDatabase();

    const today =
        getLocalDate(new Date());

    /*
     * IMPORTANT :
     * On sélectionne le calendrier du jour,
     * même si certains matchs ont déjà commencé
     * ou sont déjà terminés.
     */

    const matches = UPCOMING.filter(match => {

        if (!match?.utcDate)
            return false;

        return (
            getLocalDate(match.utcDate) === today
        );
    });

    console.log(
        `🇨🇬 MATCHS DU ${today}:`,
        matches.length
    );

    return matches;
}

/* ======================================================
   GET TEAM MATCHES
====================================================== */

async function getTeamMatches(teamId) {

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

    /*
     * Empêche plusieurs initialisations simultanées.
     */

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
             * ÉTAPE 1 :
             * matchs futurs en priorité.
             *
             * Cela permet à l'IA de commencer
             * même si l'historique rencontre un problème.
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
             * ÉTAPE 2 :
             * historique.
             *
             * Une erreur historique ne doit
             * jamais empêcher l'IA d'afficher
             * les matchs futurs.
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
