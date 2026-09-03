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

const app = express();

const PORT = process.env.PORT || 3000;

/* =====================================================
   KING PREDICTIONS AI — SERVER V1
   =====================================================

   INTERFACE :
   🔥 IA ACTIVE
   💎 1X2
   🟣 OVER 2.5
   🟠 BTTS
   🏆 PARI LE PLUS SÛR

   ROUTES PUBLIQUES :
   /vip/1x2
   /vip/over25
   /vip/btts
   /safest

   ROUTES TECHNIQUES :
   /status
   /health

   ===================================================== */


/* =====================================================
   EXPRESS
===================================================== */

app.use(cors());

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =====================================================
   CONFIGURATION
===================================================== */

const CACHE_TTL =
    30 * 60 * 1000; // 30 minutes

const EMPTY_CACHE_TTL =
    2 * 60 * 1000; // 2 minutes

const MAX_ANALYSES = 30;

const UPCOMING_DAYS = 7;


/* =====================================================
   CACHE
===================================================== */

let cache = [];

let cacheTime = 0;

let cacheValid = false;

let building = null;


/* =====================================================
   ÉTAT IA
===================================================== */

let dailyDate = "";

let lastStatus = "STARTING";

let lastError = null;

let lastUpdate = null;


/* =====================================================
   DATE CONGO
===================================================== */

function getToday() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Africa/Brazzaville",

            year: "numeric",

            month: "2-digit",

            day: "2-digit"
        }
    ).format(new Date());
}


/* =====================================================
   NORMALISATION
===================================================== */

function normalizeText(value) {

    return String(value || "")
        .trim()
        .toUpperCase();
}


/* =====================================================
   SCORE IA
===================================================== */

function getAIScore(a) {

    const p =
        a?.predictions || {};

    const value =
        p.aiRating ??
        p.winnerAIScore ??
        a?.vipScore ??
        0;

    const score =
        Number(value);

    return Number.isFinite(score)
        ? score
        : 0;
}


/* =====================================================
   RISQUE
===================================================== */

function getRisk(a) {

    const p =
        a?.predictions || {};

    return normalizeText(
        p.winnerRisk ||
        p.risk ||
        p.aiDecision?.risk ||
        a?.risk ||
        "HIGH"
    );
}


/* =====================================================
   ANALYSE VALIDE
===================================================== */

function isUsable(a) {

    return !!(
        a &&
        a.match &&
        a.match.homeTeam &&
        a.match.awayTeam &&
        a.predictions
    );
}


/* =====================================================
   ANALYSE PUBLIABLE
===================================================== */

function isPublishable(a) {

    const risk =
        getRisk(a);

    return [
        "LOW",
        "FAIBLE",
        "MEDIUM",
        "MOYEN"
    ].includes(risk);
}


/* =====================================================
   IDENTIFIANT MATCH
===================================================== */

function matchKey(a) {

    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id || a?.match?.homeTeam?.name}_${a?.match?.awayTeam?.id || a?.match?.awayTeam?.name}_${a?.match?.utcDate}`
    );
}


/* =====================================================
   FORMAT FRONTEND
===================================================== */

function format(a) {

    if (!a) {
        return null;
    }

    return {

        match: {

            id:
                a.match?.id ?? null,

            utcDate:
                a.match?.utcDate ?? null,

            competition:
                a.match?.competition ?? null,

            homeTeam:
                a.match?.homeTeam ?? null,

            awayTeam:
                a.match?.awayTeam ?? null
        },

        predictions:
            a.predictions || {},

        model:
            a.model || {},

        vipScore:
            getAIScore(a),

        risk:
            getRisk(a)
    };
}


/* =====================================================
   FILTRE 1X2
===================================================== */

function strict1X2(a) {

    const p =
        a?.predictions || {};

    const probabilities =
        p.probabilities || {};

    const values = [

        Number(
            probabilities.homeWin || 0
        ),

        Number(
            probabilities.draw || 0
        ),

        Number(
            probabilities.awayWin || 0
        )

    ].sort(
        (x, y) => y - x
    );

    const favorite =
        values[0] || 0;

    const second =
        values[1] || 0;

    return (

        isUsable(a) &&

        isPublishable(a) &&

        p.winner &&

        normalizeText(
            p.winner
        ) !== "DRAW" &&

        favorite >= 65 &&

        favorite - second >= 10 &&

        Number(
            p.winnerConfidence || 0
        ) >= 65 &&

        getAIScore(a) >= 65
    );
}


/* =====================================================
   FILTRE OVER 2.5
===================================================== */

function strictOver(a) {

    const p =
        a?.predictions || {};

    const xg =
        Number(
            a?.model?.expectedGoals || 0
        );

    return (

        isUsable(a) &&

        isPublishable(a) &&

        normalizeText(
            p.over25
        ) === "OVER 2.5" &&

        Number(
            p.over25Confidence || 0
        ) >= 70 &&

        getAIScore(a) >= 65 &&

        xg >= 2.5
    );
}


/* =====================================================
   FILTRE BTTS
===================================================== */

function strictBTTS(a) {

    const p =
        a?.predictions || {};

    const xg =
        Number(
            a?.model?.expectedGoals || 0
        );

    return (

        isUsable(a) &&

        isPublishable(a) &&

        (
            normalizeText(p.btts) === "OUI" ||
            normalizeText(p.btts) === "YES"
        ) &&

        Number(
            p.bttsConfidence || 0
        ) >= 70 &&

        getAIScore(a) >= 65 &&

        xg >= 2.5
    );
}


/* =====================================================
   SCORE 1X2
===================================================== */

function score1X2(a) {

    const p =
        a?.predictions || {};

    const probabilities =
        p.probabilities || {};

    const values = [

        Number(
            probabilities.homeWin || 0
        ),

        Number(
            probabilities.draw || 0
        ),

        Number(
            probabilities.awayWin || 0
        )

    ].sort(
        (x, y) => y - x
    );

    const favorite =
        values[0] || 0;

    const second =
        values[1] || 0;

    const separation =
        favorite - second;

    return (

        favorite * 100 +

        separation * 80 +

        Number(
            p.winnerConfidence || 0
        ) * 2 +

        getAIScore(a) * 1.5
    );
}


/* =====================================================
   SCORE OVER
===================================================== */

function scoreOver(a) {

    const p =
        a?.predictions || {};

    const xg =
        Number(
            a?.model?.expectedGoals || 0
        );

    const confidence =
        Number(
            p.over25Confidence || 0
        );

    return (

        confidence * 100 +

        getAIScore(a) * 1.5 +

        xg * 100
    );
}


/* =====================================================
   SCORE BTTS
===================================================== */

function scoreBTTS(a) {

    const p =
        a?.predictions || {};

    const xg =
        Number(
            a?.model?.expectedGoals || 0
        );

    const confidence =
        Number(
            p.bttsConfidence || 0
        );

    return (

        confidence * 100 +

        getAIScore(a) * 1.5 +

        xg * 100
    );
}


/* =====================================================
   DÉDUPLICATION
===================================================== */

function removeDuplicates(matches) {

    const seen =
        new Set();

    return matches.filter(
        match => {

            const key =
                String(
                    match?.id ??
                    `${match?.homeTeam?.id}_${match?.awayTeam?.id}_${match?.utcDate}`
                );

            if (
                seen.has(key)
            ) {
                return false;
            }

            seen.add(key);

            return true;
        }
    );
}


/* =====================================================
   SÉLECTION UNIQUE
===================================================== */

function selectUnique(
    candidates,
    scorer,
    limit
) {

    const used =
        new Set();

    const selected = [];

    const sorted =
        [...candidates].sort(
            (a, b) =>
                scorer(b) -
                scorer(a)
        );

    for (
        const analysis of sorted
    ) {

        const key =
            matchKey(analysis);

        if (
            used.has(key)
        ) {
            continue;
        }

        used.add(key);

        selected.push(
            analysis
        );

        if (
            selected.length >= limit
        ) {
            break;
        }
    }

    return selected;
}


/* =====================================================
   CONSTRUCTION DU JOUR
===================================================== */

async function getDaily() {

    const today =
        getToday();


    /* -------------------------------------------------
       NOUVEAU JOUR
    ------------------------------------------------- */

    if (
        dailyDate !== today
    ) {

        cache = [];

        cacheTime = 0;

        cacheValid = false;

        dailyDate = today;

        console.log(
            "📅 NEW DAY:",
            today
        );
    }


    /* -------------------------------------------------
       CACHE
    ------------------------------------------------- */

    if (
        cacheValid
    ) {

        const ttl =
            cache.length > 0
                ? CACHE_TTL
                : EMPTY_CACHE_TTL;

        if (
            Date.now() -
            cacheTime <
            ttl
        ) {

            console.log(
                "⚡ CACHE:",
                cache.length,
                "analyses"
            );

            return cache;
        }
    }


    /* -------------------------------------------------
       ÉVITER DOUBLE CONSTRUCTION
    ------------------------------------------------- */

    if (
        building
    ) {

        console.log(
            "⏳ ANALYSIS ALREADY RUNNING"
        );

        return building;
    }


    /* -------------------------------------------------
       CONSTRUCTION
    ------------------------------------------------- */

    building =
        (async () => {

            lastStatus =
                "LOADING";

            lastError =
                null;

            try {

                console.log(
                    "📡 FETCHING MATCHES..."
                );


                const matches =
                    await getMatches();


                if (
                    !Array.isArray(matches)
                ) {

                    throw new Error(
                        "getMatches() ne retourne pas un tableau"
                    );
                }


                console.log(
                    "📦 MATCHES RECEIVED:",
                    matches.length
                );


                const uniqueMatches =
                    removeDuplicates(
                        matches
                    );


                const now =
                    Date.now();


                const limit =
                    now +
                    UPCOMING_DAYS *
                    24 *
                    60 *
                    60 *
                    1000;


                /* -------------------------------------
                   MATCHS À VENIR
                ------------------------------------- */

                const upcoming =
                    uniqueMatches

                        .filter(
                            match => {

                                const time =
                                    new Date(
                                        match?.utcDate
                                    ).getTime();

                                return (

                                    Number.isFinite(
                                        time
                                    ) &&

                                    time >= now &&

                                    time <= limit
                                );
                            }
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
                    "📅 UPCOMING MATCHES:",
                    upcoming.length
                );


                /* -------------------------------------
                   AUCUN MATCH
                ------------------------------------- */

                if (
                    !upcoming.length
                ) {

                    cache = [];

                    cacheTime =
                        Date.now();

                    cacheValid =
                        true;

                    lastStatus =
                        "NO_MATCHES";

                    lastUpdate =
                        new Date()
                            .toISOString();

                    console.log(
                        "⚠️ NO UPCOMING MATCHES"
                    );

                    return [];
                }


                /* -------------------------------------
                   ANALYSES
                ------------------------------------- */

                const results =
                    [];


                const toAnalyze =
                    upcoming.slice(
                        0,
                        MAX_ANALYSES
                    );


                console.log(
                    "🔥 MATCHES TO ANALYZE:",
                    toAnalyze.length
                );


                for (
                    const match of toAnalyze
                ) {

                    try {

                        console.log(
                            "🔎 ANALYZING:",
                            `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`
                        );


                        const analysis =
                            await analyzeMatch(
                                match
                            );


                        if (
                            !isUsable(
                                analysis
                            )
                        ) {

                            console.log(
                                "⚠️ INVALID ANALYSIS:",
                                match.homeTeam?.name,
                                "vs",
                                match.awayTeam?.name
                            );

                            continue;
                        }


                        results.push(
                            analysis
                        );


                    } catch (
                        err
                    ) {

                        console.error(
                            "❌ AI ERROR:",
                            `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`,
                            err.message
                        );
                    }
                }


                /* -------------------------------------
                   CACHE
                ------------------------------------- */

                cache =
                    results;

                cacheTime =
                    Date.now();

                cacheValid =
                    true;


                lastStatus =
                    results.length
                        ? "READY"
                        : "NO_VALID_ANALYSES";


                lastUpdate =
                    new Date()
                        .toISOString();


                console.log(
                    "👑 AI READY:",
                    results.length
                );


                return results;


            } catch (
                err
            ) {

                lastStatus =
                    "ERROR";

                lastError =
                    err.message;

                lastUpdate =
                    new Date()
                        .toISOString();


                console.error(
                    "❌ DAILY ERROR:",
                    err.stack
                );


                if (
                    cacheValid
                ) {

                    return cache;
                }


                return [];


            } finally {

                building =
                    null;
            }

        })();


    return building;
}


/* =====================================================
   💎 1X2
===================================================== */

app.get(
    "/vip/1x2",
    async (
        req,
        res
    ) => {

        try {

            const data =
                await getDaily();


            const selected =
                selectUnique(

                    data.filter(
                        strict1X2
                    ),

                    score1X2,

                    2
                );


            console.log(
                "🎯 1X2:",
                selected.map(
                    matchKey
                )
            );


            res.json(
                selected.map(
                    format
                )
            );


        } catch (
            err
        ) {

            console.error(
                "1X2:",
                err
            );

            res.status(500).json({
                error:
                    err.message
            });
        }
    }
);


/* =====================================================
   🟣 OVER 2.5
===================================================== */

app.get(
    "/vip/over25",
    async (
        req,
        res
    ) => {

        try {

            const data =
                await getDaily();


            const selected =
                selectUnique(

                    data.filter(
                        strictOver
                    ),

                    scoreOver,

                    2
                );


            console.log(
                "🎯 OVER 2.5:",
                selected.map(
                    matchKey
                )
            );


            res.json(
                selected.map(
                    format
                )
            );


        } catch (
            err
        ) {

            console.error(
                "OVER 2.5:",
                err
            );

            res.status(500).json({
                error:
                    err.message
            });
        }
    }
);


/* =====================================================
   🟠 BTTS
===================================================== */

app.get(
    "/vip/btts",
    async (
        req,
        res
    ) => {

        try {

            const data =
                await getDaily();


            const selected =
                selectUnique(

                    data.filter(
                        strictBTTS
                    ),

                    scoreBTTS,

                    2
                );


            console.log(
                "🎯 BTTS:",
                selected.map(
                    matchKey
                )
            );


            res.json(
                selected.map(
                    format
                )
            );


        } catch (
            err
        ) {

            console.error(
                "BTTS:",
                err
            );

            res.status(500).json({
                error:
                    err.message
            });
        }
    }
);


/* =====================================================
   🏆 PARI LE PLUS SÛR
===================================================== */

app.get(
    "/safest",
    async (
        req,
        res
    ) => {

        try {

            const data =
                await getDaily();


            const choices =
                [];


            for (
                const a of data
            ) {

                const p =
                    a?.predictions || {};


                /* -------------------------------------
                   1X2
                ------------------------------------- */

                if (
                    strict1X2(a)
                ) {

                    choices.push({

                        ...format(a),

                        market:
                            "1X2",

                        pick:
                            p.winner,

                        confidence:
                            Number(
                                p.winnerConfidence ||
                                0
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)
                    });
                }


                /* -------------------------------------
                   OVER 2.5
                ------------------------------------- */

                if (
                    strictOver(a)
                ) {

                    choices.push({

                        ...format(a),

                        market:
                            "OVER 2.5",

                        pick:
                            p.over25,

                        confidence:
                            Number(
                                p.over25Confidence ||
                                0
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)
                    });
                }


                /* -------------------------------------
                   BTTS
                ------------------------------------- */

                if (
                    strictBTTS(a)
                ) {

                    choices.push({

                        ...format(a),

                        market:
                            "BTTS",

                        pick:
                            p.btts,

                        confidence:
                            Number(
                                p.bttsConfidence ||
                                0
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)
                    });
                }
            }


            /* -----------------------------------------
               AUCUNE ANALYSE
            ----------------------------------------- */

            if (
                !choices.length
            ) {

                console.log(
                    "🛑 SAFEST: NO QUALIFIED ANALYSIS"
                );

                return res.json(
                    null
                );
            }


            /* -----------------------------------------
               CLASSEMENT
            ----------------------------------------- */

            choices.sort(
                (a, b) =>

                    b.confidence -
                    a.confidence ||

                    b.aiScore -
                    a.aiScore
            );


            const safest =
                choices[0];


            console.log(
                "🏆 SAFEST:",
                safest.market,
                safest.pick,
                safest.confidence + "%"
            );


            res.json(
                safest
            );


        } catch (
            err
        ) {

            console.error(
                "SAFEST:",
                err
            );

            res.status(500).json({
                error:
                    err.message
            });
        }
    }
);


/* =====================================================
   STATUS — TECHNIQUE
===================================================== */

app.get(
    "/status",
    (
        req,
        res
    ) => {

        res.json({

            status:
                lastStatus,

            ai:
                "ACTIVE",

            version:
                "V1",

            matches:
                cache.length,

            predictions:
                cache.length,

            cacheValid,

            analyzing:
                !!building,

            dailyDate,

            lastUpdate,

            error:
                lastError
        });
    }
);


/* =====================================================
   HEALTH — RENDER
===================================================== */

app.get(
    "/health",
    (
        req,
        res
    ) => {

        res.json({

            status:
                "ok",

            ai:
                "ACTIVE",

            version:
                "V1",

            analyses:
                cache.length,

            analyzing:
                !!building,

            dailyDate,

            lastStatus,

            lastError,

            lastUpdate
        });
    }
);


/* =====================================================
   HOME
===================================================== */

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


/* =====================================================
   DÉMARRAGE
===================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            "👑 KING PREDICTIONS AI V1 ONLINE"
        );

        console.log(
            "🌐 PORT:",
            PORT
        );


        try {

            /* -----------------------------------------
               DATABASE
            ----------------------------------------- */

            await initializeDatabase();


            console.log(
                "✅ DATABASE READY"
            );


            /* -----------------------------------------
               PRÉCHARGEMENT UNIQUE
            ----------------------------------------- */

            await getDaily();


            console.log(
                "✅ AI PRELOAD FINISHED"
            );


        } catch (
            err
        ) {

            console.error(
                "❌ STARTUP:",
                err.stack
            );
        }
    }
);
