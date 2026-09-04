const express = require("express");
const cors = require("cors");
const path = require("path");

const { getMatches, initializeDatabase } = require("./services/footballApi");
const { analyzeMatch } = require("./services/predictionEngine");

const app = express();
const PORT = process.env.PORT || 3000;

const VERSION = "KING-V1-DAILY-INTELLIGENT";

const CACHE_TTL = 30 * 60 * 1000;
const EMPTY_CACHE_TTL = 2 * 60 * 1000;

const MIN_DAILY_PICKS = 3;
const MAX_DAILY_PICKS = 4;

/*
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
|
| L'IA travaille sur le JOUR CALENDAIRE ACTUEL à Brazzaville.
|
| Exemple :
| 03 septembre -> matchs du 03 septembre
| 04 septembre -> matchs du 04 septembre
| 05 septembre -> matchs du 05 septembre
|
| Elle ne mélange donc plus les matchs du 04 avec ceux du 05.
|
|--------------------------------------------------------------------------
*/

app.use(cors());
app.use(express.json());

/*
|--------------------------------------------------------------------------
| CACHE CONTROL
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| FRONTEND
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

let cache = [];
let cacheTime = 0;
let cacheValid = false;

let building = null;

let dailyDate = "";

let lastStatus = "STARTING";
let lastError = null;
let lastUpdate = null;

/*
|--------------------------------------------------------------------------
| DATE BRAZZAVILLE
|--------------------------------------------------------------------------
*/

function getToday() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Brazzaville",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

/*
|--------------------------------------------------------------------------
| DATE D'UN MATCH
|--------------------------------------------------------------------------
|
| On convertit l'heure UTC du match vers Brazzaville avant de déterminer
| son jour.
|
|--------------------------------------------------------------------------
*/

function getMatchLocalDate(utcDate) {
    if (!utcDate) return null;

    const date = new Date(utcDate);

    if (!Number.isFinite(date.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Brazzaville",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}

/*
|--------------------------------------------------------------------------
| MATCH USABLE
|--------------------------------------------------------------------------
*/

function isUsable(a) {
    return !!(
        a &&
        a.match &&
        a.match.homeTeam &&
        a.match.awayTeam &&
        a.predictions
    );
}

/*
|--------------------------------------------------------------------------
| MATCH KEY
|--------------------------------------------------------------------------
*/

function matchKey(a) {
    return String(
        a?.match?.id ??
        `${a?.match?.homeTeam?.id || a?.match?.homeTeam?.name}_${a?.match?.awayTeam?.id || a?.match?.awayTeam?.name}_${a?.match?.utcDate}`
    );
}

/*
|--------------------------------------------------------------------------
| REMOVE DUPLICATES
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function number(value) {
    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}

function clamp(value, min = 0, max = 100) {
    const n = number(value);

    if (n === null) return null;

    return Math.max(min, Math.min(max, n));
}

/*
|--------------------------------------------------------------------------
| GET PROBABILITIES
|--------------------------------------------------------------------------
|
| On cherche les probabilités produites par ton moteur actuel sans
| modifier predictionEngine.js.
|
|--------------------------------------------------------------------------
*/

function getWinnerProbabilities(a) {
    const p = a?.predictions || {};
    const model = a?.model || {};

    const home =
        number(p.homeWin) ??
        number(p.home) ??
        number(p.homeProbability) ??
        number(model.homeWin) ??
        number(model.homeProbability);

    const draw =
        number(p.draw) ??
        number(p.drawProbability) ??
        number(model.draw) ??
        number(model.drawProbability);

    const away =
        number(p.awayWin) ??
        number(p.away) ??
        number(p.awayProbability) ??
        number(model.awayWin) ??
        number(model.awayProbability);

    return {
        home: home !== null ? clamp(home) : null,
        draw: draw !== null ? clamp(draw) : null,
        away: away !== null ? clamp(away) : null
    };
}

/*
|--------------------------------------------------------------------------
| GET OVER 2.5
|--------------------------------------------------------------------------
*/

function getOver25(a) {
    const p = a?.predictions || {};
    const model = a?.model || {};

    return clamp(
        number(p.over25) ??
        number(p.over2_5) ??
        number(p.over25Probability) ??
        number(model.over25) ??
        number(model.over2_5)
    );
}

/*
|--------------------------------------------------------------------------
| GET BTTS
|--------------------------------------------------------------------------
*/

function getBTTS(a) {
    const p = a?.predictions || {};
    const model = a?.model || {};

    return clamp(
        number(p.btts) ??
        number(p.bttsProbability) ??
        number(model.btts) ??
        number(model.bttsProbability)
    );
}

/*
|--------------------------------------------------------------------------
| GET CONFIDENCE
|--------------------------------------------------------------------------
*/

function getConfidence(a) {
    const p = a?.predictions || {};
    const model = a?.model || {};

    return clamp(
        number(p.confidence) ??
        number(model.confidence) ??
        number(a?.confidence)
    ) ?? 0;
}

/*
|--------------------------------------------------------------------------
| GET RISK
|--------------------------------------------------------------------------
*/

function getRisk(a) {
    const p = a?.predictions || {};
    const model = a?.model || {};

    return String(
        p.risk ??
        model.risk ??
        a?.risk ??
        "UNKNOWN"
    ).toUpperCase();
}

/*
|--------------------------------------------------------------------------
| INTELLIGENT BET SELECTION
|--------------------------------------------------------------------------
|
| IMPORTANT :
|
| Le score exact n'est PAS une option de pari.
|
| L'IA compare uniquement les marchés réellement exploitables :
|
| - 1X2
| - Double chance
| - Over 2.5
| - Under 2.5
| - BTTS OUI
| - BTTS NON
|
| Elle sélectionne UNE SEULE option pour chaque match.
|
|--------------------------------------------------------------------------
*/

function selectBestBet(a) {
    const probabilities = getWinnerProbabilities(a);

    const over25 = getOver25(a);
    const btts = getBTTS(a);

    const confidence = getConfidence(a);
    const risk = getRisk(a);

    const candidates = [];

    /*
    |--------------------------------------------------------------------------
    | 1X2
    |--------------------------------------------------------------------------
    */

    if (probabilities.home !== null) {
        candidates.push({
            market: "1X2",
            option: "Victoire domicile",
            probability: probabilities.home,
            baseScore: probabilities.home,
            label: `Victoire ${a.match.homeTeam.name}`
        });
    }

    if (probabilities.draw !== null) {
        candidates.push({
            market: "1X2",
            option: "Match nul",
            probability: probabilities.draw,
            baseScore: probabilities.draw,
            label: "Match nul"
        });
    }

    if (probabilities.away !== null) {
        candidates.push({
            market: "1X2",
            option: "Victoire extérieur",
            probability: probabilities.away,
            baseScore: probabilities.away,
            label: `Victoire ${a.match.awayTeam.name}`
        });
    }

    /*
    |--------------------------------------------------------------------------
    | DOUBLE CHANCE
    |--------------------------------------------------------------------------
    |
    | La double chance est dérivée des probabilités 1X2.
    |
    */

    if (
        probabilities.home !== null &&
        probabilities.draw !== null
    ) {
        candidates.push({
            market: "DOUBLE_CHANCE",
            option: "1X",
            probability: probabilities.home + probabilities.draw,
            baseScore: probabilities.home + probabilities.draw,
            label: "1X"
        });
    }

    if (
        probabilities.away !== null &&
        probabilities.draw !== null
    ) {
        candidates.push({
            market: "DOUBLE_CHANCE",
            option: "X2",
            probability: probabilities.away + probabilities.draw,
            baseScore: probabilities.away + probabilities.draw,
            label: "X2"
        });
    }

    if (
        probabilities.home !== null &&
        probabilities.away !== null
    ) {
        candidates.push({
            market: "DOUBLE_CHANCE",
            option: "12",
            probability: probabilities.home + probabilities.away,
            baseScore: probabilities.home + probabilities.away,
            label: "12"
        });
    }

    /*
    |--------------------------------------------------------------------------
    | OVER / UNDER 2.5
    |--------------------------------------------------------------------------
    */

    if (over25 !== null) {
        candidates.push({
            market: "TOTAL_GOALS",
            option: "Over 2.5",
            probability: over25,
            baseScore: over25,
            label: "Plus de 2.5 buts"
        });

        candidates.push({
            market: "TOTAL_GOALS",
            option: "Under 2.5",
            probability: 100 - over25,
            baseScore: 100 - over25,
            label: "Moins de 2.5 buts"
        });
    }

    /*
    |--------------------------------------------------------------------------
    | BTTS
    |--------------------------------------------------------------------------
    */

    if (btts !== null) {
        candidates.push({
            market: "BTTS",
            option: "BTTS OUI",
            probability: btts,
            baseScore: btts,
            label: "Les deux équipes marquent — OUI"
        });

        candidates.push({
            market: "BTTS",
            option: "BTTS NON",
            probability: 100 - btts,
            baseScore: 100 - btts,
            label: "Les deux équipes marquent — NON"
        });
    }

    /*
    |--------------------------------------------------------------------------
    | AJUSTEMENT INTELLIGENT
    |--------------------------------------------------------------------------
    |
    | On ne prend pas simplement le plus gros pourcentage.
    |
    | L'objectif est de favoriser une option cohérente avec l'analyse
    | globale du match.
    |
    */

    const xg =
        number(a?.predictions?.expectedGoals) ??
        number(a?.model?.expectedGoals) ??
        number(a?.predictions?.totalExpectedGoals) ??
        number(a?.model?.totalExpectedGoals);

    const exactScore =
        a?.predictions?.exactScore ??
        a?.model?.exactScore ??
        null;

    for (const candidate of candidates) {
        let score = candidate.baseScore;

        /*
        | Bonus confiance
        */

        score += confidence * 0.15;

        /*
        | Risque élevé = légère pénalité
        */

        if (risk === "HIGH") {
            score -= 5;
        }

        /*
        | Cohérence avec les buts attendus
        */

        if (
            candidate.market === "TOTAL_GOALS" &&
            xg !== null
        ) {
            if (
                candidate.option === "Over 2.5" &&
                xg >= 2.8
            ) {
                score += 8;
            }

            if (
                candidate.option === "Under 2.5" &&
                xg < 2.4
            ) {
                score += 8;
            }
        }

        /*
        | Cohérence BTTS
        */

        if (
            candidate.market === "BTTS" &&
            btts !== null
        ) {
            if (
                candidate.option === "BTTS OUI" &&
                btts >= 65
            ) {
                score += 8;
            }

            if (
                candidate.option === "BTTS NON" &&
                btts <= 35
            ) {
                score += 8;
            }
        }

        /*
        | Cohérence 1X2
        */

        if (
            candidate.market === "1X2" &&
            candidate.probability >= 60
        ) {
            score += 5;
        }

        /*
        | Cohérence double chance
        */

        if (
            candidate.market === "DOUBLE_CHANCE" &&
            candidate.probability >= 75
        ) {
            score += 6;
        }

        candidate.selectionScore = score;
    }

    /*
    |--------------------------------------------------------------------------
    | TRI
    |--------------------------------------------------------------------------
    */

    candidates.sort(
        (a, b) =>
            (b.selectionScore || 0) -
            (a.selectionScore || 0)
    );

    const best = candidates[0];

    if (!best) {
        return null;
    }

    /*
    |--------------------------------------------------------------------------
    | CONFIANCE MINIMALE DE L'OPTION
    |--------------------------------------------------------------------------
    */

    if (
        best.probability === null ||
        best.probability < 55
    ) {
        return null;
    }

    return {
        market: best.market,
        option: best.option,
        label: best.label,
        probability: Math.round(best.probability),
        selectionScore: Math.round(best.selectionScore),
        confidence: Math.round(confidence)
    };
}

/*
|--------------------------------------------------------------------------
| SCORE GLOBAL DU MATCH
|--------------------------------------------------------------------------
|
| Il sert à sélectionner les 3-4 meilleurs matchs APRÈS analyse.
|
|--------------------------------------------------------------------------
*/

function calculateMatchSelectionScore(a) {
    const confidence = getConfidence(a);

    const probabilities = getWinnerProbabilities(a);

    const over25 = getOver25(a);

    const btts = getBTTS(a);

    const bestWinner = Math.max(
        probabilities.home ?? 0,
        probabilities.draw ?? 0,
        probabilities.away ?? 0
    );

    let score = 0;

    /*
    | Confiance du moteur
    */

    score += confidence * 0.45;

    /*
    | Force de la meilleure probabilité 1X2
    */

    score += bestWinner * 0.25;

    /*
    | Cohérence des marchés secondaires
    */

    if (over25 !== null) {
        score += Math.max(over25, 100 - over25) * 0.10;
    }

    if (btts !== null) {
        score += Math.max(btts, 100 - btts) * 0.10;
    }

    /*
    | Qualité des données
    */

    const dataQuality =
        String(
            a?.model?.dataQuality ??
            a?.predictions?.dataQuality ??
            a?.teamStats?.dataQuality ??
            ""
        ).toUpperCase();

    if (dataQuality === "HIGH") {
        score += 8;
    } else if (dataQuality === "MEDIUM") {
        score += 3;
    }

    /*
    | Risque
    */

    const risk = getRisk(a);

    if (risk === "HIGH") {
        score -= 8;
    }

    if (risk === "LOW") {
        score += 5;
    }

    return score;
}

/*
|--------------------------------------------------------------------------
| SELECTION DES 3-4 MEILLEURS MATCHS
|--------------------------------------------------------------------------
*/

function selectDailyPicks(analyses) {
    const valid = [];

    for (const analysis of analyses) {
        if (!isUsable(analysis)) {
            continue;
        }

        const bestBet = selectBestBet(analysis);

        /*
        | Si aucune option suffisamment solide n'est trouvée,
        | le match n'est pas retenu.
        */

        if (!bestBet) {
            console.log(
                "🚫 NO SUITABLE BET:",
                analysis.match.homeTeam.name,
                "vs",
                analysis.match.awayTeam.name
            );

            continue;
        }

        const matchScore =
            calculateMatchSelectionScore(analysis);

        valid.push({
            analysis,
            bestBet,
            matchScore
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Classement des matchs
    |--------------------------------------------------------------------------
    */

    valid.sort((a, b) => {
        return b.matchScore - a.matchScore;
    });

    /*
    |--------------------------------------------------------------------------
    | MAXIMUM 4
    |--------------------------------------------------------------------------
    */

    const selected = valid.slice(0, MAX_DAILY_PICKS);

    console.log(
        "👑 DAILY TOP MATCHES:",
        selected.length
    );

    selected.forEach((item, index) => {
        console.log(
            `🏆 #${index + 1}`,
            `${item.analysis.match.homeTeam.name} vs ${item.analysis.match.awayTeam.name}`,
            "|",
            item.bestBet.label,
            "|",
            `${item.bestBet.probability}%`,
            "| SCORE:",
            Math.round(item.matchScore)
        );
    });

    return selected.map(item => {
        const a = item.analysis;

        return {
            ...a,

           /*
            |--------------------------------------------------------------------------
            | UNE SEULE OPTION DE PARI
            |--------------------------------------------------------------------------
            */

            selectedBet: item.bestBet,

            /*
            |--------------------------------------------------------------------------
            | SCORE DE SÉLECTION INTERNE
            |--------------------------------------------------------------------------
            */

            selectionScore: Math.round(item.matchScore)
        };
    });
}

/*
|--------------------------------------------------------------------------
| FORMAT FINAL POUR LE FRONTEND
|--------------------------------------------------------------------------
|
| On conserve les informations utiles à l'interface mais on ajoute
| selectedBet.
|
| Le frontend pourra donc afficher :
|
| 🎯 OPTION DE PARI
| Over 2.5 — 88%
|
| au lieu de présenter plusieurs options comme si elles étaient toutes
| recommandées.
|
|--------------------------------------------------------------------------
*/

function formatAnalysis(a) {
    return {
        match: {
            id: a.match?.id ?? null,
            utcDate: a.match?.utcDate ?? null,
            status: a.match?.status ?? null,
            competition: a.match?.competition ?? null,
            homeTeam: a.match?.homeTeam ?? null,
            awayTeam: a.match?.awayTeam ?? null
        },

        predictions: a.predictions || {},

        model: a.model || {},

        teamStats: a.teamStats || {},

        marketScores: a.marketScores || {},

        /*
        |--------------------------------------------------------------------------
        | NOUVEAU
        |--------------------------------------------------------------------------
        */

        selectedBet: a.selectedBet || null,

        selectionScore: a.selectionScore ?? null
    };
}

/*
|--------------------------------------------------------------------------
| BUILD DAILY ANALYSIS
|--------------------------------------------------------------------------
*/

async function buildDailyAnalysis() {
    const today = getToday();

    /*
    |--------------------------------------------------------------------------
    | CHANGEMENT DE JOUR
    |--------------------------------------------------------------------------
    */

    if (dailyDate !== today) {
        cache = [];
        cacheTime = 0;
        cacheValid = false;

        dailyDate = today;

        console.log("📅 NEW KING DAY:", today);
    }

    /*
    |--------------------------------------------------------------------------
    | CACHE
    |--------------------------------------------------------------------------
    */

    if (cacheValid) {
        const ttl =
            cache.length > 0
                ? CACHE_TTL
                : EMPTY_CACHE_TTL;

        if (Date.now() - cacheTime < ttl) {
            console.log(
                "⚡ DAILY CACHE:",
                cache.length
            );

            return cache;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | ÉVITER PLUSIEURS ANALYSES SIMULTANÉES
    |--------------------------------------------------------------------------
    */

    if (building) {
        console.log(
            "⏳ DAILY ANALYSIS ALREADY RUNNING"
        );

        return building;
    }

    building = (async () => {
        lastStatus = "LOADING";
        lastError = null;

        try {
            console.log(
                "📡 FETCHING MATCHES FOR:",
                today
            );

            const matches = await getMatches();

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
            |--------------------------------------------------------------------------
            | UNIQUEMENT LES MATCHS DU JOUR
            |--------------------------------------------------------------------------
            |
            | Très important :
            |
            | On ne prend PLUS :
            |
            | now -> +7 jours
            |
            | On prend :
            |
            | TODAY -> TODAY
            |
            |--------------------------------------------------------------------------
            */

            const todayMatches =
                uniqueMatches
                    .filter(match => {
                        const localDate =
                            getMatchLocalDate(
                                match?.utcDate
                            );

                        return localDate === today;
                    })
                    .sort(
                        (a, b) =>
                            new Date(a.utcDate) -
                            new Date(b.utcDate)
                    );

            console.log(
                "📅 MATCHS DU JOUR:",
                todayMatches.length
            );

            /*
            |--------------------------------------------------------------------------
            | AUCUN MATCH AUJOURD'HUI
            |--------------------------------------------------------------------------
            */

            if (!todayMatches.length) {
                cache = [];
                cacheTime = Date.now();
                cacheValid = true;

                lastStatus = "NO_MATCHES";
                lastUpdate =
                    new Date().toISOString();

                console.log(
                    "⚠️ NO MATCHES FOR TODAY:",
                    today
                );

                return [];
            }

            /*
            |--------------------------------------------------------------------------
            | ANALYSE DE TOUS LES MATCHS DU JOUR
            |--------------------------------------------------------------------------
            |
            | On analyse d'abord les matchs.
            | Ensuite seulement l'IA sélectionne les 3-4 meilleurs.
            |
            |--------------------------------------------------------------------------
            */

            const analyzed = [];

            for (const match of todayMatches) {
                try {
                    console.log(
                        "🔎 ANALYZING:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`
                    );

                    const analysis =
                        await analyzeMatch(match);

                    if (!isUsable(analysis)) {
                        console.log(
                            "⚠️ INVALID ANALYSIS:",
                            match.homeTeam?.name,
                            "vs",
                            match.awayTeam?.name
                        );

                        continue;
                    }

                    analyzed.push(analysis);

                } catch (err) {
                    console.error(
                        "❌ AI ERROR:",
                        `${match.homeTeam?.name || "HOME"} vs ${match.awayTeam?.name || "AWAY"}`,
                        err.message
                    );
                }
            }

            console.log(
                "🧠 MATCHES ANALYZED:",
                analyzed.length
            );

            /*
            |--------------------------------------------------------------------------
            | SÉLECTION INTELLIGENTE POST-ANALYSE
            |--------------------------------------------------------------------------
            */

            const dailyPicks =
                selectDailyPicks(analyzed);

            /*
            |--------------------------------------------------------------------------
            | CACHE FINAL
            |--------------------------------------------------------------------------
            */

            cache = dailyPicks;

            cacheTime = Date.now();

            cacheValid = true;

            lastStatus =
                dailyPicks.length >= MIN_DAILY_PICKS
                    ? "READY"
                    : dailyPicks.length > 0
                        ? "PARTIAL"
                        : "NO_VALID_ANALYSES";

            lastUpdate =
                new Date().toISOString();

            console.log(
                "👑 DAILY PREDICTIONS READY:",
                dailyPicks.length
            );

            return dailyPicks;

        } catch (err) {
            lastStatus = "ERROR";

            lastError = err.message;

            lastUpdate =
                new Date().toISOString();

            console.error(
                "❌ DAILY ANALYSIS ERROR:",
                err.stack
            );

            return cacheValid ? cache : [];

        } finally {
            building = null;
        }
    })();

    return building;
}

/*
|--------------------------------------------------------------------------
| FORCE REFRESH
|--------------------------------------------------------------------------
*/

async function refreshDaily() {
    if (building) {
        return;
    }

    console.log(
        "🔄 DAILY INTELLIGENT REFRESH"
    );

    cacheValid = false;

    try {
        await buildDailyAnalysis();

        console.log(
            "✅ DAILY REFRESH FINISHED"
        );

    } catch (err) {
        console.error(
            "❌ DAILY REFRESH:",
            err.message
        );
    }
}

/*
|--------------------------------------------------------------------------
| /analysis
|--------------------------------------------------------------------------
*/

app.get("/analysis", async (req, res) => {
    try {
        const data =
            await buildDailyAnalysis();

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        res.json({
            version: VERSION,

            date: dailyDate,

            count: data.length,

            minPicks: MIN_DAILY_PICKS,

            maxPicks: MAX_DAILY_PICKS,

            analyses:
                data.map(formatAnalysis)
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

/*
|--------------------------------------------------------------------------
| /status
|--------------------------------------------------------------------------
*/

app.get("/status", (req, res) => {
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        status: lastStatus,

        ai: "ACTIVE",

        version: VERSION,

        matches: cache.length,

        analyses: cache.length,

        dailyPicks: cache.length,

        minDailyPicks:
            MIN_DAILY_PICKS,

        maxDailyPicks:
            MAX_DAILY_PICKS,

        cacheValid,

        analyzing: !!building,

        dailyDate,

        lastUpdate,

        error: lastError
    });
});

/*
|--------------------------------------------------------------------------
| /health
|--------------------------------------------------------------------------
*/

app.get("/health", (req, res) => {
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        status: "ok",

        ai: "ACTIVE",

        version: VERSION,

        analyses: cache.length,

        dailyPicks: cache.length,

        analyzing: !!building,

        dailyDate,

        lastStatus,

        lastError,

        lastUpdate
    });
});

/*
|--------------------------------------------------------------------------
| VERSION
|--------------------------------------------------------------------------
*/

app.get("/__king_version", (req, res) => {
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        project:
            "KING PREDICTIONS AI",

        version: VERSION,

        frontend: "V1",

        mode:
            "INTELLIGENT DAILY PICKS",

        dailyPicks:
            "3-4",

        postAnalysisSelection:
            true,

        exactScoreAsBet:
            false,

        timezone:
            "Africa/Brazzaville",

        dateMode:
            "CURRENT_LOCAL_DAY",

        timestamp:
            new Date().toISOString()
    });
});

/*
|--------------------------------------------------------------------------
| AUTOMATIC DAILY REFRESH
|--------------------------------------------------------------------------
|
| Au lieu de simplement attendre 24h après le démarrage,
| on vérifie régulièrement si le jour a changé.
|
| Cela évite le problème :
|
| serveur lancé le 03 à 20h
| +24h -> 04 à 20h
|
| qui aurait fait travailler l'IA avec un mauvais cycle.
|
| Ici le système détecte le changement de date.
|
|--------------------------------------------------------------------------
*/

function startDailyWatcher() {
    let watcherDate = getToday();

    console.log(
        "🕐 DAILY WATCHER STARTED:",
        watcherDate
    );

    setInterval(async () => {
        const currentDate = getToday();

        if (currentDate !== watcherDate) {
            console.log(
                "🌅 NEW DAY DETECTED:",
                currentDate
            );

            watcherDate = currentDate;

            /*
            |--------------------------------------------------------------------------
            | On invalide immédiatement l'ancien jour
            |--------------------------------------------------------------------------
            */

            dailyDate = currentDate;

            cache = [];

            cacheTime = 0;

            cacheValid = false;

            lastStatus = "NEW_DAY";

            /*
            |--------------------------------------------------------------------------
            | Nouvelle analyse du nouveau jour
            |--------------------------------------------------------------------------
            */

            await refreshDaily();
        }

    }, 60 * 1000);
}

/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

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
            "Africa/Brazzaville"
        );

        console.log(
            "🎯 DAILY PICKS:",
            `${MIN_DAILY_PICKS}-${MAX_DAILY_PICKS}`
        );

        console.log(
            "🧠 POST-ANALYSIS BET SELECTION: ON"
        );

        console.log(
            "🚫 EXACT SCORE AS BET: OFF"
        );

        console.log(
            "📅 CURRENT DAY MODE: ON"
        );

        try {
            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );

            /*
            |--------------------------------------------------------------------------
            | PREMIÈRE ANALYSE DU JOUR
            |--------------------------------------------------------------------------
            */

            await buildDailyAnalysis();

            console.log(
                "✅ FIRST DAILY ANALYSIS FINISHED"
            );

            /*
            |--------------------------------------------------------------------------
            | SURVEILLANCE DU CHANGEMENT DE JOUR
            |--------------------------------------------------------------------------
            */

            startDailyWatcher();

            console.log(
                "🚀 KING V1 READY"
            );

        } catch (err) {
            console.error(
                "❌ STARTUP:",
                err.stack
            );
        }
    }
);
