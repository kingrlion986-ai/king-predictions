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


/* =====================================================
   CACHE GLOBAL
===================================================== */

let cache = [];
let cacheTime = 0;
let building = null;
let dailyDate = "";

const CACHE_TTL =
    24 * 60 * 60 * 1000;

const MAX_ANALYSES = 30;


/* =====================================================
   OUTILS
===================================================== */

function getToday() {
    return new Date()
        .toISOString()
        .slice(0, 10);
}


function getRisk(a) {

    return (
        a?.predictions?.aiDecision?.risk ||
        "HIGH"
    );

}


function getAIScore(a) {

    return Number(
        a?.predictions?.aiRating ??
        a?.vipScore ??
        0
    );

}


function isUsable(a) {

    if (!a?.match)
        return false;

    if (
        Number(a.teamStats?.home?.played || 0) < 5 ||
        Number(a.teamStats?.away?.played || 0) < 5
    ) {
        return false;
    }

    return true;
}


function riskValue(a) {

    const risk =
        getRisk(a);

    if (risk === "LOW")
        return 3;

    if (risk === "MEDIUM")
        return 2;

    if (risk === "HIGH")
        return 1;

    return 0;
}


/* =====================================================
   FORMAT
===================================================== */

function format(a) {

    return {

        match: {
            id: a.match?.id,
            utcDate: a.match?.utcDate,
            competition: a.match?.competition,
            homeTeam: a.match?.homeTeam,
            awayTeam: a.match?.awayTeam
        },

        predictions:
            a.predictions,

        model: {

            expectedGoals:
                a.model?.expectedGoals,

            expectedHomeGoals:
                a.model?.expectedHomeGoals,

            expectedAwayGoals:
                a.model?.expectedAwayGoals

        },

        vipScore:
            a.vipScore ??
            a.predictions?.aiRating ??
            0

    };

}


/* =====================================================
   SCORE 1X2
===================================================== */

function score1X2(a) {

    const p =
        a.predictions || {};

    const confidence =
        Number(
            p.winnerConfidence || 0
        );

    const ai =
        getAIScore(a);

    const risk =
        riskValue(a);

    const probabilities =
        p.probabilities || {};

    const values = [
        Number(probabilities.homeWin || 0),
        Number(probabilities.draw || 0),
        Number(probabilities.awayWin || 0)
    ].sort((x, y) => y - x);

    const separation =
        values[0] - values[1];

    return (
        risk * 1000 +
        confidence * 5 +
        ai * 2 +
        separation * 2
    );

}


/* =====================================================
   SCORE OVER 2.5
===================================================== */

function scoreOver(a) {

    const p =
        a.predictions || {};

    const confidence =
        Number(
            p.over25Confidence || 0
        );

    const ai =
        getAIScore(a);

    const risk =
        riskValue(a);

    const xg =
        Number(
            a.model?.expectedGoals || 0
        );

    const market =
        p.over25 === "OVER 2.5"
            ? 1
            : 0;

    return (
        risk * 1000 +
        market * 500 +
        confidence * 5 +
        ai * 2 +
        Math.min(xg, 5) * 10
    );

}


/* =====================================================
   SCORE BTTS
===================================================== */

function scoreBTTS(a) {

    const p =
        a.predictions || {};

    const confidence =
        Number(
            p.bttsConfidence || 0
        );

    const ai =
        getAIScore(a);

    const risk =
        riskValue(a);

    const xg =
        Number(
            a.model?.expectedGoals || 0
        );

    const market =
        p.btts === "OUI"
            ? 1
            : 0;

    return (
        risk * 1000 +
        market * 500 +
        confidence * 5 +
        ai * 2 +
        Math.min(xg, 5) * 10
    );

}


/* =====================================================
   ANALYSE QUOTIDIENNE
===================================================== */

async function getDaily() {

    const today =
        getToday();

    /*
     * Nouveau jour :
     * on détruit uniquement le cache
     * des prédictions.
     */

    if (dailyDate !== today) {

        console.log(
            "📅 NEW DAY:",
            today
        );

        cache = [];
        cacheTime = 0;

        dailyDate = today;

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

        try {

            const matches =
                await getMatches();

            if (!Array.isArray(matches) ||
                !matches.length) {

                console.log(
                    "⚠️ NO MATCHES"
                );

                return [];

            }


            /*
             * =================================================
             * PROCHAINES 24 HEURES
             * =================================================
             */

            const now =
                Date.now();

            const next24h =
                now +
                24 * 60 * 60 * 1000;


            const matches24h =
                matches.filter(match => {

                    const time =
                        new Date(
                            match.utcDate
                        ).getTime();

                    return (
                        Number.isFinite(time) &&
                        time >= now &&
                        time <= next24h
                    );

                });


            /*
             * Si l'API fournit peu de matchs
             * dans les 24h, on ne fabrique rien.
             */

            if (!matches24h.length) {

                console.log(
                    "⚠️ NO MATCHES IN NEXT 24H"
                );

                return [];

            }


            console.log(
                "🔥 MATCHES NEXT 24H:",
                matches24h.length
            );


            /*
             * =================================================
             * ANALYSE
             * =================================================
             *
             * On analyse suffisamment de matchs.
             * Les marchés feront ensuite leur propre sélection.
             */

            const results = [];


            for (
                const match of matches24h
                    .slice(0, MAX_ANALYSES)
            ) {

                try {

                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam.name} vs ${match.awayTeam.name}`
                    );


                    const a =
                        await analyzeMatch(match);


                    if (!isUsable(a))
                        continue;


                    results.push(a);


                } catch (err) {

                    console.log(
                        "❌ AI:",
                        err.message
                    );

                }

            }


            /*
             * Tri général uniquement pour
             * garder les résultats stables.
             */

            results.sort(
                (a, b) =>
                    getAIScore(b) -
                    getAIScore(a)
            );


            cache =
                results;

            cacheTime =
                Date.now();


            console.log(
                "👑 AI READY:",
                results.length
            );


            return results;


        } catch (err) {

            console.error(
                "❌ DAILY:",
                err.stack
            );

            return [];

        }

    })();


    try {

        return await building;

    } finally {

        building = null;

    }

}


/* =====================================================
   1X2 — 2 MEILLEURS
===================================================== */

app.get(
    "/vip/1x2",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const selected =
                data
                    .filter(a => {

                        const p =
                            a.predictions || {};

                        return (
                            p.winner &&
                            Number(
                                p.winnerConfidence || 0
                            ) > 0 &&
                            getRisk(a) !== "VERY HIGH"
                        );

                    })
                    .sort(
                        (a, b) =>
                            score1X2(b) -
                            score1X2(a)
                    )
                    .slice(0, 2);


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

    }
);


/* =====================================================
   OVER 2.5 — 2 MEILLEURS
===================================================== */

app.get(
    "/vip/over25",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const selected =
                data
                    .filter(a => {

                        const p =
                            a.predictions || {};

                        return (
                            p.over25 &&
                            Number(
                                p.over25Confidence || 0
                            ) > 0 &&
                            getRisk(a) !== "VERY HIGH"
                        );

                    })
                    .sort(
                        (a, b) =>
                            scoreOver(b) -
                            scoreOver(a)
                    )
                    .slice(0, 2);


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

    }
);


/* =====================================================
   BTTS — 2 MEILLEURS
===================================================== */

app.get(
    "/vip/btts",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const selected =
                data
                    .filter(a => {

                        const p =
                            a.predictions || {};

                        return (
                            p.btts &&
                            Number(
                                p.bttsConfidence || 0
                            ) > 0 &&
                            getRisk(a) !== "VERY HIGH"
                        );

                    })
                    .sort(
                        (a, b) =>
                            scoreBTTS(b) -
                            scoreBTTS(a)
                    )
                    .slice(0, 2);


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

    }
);


/* =====================================================
   PARI LE PLUS SÛR
===================================================== */

app.get(
    "/safest",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const choices = [];


            for (
                const a of data
            ) {

                const p =
                    a.predictions || {};


                /*
                 * 1X2
                 */

                if (
                    p.winner &&
                    Number(
                        p.winnerConfidence || 0
                    ) > 0
                ) {

                    choices.push({

                        ...format(a),

                        market:
                            "1X2",

                        pick:
                            p.winner,

                        confidence:
                            Number(
                                p.winnerConfidence
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)

                    });

                }


                /*
                 * OVER
                 */

                if (
                    p.over25 &&
                    Number(
                        p.over25Confidence || 0
                    ) > 0
                ) {

                    choices.push({

                        ...format(a),

                        market:
                            "OVER 2.5",

                        pick:
                            p.over25,

                        confidence:
                            Number(
                                p.over25Confidence
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)

                    });

                }


                /*
                 * BTTS
                 */

                if (
                    p.btts &&
                    Number(
                        p.bttsConfidence || 0
                    ) > 0
                ) {

                    choices.push({

                        ...format(a),

                        market:
                            "BTTS",

                        pick:
                            p.btts,

                        confidence:
                            Number(
                                p.bttsConfidence
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)

                    });

                }

            }


            /*
             * On élimine les risques trop élevés
             * si une alternative correcte existe.
             */

            const safeChoices =
                choices.filter(
                    c =>
                        c.risk === "LOW" ||
                        c.risk === "MEDIUM"
                );


            const pool =
                safeChoices.length
                    ? safeChoices
                    : choices;


            pool.sort((a, b) => {

                const riskA =
                    a.risk === "LOW"
                        ? 3
                        : a.risk === "MEDIUM"
                            ? 2
                            : 1;

                const riskB =
                    b.risk === "LOW"
                        ? 3
                        : b.risk === "MEDIUM"
                            ? 2
                            : 1;


                const scoreA =
                    riskA * 1000 +
                    a.confidence * 5 +
                    a.aiScore * 3;


                const scoreB =
                    riskB * 1000 +
                    b.confidence * 5 +
                    b.aiScore * 3;


                return scoreB - scoreA;

            });


            res.json(
                pool[0] || null
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

    }
);


/* =====================================================
   HEALTH
===================================================== */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status: "ok",

            ai: "ACTIVE",

            version: "V1",

            analyses:
                cache.length,

            dailyDate

        });

    }
);


/* =====================================================
   HOME
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


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
