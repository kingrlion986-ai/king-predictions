const express = require("express");
const cors = require("cors");
const path = require("path");

const {
    getMatches,
    initializeDatabase
} = require("./services/footballApi");

const {
    analyzeMatch
} = require("./services/predictionEngine");


/* =========================================================
   CONFIGURATION
========================================================= */

const app = express();

const PORT = process.env.PORT || 3000;

const VERSION = "KING-V1";

const TIMEZONE = "Africa/Brazzaville";

const CACHE_TTL = 30 * 60 * 1000;

const MAX_PICKS = 4;


/* =========================================================
   ÉTAT
========================================================= */

let cache = [];

let cacheTime = 0;

let dailyDate = "";

let building = null;

let lastStatus = "STARTING";

let lastError = null;

let lastUpdate = null;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());

app.use(express.json());

app.use((req, res, next) => {

    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.setHeader(
        "X-KING-VERSION",
        VERSION
    );

    next();

});


/* =========================================================
   FRONTEND
========================================================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        ),
        {
            etag: false,
            maxAge: 0,
            index: false
        }
    )
);


/* =========================================================
   DATE LOCALE
========================================================= */

function getToday() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date());

}


function getMatchDate(utcDate) {

    if (!utcDate)
        return null;

    const date =
        new Date(utcDate);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(date);

}


/* =========================================================
   SÉLECTION FINALE
=========================================================

   IMPORTANT :

   predictionEngine.js choisit déjà
   UN seul pari pour chaque match.

   server.js ne doit PAS recalculer
   le pari.

========================================================= */

function selectDailyPicks(analyses) {

    if (!Array.isArray(analyses))
        return [];


    const valid = analyses
        .filter(
            analysis =>
                analysis &&
                analysis.match &&
                analysis.selectedBet &&
                analysis.selectedBet.option
        );


    console.log(
        "🔎 ANALYSES VALIDES:",
        valid.length,
        "/",
        analyses.length
    );


    /*
     * Classement par qualité du match.
     */

    valid.sort(
        (a, b) =>
            Number(
                b.qualityScore || 0
            ) -
            Number(
                a.qualityScore || 0
            )
    );


    /*
     * Maximum 4 matchs.
     */

    return valid
        .slice(0, MAX_PICKS)
        .map(analysis => ({

            match:
                analysis.match,

            selectedBet:
                analysis.selectedBet,

            analysis:
                analysis.analysis,

            qualityScore:
                analysis.qualityScore

        }));

}


/* =========================================================
   ANALYSE DU JOUR
========================================================= */

async function buildDailyAnalysis() {

    const today =
        getToday();


    /* -----------------------------------------------------
       NOUVEAU JOUR
    ----------------------------------------------------- */

    if (dailyDate !== today) {

        dailyDate = today;

        cache = [];

        cacheTime = 0;

        lastStatus =
            "NEW_DAY";

        console.log(
            "📅 NOUVEAU JOUR:",
            today
        );

    }


    /* -----------------------------------------------------
       CACHE
    ----------------------------------------------------- */

    if (
        cache.length > 0 &&
        Date.now() - cacheTime <
            CACHE_TTL
    ) {

        console.log(
            "💾 CACHE DAILY:",
            cache.length
        );

        return cache;

    }


    /* -----------------------------------------------------
       ANALYSE DÉJÀ EN COURS
    ----------------------------------------------------- */

    if (building) {

        console.log(
            "⏳ ANALYSE DÉJÀ EN COURS"
        );

        return building;

    }


    /* -----------------------------------------------------
       CONSTRUCTION
    ----------------------------------------------------- */

    building = (async () => {

        lastStatus =
            "ANALYZING";

        lastError = null;


        try {

            console.log(
                "📡 RECHERCHE DES MATCHS:",
                today
            );


            /* ------------------------------------------------
               RÉCUPÉRATION
            ------------------------------------------------ */

            const matches =
                await getMatches();


            if (!Array.isArray(matches)) {

                throw new Error(
                    "getMatches() doit retourner un tableau"
                );

            }


            /* ------------------------------------------------
               MATCHS DU JOUR
            ------------------------------------------------ */

            const todayMatches =
                matches
                    .filter(
                        match =>
                            getMatchDate(
                                match?.utcDate
                            ) === today
                    )
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
                "⚽ MATCHS DU JOUR:",
                todayMatches.length
            );


            /* ------------------------------------------------
               AUCUN MATCH
            ------------------------------------------------ */

            if (
                todayMatches.length === 0
            ) {

                cache = [];

                cacheTime =
                    Date.now();

                lastStatus =
                    "NO_MATCHES";

                lastUpdate =
                    new Date()
                        .toISOString();

                return [];

            }


            /* ------------------------------------------------
               ANALYSE DES MATCHS
            ------------------------------------------------ */

            const analyses = [];


            for (
                const match
                of todayMatches
            ) {

                try {

                    console.log(
                        `🔬 ANALYSE: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`
                    );


                    const result =
                        await analyzeMatch(
                            match
                        );


                    if (result) {

                        analyses.push(
                            result
                        );


                        console.log(
                            `✅ ANALYSE OK: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
                            {
                                bet:
                                    result.selectedBet,

                                quality:
                                    result.qualityScore
                            }
                        );

                    } else {

                        console.log(
                            `❌ ANALYSE REJETÉE: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`
                        );

                    }

                } catch (error) {

                    console.error(
                        `❌ ANALYSE ERROR: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
                        error.message
                    );

                }

            }


            console.log(
                "📊 TOTAL ANALYSES:",
                analyses.length
            );


            /* ------------------------------------------------
               TOP PICKS
            ------------------------------------------------ */

            const picks =
                selectDailyPicks(
                    analyses
                );


            /* ------------------------------------------------
               CACHE
            ------------------------------------------------ */

            cache =
                picks;

            cacheTime =
                Date.now();

            lastStatus =
                picks.length > 0
                    ? "READY"
                    : "NO_VALID_PICKS";

            lastUpdate =
                new Date()
                    .toISOString();


            console.log(
                "👑 PICKS:",
                picks.length
            );


            if (picks.length) {

                picks.forEach(
                    (pick, index) => {

                        console.log(
                            `👑 PICK #${index + 1}:`,
                            `${pick.match.homeTeam.name} vs ${pick.match.awayTeam.name}`,
                            "|",
                            pick.selectedBet.option,
                            "|",
                            "QUALITY:",
                            pick.qualityScore
                        );

                    }
                );

            }


            return picks;


        } catch (error) {

            lastStatus =
                "ERROR";

            lastError =
                error.message;


            console.error(
                "❌ DAILY ERROR:",
                error.message
            );


            return cache;


        } finally {

            building = null;

        }

    })();


    return building;

}


/* =========================================================
   API ANALYSIS
========================================================= */

app.get(
    "/analysis",
    async (req, res) => {

        try {

            const analyses =
                await buildDailyAnalysis();


            res.json({

                version:
                    VERSION,

                date:
                    dailyDate,

                count:
                    analyses.length,

                analyses

            });


        } catch (error) {

            res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   STATUS
========================================================= */

app.get(
    "/status",
    (req, res) => {

        res.json({

            status:
                lastStatus,

            ai:
                "ACTIVE",

            version:
                VERSION,

            date:
                dailyDate,

            matches:
                cache.length,

            analyzing:
                !!building,

            lastUpdate,

            error:
                lastError

        });

    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "ok",

            ai:
                "ACTIVE",

            version:
                VERSION,

            date:
                dailyDate,

            picks:
                cache.length

        });

    }
);


/* =========================================================
   WATCHER 24/24
========================================================= */

function startDailyWatcher() {

    let currentDay =
        getToday();


    console.log(
        "🕐 WATCHER ACTIF:",
        currentDay
    );


    setInterval(
        async () => {

            const today =
                getToday();


            if (
                today !== currentDay
            ) {

                console.log(
                    "🌅 NOUVEAU JOUR DÉTECTÉ:",
                    today
                );


                currentDay =
                    today;

                dailyDate =
                    today;

                cache = [];

                cacheTime = 0;


                await buildDailyAnalysis();

            }

        },
        60 * 1000
    );

}


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            "👑 KING PREDICTIONS AI V1"
        );

        console.log(
            "🔥 VERSION:",
            VERSION
        );

        console.log(
            "🇨🇬 TIMEZONE:",
            TIMEZONE
        );


        try {

            await initializeDatabase();


            console.log(
                "✅ DATABASE READY"
            );


            await buildDailyAnalysis();


            startDailyWatcher();


            console.log(
                "🚀 KING V1 READY 24/24"
            );


        } catch (error) {

            console.error(
                "❌ STARTUP ERROR:",
                error.message
            );

        }

    }
);
