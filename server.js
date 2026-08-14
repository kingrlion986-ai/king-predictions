const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const {
    getMatches,
    initializeDatabase
} = require("./services/footballApi");

const {
    analyzeMatch
} = require("./services/predictionEngine");

const {
    filterVipMatches,
    filterVipOver25,
    filterVipBtts
} = require("./services/vipFilterEngine");

const {
    rankScoreMatches
} = require("./services/rankingEngine");

const {
    startDailyScheduler
} = require("./services/dailyScheduler");


/* =====================================================
   APP
===================================================== */

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const HISTORY_FILE =
    path.join(__dirname, "history.json");


/* =====================================================
   SETTINGS
===================================================== */

const SETTINGS = {
    candidates: 10,
    free: 1,
    vip1x2: 5,
    over25: 6,
    btts: 5,
    score: 3
};


/* =====================================================
   CACHE
===================================================== */

let dailyPredictions = null;
let dailyDate = null;
let building = null;

const CACHE_TTL =
    15 * 60 * 1000;


/* =====================================================
   UTILS
===================================================== */

function today() {

    return new Date()
        .toISOString()
        .slice(0, 10);

}


function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


function loadHistory() {

    try {

        if (!fs.existsSync(HISTORY_FILE))
            return [];

        return JSON.parse(
            fs.readFileSync(
                HISTORY_FILE,
                "utf8"
            )
        );

    } catch {

        return [];

    }

}


/* =====================================================
   ANALYSE
===================================================== */

async function analyzeMatches(matches) {

    const unique = [
        ...new Map(
            matches.map(
                m => [m.id, m]
            )
        ).values()
    ];

    const results = [];

    console.log(
        `🎯 AI ANALYSE: ${unique.length} matchs`
    );

    for (const match of unique) {

        try {

            const result =
                await analyzeMatch(match);

            if (result)
                results.push(result);

            console.log(
                `✅ ${match.homeTeam.name} vs ${match.awayTeam.name}`
            );

        } catch (error) {

            console.error(
                `❌ ${match.homeTeam.name}:`,
                error.message
            );

        }

        /*
         * Petite protection API.
         */

        await sleep(3000);
    }

    console.log(
        `🤖 AI READY: ${results.length}`
    );

    return results;
}


/* =====================================================
   DAILY ENGINE
===================================================== */

async function getDailyPredictions() {

    const date = today();

    if (
        dailyPredictions &&
        dailyDate === date
    ) {

        console.log(
            `⚡ DAILY CACHE: ${dailyPredictions.length}`
        );

        return dailyPredictions;
    }


    if (building)
        return building;


    building = (async () => {

        try {

            console.log(
                "🔄 BUILDING DAILY AI..."
            );

            const matches =
                await getMatches();


            if (!matches.length) {

                console.log(
                    "⚠️ NO UPCOMING MATCHES"
                );

                dailyPredictions = [];
                dailyDate = date;

                return [];

            }


            /*
             * On donne suffisamment de matchs
             * à l'IA pour permettre aux filtres
             * VIP de trouver plusieurs marchés.
             */

            const candidates =
                matches.slice(
                    0,
                    SETTINGS.candidates
                );


            console.log(
                "🏆 CANDIDATES:",
                candidates.length
            );


            const analyses =
                await analyzeMatches(
                    candidates
                );


            dailyPredictions =
                analyses;

            dailyDate =
                date;


            console.log(
                `👑 DAILY READY: ${analyses.length}`
            );


            return analyses;

        } finally {

            building = null;

        }

    })();


    return building;
}


/* =====================================================
   FREE
===================================================== */

app.get("/free", async (req, res) => {

    try {

        const data =
            await getDailyPredictions();


        if (!data.length)
            return res.json({
                error: "No future matches"
            });


        const a =
            data[0];


        res.json({

            match:
                `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

            prediction: "1X2",

            pick:
                a.predictions.winner,

            confidence:
                a.predictions.winnerConfidence,

            quality:
                a.predictions.quality

        });

    } catch (error) {

        console.error(
            "FREE ERROR:",
            error.message
        );

        res.status(500).json({
            error: "Internal server error"
        });

    }

});


/* =====================================================
   VIP 1X2
===================================================== */

app.get("/vip/1x2", async (req, res) => {

    try {

        const data =
            await getDailyPredictions();

        const vip =
            filterVipMatches(data)
                .slice(0, SETTINGS.vip1x2)
                .map(a => ({

                    match:
                        `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

                    pick:
                        a.predictions.winner,

                    confidence:
                        a.predictions.winnerConfidence,

                    probabilities:
                        a.predictions.probabilities,

                    vipScore:
                        a.vipScore,

                    decision:
                        a.predictions.aiDecision?.decision,

                    risk:
                        a.predictions.aiDecision?.risk,

                    score:
                        a.predictions.predictionStrength

                }));


        console.log(
            `👑 VIP 1X2: ${vip.length}`
        );


        res.json(vip);

    } catch (error) {

        console.error(
            "VIP 1X2 ERROR:",
            error.message
        );

        res.status(500).json({
            error: "Internal server error"
        });

    }

});


/* =====================================================
   VIP OVER 2.5
===================================================== */

app.get("/vip/over25", async (req, res) => {

    try {

        const data =
            await getDailyPredictions();

        const vip =
            filterVipOver25(data)
                .slice(0, SETTINGS.over25)
                .map(a => ({

                    match:
                        `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

                    market:
                        a.predictions.over25,

                    confidence:
                        a.predictions.over25Confidence,

                    vipScore:
                        a.vipScore,

                    expectedGoals:
                        a.model.expectedGoals

                }));


        console.log(
            `🔥 VIP OVER25: ${vip.length}`
        );


        res.json(vip);

    } catch (error) {

        console.error(
            "VIP OVER ERROR:",
            error.message
        );

        res.status(500).json({
            error: "Internal server error"
        });

    }

});


/* =====================================================
   VIP BTTS
===================================================== */

app.get("/vip/btts", async (req, res) => {

    try {

        const data =
            await getDailyPredictions();

        const vip =
            filterVipBtts(data)
                .slice(0, SETTINGS.btts)
                .map(a => ({

                    match:
                        `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

                    pick:
                        a.predictions.btts,

                    confidence:
                        a.predictions.bttsConfidence,

                    vipScore:
                        a.vipScore,

                    expectedGoals:
                        a.model.expectedGoals

                }));


        console.log(
            `🔥 VIP BTTS: ${vip.length}`
        );


        res.json(vip);

    } catch (error) {

        console.error(
            "VIP BTTS ERROR:",
            error.message
        );

        res.status(500).json({
            error: "Internal server error"
        });

    }

});


/* =====================================================
   SCORE EXACT
===================================================== */

app.get("/vip/score", async (req, res) => {

    try {

        const data =
            await getDailyPredictions();


        const ranked =
            rankScoreMatches(data);


        const result =
            ranked
                .slice(0, SETTINGS.score)
                .map(a => ({

                    match:
                        `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

                    score:
                        a.predictions.correctScore,

                    confidence:
                        Math.round(
                            Number(
                                a.predictions
                                    .correctScoreProbability
                            ) || 0
                        )

                }));


        res.json(result);

    } catch (error) {

        console.error(
            "VIP SCORE ERROR:",
            error.message
        );

        res.status(500).json({
            error: "Internal server error"
        });

    }

});


/* =====================================================
   HISTORY
===================================================== */

app.get("/history", (req, res) => {

    res.json(
        loadHistory()
    );

});


/* =====================================================
   ACCURACY
===================================================== */

app.get("/accuracy", (req, res) => {

    const history =
        loadHistory();

    let checked = 0;
    let correct = 0;


    for (const entry of history) {

        for (const prediction of
            entry.predictions || []) {

            if (
                prediction.result === "WIN"
            ) {

                checked++;
                correct++;

            }

            else if (
                prediction.result === "LOSS"
            ) {

                checked++;

            }

        }

    }


    res.json({

        checked,

        correct,

        accuracy:
            checked
                ? Math.round(
                    correct / checked * 100
                )
                : 0

    });

});


/* =====================================================
   HEALTH
===================================================== */

app.get("/health", (req, res) => {

    res.json({

        status: "ok",

        version: "KING-V32",

        daily:
            dailyPredictions?.length || 0,

        building:
            !!building,

        time:
            new Date().toISOString()

    });

});


/* =====================================================
   SYSTEM
===================================================== */

app.get("/system", (req, res) => {

    res.json({

        status:
            "KING PREDICTIONS AI ONLINE",

        predictions:
            dailyPredictions?.length || 0,

        candidates:
            SETTINGS.candidates,

        date:
            dailyDate

    });

});


/* =====================================================
   START
===================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            "👑 KING PREDICTIONS AI ONLINE"
        );

        console.log(
            `🚀 PORT: ${PORT}`
        );


        try {

            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );


            await getDailyPredictions();

            console.log(
                "✅ AI PRELOAD READY"
            );


            startDailyScheduler(
                async () => {

                    console.log(
                        "♻️ NEW DAY → RESET AI"
                    );

                    dailyPredictions =
                        null;

                    dailyDate =
                        null;

                    await getDailyPredictions();

                }
            );


        } catch (error) {

            console.error(
                "❌ STARTUP ERROR:",
                error.stack
            );

        }

    }
);
