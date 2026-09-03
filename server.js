const express = require("express");
const cors = require("cors");
const path = require("path");

const { getMatches, initializeDatabase } = require("./services/footballApi");
const { analyzeMatch } = require("./services/predictionEngine");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "KING-V1-TOMORROW";
const CACHE_TTL = 30 * 60 * 1000;
const EMPTY_CACHE_TTL = 2 * 60 * 1000;
const MAX_ANALYSES = 30;
const TOP_ANALYSES = 4;
const DAILY_INTERVAL = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const file = req.path.toLowerCase();

    if (
        file === "/" ||
        file.endsWith(".html") ||
        file.endsWith(".js") ||
        file.endsWith(".css")
    ) {
        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }

    res.setHeader("X-KING-VERSION", VERSION);
    next();
});

app.get("/", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    res.sendFile(path.join(__dirname, "public", "index.html"), {
        cacheControl: false,
        etag: false
    });
});

app.use(
    express.static(path.join(__dirname, "public"), {
        etag: false,
        maxAge: 0,
        index: false
    })
);

let cache = [];
let cacheTime = 0;
let cacheValid = false;
let building = null;
let dailyDate = "";
let lastStatus = "STARTING";
let lastError = null;
let lastUpdate = null;


/* =====================================================
   DATE BRAZZAVILLE
===================================================== */

function getBrazzavilleDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Brazzaville",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const values = {};

    for (const part of parts) {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    }

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day)
    };
}

function formatDate({ year, month, day }) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}


/* =====================================================
   DATE DE DEMAIN
===================================================== */

function getTomorrow() {
    const today = getBrazzavilleDate();

    // On utilise UTC uniquement pour ajouter 1 jour
    // aux composants de date déjà calculés pour Brazzaville.
    const tomorrow = new Date(
        Date.UTC(today.year, today.month - 1, today.day + 1)
    );

    return formatDate({
        year: tomorrow.getUTCFullYear(),
        month: tomorrow.getUTCMonth() + 1,
        day: tomorrow.getUTCDate()
    });
}


/* =====================================================
   OBTENIR LA DATE D'UN MATCH À BRAZZAVILLE
===================================================== */

function getMatchBrazzavilleDate(utcDate) {
    if (!utcDate) return "";

    const date = new Date(utcDate);

    if (!Number.isFinite(date.getTime())) return "";

    const parts = getBrazzavilleDate(date);

    return formatDate(parts);
}


/* =====================================================
   VALIDATION
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

function removeDuplicates(matches) {
    const seen = new Set();

    return matches.filter(match => {
        const key = String(
            match?.id ??
            `${match?.homeTeam?.id}_${match?.awayTeam?.id}_${match?.utcDate}`
        );

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
    });
}

function formatAnalysis(a) {
    return {
        match: {
            id: a.match?.id ?? null,
            utcDate: a.match?.utcDate ?? null,
            status: a.match?.status ?? null,
            competition: a.match?.competition ?? null,
            homeTeam: a.match?.homeTeam ?? null,
            awayTeam: a.match?.awayTeam ?? null
        },
        predictions: a.predictions || {},
        model: a.model || {},
        teamStats: a.teamStats || {},
        marketScores: a.marketScores || {}
    };
}


/* =====================================================
   BUILD DAILY ANALYSIS
   UNIQUEMENT LES MATCHS DE DEMAIN
===================================================== */

async function buildDailyAnalysis() {
    const targetDate = getTomorrow();

    // Si la date cible change, nouveau cycle
    if (dailyDate !== targetDate) {
        cache = [];
        cacheTime = 0;
        cacheValid = false;
        dailyDate = targetDate;

        console.log("📅 TARGET DATE:", targetDate);
    }

    // CACHE
    if (cacheValid) {
        const ttl =
            cache.length > 0
                ? CACHE_TTL
                : EMPTY_CACHE_TTL;

        if (Date.now() - cacheTime < ttl) {
            console.log(
                "⚡ ANALYSIS CACHE:",
                cache.length,
                "| DATE:",
                dailyDate
            );

            return cache;
        }
    }

    // Une seule analyse à la fois
    if (building) {
        console.log("⏳ ANALYSIS ALREADY RUNNING");
        return building;
    }

    building = (async () => {
        lastStatus = "LOADING";
        lastError = null;

        try {
            console.log("📡 FETCHING MATCHES...");
            console.log("🎯 SEARCHING ONLY FOR:", targetDate);

            const matches = await getMatches();

            if (!Array.isArray(matches)) {
                throw new Error(
                    "getMatches() ne retourne pas un tableau"
                );
            }

            console.log("📦 MATCHES RECEIVED:", matches.length);

            const uniqueMatches = removeDuplicates(matches);

            // UNIQUEMENT LES MATCHS DE DEMAIN
            const tomorrowMatches = uniqueMatches
                .filter(match => {
                    const matchDate =
                        getMatchBrazzavilleDate(match?.utcDate);

                    return matchDate === targetDate;
                })
                .sort(
                    (a, b) =>
                        new Date(a.utcDate) -
                        new Date(b.utcDate)
                );

            console.log(
                "📅 MATCHES FOR",
                targetDate,
                ":",
                tomorrowMatches.length
            );

            if (!tomorrowMatches.length) {
                cache = [];
                cacheTime = Date.now();
                cacheValid = true;
                lastStatus = "NO_MATCHES";
                lastUpdate = new Date().toISOString();

                console.log(
                    "⚠️ NO MATCHES FOUND FOR:",
                    targetDate
                );

                return [];
            }

            const results = [];

            // On analyse les matchs de demain disponibles
            for (
                const match of tomorrowMatches.slice(0, MAX_ANALYSES)
            ) {
                try {
                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`
                    );

                    const analysis =
                        await analyzeMatch(match);

                    if (!isUsable(analysis)) {
                        console.log(
                            "⚠️ INVALID ANALYSIS:",
                            match.homeTeam?.name,
                            "vs",
                            match.awayTeam?.name
                        );

                        continue;
                    }

                    results.push(analysis);

                } catch (err) {
                    console.error(
                        "❌ AI ERROR:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`,
                        err.message
                    );
                }
            }


            /* =============================================
               LIMITER À 4 ANALYSES MAXIMUM

               Priorité :
               1. confiance
               2. qualité des données
               3. nombre de matchs utilisés
            ============================================= */

            const sortedResults = results
                .sort((a, b) => {
                    const confidenceA =
                        Number(a?.predictions?.confidence) || 0;

                    const confidenceB =
                        Number(b?.predictions?.confidence) || 0;

                    if (confidenceB !== confidenceA) {
                        return confidenceB - confidenceA;
                    }

                    const matchesA =
                        Number(a?.predictions?.matchesUsed) || 0;

                    const matchesB =
                        Number(b?.predictions?.matchesUsed) || 0;

                    return matchesB - matchesA;
                })
                .slice(0, TOP_ANALYSES);


            cache = sortedResults;
            cacheTime = Date.now();
            cacheValid = true;

            lastStatus =
                sortedResults.length
                    ? "READY"
                    : "NO_VALID_ANALYSES";

            lastUpdate = new Date().toISOString();

            console.log(
                "👑 TOMORROW ANALYSIS READY:",
                sortedResults.length,
                "| DATE:",
                targetDate
            );

            sortedResults.forEach((analysis, index) => {
                console.log(
                    `🏆 TOP ${index + 1}:`,
                    `${analysis.match?.homeTeam?.name} vs ${analysis.match?.awayTeam?.name}`,
                    "| CONF:",
                    analysis.predictions?.confidence ?? 0,
                    "| DATA:",
                    analysis.predictions?.dataQuality ?? "UNKNOWN"
                );
            });

            return sortedResults;

        } catch (err) {
            lastStatus = "ERROR";
            lastError = err.message;
            lastUpdate = new Date().toISOString();

            console.error(
                "❌ DAILY ANALYSIS ERROR:",
                err.stack
            );

            return cacheValid ? cache : [];

        } finally {
            building = null;
        }
    })();

    return building;
}


/* =====================================================
   REFRESH
===================================================== */

async function refreshDaily() {
    if (building) return;

    console.log("🔄 DAILY REFRESH START");

    cacheValid = false;

    try {
        await buildDailyAnalysis();

        console.log(
            "✅ DAILY REFRESH FINISHED",
            "| TARGET:",
            dailyDate
        );

    } catch (err) {
        console.error(
            "❌ DAILY REFRESH:",
            err.message
        );
    }
}


/* =====================================================
   API
===================================================== */

app.get("/analysis", async (req, res) => {
    try {
        const data = await buildDailyAnalysis();

        res.setHeader("Cache-Control", "no-store");

        res.json({
            version: VERSION,
            date: dailyDate,
            count: data.length,
            max: TOP_ANALYSES,
            analyses: data.map(formatAnalysis)
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});


app.get("/status", (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.json({
        status: lastStatus,
        ai: "ACTIVE",
        version: VERSION,
        matches: cache.length,
        analyses: cache.length,
        maxAnalyses: TOP_ANALYSES,
        cacheValid,
        analyzing: !!building,
        targetDate: dailyDate,
        lastUpdate,
        error: lastError
    });
});


app.get("/health", (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.json({
        status: "ok",
        ai: "ACTIVE",
        version: VERSION,
        analyses: cache.length,
        maxAnalyses: TOP_ANALYSES,
        analyzing: !!building,
        targetDate: dailyDate,
        lastStatus,
        lastError,
        lastUpdate
    });
});


app.get("/__king_version", (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.json({
        project: "KING PREDICTIONS AI",
        version: VERSION,
        frontend: "V1",
        target: "TOMORROW_ONLY",
        maxDailyAnalyses: TOP_ANALYSES,
        dailyRefresh: true,
        intervalHours: 24,
        timezone: "Africa/Brazzaville",
        targetDate: dailyDate,
        timestamp: new Date().toISOString()
    });
});


/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, "0.0.0.0", async () => {
    console.log("👑 KING PREDICTIONS AI V1 ONLINE");
    console.log("🔥 VERSION:", VERSION);
    console.log("🌐 PORT:", PORT);
    console.log("🎯 MODE: TOMORROW ONLY");
    console.log("🏆 MAX ANALYSES:", TOP_ANALYSES);
    console.log("📅 DAILY REFRESH: 24H");
    console.log("🇨🇬 TIMEZONE: Africa/Brazzaville");

    try {
        await initializeDatabase();

        console.log("✅ DATABASE READY");

        console.log(
            "📅 CURRENT TARGET:",
            getTomorrow()
        );

        await buildDailyAnalysis();

        console.log(
            "✅ FIRST TOMORROW ANALYSIS FINISHED"
        );

        setInterval(async () => {
            console.log("⏰ 24H REFRESH");
            await refreshDaily();
        }, DAILY_INTERVAL);

        console.log("🚀 V1 READY");

    } catch (err) {
        console.error(
            "❌ STARTUP:",
            err.stack
        );
    }
});
