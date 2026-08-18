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
   FORMAT MATCH
========================= */

function formatMatch(a) {
    return {
        home: a.match.homeTeam.name,
        away: a.match.awayTeam.name,
        name: `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`
    };
}


/* =========================
   FREE
========================= */

app.get("/free", async (req, res) => {

    const data = await getDaily();

    if (!data.length)
        return res.json([]);

    const a = data[0];
    const p = a.predictions;
    const m = formatMatch(a);

    res.json([{
        match: m.name,
        pick: p.winner,
        confidence: p.winnerConfidence,
        probabilities: p.probabilities,
        risk: p.aiDecision?.risk || "UNKNOWN",
        aiScore: p.aiRating
    }]);
});


/* =========================
   VIP 1X2
========================= */

app.get("/vip/1x2", async (req, res) => {

    const data = filterVipMatches(await getDaily());

    res.json(
        data.slice(0, 5).map(a => {

            const p = a.predictions;
            const m = formatMatch(a);

            return {
                match: m.name,
                pick: p.winner,
                confidence: p.winnerConfidence,
                probabilities: p.probabilities,
                vipScore: a.vipScore,
                risk: p.aiDecision?.risk || "UNKNOWN",
                aiScore: p.aiRating
            };

        })
    );
});


/* =========================
   OVER 2.5
========================= */

app.get("/vip/over25", async (req, res) => {

    const data = filterVipOver25(await getDaily());

    res.json(
        data.slice(0, 6).map(a => {

            const p = a.predictions;
            const m = formatMatch(a);

            return {
                match: m.name,
                pick: p.over25,
                confidence: p.over25Confidence,
                expectedGoals: a.model?.expectedGoals || 0,
                vipScore: a.vipScore,
                risk: p.aiDecision?.risk || "UNKNOWN",
                aiScore: p.aiRating
            };

        })
    );
});


/* =========================
   BTTS
========================= */

app.get("/vip/btts", async (req, res) => {

    const data = filterVipBtts(await getDaily());

    res.json(
        data.slice(0, 5).map(a => {

            const p = a.predictions;
            const m = formatMatch(a);

            return {
                match: m.name,
                pick: p.btts,
                confidence: p.bttsConfidence,
                expectedGoals: a.model?.expectedGoals || 0,
                vipScore: a.vipScore,
                risk: p.aiDecision?.risk || "UNKNOWN",
                aiScore: p.aiRating
            };

        })
    );
});


/* =========================
   SCORE EXACT
========================= */

app.get("/vip/score", async (req, res) => {

    const data = await getDaily();

    const results = data
        .filter(a => a?.predictions?.correctScore)
        .map(a => {

            const p = a.predictions;
            const m = formatMatch(a);

            return {
                match: m.name,
                pick: p.correctScore,
                probability: p.correctScoreProbability,
                expectedGoals: a.model?.expectedGoals || 0,
                aiScore: p.aiRating,
                risk: p.aiDecision?.risk || "UNKNOWN"
            };

        })
        .sort((a, b) =>
            b.probability - a.probability
        );

    res.json(results.slice(0, 5));
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
