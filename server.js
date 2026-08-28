const express = require("express");
const cors = require("cors");
const path = require("path");

const {
    getMatches,
    initializeDatabase
} = require("./services/footballApi");

const { analyzeMatch } =
    require("./services/predictionEngine");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

let cache = [];
let cacheTime = 0;
let building = null;
let dailyDate = "";

const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_ANALYSES = 30;


/* =========================
   DAILY ANALYSIS
========================= */

async function getDaily() {

    const today =
        new Date().toISOString().slice(0, 10);

    if (dailyDate !== today) {
        cache = [];
        cacheTime = 0;
        dailyDate = today;

        console.log("📅 NEW DAY:", today);
    }

    if (
        cache.length &&
        Date.now() - cacheTime < CACHE_TTL
    ) {
        return cache;
    }

    if (building)
        return building;

    building = (async () => {

        const matches = await getMatches();

        if (!matches?.length)
            return [];

        const now = Date.now();

        const limit =
            now + 24 * 60 * 60 * 1000;

        const next24h = matches.filter(match => {

            const time =
                new Date(match.utcDate).getTime();

            return (
                time >= now &&
                time <= limit
            );

        });

        console.log(
            "📅 MATCHES 24H:",
            next24h.length
        );

        const results = [];

        for (
            const match of next24h.slice(0, MAX_ANALYSES)
        ) {

            try {

                const a =
                    await analyzeMatch(match);

                if (!a)
                    continue;

                if (
                    Number(a.teamStats?.home?.played) < 5 ||
                    Number(a.teamStats?.away?.played) < 5
                ) {
                    continue;
                }

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
   HELPERS
========================= */

function risk(a) {
    return (
        a?.predictions?.aiDecision?.risk ||
        "HIGH"
    );
}

function safe(a) {
    return (
        risk(a) === "LOW" ||
        risk(a) === "MEDIUM"
    );
}

function aiScore(a) {
    return Number(
        a?.predictions?.aiRating ||
        a?.vipScore ||
        0
    );
}

function format(a) {

    return {
        match: a.match,
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
   MARKET RANKING
========================= */

function rank(a, market) {

    const p =
        a.predictions || {};

    let confidence = 0;

    if (market === "1X2")
        confidence =
            Number(p.winnerConfidence || 0);

    if (market === "OVER")
        confidence =
            Number(p.over25Confidence || 0);

    if (market === "BTTS")
        confidence =
            Number(p.bttsConfidence || 0);

    const riskScore =
        risk(a) === "LOW" ? 3 :
        risk(a) === "MEDIUM" ? 2 : 0;

    return (
        riskScore * 1000 +
        confidence * 5 +
        aiScore(a) * 2
    );
}


/* =========================
   GET MARKET
========================= */

function market(data, type, used = new Set()) {

    return data
        .filter(a => {

            if (!safe(a))
                return false;

            if (
                used.has(a.match?.id)
            )
                return false;

            const p =
                a.predictions || {};

            if (type === "1X2")
                return !!(
                    p.winner &&
                    p.winnerConfidence
                );

            if (type === "OVER")
                return !!(
                    p.over25 &&
                    p.over25Confidence
                );

            if (type === "BTTS")
                return !!(
                    p.btts &&
                    p.bttsConfidence
                );

            return false;

        })
        .sort(
            (a, b) =>
                rank(b, type) -
                rank(a, type)
        )
        .slice(0, 2);
}


/* =========================
   1X2
========================= */

app.get("/vip/1x2", async (req, res) => {

    try {

        const data =
            await getDaily();

        const selected =
            market(data, "1X2");

        res.json(
            selected.map(format)
        );

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
            await getDaily();

        const used =
            new Set(
                market(data, "1X2")
                    .map(a => a.match?.id)
            );

        const selected =
            market(
                data,
                "OVER",
                used
            );

        res.json(
            selected.map(format)
        );

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
            await getDaily();

        const used =
            new Set([
                ...market(data, "1X2")
                    .map(a => a.match?.id),

                ...market(data, "OVER")
                    .map(a => a.match?.id)
            ]);

        const selected =
            market(
                data,
                "BTTS",
                used
            );

        res.json(
            selected.map(format)
        );

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

        const data =
            await getDaily();

        const choices = [];

        for (const a of data) {

            if (!safe(a))
                continue;

            const p =
                a.predictions || {};


            if (
                p.winner &&
                p.winnerConfidence
            ) {

                choices.push({
                    ...format(a),
                    market: "1X2",
                    pick: p.winner,
                    confidence:
                        Number(
                            p.winnerConfidence
                        ),
                    aiScore:
                        aiScore(a),
                    risk:
                        risk(a)
                });

            }


            if (
                p.over25 &&
                p.over25Confidence
            ) {

                choices.push({
                    ...format(a),
                    market: "OVER 2.5",
                    pick: p.over25,
                    confidence:
                        Number(
                            p.over25Confidence
                        ),
                    aiScore:
                        aiScore(a),
                    risk:
                        risk(a)
                });

            }


            if (
                p.btts &&
                p.bttsConfidence
            ) {

                choices.push({
                    ...format(a),
                    market: "BTTS",
                    pick: p.btts,
                    confidence:
                        Number(
                            p.bttsConfidence
                        ),
                    aiScore:
                        aiScore(a),
                    risk:
                        risk(a)
                });

            }

        }


        choices.sort((a, b) => {

            const A =
                (a.risk === "LOW" ? 300 : 200) +
                a.confidence * 5 +
                a.aiScore * 2;

            const B =
                (b.risk === "LOW" ? 300 : 200) +
                b.confidence * 5 +
                b.aiScore * 2;

            return B - A;

        });


        res.json(
            choices[0] || null
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
        analyses: cache.length,
        dailyDate
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
