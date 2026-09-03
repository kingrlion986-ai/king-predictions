const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const {
    getTeamElo,
    calculateEloProbability
} = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");
const { buildLearningModel } = require("./learningEngine");

const CACHE = new Map();

const TTL = 10 * 60 * 1000;
const EMPTY_CACHE_TTL = 2 * 60 * 1000;

const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, Number(n) || 0));

const normalize = value =>
    String(value || "")
        .trim()
        .toUpperCase()
        .replace(/_/g, " ");

function getWinner(match, probabilities) {

    const values = [
        ["HOME", Number(probabilities?.homeWin || 0)],
        ["DRAW", Number(probabilities?.draw || 0)],
        ["AWAY", Number(probabilities?.awayWin || 0)]
    ].sort((a, b) => b[1] - a[1]);

    if (values[0][0] === "HOME")
        return match.homeTeam.name;

    if (values[0][0] === "AWAY")
        return match.awayTeam.name;

    return "DRAW";
}


/* =========================
   STRICT FILTER
========================= */

function strictFilter(
    probability,
    confidence,
    risk,
    separation
) {

    const normalizedRisk = normalize(risk);

    if (normalizedRisk === "VERY HIGH")
        return false;

    if (probability < 65)
        return false;

    if (confidence < 60)
        return false;

    if (separation < 10)
        return false;

    return true;
}


/* =========================
   RISK
========================= */

function calculateRisk(
    favorite,
    separation,
    confidence
) {

    if (
        favorite >= 75 &&
        separation >= 15 &&
        confidence >= 70
    ) {
        return "LOW";
    }

    if (
        favorite >= 65 &&
        separation >= 12 &&
        confidence >= 65
    ) {
        return "MEDIUM";
    }

    if (
        favorite >= 55 &&
        separation >= 8 &&
        confidence >= 55
    ) {
        return "HIGH";
    }

    return "VERY HIGH";
}


/* =========================
   ANALYSE
========================= */

async function analyzeMatch(match) {

    if (
        !match?.homeTeam?.id ||
        !match?.awayTeam?.id
    ) {
        return null;
    }

    if (
        match.status !== "SCHEDULED" &&
        match.status !== "TIMED"
    ) {
        return null;
    }

    const key =
        `${match.homeTeam.id}_${match.awayTeam.id}_${match.utcDate}`;

    const cached = CACHE.get(key);

    if (cached) {

        const age = Date.now() - cached.time;

        const cacheTTL =
            cached.data === null
                ? EMPTY_CACHE_TTL
                : TTL;

        if (age < cacheTTL)
            return cached.data;
    }


    try {

        /* =========================
           TEAM ANALYSIS
        ========================= */

        const [
            homeStats,
            awayStats
        ] = await Promise.all([
            analyzeTeam(match.homeTeam),
            analyzeTeam(match.awayTeam)
        ]);


        if (!homeStats || !awayStats) {

            console.log(
                `⚠️ TEAM DATA INSUFFISANT → ` +
                `${match.homeTeam.name} vs ${match.awayTeam.name}`
            );

            CACHE.set(key, {
                time: Date.now(),
                data: null
            });

            return null;
        }


        /* =========================
           DATA QUALITY
        ========================= */

        const homePlayed =
            Number(homeStats.played || 0);

        const awayPlayed =
            Number(awayStats.played || 0);

        const played =
            Math.min(homePlayed, awayPlayed);

        let dataQuality = "HIGH";

        if (played < 3)
            dataQuality = "LOW";
        else if (played < 5)
            dataQuality = "LIMITED";


        /*
         * IMPORTANT :
         * On ne bloque plus automatiquement
         * l'analyse si played < 5.
         *
         * Le manque de données est signalé
         * dans dataQuality.
         */

        if (played < 1) {

            console.log(
                `⚠️ AUCUN MATCH HISTORIQUE → ` +
                `${match.homeTeam.name} vs ${match.awayTeam.name}`
            );

            CACHE.set(key, {
                time: Date.now(),
                data: null
            });

            return null;
        }


        /* =========================
   ELO
========================= */

const homeElo =
    Number(getTeamElo(match.homeTeam.id)) || 1500;

const awayElo =
    Number(getTeamElo(match.awayTeam.id)) || 1500;

const eloProbability =
    clamp(
        calculateEloProbability(
            homeElo,
            awayElo
        ),
        0,
        1
    );

/*
 * ELO produit actuellement une probabilité
 * HOME entre 0 et 1.
 *
 * Pour la confiance, on conserve également
 * l'orientation AWAY.
 */
const eloProbabilities = {
    home: eloProbability,
    draw: 0.50,
    away: 1 - eloProbability
};

        /* =========================
           EXPECTED GOALS
        ========================= */

        const xg =
            calculateExpectedGoals(
                homeStats,
                awayStats,
                {
                    home: homeElo,
                    away: awayElo
                }
            );

        if (
            !xg ||
            !Number.isFinite(Number(xg.expectedHomeGoals)) ||
            !Number.isFinite(Number(xg.expectedAwayGoals))
        ) {

            console.log(
                `⚠️ XG INVALIDE → ` +
                `${match.homeTeam.name} vs ${match.awayTeam.name}`
            );

            CACHE.set(key, {
                time: Date.now(),
                data: null
            });

            return null;
        }


        /* =========================
           POISSON
        ========================= */

        const poisson =
            buildPoissonMatrix(
                xg.expectedHomeGoals,
                xg.expectedAwayGoals
            );

        if (!poisson?.probabilities) {

            console.log(
                `⚠️ POISSON INVALIDE → ` +
                `${match.homeTeam.name} vs ${match.awayTeam.name}`
            );

            CACHE.set(key, {
                time: Date.now(),
                data: null
            });

            return null;
        }


        const probabilities =
            poisson.probabilities;

        const eloFavoriteProbability =
    (() => {

        const home =
            Number(probabilities.homeWin || 0);

        const draw =
            Number(probabilities.draw || 0);

        const away =
            Number(probabilities.awayWin || 0);

        if (
            home >= draw &&
            home >= away
        ) {
            return eloProbabilities.home;
        }

        if (away >= home && away >= draw) {
            return eloProbabilities.away;
        }

        return eloProbabilities.draw;
    })();


        /* =========================
           CONFIDENCE
        ========================= */

        const confidence =
            clamp(
                calculateConfidence({
    probabilities,
    homeStats,
    awayStats,
    eloProbability: eloFavoriteProbability,
    poisson
}),
                0,
                100
            );


        /* =========================
           WINNER
        ========================= */

        const winner =
            getWinner(
                match,
                probabilities
            );


        const values = [
            Number(probabilities.homeWin || 0),
            Number(probabilities.draw || 0),
            Number(probabilities.awayWin || 0)
        ].sort((a, b) => b - a);


        const favorite =
            clamp(values[0], 0, 100);

        const second =
            clamp(values[1], 0, 100);

        const separation =
            Math.max(
                0,
                favorite - second
            );


        /* =========================
           RISK
        ========================= */

        const risk =
            calculateRisk(
                favorite,
                separation,
                confidence
            );


        /* =========================
           MARKETS
        ========================= */

        const overRaw =
            clamp(
                Number(poisson.over25 || 0),
                0,
                100
            );

        const bttsRaw =
            clamp(
                Number(poisson.btts || 0),
                0,
                100
            );


        const over25 =
            overRaw >= 50
                ? "OVER 2.5"
                : "UNDER 2.5";


        const btts =
            bttsRaw >= 50
                ? "OUI"
                : "NON";


        const over25Confidence =
    Math.round(
        Math.max(
            overRaw,
            100 - overRaw
        )
    );


        const bttsConfidence =
            Math.round(
                Math.max(
                    bttsRaw,
                    100 - bttsRaw
                )
            );


        /* =========================
           1X2 FILTER
        ========================= */

        const winnerAllowed =
            dataQuality !== "LOW" &&
            strictFilter(
                favorite,
                confidence,
                risk,
                separation
            );


        /* =========================
           AI RATING
        ========================= */

        const aiRating =
            Math.round(
                clamp(
                    confidence * 0.50 +
                    favorite * 0.35 +
                    separation * 1.5,
                    0,
                    100
                )
            );


        /* =========================
           LEARNING
        ========================= */

        let learning = null;

        try {

            if (typeof buildLearningModel === "function")
                learning = buildLearningModel();

        } catch (error) {

            console.log(
                "⚠️ LEARNING ERROR:",
                error.message
            );
        }


        /* =========================
           FINAL RESULT
        ========================= */

        const result = {

            match: {
                id: match.id,
                utcDate: match.utcDate,
                status: match.status,
                competition: match.competition,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam
            },


            predictions: {

                winner,

                /*
                 * Confidence globale du modèle.
                 */
                confidence,

                /*
                 * Probabilités 1X2 produites
                 * par Poisson.
                 */
                probabilities,

                winnerConfidence:
                    Math.round(favorite),

                winnerDecision:
                    winnerAllowed
                        ? "VIP PICK"
                        : "NO BET",

                winnerRisk:
                    winnerAllowed
                        ? risk
                        : "VERY HIGH",

                winnerAIScore:
                    winnerAllowed
                        ? aiRating
                        : 0,

                over25,

                over25Confidence,

                btts,

                bttsConfidence,

                correctScore:
                    poisson.exactScore?.score || null,

                correctScoreProbability:
                    poisson.exactScore?.probability || 0,

                aiRating,

                predictionStrength:
                    aiRating,

                quality:
                    winnerAllowed
                        ? dataQuality === "HIGH"
                            ? "HIGH"
                            : "LIMITED DATA"
                        : "NO BET",

                dataQuality,

                matchesUsed:
                    played
            },


            teamStats: {

                home: homeStats,
                away: awayStats
            },


            model: {
    elo: {
        home: homeElo,
        away: awayElo,

        homeProbability:
            Math.round(
                eloProbability * 100
            ),

        awayProbability:
            Math.round(
                (1 - eloProbability) * 100
            )
    },

                

                expectedGoals:
                    xg.totalExpectedGoals,

                expectedHomeGoals:
                    xg.expectedHomeGoals,

                expectedAwayGoals:
                    xg.expectedAwayGoals,

                poissonMatrix:
                    poisson.matrix,

                learning
            },


            marketScores: {

    oneXtwo:
        winnerAllowed
            ? aiRating
            : 0,

    over25:
        over25Confidence >= 65
            ? over25Confidence
            : 0,

    btts:
        bttsConfidence >= 65
            ? bttsConfidence
            : 0
},


            vipAllowed:
                winnerAllowed
        };


        CACHE.set(key, {
            time: Date.now(),
            data: result
        });


        console.log(
            `👑 ${match.homeTeam.name} vs ${match.awayTeam.name}`,
            `| ${winner}`,
            `| ${favorite.toFixed(2)}%`,
            `| CONF ${confidence}%`,
            `| ${risk}`,
            `| DATA ${dataQuality}`,
            `| ${winnerAllowed ? "VIP PICK" : "NO BET"}`
        );


        return result;


    } catch (error) {

        console.error(
            `❌ ANALYSE ERROR → ` +
            `${match.homeTeam.name} vs ${match.awayTeam.name}`,
            error.message
        );

        CACHE.set(key, {
            time: Date.now(),
            data: null
        });

        return null;
    }
}


module.exports = {
    analyzeMatch
};
