const express = require("express");
const cors = require("cors");
const path = require("path");

const { getMatches, initializeDatabase } =
    require("./services/footballApi");

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

const TTL = 15 * 60 * 1000;
const MAX_MATCHES = 12;


/* =========================
   ANALYSE
========================= */

async function getAnalyses() {

    if (
        cache.length &&
        Date.now() - cacheTime < TTL
    ) {
        return cache;
    }

    if (building) return building;

    building = (async () => {

        const matches = await getMatches();

        const results = [];

        for (
            const match of matches.slice(0, MAX_MATCHES)
        ) {

            try {

                const a =
                    await analyzeMatch(match);

                if (
                    a &&
                    a.teamStats?.home?.played >= 5 &&
                    a.teamStats?.away?.played >= 5
                ) {
                    results.push(a);
                }

            } catch (e) {

                console.log(
                    "❌ ANALYSIS:",
                    e.message
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
   FREE
========================= */

app.get("/free", async (req, res) => {

    const data = await getAnalyses();

    if (!data.length)
        return res.json([]);

    const a = data[0];

    res.json([{
        match:
            `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

        pick:
            a.predictions.winner,

        confidence:
            a.predictions.winnerConfidence
    }]);

});


/* =========================
   VIP 1X2
========================= */

app.get("/vip/1x2", async (req, res) => {

    const data =
        filterVipMatches(
            await getAnalyses()
        ).slice(0, 5);

    res.json(data);

});


/* =========================
   VIP OVER
========================= */

app.get("/vip/over25", async (req, res) => {

    const data =
        filterVipOver25(
            await getAnalyses()
        ).slice(0, 5);

    res.json(data);

});


/* =========================
   VIP BTTS
========================= */

app.get("/vip/btts", async (req, res) => {

    const data =
        filterVipBtts(
            await getAnalyses()
        ).slice(0, 5);

    res.json(data);

});


/* =========================
   SCORE EXACT
========================= */

app.get("/vip/score", async (req, res) => {

    const data =
        (await getAnalyses())
        .map(a => ({

            match:
                `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

            score:
                a.predictions.correctScore,

            probability:
                a.predictions.correctScoreProbability,

            xg:
                a.model.expectedGoals,

            aiScore:
                a.predictions.aiRating,

            risk:
                a.predictions.aiDecision?.risk

        }))
        .filter(a =>
            a.score &&
            a.probability >= 8
        )
        .sort(
            (a, b) =>
                b.probability -
                a.probability
        )
        .slice(0, 3);

    res.json(data);

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
   START
========================= */

app.listen(PORT, "0.0.0.0", async () => {

    console.log(
        "👑 KING PREDICTIONS AI ONLINE"
    );

    await initializeDatabase();

    await getAnalyses();

});
