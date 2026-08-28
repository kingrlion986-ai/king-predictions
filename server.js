const express = require("express");
const cors = require("cors");
const path = require("path");

const {
    getMatches,
    initializeDatabase
} = require("./services/footballApi");

const {
    analyzeMatch
} = require("./services/predictionEngine");

const app = express();

app.use(cors());
app.use(express.json());
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

const PORT =
    process.env.PORT || 3000;


/* =====================================================
   CONFIGURATION V1
===================================================== */

const CACHE_TTL =
    24 * 60 * 60 * 1000;

const MAX_ANALYSES = 30;

const NEXT_24H =
    24 * 60 * 60 * 1000;


/* =====================================================
   CACHE DAILY
===================================================== */

let cache = [];
let cacheTime = 0;
let dailyDate = "";
let building = null;


/* =====================================================
   GET DAILY
===================================================== */

async function getDaily() {

    const today =
        new Date()
            .toISOString()
            .slice(0, 10);


    /*
     * Nouveau jour
     */

    if (dailyDate !== today) {

        cache = [];
        cacheTime = 0;
        dailyDate = today;

        console.log(
            "📅 NEW DAY:",
            today
        );
    }


    /*
     * Cache 24h
     */

    if (
        cache.length > 0 &&
        Date.now() - cacheTime < CACHE_TTL
    ) {

        return cache;
    }


    /*
     * Empêche plusieurs analyses
     * simultanées.
     */

    if (building)
        return building;


    building = (async () => {

        try {

            const matches =
                await getMatches();


            if (
                !Array.isArray(matches) ||
                matches.length === 0
            ) {

                console.log(
                    "⚠️ NO MATCHES"
                );

                return [];
            }


            /*
             * PROCHAINES 24 HEURES
             */

            const now =
                Date.now();

            const limit =
                now + NEXT_24H;


            const next24h =
                matches.filter(match => {

                    const time =
                        new Date(
                            match.utcDate
                        ).getTime();

                    return (
                        Number.isFinite(time) &&
                        time >= now &&
                        time <= limit
                    );

                });


            console.log(
                "📅 MATCHES NEXT 24H:",
                next24h.length
            );


            /*
             * On analyse jusqu'à 30 matchs.
             */

            const selected =
                next24h.slice(
                    0,
                    MAX_ANALYSES
                );


            console.log(
                "🎯 MATCHES SELECTED:",
                selected.length
            );


            const results = [];


            /*
             * ANALYSE
             */

            for (
                const match of selected
            ) {

                try {

                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam.name} vs ${match.awayTeam.name}`
                    );


                    const analysis =
                        await analyzeMatch(
                            match
                        );


                    if (!analysis)
                        continue;


                    const homePlayed =
                        Number(
                            analysis.teamStats
                                ?.home
                                ?.played || 0
                        );


                    const awayPlayed =
                        Number(
                            analysis.teamStats
                                ?.away
                                ?.played || 0
                        );


                    if (
                        homePlayed < 5 ||
                        awayPlayed < 5
                    ) {

                        console.log(
                            "🚫 INSUFFICIENT DATA"
                        );

                        continue;
                    }


                    results.push(
                        analysis
                    );


                } catch (err) {

                    console.log(
                        "❌ AI:",
                        err.message
                    );

                }

            }


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
                "❌ DAILY AI:",
                err
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
   RISK
===================================================== */

function getRisk(a) {

    return (
        a?.predictions
            ?.aiDecision
            ?.risk ||
        "HIGH"
    );

}


function riskValue(risk) {

    if (risk === "LOW")
        return 3;

    if (risk === "MEDIUM")
        return 2;

    if (risk === "HIGH")
        return 1;

    return 0;
}


/* =====================================================
   SAFE MATCH
===================================================== */

function isSafe(a) {

    const risk =
        getRisk(a);

    return (
        risk === "LOW" ||
        risk === "MEDIUM"
    );

}


/* =====================================================
   AI SCORE
===================================================== */

function getAIScore(a) {

    return Number(
        a?.predictions
            ?.aiRating ??
        a?.vipScore ??
        0
    );

}


/* =====================================================
   FORMAT
===================================================== */

function format(a) {

    return {

        match: {

            id:
                a.match?.id,

            utcDate:
                a.match?.utcDate,

            competition:
                a.match?.competition,

            homeTeam:
                a.match?.homeTeam,

            awayTeam:
                a.match?.awayTeam

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


/* =====================================================
   UNIQUE
===================================================== */

function uniqueByMatch(list) {

    const map =
        new Map();


    for (
        const item of list
    ) {

        const id =
            item?.match?.id;


        if (
            id &&
            !map.has(id)
        ) {

            map.set(
                id,
                item
            );

        }

    }


    return [
        ...map.values()
    ];

}


/* =====================================================
   MARKET SCORE
===================================================== */

function marketRanking(
    a,
    market
) {

    const p =
        a?.predictions || {};


    let confidence = 0;


    if (market === "1X2") {

        confidence =
            Number(
                p.winnerConfidence || 0
            );

    }


    if (market === "OVER") {

        confidence =
            Number(
                p.over25Confidence || 0
            );

    }


    if (market === "BTTS") {

        confidence =
            Number(
                p.bttsConfidence || 0
            );

    }


    const ai =
        getAIScore(a);


    const risk =
        riskValue(
            getRisk(a)
        );


    /*
     * Priorité :
     * 1. risque
     * 2. confiance
     * 3. AI Score
     */

    return (
        risk * 1000 +
        confidence * 5 +
        ai * 2
    );

}


/* =====================================================
   GET MARKET CANDIDATES
===================================================== */

function getCandidates(
    data,
    market
) {

    return data
        .filter(a => {

            if (!isSafe(a))
                return false;


            const p =
                a?.predictions || {};


            if (
                market === "1X2"
            ) {

                return Boolean(
                    p.winner &&
                    p.winnerConfidence
                );

            }


            if (
                market === "OVER"
            ) {

                return Boolean(
                    p.over25 &&
                    p.over25Confidence
                );

            }


            if (
                market === "BTTS"
            ) {

                return Boolean(
                    p.btts &&
                    p.bttsConfidence
                );

            }


            return false;

        })
        .sort(
            (a, b) =>
                marketRanking(
                    b,
                    market
                ) -
                marketRanking(
                    a,
                    market
                )
        );

}


/* =====================================================
   DIVERSIFICATION
===================================================== */

function selectTwo(
    candidates,
    usedIds
) {

    const selected = [];


    /*
     * Première priorité :
     * matchs jamais utilisés.
     */

    for (
        const candidate of candidates
    ) {

        if (
            selected.length >= 2
        )
            break;


        const id =
            candidate.match?.id;


        if (
            !usedIds.has(id)
        ) {

            selected.push(
                candidate
            );

            usedIds.add(id);

        }

    }


    /*
     * Si on n'a pas 2 matchs différents,
     * on complète avec le meilleur disponible.
     *
     * On ne force jamais un HIGH.
     */

    if (
        selected.length < 2
    ) {

        for (
            const candidate of candidates
        ) {

            if (
                selected.length >= 2
            )
                break;


            const already =
                selected.some(
                    x =>
                        x.match?.id ===
                        candidate.match?.id
                );


            if (!already) {

                selected.push(
                    candidate
                );

            }

        }

    }


    return selected.slice(
        0,
        2
    );

}


/* =====================================================
   1X2
===================================================== */

app.get(
    "/vip/1x2",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const candidates =
                getCandidates(
                    data,
                    "1X2"
                );


            const selected =
                selectTwo(
                    candidates,
                    new Set()
                );


            res.json(
                selected.map(format)
            );


        } catch (err) {

            console.error(
                "1X2:",
                err
            );


            res.status(500).json({
                error:
                    err.message
            });

        }

    }
);


/* =====================================================
   OVER 2.5
===================================================== */

app.get(
    "/vip/over25",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const usedIds =
                new Set();


            /*
             * Réserver les meilleurs 1X2
             * pour éviter les doublons.
             */

            const winnerCandidates =
                getCandidates(
                    data,
                    "1X2"
                );


            winnerCandidates
                .slice(0, 2)
                .forEach(a => {

                    if (
                        a.match?.id
                    ) {

                        usedIds.add(
                            a.match.id
                        );

                    }

                });


            const candidates =
                getCandidates(
                    data,
                    "OVER"
                );


            const selected =
                selectTwo(
                    candidates,
                    usedIds
                );


            res.json(
                selected.map(format)
            );


        } catch (err) {

            console.error(
                "OVER:",
                err
            );


            res.status(500).json({
                error:
                    err.message
            });

        }

    }
);


/* =====================================================
   BTTS
===================================================== */

app.get(
    "/vip/btts",
    async (req, res) => {

        try {

            const data =
                await getDaily();


            const usedIds =
                new Set();


            /*
             * Réserver les matchs
             * déjà utilisés par 1X2
             * et OVER.
             */

            getCandidates(
                data,
                "1X2"
            )
                .slice(0, 2)
                .forEach(a => {

                    if (
                        a.match?.id
                    ) {

                        usedIds.add(
                            a.match.id
                        );

                    }

                });


            const overCandidates =
                getCandidates(
                    data,
                    "OVER"
                );


            for (
                const a of overCandidates
                    .slice(0, 2)
            ) {

                if (
                    a.match?.id
                ) {

                    usedIds.add(
                        a.match.id
                    );

                }

            }


            const candidates =
                getCandidates(
                    data,
                    "BTTS"
                );


            const selected =
                selectTwo(
                    candidates,
                    usedIds
                );


            res.json(
                selected.map(format)
            );


        } catch (err) {

            console.error(
                "BTTS:",
                err
            );


            res.status(500).json({
                error:
                    err.message
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

                if (!isSafe(a))
                    continue;


                const p =
                    a?.predictions || {};


                /*
                 * 1X2
                 */

                if (
                    p.winner &&
                    p.winnerConfidence
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
                    p.over25Confidence
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
                    p.bttsConfidence
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


            choices.sort(
                (a, b) => {

                    const scoreA =
                        riskValue(a.risk) * 1000 +
                        a.confidence * 5 +
                        a.aiScore * 2;


                    const scoreB =
                        riskValue(b.risk) * 1000 +
                        b.confidence * 5 +
                        b.aiScore * 2;


                    return scoreB - scoreA;

                }
            );


            res.json(
                choices[0] || null
            );


        } catch (err) {

            console.error(
                "SAFEST:",
                err
            );


            res.status(500).json({
                error:
                    err.message
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

            status:
                "ok",

            ai:
                "ACTIVE",

            version:
                "V1",

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
