const express = require("express");
const cors = require("cors");
const path = require("path");

const { getMatches, initializeDatabase } = require("./services/footballApi");
const { analyzeMatch } = require("./services/predictionEngine");

const app = express();

const PORT = process.env.PORT || 3000;

const VERSION = "KING-V1-INTELLIGENT";

const CACHE_TTL = 24 * 60 * 60 * 1000;
const EMPTY_CACHE_TTL = 2 * 60 * 1000;

const MAX_MATCHES_TO_ANALYZE = 40;
const DAILY_RESULTS = 4;

const TARGET_TIMEZONE = "Africa/Brazzaville";

app.use(cors());
app.use(express.json());

/* =========================================================
   CACHE / NO CACHE FRONTEND
========================================================= */

app.use((req, res, next) => {
    const file = req.path.toLowerCase();

    if (
        file === "/" ||
        file.endsWith(".html") ||
        file.endsWith(".js") ||
        file.endsWith(".css")
    ) {
        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
        );

        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }

    res.setHeader("X-KING-VERSION", VERSION);

    next();
});

app.get("/", (req, res) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );

    res.sendFile(
        path.join(__dirname, "public", "index.html"),
        {
            cacheControl: false,
            etag: false
        }
    );
});

app.use(
    express.static(path.join(__dirname, "public"), {
        etag: false,
        maxAge: 0,
        index: false
    })
);


/* =========================================================
   GLOBAL STATE
========================================================= */

let cache = [];
let cacheTime = 0;
let cacheValid = false;

let building = null;

let dailyDate = "";
let targetDate = "";

let lastStatus = "STARTING";
let lastError = null;
let lastUpdate = null;


/* =========================================================
   DATE HELPERS
========================================================= */

/*
 * Date actuelle au Congo.
 */
function getToday() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TARGET_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}


/*
 * Demain au Congo.
 *
 * IMPORTANT :
 * L'IA ne sélectionne PAS les matchs du jour.
 * Elle prépare les matchs du lendemain.
 *
 * Exemple :
 * 04/09/2026 -> cible 05/09/2026
 */
function getTomorrow() {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TARGET_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(now);

    const year = Number(
        parts.find(p => p.type === "year")?.value
    );

    const month = Number(
        parts.find(p => p.type === "month")?.value
    );

    const day = Number(
        parts.find(p => p.type === "day")?.value
    );

    const localDate = new Date(
        Date.UTC(year, month - 1, day)
    );

    localDate.setUTCDate(localDate.getUTCDate() + 1);

    return localDate
        .toISOString()
        .slice(0, 10);
}


/*
 * Convertit une date UTC en date Congo.
 */
function getCongoDate(utcDate) {
    if (!utcDate) return null;

    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: TARGET_TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date(utcDate));
    } catch {
        return null;
    }
}


/* =========================================================
   BASIC VALIDATION
========================================================= */

function isUsable(a) {
    return !!(
        a &&
        a.match &&
        a.match.homeTeam &&
        a.match.awayTeam &&
        a.predictions
    );
}


function matchKey(a) {
    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id || a?.match?.homeTeam?.name}_${a?.match?.awayTeam?.id || a?.match?.awayTeam?.name}_${a?.match?.utcDate}`
    );
}


function removeDuplicates(matches) {
    const seen = new Set();

    return matches.filter(match => {
        const key = String(
            match?.id ??
            `${match?.homeTeam?.id}_${match?.awayTeam?.id}_${match?.utcDate}`
        );

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function number(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}


function clamp(value, min, max) {
    return Math.max(
        min,
        Math.min(max, value)
    );
}


/* =========================================================
   EXTRACT MODEL INFORMATION
========================================================= */

function getFavoriteProbability(a) {
    return number(
        a?.predictions?.favoriteProbability ??
        a?.predictions?.probability ??
        a?.model?.favoriteProbability ??
        a?.model?.confidence,
        0
    );
}


function getConfidence(a) {
    return number(
        a?.predictions?.confidence ??
        a?.model?.confidence ??
        a?.confidence?.confidence,
        0
    );
}


function getDataQuality(a) {
    const value =
        a?.predictions?.dataQuality ??
        a?.model?.dataQuality ??
        a?.teamStats?.dataQuality;

    if (typeof value === "string") {
        if (value.toUpperCase() === "HIGH") return 100;
        if (value.toUpperCase() === "MEDIUM") return 70;
        if (value.toUpperCase() === "LOW") return 40;
    }

    return clamp(number(value, 0), 0, 100);
}


function getPlayedMatches(a) {
    return number(
        a?.predictions?.played ??
        a?.model?.played ??
        a?.teamStats?.played ??
        a?.teamStats?.matchesUsed,
        0
    );
}


/* =========================================================
   EXTRACT ANALYSIS SIGNALS
========================================================= */

function getWinnerProbability(a) {
    const p = a?.predictions || {};

    const home = number(
        p.homeWin ??
        p.homeProbability ??
        p.probabilities?.home,
        0
    );

    const draw = number(
        p.draw ??
        p.drawProbability ??
        p.probabilities?.draw,
        0
    );

    const away = number(
        p.awayWin ??
        p.awayProbability ??
        p.probabilities?.away,
        0
    );

    return {
        home,
        draw,
        away
    };
}


function getOver25(a) {
    const p = a?.predictions || {};

    return number(
        p.over25 ??
        p.over25Probability ??
        p.over25Percent ??
        a?.model?.over25,
        0
    );
}


function getBTTS(a) {
    const p = a?.predictions || {};

    return number(
        p.btts ??
        p.bttsProbability ??
        p.bttsPercent ??
        a?.model?.btts,
        0
    );
}


/* =========================================================
   ANALYSIS SCORE
========================================================= */

/*
 * On ne sélectionne pas simplement les matchs ayant
 * la plus grosse probabilité.

 * On combine :
 *
 * - confiance
 * - qualité des données
 * - quantité de données
 * - séparation entre les issues
 * - cohérence des signaux
 *
 * Le but est de choisir 3-4 analyses solides.
 */

function calculateAnalysisScore(a) {
    const confidence = getConfidence(a);

    const dataQuality = getDataQuality(a);

    const played = getPlayedMatches(a);

    const probabilities = getWinnerProbability(a);

    const values = [
        probabilities.home,
        probabilities.draw,
        probabilities.away
    ].sort((x, y) => y - x);

    const best = values[0] || 0;
    const second = values[1] || 0;

    const separation = Math.max(
        0,
        best - second
    );

    const dataScore = clamp(
        dataQuality,
        0,
        100
    );

    const matchesScore = clamp(
        played * 10,
        0,
        100
    );

    const separationScore = clamp(
        separation,
        0,
        100
    );

    return (
        confidence * 0.40 +
        dataScore * 0.25 +
        matchesScore * 0.10 +
        separationScore * 0.25
    );
}


/* =========================================================
   CHOOSE ONE SINGLE ANALYTICAL ANGLE
========================================================= */

/*
 * IMPORTANT :
 *
 * L'IA analyse d'abord le match.
 *
 * Ensuite seulement elle choisit UN SEUL angle.
 *
 * Elle ne renvoie donc plus :
 *
 * Tendance
 * + Over 2.5
 * + BTTS
 * + Score exact
 *
 * Elle choisit le signal qui ressort le plus clairement.
 *
 * Le score exact est volontairement exclu.
 */

function chooseBestAngle(a) {
    const probabilities = getWinnerProbability(a);

    const home = probabilities.home;
    const draw = probabilities.draw;
    const away = probabilities.away;

    const over25 = getOver25(a);
    const btts = getBTTS(a);

    const candidates = [];

    /*
     * ISSUE DOMICILE
     */
    if (home > 0) {
        candidates.push({
            type: "RESULTAT",
            label: "Avantage domicile",
            value: home,
            strength: home
        });
    }


    /*
     * ISSUE NUL
     */
    if (draw > 0) {
        candidates.push({
            type: "RESULTAT",
            label: "Tendance au nul",
            value: draw,
            strength: draw
        });
    }


    /*
     * ISSUE EXTERIEUR
     */
    if (away > 0) {
        candidates.push({
            type: "RESULTAT",
            label: "Avantage extérieur",
            value: away,
            strength: away
        });
    }


    /*
     * OVER 2.5
     */
    if (over25 > 0) {
        candidates.push({
            type: "BUTS",
            label: "Plus de 2,5 buts",
            value: over25,
            strength: over25
        });
    }


    /*
     * BTTS
     *
     * On accepte uniquement si le moteur renvoie
     * une probabilité exploitable.
     */
    if (btts > 0) {
        candidates.push({
            type: "BTTS",
            label: "Les deux équipes peuvent marquer",
            value: btts,
            strength: btts
        });
    }


    if (!candidates.length) {
        return {
            type: "ANALYSE",
            label: "Signal insuffisant",
            value: 0
        };
    }


    /*
     * Le signal avec la meilleure valeur ressort.
     */
    candidates.sort(
        (a, b) => b.strength - a.strength
    );

    const best = candidates[0];

    return {
        type: best.type,
        label: best.label,
        value: Math.round(best.value)
    };
}


/* =========================================================
   FORMAT FINAL
========================================================= */

/*
 * IMPORTANT :
 *
 * Le frontend reçoit seulement :
 *
 * - match
 * - compétition
 * - date
 * - un seul angle analytique
 * - confiance
 * - qualité des données
 *
 * Le score exact n'est PAS envoyé.
 */

function formatAnalysis(a) {
    const angle = chooseBestAngle(a);

    return {
        match: {
            id: a.match?.id ?? null,

            utcDate:
                a.match?.utcDate ?? null,

            localDate:
                getCongoDate(a.match?.utcDate),

            status:
                a.match?.status ?? null,

            competition:
                a.match?.competition ?? null,

            homeTeam:
                a.match?.homeTeam ?? null,

            awayTeam:
                a.match?.awayTeam ?? null
        },

        analysis: {
            angle: angle.label,
            type: angle.type,
            signal: angle.value,

            confidence: getConfidence(a),

            dataQuality:
                a?.predictions?.dataQuality ??
                a?.model?.dataQuality ??
                a?.teamStats?.dataQuality ??
                "UNKNOWN",

            matchesUsed:
                getPlayedMatches(a)
        }
    };
}


/* =========================================================
   BUILD TOMORROW'S ANALYSIS
========================================================= */

async function buildDailyAnalysis() {
    const today = getToday();
    const tomorrow = getTomorrow();

    /*
     * Chaque nouveau jour :
     * on vide l'ancien résultat.
     */
    if (
        dailyDate !== today ||
        targetDate !== tomorrow
    ) {
        cache = [];

        cacheTime = 0;

        cacheValid = false;

        dailyDate = today;

        targetDate = tomorrow;

        console.log("📅 TODAY:", today);

        console.log(
            "🎯 TARGET DATE:",
            tomorrow
        );
    }


    /*
     * Cache 24 heures.
     */
    if (cacheValid) {
        const ttl =
            cache.length > 0
                ? CACHE_TTL
                : EMPTY_CACHE_TTL;

        if (
            Date.now() - cacheTime <
            ttl
        ) {
            console.log(
                "⚡ DAILY CACHE:",
                cache.length
            );

            return cache;
        }
    }


    /*
     * Empêche plusieurs analyses simultanées.
     */
    if (building) {
        console.log(
            "⏳ ANALYSIS ALREADY RUNNING"
        );

        return building;
    }


    building = (async () => {
        lastStatus = "LOADING";

        lastError = null;


        try {
            console.log(
                "📡 FETCHING MATCHES..."
            );

            const matches =
                await getMatches();


            if (!Array.isArray(matches)) {
                throw new Error(
                    "getMatches() ne retourne pas un tableau"
                );
            }


            console.log(
                "📦 MATCHES RECEIVED:",
                matches.length
            );


            const uniqueMatches =
                removeDuplicates(matches);


            /*
             * =================================================
             * IMPORTANT :
             *
             * ON CHERCHE UNIQUEMENT LES MATCHS DE DEMAIN.
             * =================================================
             */

            const tomorrowMatches =
                uniqueMatches
                    .filter(match => {
                        const date =
                            getCongoDate(
                                match?.utcDate
                            );

                        return (
                            date ===
                            targetDate
                        );
                    })
                    .sort(
                        (a, b) =>
                            new Date(
                                a.utcDate
                            ) -
                            new Date(
                                b.utcDate
                            )
                    );


            console.log(
                "🎯 MATCHES DE DEMAIN:",
                tomorrowMatches.length
            );


            if (!tomorrowMatches.length) {
                cache = [];

                cacheTime =
                    Date.now();

                cacheValid = true;

                lastStatus =
                    "NO_MATCHES_TOMORROW";

                lastUpdate =
                    new Date().toISOString();

                return [];
            }


            /*
             * =================================================
             * ANALYSE COMPLETE
             *
             * On analyse les matchs de demain
             * avant de sélectionner les meilleurs.
             * =================================================
             */

            const analyzed = [];


            for (
                const match of
                tomorrowMatches.slice(
                    0,
                    MAX_MATCHES_TO_ANALYZE
                )
            ) {
                try {
                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`
                    );


                    const analysis =
                        await analyzeMatch(
                            match
                        );


                    if (
                        !isUsable(
                            analysis
                        )
                    ) {
                        console.log(
                            "⚠️ INVALID:",
                            match.homeTeam?.name,
                            "vs",
                            match.awayTeam?.name
                        );

                        continue;
                    }


                    const score =
                        calculateAnalysisScore(
                            analysis
                        );


                    const angle =
                        chooseBestAngle(
                            analysis
                        );


                    /*
                     * Si le moteur ne donne aucun
                     * signal exploitable, on ignore
                     * le match.
                     */
                    if (
                        angle.value <= 0
                    ) {
                        console.log(
                            "⚠️ NO STRONG SIGNAL:",
                            match.homeTeam?.name,
                            "vs",
                            match.awayTeam?.name
                        );

                        continue;
                    }


                    analyzed.push({
                        analysis,
                        score,
                        angle
                    });


                    console.log(
                        "✅ ANALYZED:",
                        `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
                        "| SCORE:",
                        score.toFixed(2),
                        "| ANGLE:",
                        angle.label
                    );

                } catch (err) {
                    console.error(
                        "❌ AI ERROR:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`,
                        err.message
                    );
                }
            }


            /*
             * =================================================
             * SELECTION INTELLIGENTE
             *
             * On trie après analyse complète.
             * =================================================
             */

            analyzed.sort(
                (a, b) =>
                    b.score - a.score
            );


            /*
             * Seulement 3 à 4 matchs.
             */
            const selected =
                analyzed
                    .slice(
                        0,
                        DAILY_RESULTS
                    )
                    .map(item =>
                        item.analysis
                    );

/*
             * =================================================
             * RESULTAT FINAL
             * =================================================
             */

            cache = selected;

            cacheTime =
                Date.now();

            cacheValid = true;

            lastStatus =
                selected.length > 0
                    ? "READY"
                    : "NO_VALID_ANALYSES";

            lastUpdate =
                new Date().toISOString();


            console.log(
                "👑 FINAL SELECTION:",
                selected.length
            );


            selected.forEach(
                (item, index) => {
                    const angle =
                        chooseBestAngle(
                            item
                        );

                    console.log(
                        `🏆 #${index + 1}`,
                        `${item.match?.homeTeam?.name} vs ${item.match?.awayTeam?.name}`,
                        "|",
                        angle.label
                    );
                }
            );


            return selected;

        } catch (err) {
            lastStatus = "ERROR";

            lastError =
                err.message;

            lastUpdate =
                new Date().toISOString();


            console.error(
                "❌ DAILY ANALYSIS ERROR:",
                err.stack
            );


            return cacheValid
                ? cache
                : [];

        } finally {
            building = null;
        }
    })();


    return building;
}


/* =========================================================
   API /analysis
========================================================= */

app.get(
    "/analysis",
    async (req, res) => {
        try {
            const data =
                await buildDailyAnalysis();


            res.setHeader(
                "Cache-Control",
                "no-store"
            );


            res.json({
                version: VERSION,

                today: dailyDate,

                targetDate: targetDate,

                count: data.length,

                maxResults:
                    DAILY_RESULTS,

                analyses:
                    data.map(
                        formatAnalysis
                    )
            });

        } catch (err) {
            res.status(500).json({
                error: err.message
            });
        }
    }
);


/* =========================================================
   STATUS
========================================================= */

app.get(
    "/status",
    (req, res) => {
        res.setHeader(
            "Cache-Control",
            "no-store"
        );


        res.json({
            status: lastStatus,

            ai: "ACTIVE",

            version: VERSION,

            today: dailyDate,

            targetDate: targetDate,

            matches:
                cache.length,

            analyses:
                cache.length,

            maxDailyResults:
                DAILY_RESULTS,

            cacheValid,

            analyzing:
                !!building,

            lastUpdate,

            error:
                lastError
        });
    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (req, res) => {
        res.setHeader(
            "Cache-Control",
            "no-store"
        );


        res.json({
            status: "ok",

            ai: "ACTIVE",

            version: VERSION,

            today: dailyDate,

            targetDate: targetDate,

            analyses:
                cache.length,

            analyzing:
                !!building,

            lastStatus,

            lastError,

            lastUpdate
        });
    }
);


/* =========================================================
   VERSION
========================================================= */

app.get(
    "/__king_version",
    (req, res) => {
        res.setHeader(
            "Cache-Control",
            "no-store"
        );


        res.json({
            project:
                "KING PREDICTIONS AI",

            version:
                VERSION,

            frontend:
                "V1",

            intelligentSelection:
                true,

            dailyResults:
                DAILY_RESULTS,

            analyzesTomorrow:
                true,

            timezone:
                TARGET_TIMEZONE,

            cacheHours:
                24,

            timestamp:
                new Date().toISOString()
        });
    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    async () => {
        console.log(
            "👑 KING PREDICTIONS AI V1 ONLINE"
        );

        console.log(
            "🔥 VERSION:",
            VERSION
        );

        console.log(
            "🌐 PORT:",
            PORT
        );

        console.log(
            "🇨🇬 TIMEZONE:",
            TARGET_TIMEZONE
        );

        console.log(
            "🎯 DAILY TARGET:",
            "TOMORROW"
        );

        console.log(
            "🏆 MAX RESULTS:",
            DAILY_RESULTS
        );

        console.log(
            "🧠 INTELLIGENT POST-ANALYSIS: ON"
        );


        try {
            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );


            /*
             * Première génération au démarrage.
             *
             * Exemple :
             * 4 septembre
             * ↓
             * recherche du 5 septembre
             */
            await buildDailyAnalysis();


            console.log(
                "✅ TOMORROW ANALYSIS READY"
            );


            /*
             * Vérification régulière.
             *
             * Ce n'est plus un simple calcul
             * toutes les 24h à partir du démarrage.
             *
             * Le système regarde toujours la date
             * actuelle et recalcule automatiquement
             * lorsque la date cible change.
             */

            setInterval(
                async () => {
                    try {
                        const currentToday =
                            getToday();

                        const currentTomorrow =
                            getTomorrow();


                        if (
                            currentToday !==
                                dailyDate ||
                            currentTomorrow !==
                                targetDate
                        ) {
                            console.log(
                                "📅 NEW DAILY CYCLE"
                            );

                            cacheValid =
                                false;

                            await buildDailyAnalysis();
                        }

                    } catch (err) {
                        console.error(
                            "❌ DAILY CHECK:",
                            err.message
                        );
                    }
                },

                5 * 60 * 1000
            );


            console.log(
                "🚀 V1 READY"
            );

        } catch (err) {
            console.error(
                "❌ STARTUP:",
                err.stack
            );
        }
    }
);
