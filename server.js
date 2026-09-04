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

const PORT = process.env.PORT || 3000;
const VERSION = "KING-V1";

const TIMEZONE = "Africa/Brazzaville";

const CACHE_TTL = 30 * 60 * 1000;
const MAX_PICKS = 4;

let cache = [];
let cacheTime = 0;
let dailyDate = "";
let building = null;

let lastStatus = "STARTING";
let lastError = null;
let lastUpdate = null;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-KING-VERSION", VERSION);
    next();
});


/* =========================================================
   FRONTEND
========================================================= */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

app.use(express.static(
    path.join(__dirname, "public"),
    {
        etag: false,
        maxAge: 0,
        index: false
    }
));


/* =========================================================
   DATE LOCALE
========================================================= */

function getToday() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

function getMatchDate(utcDate) {
    if (!utcDate) return null;

    const date = new Date(utcDate);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}


/* =========================================================
   HELPERS
========================================================= */

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function clamp(value) {
    const n = num(value);
    if (n === null) return null;

    return Math.max(0, Math.min(100, n));
}

function getWinnerProbabilities(a) {
    const p = a?.predictions || {};
    const m = a?.model || {};

    return {
        home: clamp(
            p.homeWin ??
            p.home ??
            p.homeProbability ??
            m.homeWin ??
            m.homeProbability
        ),

        draw: clamp(
            p.draw ??
            p.drawProbability ??
            m.draw ??
            m.drawProbability
        ),

        away: clamp(
            p.awayWin ??
            p.away ??
            p.awayProbability ??
            m.awayWin ??
            m.awayProbability
        )
    };
}

function getOver25(a) {
    const p = a?.predictions || {};
    const m = a?.model || {};

    return clamp(
        p.over25 ??
        p.over2_5 ??
        p.over25Probability ??
        m.over25 ??
        m.over2_5
    );
}

function getBTTS(a) {
    const p = a?.predictions || {};
    const m = a?.model || {};

    return clamp(
        p.btts ??
        p.bttsProbability ??
        m.btts ??
        m.bttsProbability
    );
}


/* =========================================================
   CHOIX DU MEILLEUR PARI
========================================================= */

function selectBestBet(a) {

    const p = getWinnerProbabilities(a);
    const over25 = getOver25(a);
    const btts = getBTTS(a);

    const candidates = [];


    /* 1X2 */

    if (p.home !== null) {
        candidates.push({
            type: "1X2",
            option: `Victoire ${a.match.homeTeam.name}`,
            probability: p.home
        });
    }

    if (p.draw !== null) {
        candidates.push({
            type: "1X2",
            option: "Match nul",
            probability: p.draw
        });
    }

    if (p.away !== null) {
        candidates.push({
            type: "1X2",
            option: `Victoire ${a.match.awayTeam.name}`,
            probability: p.away
        });
    }


    /* DOUBLE CHANCE */

    if (p.home !== null && p.draw !== null) {
        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "1X",
            probability: p.home + p.draw
        });
    }

    if (p.away !== null && p.draw !== null) {
        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "X2",
            probability: p.away + p.draw
        });
    }

    if (p.home !== null && p.away !== null) {
        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "12",
            probability: p.home + p.away
        });
    }


    /* OVER / UNDER */

    if (over25 !== null) {

        candidates.push({
            type: "TOTAL_GOALS",
            option: "Over 2.5",
            probability: over25
        });

        candidates.push({
            type: "TOTAL_GOALS",
            option: "Under 2.5",
            probability: 100 - over25
        });
    }


    /* BTTS */

    if (btts !== null) {

        candidates.push({
            type: "BTTS",
            option: "BTTS — OUI",
            probability: btts
        });

        candidates.push({
            type: "BTTS",
            option: "BTTS — NON",
            probability: 100 - btts
        });
    }


    /* Aucun marché */

    if (!candidates.length) {
        return null;
    }


    /*
     * On choisit le marché le plus solide.
     *
     * Une seule recommandation finale.
     */

    candidates.sort(
        (a, b) => b.probability - a.probability
    );


    const best = candidates[0];


    /*
     * On refuse les paris trop faibles.
     */

    if (best.probability < 60) {
        return null;
    }


    return {
        type: best.type,
        option: best.option
    };
}


/* =========================================================
   SCORE DE SÉLECTION DU MATCH
========================================================= */

function getMatchScore(a, bet) {

    const p = getWinnerProbabilities(a);
    const over25 = getOver25(a);
    const btts = getBTTS(a);

    let score = 0;

    /*
     * Solidité du pari sélectionné
     */

    if (bet) {

        const probabilities = [];

        if (p.home !== null)
            probabilities.push(p.home);

        if (p.draw !== null)
            probabilities.push(p.draw);

        if (p.away !== null)
            probabilities.push(p.away);

        if (over25 !== null) {
            probabilities.push(over25);
            probabilities.push(100 - over25);
        }

        if (btts !== null) {
            probabilities.push(btts);
            probabilities.push(100 - btts);
        }

        if (probabilities.length) {
            score += Math.max(...probabilities);
        }
    }

    /*
     * Qualité minimale de l'analyse.
     */

    const confidence =
        num(a?.predictions?.confidence) ??
        num(a?.model?.confidence);

    if (confidence !== null) {
        score += confidence * 0.25;
    }

    return score;
}


/* =========================================================
   SÉLECTION DES MATCHS
========================================================= */

function selectDailyPicks(analyses) {

    return analyses
        .filter(a => a?.selectedBet)
        .sort(
            (a, b) =>
                Number(b.qualityScore || 0) -
                Number(a.qualityScore || 0)
        )
        .slice(0, MAX_PICKS)
        .map(a => ({
            match: a.match,
            selectedBet: a.selectedBet,
            analysis: a.analysis,
            qualityScore: a.qualityScore
        }));
}


/* =========================================================
   EXPLICATION SIMPLE
========================================================= */

function buildSimpleExplanation(a, bet) {

    const p = getWinnerProbabilities(a);
    const over25 = getOver25(a);
    const btts = getBTTS(a);

    if (bet.type === "BTTS") {

        if (btts !== null && btts >= 70) {
            return "L'analyse indique une forte tendance à voir les deux équipes marquer.";
        }

        return "Les données offensives et défensives favorisent ce scénario.";
    }


    if (bet.type === "TOTAL_GOALS") {

        if (
            bet.option === "Over 2.5" &&
            over25 !== null &&
            over25 >= 70
        ) {
            return "L'analyse indique une forte tendance vers un match avec plusieurs buts.";
        }

        return "Les indicateurs de buts favorisent cette sélection.";
    }


    if (bet.type === "DOUBLE_CHANCE") {
        return "L'analyse globale réduit le risque sur le résultat du match.";
    }


    if (bet.type === "1X2") {
        return "L'analyse globale favorise nettement ce résultat.";
    }


    return "L'analyse globale du match favorise cette sélection.";
}


/* =========================================================
   ANALYSE DU JOUR
========================================================= */

async function buildDailyAnalysis() {

    const today = getToday();


    /* Nouveau jour */

    if (dailyDate !== today) {

        dailyDate = today;

        cache = [];
        cacheTime = 0;

        lastStatus = "NEW_DAY";

        console.log(
            "📅 NOUVEAU JOUR:",
            today
        );
    }


    /* Cache */

    if (
        cache.length &&
        Date.now() - cacheTime < CACHE_TTL
    ) {
        return cache;
    }


    /* Analyse déjà en cours */

    if (building) {
        return building;
    }


    building = (async () => {

        lastStatus = "ANALYZING";
        lastError = null;

        try {

            console.log(
                "📡 RECHERCHE DES MATCHS:",
                today
            );

            const matches = await getMatches();


            if (!Array.isArray(matches)) {
                throw new Error(
                    "getMatches() doit retourner un tableau"
                );
            }


            /*
             * Matchs du jour uniquement
             */

            const todayMatches = matches
                .filter(match =>
                    getMatchDate(
                        match?.utcDate
                    ) === today
                )
                .sort(
                    (a, b) =>
                        new Date(a.utcDate) -
                        new Date(b.utcDate)
                );


            console.log(
                "⚽ MATCHS DU JOUR:",
                todayMatches.length
            );


            if (!todayMatches.length) {

                cache = [];
                cacheTime = Date.now();

                lastStatus = "NO_MATCHES";
                lastUpdate =
                    new Date().toISOString();

                return [];
            }


            /*
             * Analyse de chaque match
             */

            const analyses = [];

            for (const match of todayMatches) {

                try {

                    const result =
                        await analyzeMatch(match);

                    if (result) {
                        analyses.push(result);
                    }

                } catch (error) {

                    console.error(
                        "❌ ANALYSE:",
                        error.message
                    );
                }
            }


            /*
             * Sélection finale
             */

            const picks =
                selectDailyPicks(
                    analyses
                );


            cache = picks;
            cacheTime = Date.now();

            lastStatus =
                picks.length > 0
                    ? "READY"
                    : "NO_VALID_PICKS";

            lastUpdate =
                new Date().toISOString();


            console.log(
                "👑 PICKS:",
                picks.length
            );


            return picks;

        } catch (error) {

            lastStatus = "ERROR";
            lastError = error.message;

            console.error(
                "❌ DAILY ERROR:",
                error.message
            );

            return cache;

        } finally {

            building = null;
        }

    })();


    return building;
}


/* =========================================================
   API ANALYSIS
========================================================= */

app.get("/analysis", async (req, res) => {

    try {

        const analyses =
            await buildDailyAnalysis();

        res.json({

            version: VERSION,

            date: dailyDate,

            count: analyses.length,

            analyses

        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });
    }
});


/* =========================================================
   STATUS
========================================================= */

app.get("/status", (req, res) => {

    res.json({

        status: lastStatus,

        ai: "ACTIVE",

        version: VERSION,

        date: dailyDate,

        matches: cache.length,

        analyzing: !!building,

        lastUpdate,

        error: lastError

    });
});


/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {

    res.json({

        status: "ok",

        ai: "ACTIVE",

        version: VERSION,

        date: dailyDate,

        picks: cache.length

    });
});


/* =========================================================
   SURVEILLANCE 24H/24
========================================================= */

function startDailyWatcher() {

    let currentDay = getToday();

    console.log(
        "🕐 WATCHER ACTIF:",
        currentDay
    );


    setInterval(async () => {

        const today = getToday();

        if (today !== currentDay) {

            console.log(
                "🌅 NOUVEAU JOUR DÉTECTÉ:",
                today
            );

            currentDay = today;

            dailyDate = today;

            cache = [];
            cacheTime = 0;

            await buildDailyAnalysis();
        }

    }, 60 * 1000);
}


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            "👑 KING PREDICTIONS AI V1"
        );

        console.log(
            "🔥 VERSION:",
            VERSION
        );

        console.log(
            "🇨🇬 TIMEZONE:",
            TIMEZONE
        );

        try {

            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );


            await buildDailyAnalysis();

            startDailyWatcher();


            console.log(
                "🚀 KING V1 READY 24/24"
            );

        } catch (error) {

            console.error(
                "❌ STARTUP ERROR:",
                error.message
            );
        }
    }
);
