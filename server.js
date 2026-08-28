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
const MAX_ANALYSES = 15;


/* =========================
   DAILY AI
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

    if (building) return building;

    building = (async () => {

        const matches = await getMatches();

        if (!matches?.length)
            return [];

        const now = Date.now();

        const next24h =
            now + 24 * 60 * 60 * 1000;

        const selected =
            matches
                .filter(match => {

                    const time =
                        new Date(
                            match.utcDate
                        ).getTime();

                    return (
                        time >= now &&
                        time <= next24h
                    );

                })
                .slice(0, MAX_ANALYSES);

        console.log(
            "🎯 MATCHS 24H:",
            selected.length
        );

        const results = [];

        for (const match of selected) {

            try {

                console.log(
                    "🔎 ANALYZING:",
                    match.homeTeam.name,
                    "vs",
                    match.awayTeam.name
                );

                const a =
                    await analyzeMatch(match);

                if (!a)
                    continue;

                if (
                    Number(
                        a.teamStats?.home?.played
                    ) < 5 ||
                    Number(
                        a.teamStats?.away?.played
                    ) < 5
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
   RISK
========================= */

function getRisk(a) {

    return (
        a?.predictions?.aiDecision?.risk ||
        "HIGH"
    );

}


function isSafe(a) {

    const risk =
        getRisk(a);

    return (
        risk === "LOW" ||
        risk === "MEDIUM"
    );

}


/* =========================
   FORMAT
========================= */

function format(a) {

    return {

        match: {
            homeTeam:
                a.match.homeTeam,

            awayTeam:
                a.match.awayTeam
        },

        predictions:
            a.predictions,

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
   1X2
========================= */

app.get("/vip/1x2", async (req, res) => {

    try {

        const data =
            (await getDaily())

                .filter(a =>
                    a?.predictions?.winner &&
                    a?.predictions?.winnerConfidence &&
                    isSafe(a)
                )

                .sort((a, b) =>
                    (
                        b.predictions.winnerConfidence +
                        (b.vipScore || 0)
                    ) -
                    (
                        a.predictions.winnerConfidence +
                        (a.vipScore || 0)
                    )
                )

                .slice(0, 2)

                .map(format);

        res.json(data);

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


/* =========================
   OVER 2.5
========================= */

app.get("/vip/over25", async (req, res) => {

    try {

        const data =
            (await getDaily())

                .filter(a =>
                    a?.predictions?.over25 &&
                    a?.predictions?.over25Confidence &&
                    isSafe(a)
                )

                .sort((a, b) =>
                    (
                        b.predictions.over25Confidence +
                        (b.vipScore || 0)
                    ) -
                    (
                        a.predictions.over25Confidence +
                        (a.vipScore || 0)
                    )
                )

                .slice(0, 2)

                .map(format);

        res.json(data);

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


/* =========================
   BTTS
========================= */

app.get("/vip/btts", async (req, res) => {

    try {

        const data =
            (await getDaily())

                .filter(a =>
                    a?.predictions?.btts &&
                    a?.predictions?.bttsConfidence &&
                    isSafe(a)
                )

                .sort((a, b) =>
                    (
                        b.predictions.bttsConfidence +
                        (b.vipScore || 0)
                    ) -
                    (
                        a.predictions.bttsConfidence +
                        (a.vipScore || 0)
                    )
                )

                .slice(0, 2)

                .map(format);

        res.json(data);

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


/* =========================
   PARI LE PLUS SÛR
========================= */

app.get("/safest", async (req, res) => {

    try {

        const data =
            await getDaily();

        const choices = [];

        for (const a of data) {

            if (!isSafe(a))
                continue;

            const p =
                a.predictions || {};

            const aiScore =
                Number(
                    a.vipScore ??
                    p.aiRating ??
                    0
                );


            /* 1X2 */

            if (
                p.winner &&
                p.winnerConfidence
            ) {

                choices.push({

                    ...format(a),

                    market: "1X2",

                    pick:
                        p.winner,

                    confidence:
                        p.winnerConfidence,

                    aiScore

                });

            }


            /* OVER */

            if (
                p.over25 &&
                p.over25Confidence
            ) {

                choices.push({

                    ...format(a),

                    market: "OVER 2.5",

                    pick:
                        p.over25,

                    confidence:
                        p.over25Confidence,

                    aiScore

                });

            }


            /* BTTS */

            if (
                p.btts &&
                p.bttsConfidence
            ) {

                choices.push({

                    ...format(a),

                    market: "BTTS",

                    pick:
                        p.btts,

                    confidence:
                        p.bttsConfidence,

                    aiScore

                });

            }

        }


        choices.sort((a, b) => {

            const scoreA =
                a.confidence * 0.60 +
                a.aiScore * 0.40;

            const scoreB =
                b.confidence * 0.60 +
                b.aiScore * 0.40;

            return scoreB - scoreA;

        });


        res.json(
            choices[0] || null
        );

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


/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {

    res.json({

        status: "ok",

        ai: "ACTIVE",

        version: "V1",

        analyses:
            cache.length

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
