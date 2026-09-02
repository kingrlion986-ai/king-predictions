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
   KING PREDICTIONS AI — SERVER V2
   SÉLECTION STRICTE / ANTI-DOUBLON / ANTI-HIGH
===================================================== */

let cache = [];
let cacheTime = 0;
let building = null;
let dailyDate = "";

const CACHE_TTL = 24 * 60 * 60 * 1000;
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
    const p = a?.predictions || {};

    return (
        p.winnerRisk ||
        p.risk ||
        p.aiDecision?.risk ||
        "HIGH"
    );
}

function getAIScore(a) {
    const p = a?.predictions || {};

    return Number(
        p.winnerAIScore ??
        p.aiRating ??
        a?.vipScore ??
        0
    );
}


function isUsable(a) {

    return !!(
        a?.match &&
        Number(a.teamStats?.home?.played || 0) >= 5 &&
        Number(a.teamStats?.away?.played || 0) >= 5
    );

}

function isPublishable(a) {
    const p = a?.predictions || {};
    const risk = getRisk(a);

    return !!p && risk === "LOW";
}

function riskValue(risk) {

    if (risk === "LOW")
        return 3;

    if (risk === "MEDIUM")
        return 2;

    return 0;

}


function matchKey(a) {

    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id}_${a?.match?.awayTeam?.id}`
    );

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
            getAIScore(a)

    };

}


/* =====================================================
   SCORE 1X2
===================================================== */

function score1X2(a) {

    const p = a?.predictions || {};
    const probabilities = p.probabilities || {};

    const values = [
        Number(probabilities.homeWin || 0),
        Number(probabilities.draw || 0),
        Number(probabilities.awayWin || 0)
    ].sort((x, y) => y - x);

    const favorite = values[0] || 0;
    const second = values[1] || 0;

    const separation = favorite - second;
    const confidence = Number(p.winnerConfidence || 0);
    const ai = getAIScore(a);
    const risk = getRisk(a);

    if (!isPublishable(a))
        return -999999;

    let score = 0;

    score += favorite * 100;
    score += separation * 80;
    score += confidence * 2;
    score += ai * 1.5;

    if (risk === "LOW")
        score += 300;
    else if (risk === "MEDIUM")
        score += 100;

    if (favorite < 60)
        score -= 300;

    if (separation < 8)
        score -= 250;

    if (confidence < 60)
        score -= 200;

    return score;
}

/* =====================================================
   SCORE OVER 2.5
===================================================== */
function scoreOver(a) {

    const p = a?.predictions || {};
    const xg = Number(a?.model?.expectedGoals || 0);

    const confidence =
        Number(p.over25Confidence || 0);

    const ai =
        getAIScore(a);

    const risk =
        getRisk(a);

    if (!isPublishable(a))
        return -999999;

    const probability =
        p.over25 === "OVER 2.5"
            ? confidence
            : 100 - confidence;

    let score = 0;

    score += probability * 100;
    score += confidence * 2;
    score += ai * 1.5;

    if (risk === "LOW")
        score += 300;
    else if (risk === "MEDIUM")
        score += 100;

    if (probability < 65)
        score -= 300;

    if (xg < 2.30)
        score -= 250;

    if (confidence < 65)
        score -= 200;

    return score;
}


/* =====================================================
   SCORE BTTS
===================================================== */

function scoreBTTS(a) {

    const p = a?.predictions || {};
    const xg = Number(a?.model?.expectedGoals || 0);

    const confidence =
        Number(p.bttsConfidence || 0);

    const ai =
        getAIScore(a);

    const risk =
        getRisk(a);

    if (!isPublishable(a))
        return -999999;

    const probability =
        p.btts === "OUI"
            ? confidence
            : 100 - confidence;

    let score = 0;

    score += probability * 100;
    score += confidence * 2;
    score += ai * 1.5;

    if (risk === "LOW")
        score += 300;
    else if (risk === "MEDIUM")
        score += 100;

    if (probability < 65)
        score -= 300;

    if (xg < 2.30)
        score -= 250;

    if (confidence < 65)
        score -= 200;

    return score;
}

/* =====================================================
   FILTRES STRICTS V2
===================================================== */

function strict1X2(a) {
    const p = a?.predictions || {};
    const probs = p.probabilities || {};

    const values = [
        Number(probs.homeWin || 0),
        Number(probs.draw || 0),
        Number(probs.awayWin || 0)
    ].sort((x, y) => y - x);

    const favorite = values[0] || 0;
    const second = values[1] || 0;

    return (
        isPublishable(a) &&
        getRisk(a) === "LOW" &&
        favorite >= 65 &&
        favorite - second >= 10 &&
        Number(p.winnerConfidence || 0) >= 65 &&
        getAIScore(a) >= 65
    );
}


function strictOver(a) {
    const p = a?.predictions || {};
    const xg = Number(a?.model?.expectedGoals || 0);

    return (
        isPublishable(a) &&
        getRisk(a) === "LOW" &&
        p.over25 === "OVER 2.5" &&
        Number(p.over25Confidence || 0) >= 70 &&
        getAIScore(a) >= 65 &&
        xg >= 2.50
    );
}


function strictBTTS(a) {
    const p = a?.predictions || {};
    const xg = Number(a?.model?.expectedGoals || 0);

    return (
        isPublishable(a) &&
        getRisk(a) === "LOW" &&
        p.btts === "OUI" &&
        Number(p.bttsConfidence || 0) >= 70 &&
        getAIScore(a) >= 65 &&
        xg >= 2.50
    );
}


/* =====================================================
   ANALYSE QUOTIDIENNE
===================================================== */

async function getDaily() {

    const today =
        getToday();


    if (
        dailyDate !== today
    ) {

        cache = [];

        cacheTime = 0;

        dailyDate =
            today;

        console.log(
            "📅 NEW DAY:",
            today
        );

    }


    if (
        cache.length &&
        Date.now() - cacheTime <
        CACHE_TTL
    ) {

        return cache;

    }


    if (building)
        return building;


    building = (async () => {

        try {

            const matches =
                await getMatches();


            if (
                !Array.isArray(matches) ||
                !matches.length
            ) {

                console.log(
                    "⚠️ NO MATCHES"
                );

                return [];

            }


            /* ==========================================
               PROCHAINES 24 HEURES
            ========================================== */

            const now =
                Date.now();

            const next24h =
                now +
                24 * 60 * 60 * 1000;


            /* ==========================================
   PROCHAINS MATCHS DISPONIBLES
   MAX 48H
========================================== */

const now = Date.now();
const next48h = now + 48 * 60 * 60 * 1000;

const matches24h = matches
    .filter(match => {
        const time = new Date(match.utcDate).getTime();

        return (
            Number.isFinite(time) &&
            time >= now &&
            time <= next48h
        );
    })
    .sort(
        (a, b) =>
            new Date(a.utcDate) -
            new Date(b.utcDate)
    );

if (!matches24h.length) {
    console.log("⚠️ NO MATCHES NEXT 48H");
    return [];
}

console.log(
    "🔥 MATCHES NEXT 48H:",
    matches24h.length
);
                    .sort(
                        (a, b) =>
                            new Date(
                                a.utcDate
                            ) -
                            new Date(
                                b.utcDate
                            )
                    );


            if (
                !matches24h.length
            ) {

                console.log(
                    "⚠️ NO MATCHES NEXT 24H"
                );

                return [];

            }


            console.log(
                "🔥 MATCHES NEXT 24H:",
                matches24h.length
            );


            /* ==========================================
               ANALYSE
            ========================================== */

            const results = [];


            for (
                const match of
                matches24h.slice(
                    0,
                    MAX_ANALYSES
                )
            ) {

                try {

                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam?.name} vs ${match.awayTeam?.name}`
                    );


                    const a =
                        await analyzeMatch(
                            match
                        );


                    if (
                        !isUsable(a)
                    )
                        continue;


                    results.push(a);


                } catch (err) {

                    console.log(
                        "❌ AI:",
                        `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
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
   SÉLECTION SANS DOUBLONS
===================================================== */

function selectUnique(
    candidates,
    scorer,
    limit,
    used = new Set()
) {

    return candidates

        .filter(
            a =>
                !used.has(
                    matchKey(a)
                )
        )

        .sort(
            (a, b) =>
                scorer(b) -
                scorer(a)
        )

        .slice(
            0,
            limit
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


            const selected = selectUnique(
    data.filter(strict1X2),
    score1X2,
    2
);


            console.log(
                "🎯 1X2:",
                selected.map(
                    matchKey
                )
            );


            res.json(
                selected.map(
                    format
                )
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


            const selected = selectUnique(
    data.filter(strictOver),
    scoreOver,
    2
);


            console.log(
                "🎯 OVER 2.5:",
                selected.map(
                    matchKey
                )
            );


            res.json(
                selected.map(
                    format
                )
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


            const selected = selectUnique(
    data.filter(strictBTTS),
    scoreBTTS,
    2
);


            console.log(
                "🎯 BTTS:",
                selected.map(
                    matchKey
                )
            );


            res.json(
                selected.map(
                    format
                )
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
   JAMAIS HIGH
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


                /* ==============================
                   1X2
                ============================== */

                if (strict1X2(a)){

                    choices.push({

                        ...format(a),

                        market:
                            "1X2",

                        pick:
                            p.winner,

                        confidence:
                            Number(
                                p.winnerConfidence ||
                                0
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)

                    });

                }


                /* ==============================
                   OVER 2.5
                ============================== */


                 if (strictOver(a)){
                
                    choices.push({

                        ...format(a),

                        market:
                            "OVER 2.5",

                        pick:
                            p.over25,

                        confidence:
                            Number(
                                p.over25Confidence ||
                                0
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)

                    });

                }


                /* ==============================
                   BTTS
                ============================== */

                if (strictBTTS(a)){

                    choices.push({

                        ...format(a),

                        market:
                            "BTTS",

                        pick:
                            p.btts,

                        confidence:
                            Number(
                                p.bttsConfidence ||
                                0
                            ),

                        aiScore:
                            getAIScore(a),

                        risk:
                            getRisk(a)

                    });

                }

            }


            /*
             * AUCUN PARI SÛR
             *
             * On préfère ne rien afficher
             * plutôt que de mentir à l'utilisateur.
             */

            if (
                !choices.length
            ) {

                console.log(
                    "🛑 SAFEST: NO SAFE BET"
                );

                return res.json(
                    null
                );

            }


            /* ==========================================
               CLASSEMENT
            ========================================== */

            choices.sort(
                (a, b) => {

                    const riskA =
                        riskValue(
                            a.risk
                        );

                    const riskB =
                        riskValue(
                            b.risk
                        );


                    return (

                        riskB -
                        riskA ||

                        b.confidence -
                        a.confidence ||

                        b.aiScore -
                        a.aiScore

                    );

                }
            );


            const safest =
                choices[0];


            console.log(
                "🏆 SAFEST:",
                safest.match?.homeTeam?.name,
                "vs",
                safest.match?.awayTeam?.name,
                "|",
                safest.market,
                "|",
                safest.pick,
                "|",
                safest.confidence + "%",
                "|",
                safest.risk
            );


            res.json(
                safest
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
                "V2",

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
            "👑 KING PREDICTIONS AI V2 ONLINE"
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
