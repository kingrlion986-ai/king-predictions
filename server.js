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
   KING PREDICTIONS AI — SERVER V3.1
   Objectif :
   - serveur stable
   - cache intelligent
   - diagnostic clair
   - moins de faux "0 match"
   - API frontend simple
===================================================== */

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   CONFIGURATION
===================================================== */

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const EMPTY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const MAX_ANALYSES = 30;
const UPCOMING_DAYS = 7;

let cache = [];
let cacheTime = 0;
let cacheValid = false;

let building = null;
let dailyDate = "";

let lastStatus = "STARTING";
let lastError = null;
let lastUpdate = null;

/* =====================================================
   DATE
===================================================== */

function getToday() {
    // Date locale du serveur
    const now = new Date();

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Brazzaville",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(now);
}

/* =====================================================
   NORMALISATION
===================================================== */

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toUpperCase();
}

function getRisk(a) {
    const p = a?.predictions || {};

    return normalizeText(
        p.winnerRisk ||
        p.risk ||
        p.aiDecision?.risk ||
        "HIGH"
    );
}

function getAIScore(a) {
    const p = a?.predictions || {};

    const value =
        p.winnerAIScore ??
        p.aiRating ??
        a?.vipScore ??
        0;

    const score = Number(value);

    return Number.isFinite(score)
        ? score
        : 0;
}

/* =====================================================
   UTILITAIRES
===================================================== */

function getPlayed(team) {
    return Number(
        team?.played ??
        team?.matchesPlayed ??
        team?.gamesPlayed ??
        0
    );
}

/*
 * IMPORTANT :
 * On ne rejette plus automatiquement une analyse
 * simplement parce qu'une équipe possède moins de
 * 5 matchs dans les statistiques retournées.
 *
 * Le moteur IA décide lui-même de la qualité.
 */
function isUsable(a) {
    return !!(
        a &&
        a.match &&
        a.match.homeTeam &&
        a.match.awayTeam &&
        a.predictions
    );
}

function isPublishable(a) {
    const risk = getRisk(a);

    return [
        "LOW",
        "FAIBLE",
        "MEDIUM",
        "MOYEN"
    ].includes(risk);
}

function matchKey(a) {
    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id || a?.match?.homeTeam?.name}_${a?.match?.awayTeam?.id || a?.match?.awayTeam?.name}_${a?.match?.utcDate}`
    );
}

/* =====================================================
   FORMAT API
===================================================== */

function format(a) {
    if (!a) return null;

    return {
        match: {
            id: a.match?.id ?? null,
            utcDate: a.match?.utcDate ?? null,
            competition: a.match?.competition ?? null,
            homeTeam: a.match?.homeTeam ?? null,
            awayTeam: a.match?.awayTeam ?? null
        },

        predictions: a.predictions || {},

        model: {
            expectedGoals:
                a.model?.expectedGoals ?? null,

            expectedHomeGoals:
                a.model?.expectedHomeGoals ?? null,

            expectedAwayGoals:
                a.model?.expectedAwayGoals ?? null
        },

        vipScore: getAIScore(a),
        risk: getRisk(a)
    };
}

/* =====================================================
   FILTRES
===================================================== */

function strict1X2(a) {
    const p = a?.predictions || {};
    const probs = p.probabilities || {};

    const values = [
        Number(probs.homeWin || 0),
        Number(probs.draw || 0),
        Number(probs.awayWin || 0)
    ].sort((x, y) => y - x);

    const favorite = values[0] || 0;
    const second = values[1] || 0;

    return (
        isUsable(a) &&
        isPublishable(a) &&
        p.winner &&
        normalizeText(p.winner) !== "DRAW" &&
        favorite >= 65 &&
        favorite - second >= 10 &&
        Number(p.winnerConfidence || 0) >= 65 &&
        getAIScore(a) >= 65
    );
}

function strictOver(a) {
    const p = a?.predictions || {};
    const xg = Number(
        a?.model?.expectedGoals || 0
    );

    return (
        isUsable(a) &&
        isPublishable(a) &&
        normalizeText(p.over25) === "OVER 2.5" &&
        Number(p.over25Confidence || 0) >= 70 &&
        getAIScore(a) >= 65 &&
        xg >= 2.5
    );
}

function strictBTTS(a) {
    const p = a?.predictions || {};
    const xg = Number(
        a?.model?.expectedGoals || 0
    );

    return (
        isUsable(a) &&
        isPublishable(a) &&
        (
            normalizeText(p.btts) === "OUI" ||
            normalizeText(p.btts) === "YES"
        ) &&
        Number(p.bttsConfidence || 0) >= 70 &&
        getAIScore(a) >= 65 &&
        xg >= 2.5
    );
}

/* =====================================================
   SCORES
===================================================== */

function score1X2(a) {
    const p = a?.predictions || {};
    const probs = p.probabilities || {};

    const values = [
        Number(probs.homeWin || 0),
        Number(probs.draw || 0),
        Number(probs.awayWin || 0)
    ].sort((x, y) => y - x);

    const favorite = values[0] || 0;
    const second = values[1] || 0;
    const separation = favorite - second;

    return (
        favorite * 100 +
        separation * 80 +
        Number(p.winnerConfidence || 0) * 2 +
        getAIScore(a) * 1.5
    );
}

function scoreOver(a) {
    const p = a?.predictions || {};

    const xg = Number(
        a?.model?.expectedGoals || 0
    );

    const confidence = Number(
        p.over25Confidence || 0
    );

    return (
        confidence * 100 +
        getAIScore(a) * 1.5 +
        xg * 100
    );
}

function scoreBTTS(a) {
    const p = a?.predictions || {};

    const xg = Number(
        a?.model?.expectedGoals || 0
    );

    const confidence = Number(
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
    const seen = new Set();

    return matches.filter(match => {
        const key = String(
            match?.id ??
            `${match?.homeTeam?.id}_${match?.awayTeam?.id}_${match?.utcDate}`
        );

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

/* =====================================================
   SÉLECTION
===================================================== */

function selectUnique(
    candidates,
    scorer,
    limit,
    used = new Set()
) {
    return candidates
        .filter(a => !used.has(matchKey(a)))
        .sort(
            (a, b) =>
                scorer(b) - scorer(a)
        )
        .slice(0, limit);
}

/* =====================================================
   ANALYSE QUOTIDIENNE
===================================================== */

async function getDaily() {

    const today = getToday();

    /* -----------------------------------------------
       NOUVEAU JOUR
    ------------------------------------------------ */

    if (dailyDate !== today) {
        cache = [];
        cacheTime = 0;
        cacheValid = false;
        dailyDate = today;

        console.log(
            "📅 NEW DAY:",
            today
        );
    }

    /* -----------------------------------------------
       CACHE
    ------------------------------------------------ */

    if (cacheValid) {

        const ttl =
            cache.length > 0
                ? CACHE_TTL
                : EMPTY_CACHE_TTL;

        if (
            Date.now() - cacheTime < ttl
        ) {
            console.log(
                "⚡ CACHE:",
                cache.length,
                "analyses"
            );

            return cache;
        }
    }

    /* -----------------------------------------------
       ÉVITER DE LANCER PLUSIEURS CONSTRUCTIONS
    ------------------------------------------------ */

    if (building) {
        console.log(
            "⏳ ANALYSIS ALREADY RUNNING"
        );

        return building;
    }

    /* -----------------------------------------------
       CONSTRUCTION
    ------------------------------------------------ */

    building = (async () => {

        lastStatus = "LOADING";
        lastError = null;

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
                removeDuplicates(matches);

            const now = Date.now();

            const limit =
                now +
                UPCOMING_DAYS *
                24 *
                60 *
                60 *
                1000;

            /* -------------------------------------------
               MATCHS À VENIR
            ------------------------------------------- */

            let upcoming =
                uniqueMatches
                    .filter(match => {

                        const time =
                            new Date(
                                match?.utcDate
                            ).getTime();

                        return (
                            Number.isFinite(time) &&
                            time >= now &&
                            time <= limit
                        );
                    })
                    .sort(
                        (a, b) =>
                            new Date(a.utcDate) -
                            new Date(b.utcDate)
                    );

            console.log(
                "📅 UPCOMING MATCHES:",
                upcoming.length
            );

            /* -------------------------------------------
               SI AUCUN MATCH
            ------------------------------------------- */

            if (!upcoming.length) {

                cache = [];
                cacheTime = Date.now();
                cacheValid = true;

                lastStatus =
                    "NO_MATCHES";

                lastUpdate =
                    new Date().toISOString();

                console.log(
                    "⚠️ NO UPCOMING MATCHES"
                );

                return [];
            }

            /* -------------------------------------------
               ANALYSE
            ------------------------------------------- */

            const results = [];

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

                } catch (err) {

                    console.error(
                        "❌ AI ERROR:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`,
                        err.message
                    );
                }
            }

            /* -------------------------------------------
               SAUVEGARDE
            ------------------------------------------- */

            cache = results;
            cacheTime = Date.now();
            cacheValid = true;

            lastStatus =
                results.length
                    ? "READY"
                    : "NO_VALID_ANALYSES";

            lastUpdate =
                new Date().toISOString();

            console.log(
                "👑 AI READY:",
                results.length
            );

            return results;

        } catch (err) {

            lastStatus = "ERROR";
            lastError = err.message;
            lastUpdate =
                new Date().toISOString();

            console.error(
                "❌ DAILY ERROR:",
                err.stack
            );

            /*
             * IMPORTANT :
             * On ne détruit pas un ancien cache valide
             * lorsqu'une requête temporaire échoue.
             */

            if (cacheValid) {
                return cache;
            }

            return [];

        } finally {

            building = null;
        }

    })();

    return building;
}

/* =====================================================
   FREE / RÉSUMÉ
===================================================== */

app.get("/free", async (req, res) => {

    try {

        const data =
            await getDaily();

        const selected =
            data
                .filter(isUsable)
                .sort(
                    (a, b) =>
                        getAIScore(b) -
                        getAIScore(a)
                )
                .slice(0, 1);

        res.json(
            selected.map(format)
        );

    } catch (err) {

        console.error(
            "FREE:",
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   1X2
===================================================== */

app.get("/vip/1x2", async (req, res) => {

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
            selected.map(matchKey)
        );

        res.json(
            selected.map(format)
        );

    } catch (err) {

        console.error(
            "1X2:",
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   OVER 2.5
===================================================== */

app.get("/vip/over25", async (req, res) => {

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
            selected.map(matchKey)
        );

        res.json(
            selected.map(format)
        );

    } catch (err) {

        console.error(
            "OVER:",
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   BTTS
===================================================== */

app.get("/vip/btts", async (req, res) => {

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
            selected.map(matchKey)
        );

        res.json(
            selected.map(format)
        );

    } catch (err) {

        console.error(
            "BTTS:",
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   PARI LE PLUS SÛR
===================================================== */

app.get("/safest", async (req, res) => {

    try {

        const data =
            await getDaily();

        const choices = [];

        for (const a of data) {

            const p =
                a?.predictions || {};

            if (strict1X2(a)) {

                choices.push({
                    ...format(a),

                    market: "1X2",

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

            if (strictOver(a)) {

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

            if (strictBTTS(a)) {

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

        if (!choices.length) {

            console.log(
                "🛑 SAFEST: NO QUALIFIED ANALYSIS"
            );

            return res.json(null);
        }

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
            safest.confidence + "%",
            safest.risk
        );

        res.json(safest);

    } catch (err) {

        console.error(
            "SAFEST:",
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   STATUS — POUR TON INTERFACE
===================================================== */

app.get("/status", async (req, res) => {

    res.json({

        status: lastStatus,

        ai: "ACTIVE",

        version: "V3.1",

        matches: cache.length,

        predictions: cache.length,

        cacheValid,

        analyzing: !!building,

        dailyDate,

        lastUpdate,

        error: lastError

    });
});

/* =====================================================
   HEALTH
===================================================== */

app.get("/health", (req, res) => {

    res.json({

        status: "ok",

        ai: "ACTIVE",

        version: "V3.1",

        analyses: cache.length,

        analyzing: !!building,

        dailyDate,

        lastStatus,

        lastError,

        lastUpdate

    });
});

/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

/* =====================================================
   START
===================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            "👑 KING PREDICTIONS AI V3.1 ONLINE"
        );

        console.log(
            "🌐 PORT:",
            PORT
        );

        try {

            /*
             * La DB est initialisée AVANT
             * le premier chargement de l'IA.
             */

            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );

            /*
             * Préchargement.
             * Si l'API externe rencontre une erreur,
             * le serveur reste quand même ONLINE.
             */

            await getDaily();

            console.log(
                "✅ AI PRELOAD FINISHED"
            );

        } catch (err) {

            console.error(
                "❌ STARTUP:",
                err.stack
            );
        }
    }
);
