const express = require("express");
const cors = require("cors");
const path = require("path");

const { getMatches, initializeDatabase } = require("./services/footballApi");
const { analyzeMatch } = require("./services/predictionEngine");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "KING-V1-CLEAN";
const CACHE_TTL = 30 * 60 * 1000;
const EMPTY_CACHE_TTL = 2 * 60 * 1000;
const MAX_ANALYSES = 30;
const UPCOMING_DAYS = 7;
const DAILY_INTERVAL = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const file = req.path.toLowerCase();
    if (file === "/" || file.endsWith(".html") || file.endsWith(".js") || file.endsWith(".css")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
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

app.use(express.static(path.join(__dirname, "public"), {
    etag: false,
    maxAge: 0,
    index: false
}));

let cache = [];
let cacheTime = 0;
let cacheValid = false;
let building = null;
let dailyDate = "";
let lastStatus = "STARTING";
let lastError = null;
let lastUpdate = null;

function getToday() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Brazzaville",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

function isUsable(a) {
    return !!(
        a &&
        a.match &&
        a.match.homeTeam &&
        a.match.awayTeam &&
        a.predictions
    );
}

function matchKey(a) {
    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id || a?.match?.homeTeam?.name}_${a?.match?.awayTeam?.id || a?.match?.awayTeam?.name}_${a?.match?.utcDate}`
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

async function buildDailyAnalysis() {
    const today = getToday();

    if (dailyDate !== today) {
        cache = [];
        cacheTime = 0;
        cacheValid = false;
        dailyDate = today;
        console.log("📅 NEW DAY:", today);
    }

    if (cacheValid) {
        const ttl = cache.length > 0 ? CACHE_TTL : EMPTY_CACHE_TTL;

        if (Date.now() - cacheTime < ttl) {
            console.log("⚡ ANALYSIS CACHE:", cache.length);
            return cache;
        }
    }

    if (building) {
        console.log("⏳ ANALYSIS ALREADY RUNNING");
        return building;
    }

    building = (async () => {
        lastStatus = "LOADING";
        lastError = null;

        try {
            console.log("📡 FETCHING MATCHES...");

            const matches = await getMatches();

            if (!Array.isArray(matches)) {
                throw new Error("getMatches() ne retourne pas un tableau");
            }

            console.log("📦 MATCHES RECEIVED:", matches.length);

            const uniqueMatches = removeDuplicates(matches);
            const now = Date.now();
            const limit = now + UPCOMING_DAYS * 24 * 60 * 60 * 1000;

            const upcoming = uniqueMatches
                .filter(match => {
                    const time = new Date(match?.utcDate).getTime();

                    return (
                        Number.isFinite(time) &&
                        time >= now &&
                        time <= limit
                    );
                })
                .sort((a, b) =>
                    new Date(a.utcDate) - new Date(b.utcDate)
                );

            console.log("📅 MATCHES À ANALYSER:", upcoming.length);

            if (!upcoming.length) {
                cache = [];
                cacheTime = Date.now();
                cacheValid = true;
                lastStatus = "NO_MATCHES";
                lastUpdate = new Date().toISOString();
                return [];
            }

            const results = [];

            for (const match of upcoming.slice(0, MAX_ANALYSES)) {
                try {
                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`
                    );

                    const analysis = await analyzeMatch(match);

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

            cache = results;
            cacheTime = Date.now();
            cacheValid = true;
            lastStatus = results.length ? "READY" : "NO_VALID_ANALYSES";
            lastUpdate = new Date().toISOString();

            console.log("👑 DAILY ANALYSIS READY:", results.length);

            return results;
        } catch (err) {
            lastStatus = "ERROR";
            lastError = err.message;
            lastUpdate = new Date().toISOString();

            console.error("❌ DAILY ANALYSIS ERROR:", err.stack);

            return cacheValid ? cache : [];
        } finally {
            building = null;
        }
    })();

    return building;
}

async function refreshDaily() {
    if (building) return;

    console.log("🔄 DAILY REFRESH START");

    cacheValid = false;

    try {
        await buildDailyAnalysis();
        console.log("✅ DAILY REFRESH FINISHED");
    } catch (err) {
        console.error("❌ DAILY REFRESH:", err.message);
    }
}

app.get("/analysis", async (req, res) => {
    try {
        const data = await buildDailyAnalysis();

        res.setHeader("Cache-Control", "no-store");

        res.json({
            version: VERSION,
            date: dailyDate,
            count: data.length,
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
        cacheValid,
        analyzing: !!building,
        dailyDate,
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
        analyzing: !!building,
        dailyDate,
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
        dailyRefresh: true,
        intervalHours: 24,
        timezone: "Africa/Brazzaville",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, "0.0.0.0", async () => {
    console.log("👑 KING PREDICTIONS AI V1 ONLINE");
    console.log("🔥 VERSION:", VERSION);
    console.log("🌐 PORT:", PORT);
    console.log("📅 DAILY REFRESH: 24H");
    console.log("🇨🇬 TIMEZONE: Africa/Brazzaville");

    try {
        await initializeDatabase();
        console.log("✅ DATABASE READY");

        await buildDailyAnalysis();
        console.log("✅ FIRST DAILY ANALYSIS FINISHED");

        setInterval(async () => {
            console.log("⏰ 24H REFRESH");
            await refreshDaily();
        }, DAILY_INTERVAL);

        console.log("🚀 V1 READY");
    } catch (err) {
        console.error("❌ STARTUP:", err.stack);
    }
});
