const express = require("express");
const cors = require("cors");
const path = require("path");

const {
    getMatches,
    initializeDatabase
} = require("./services/footballApi");

const { analyzeMatch } =
    require("./services/predictionEngine");

const {
    filterVipMatches,
    filterVipOver25,
    filterVipBtts
} = require("./services/vipFilterEngine");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

let cache = [];
let cacheTime = 0;
let building = null;

const CACHE_TTL = 15 * 60 * 1000;
const MAX_ANALYSES = 5;


/* =========================
   BUILD AI
========================= */

async function buildAnalyses() {

    if (
        cache.length &&
        Date.now() - cacheTime < CACHE_TTL
    ) {
        return cache;
    }

    if (building) {
        return building;
    }

    building = (async () => {

        const matches = await getMatches();

        if (!matches?.length) {
            return [];
        }

        const results = [];

        for (
            const match of matches.slice(0, MAX_ANALYSES)
        ) {

            try {

                const a =
                    await analyzeMatch(match);

                if (!a) continue;

                if (
                    Number(a.teamStats?.home?.played) < 5 ||
                    Number(a.teamStats?.away?.played) < 5
                ) {
                    continue;
                }

                results.push(a);

                console.log(
                    "✅ AI READY:",
                    match.homeTeam.name,
                    "vs",
                    match.awayTeam.name
                );

            } catch (err) {

                console.log(
                    "❌ ANALYSIS:",
                    err.message
                );

            }
        }

        cache = results;
        cacheTime = Date.now();

        console.log(
            "🤖 AI READY:",
            results.length
        );

        return results;

    })();

    try {
        return await building;
    } finally {
        building = null;
    }
}


/* =========================
   DAILY
========================= */

async function getDaily() {
    return await buildAnalyses();
}


/* =========================
   FORMAT
========================= */

function format(a) {

    const p = a.predictions || {};

    return {
        match:
            `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

        homeTeam: a.match.homeTeam,
        awayTeam: a.match.awayTeam,

        predictions: p,

        model: a.model,

        teamStats: a.teamStats,

        vipScore:
            a.vipScore ??
            p.aiRating ??
            p.predictionStrength ??
            0
    };
}


/* =========================
   FREE
========================= */

app.get("/free", async (req, res) => {

    try {

        const data =
            await getDaily();

        if (!data.length) {
            return res.json([]);
        }

        res.json([
            format(data[0])
        ]);

    } catch (err) {

        console.error("FREE:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   VIP 1X2
========================= */

app.get("/vip/1x2", async (req, res) => {

    try {

        const data =
            filterVipMatches(
                await getDaily()
            )
            .slice(0, 5)
            .map(format);

        console.log(
            "👑 VIP 1X2:",
            data.length
        );

        res.json(data);

    } catch (err) {

        console.error("1X2:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   VIP OVER
========================= */

app.get("/vip/over25", async (req, res) => {

    try {

        const data =
            filterVipOver25(
                await getDaily()
            )
            .slice(0, 6)
            .map(format);

        console.log(
            "🔥 VIP OVER:",
            data.length
        );

        res.json(data);

    } catch (err) {

        console.error("OVER:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   VIP BTTS
========================= */

app.get("/vip/btts", async (req, res) => {

    try {

        const data =
            filterVipBtts(
                await getDaily()
            )
            .slice(0, 5)
            .map(format);

        console.log(
            "🔥 VIP BTTS:",
            data.length
        );

        res.json(data);

    } catch (err) {

        console.error("BTTS:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   SCORE EXACT
========================= */

app.get("/vip/score", async (req, res) => {

    try {

        const data =
            (await getDaily())
            .filter(a =>
                a?.predictions?.correctScore
            )
            .slice(0, 5)
            .map(format);

        console.log(
            "📊 SCORE EXACT:",
            data.length
        );

        res.json(data);

    } catch (err) {

        console.error("SCORE:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {

    res.json({
        status: "ok",
        ai: "KING PREDICTIONS AI",
        analyses: cache.length
    });

});


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================
   START
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            "👑 KING PREDICTIONS AI ONLINE"
        );

        try {

            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );

            await getDaily();

            console.log(
                "✅ AI PRELOAD READY"
            );

        } catch (err) {

            console.error(
                "❌ STARTUP:",
                err.stack
            );

        }

    }
);
