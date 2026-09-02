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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   KING PREDICTIONS AI — SERVER V3
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
    return new Date().toISOString().slice(0, 10);
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
    return getRisk(a) === "LOW";
}

function matchKey(a) {
    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id}_${a?.match?.awayTeam?.id}_${a?.match?.utcDate}`
    );
}

function format(a) {
    return {
        match: {
            id: a.match?.id,
            utcDate: a.match?.utcDate,
            competition: a.match?.competition,
            homeTeam: a.match?.homeTeam,
            awayTeam: a.match?.awayTeam
        },
        predictions: a.predictions,
        model: {
            expectedGoals: a.model?.expectedGoals,
            expectedHomeGoals: a.model?.expectedHomeGoals,
            expectedAwayGoals: a.model?.expectedAwayGoals
        },
        vipScore: getAIScore(a)
    };
}

/* =====================================================
   FILTRES STRICTS
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
        isUsable(a) &&
        isPublishable(a) &&
        p.winner &&
        p.winner !== "DRAW" &&
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
        isUsable(a) &&
        isPublishable(a) &&
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
        isUsable(a) &&
        isPublishable(a) &&
        p.btts === "OUI" &&
        Number(p.bttsConfidence || 0) >= 70 &&
        getAIScore(a) >= 65 &&
        xg >= 2.50
    );
}

/* =====================================================
   SCORES
===================================================== */

function score1X2(a) {
    const p = a?.predictions || {};
    const probs = p.probabilities || {};

    const values = [
        Number(probs.homeWin || 0),
        Number(probs.draw || 0),
        Number(probs.awayWin || 0)
    ].sort((x, y) => y - x);

    const favorite = values[0] || 0;
    const second = values[1] || 0;
    const separation = favorite - second;

    return (
        favorite * 100 +
        separation * 80 +
        Number(p.winnerConfidence || 0) * 2 +
        getAIScore(a) * 1.5 +
        300
    );
}

function scoreOver(a) {
    const p = a?.predictions || {};
    const xg = Number(a?.model?.expectedGoals || 0);
    const confidence = Number(p.over25Confidence || 0);

    return (
        confidence * 100 +
        confidence * 2 +
        getAIScore(a) * 1.5 +
        xg * 100 +
        300
    );
}

function scoreBTTS(a) {
    const p = a?.predictions || {};
    const xg = Number(a?.model?.expectedGoals || 0);
    const confidence = Number(p.bttsConfidence || 0);

    return (
        confidence * 100 +
        confidence * 2 +
        getAIScore(a) * 1.5 +
        xg * 100 +
        300
    );
}

/* =====================================================
   ANALYSE QUOTIDIENNE
===================================================== */

async function getDaily() {
    const today = getToday();

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
        try {
            const matches = await getMatches();

            if (!Array.isArray(matches) || !matches.length) {
                console.log("⚠️ NO MATCHES");
                return [];
            }

            const now = Date.now();
            const next48h = now + 48 * 60 * 60 * 1000;

            let upcoming = matches
                .filter(match => {
                    const time =
                        new Date(match.utcDate).getTime();

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

            /*
             * Si aucun match dans 48h,
             * on regarde les 7 prochains jours.
             */
            if (!upcoming.length) {
                const next7d =
                    now + 7 * 24 * 60 * 60 * 1000;

                upcoming = matches
                    .filter(match => {
                        const time =
                            new Date(match.utcDate).getTime();

                        return (
                            Number.isFinite(time) &&
                            time >= now &&
                            time <= next7d
                        );
                    })
                    .sort(
                        (a, b) =>
                            new Date(a.utcDate) -
                            new Date(b.utcDate)
                    );

                console.log(
                    "⚠️ NO MATCHES 48H → FALLBACK 7 DAYS"
                );
            }

            if (!upcoming.length) {
                console.log("⚠️ NO UPCOMING MATCHES");
                return [];
            }

            console.log(
                "🔥 MATCHES TO ANALYZE:",
                upcoming.length
            );

            const results = [];

            for (
                const match of upcoming.slice(
                    0,
                    MAX_ANALYSES
                )
            ) {
                try {
                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam?.name} vs ${match.awayTeam?.name}`
                    );

                    const analysis =
                        await analyzeMatch(match);

                    if (!isUsable(analysis))
                        continue;

                    results.push(analysis);

                } catch (err) {
                    console.log(
                        "❌ AI:",
                        `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
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
   SÉLECTION ANTI-DOUBLON
===================================================== */

function selectUnique(
    candidates,
    scorer,
    limit,
    used = new Set()
) {
    return candidates
        .filter(a => !used.has(matchKey(a)))
        .sort(
            (a, b) =>
                scorer(b) - scorer(a)
        )
        .slice(0, limit);
}

/* =====================================================
   1X2
===================================================== */

app.get("/vip/1x2", async (req, res) => {
    try {
        const data = await getDaily();

        const selected = selectUnique(
            data.filter(strict1X2),
            score1X2,
            2
        );

        console.log(
            "🎯 1X2:",
            selected.map(matchKey)
        );

        res.json(selected.map(format));

    } catch (err) {
        console.error("1X2:", err);
        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   OVER 2.5
===================================================== */

app.get("/vip/over25", async (req, res) => {
    try {
        const data = await getDaily();

        const selected = selectUnique(
            data.filter(strictOver),
            scoreOver,
            2
        );

        console.log(
            "🎯 OVER 2.5:",
            selected.map(matchKey)
        );

        res.json(selected.map(format));

    } catch (err) {
        console.error("OVER:", err);
        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   BTTS
===================================================== */

app.get("/vip/btts", async (req, res) => {
    try {
        const data = await getDaily();

        const selected = selectUnique(
            data.filter(strictBTTS),
            scoreBTTS,
            2
        );

        console.log(
            "🎯 BTTS:",
            selected.map(matchKey)
        );

        res.json(selected.map(format));

    } catch (err) {
        console.error("BTTS:", err);
        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   PARI LE PLUS SÛR
===================================================== */

app.get("/safest", async (req, res) => {
    try {
        const data = await getDaily();
        const choices = [];

        for (const a of data) {
            const p = a?.predictions || {};

            if (strict1X2(a)) {
                choices.push({
                    ...format(a),
                    market: "1X2",
                    pick: p.winner,
                    confidence:
                        Number(p.winnerConfidence || 0),
                    aiScore: getAIScore(a),
                    risk: getRisk(a)
                });
            }

            if (strictOver(a)) {
                choices.push({
                    ...format(a),
                    market: "OVER 2.5",
                    pick: p.over25,
                    confidence:
                        Number(p.over25Confidence || 0),
                    aiScore: getAIScore(a),
                    risk: getRisk(a)
                });
            }

            if (strictBTTS(a)) {
                choices.push({
                    ...format(a),
                    market: "BTTS",
                    pick: p.btts,
                    confidence:
                        Number(p.bttsConfidence || 0),
                    aiScore: getAIScore(a),
                    risk: getRisk(a)
                });
            }
        }

        if (!choices.length) {
            console.log("🛑 SAFEST: NO SAFE BET");
            return res.json(null);
        }

        choices.sort(
            (a, b) =>
                b.confidence - a.confidence ||
                b.aiScore - a.aiScore
        );

        const safest = choices[0];

        console.log(
            "🏆 SAFEST:",
            safest.market,
            safest.pick,
            safest.confidence + "%",
            safest.risk
        );

        res.json(safest);

    } catch (err) {
        console.error("SAFEST:", err);

        res.status(500).json({
            error: err.message
        });
    }
});

/* =====================================================
   HEALTH
===================================================== */

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        ai: "ACTIVE",
        version: "V3",
        analyses: cache.length,
        dailyDate
    });
});

/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

/* =====================================================
   START
===================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {
        console.log(
            "👑 KING PREDICTIONS AI V3 ONLINE"
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
