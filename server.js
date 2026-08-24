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
   AI
========================= */

async function getDaily() {

    if (
        cache.length &&
        Date.now() - cacheTime < CACHE_TTL
    ) {
        return cache;
    }

    if (building) return building;

    building = (async () => {

        const matches = await getMatches();

        if (!matches?.length)
            return [];

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
                ) continue;

                results.push(a);

            } catch (err) {

                console.log(
                    "❌ AI:",
                    err.message
                );

            }
        }

        cache = results;
        cacheTime = Date.now();

        console.log(
            "👑 AI READY:",
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
   FORMAT
========================= */

function format(a) {

    return {
        match: {
            homeTeam: a.match.homeTeam,
            awayTeam: a.match.awayTeam
        },

        predictions: a.predictions,

        model: {
            expectedGoals:
                a.model?.expectedGoals
        },

        vipScore:
            a.vipScore ??
            a.predictions?.aiRating ??
            0
    };
}


/* =========================
   1X2 — 2 MATCHS
========================= */

app.get("/vip/1x2", async (req, res) => {

    try {

        const data =
            filterVipMatches(
                await getDaily()
            )
            .sort(
                (a, b) =>
                    (b.predictions?.winnerConfidence || 0) -
                    (a.predictions?.winnerConfidence || 0)
            )
            .slice(0, 2)
            .map(format);

        res.json(data);

    } catch (err) {

        console.error("1X2:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   OVER 2.5
========================= */

app.get("/vip/over25", async (req, res) => {

    try {

        const data =
            filterVipOver25(await getDaily())
            .sort(
                (a, b) =>
                    (b.predictions?.over25Confidence || 0) -
                    (a.predictions?.over25Confidence || 0)
            )
            .slice(0, 5)
            .map(format);

        res.json(data);

    } catch (err) {

        console.error("OVER:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   BTTS
========================= */

app.get("/vip/btts", async (req, res) => {

    try {

        const data =
            filterVipBtts(await getDaily())
            .sort(
                (a, b) =>
                    (b.predictions?.bttsConfidence || 0) -
                    (a.predictions?.bttsConfidence || 0)
            )
            .slice(0, 5)
            .map(format);

        res.json(data);

    } catch (err) {

        console.error("BTTS:", err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================
   PARI LE PLUS SÛR
========================= */

app.get("/safest", async (req, res) => {

    try {

        const data = await getDaily();

        const choices = [];

        for (const a of data) {

            const p = a.predictions || {};

            if (p.winnerConfidence) {

                choices.push({
                    ...format(a),
                    market: "1X2",
                    pick: p.winner,
                    confidence: p.winnerConfidence
                });

            }

            if (p.over25Confidence) {

                choices.push({
                    ...format(a),
                    market: "OVER 2.5",
                    pick: p.over25,
                    confidence: p.over25Confidence
                });

            }

            if (p.bttsConfidence) {

                choices.push({
                    ...format(a),
                    market: "BTTS",
                    pick: p.btts,
                    confidence: p.bttsConfidence
                });
            }
        }

        choices.sort(
            (a, b) =>
                b.confidence - a.confidence
        );

        res.json(
            choices.length
                ? choices[0]
                : null
        );

    } catch (err) {

        console.error("SAFEST:", err);

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
        ai: "ACTIVE",
        version: "V1",
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
