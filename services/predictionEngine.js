const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const { getTeamElo, calculateEloProbability } = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");

const CACHE = new Map();
const TTL = 10 * 60 * 1000;

const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, Number(n) || 0));

function getMarket(probability, yes, no) {
    return probability >= 50
        ? { option: yes, probability }
        : { option: no, probability: 100 - probability };
}

function buildAnalysis(bet, xg, confidence) {

    if (bet.type === "OVER_UNDER") {
        return xg >= 3
            ? "Les données offensives et le modèle de buts indiquent une forte tendance vers un match ouvert."
            : "Le modèle estime un volume de buts intéressant pour ce match.";
    }

    if (bet.type === "BTTS") {
        return bet.option === "BTTS Oui"
            ? "Les deux équipes présentent une capacité suffisante à trouver le chemin des filets."
            : "Le modèle indique une probabilité limitée de voir les deux équipes marquer.";
    }

    if (bet.type === "DOUBLE_CHANCE") {
        return "La combinaison des probabilités du modèle et de la solidité des équipes favorise cette couverture.";
    }

    return "L'analyse combinée des forces des équipes, de l'Elo et du modèle Poisson favorise ce résultat.";
}

function selectBestBet(poisson, confidence, homeStats, awayStats) {

    const candidates = [];

    const p = poisson.probabilities;

    const home = Number(p.homeWin || 0);
    const draw = Number(p.draw || 0);
    const away = Number(p.awayWin || 0);

    const over25 = Number(poisson.over25 || 0);
    const btts = Number(poisson.btts || 0);

    const overMarket = getMarket(
        over25,
        "Over 2.5",
        "Under 2.5"
    );

    const bttsMarket = getMarket(
        btts,
        "BTTS Oui",
        "BTTS Non"
    );

    const doubleHome = home + draw;
    const doubleAway = away + draw;

    const strongest1X2 = Math.max(home, draw, away);

    if (strongest1X2 >= 62) {

        let option = "Victoire domicile";

        if (draw === strongest1X2)
            option = "Match nul";

        if (away === strongest1X2)
            option = "Victoire extérieure";

        candidates.push({
            type: "RESULT",
            option,
            probability: strongest1X2,
            score: strongest1X2 + confidence * 0.25
        });
    }

    if (doubleHome >= 70) {
        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "1X",
            probability: doubleHome,
            score: doubleHome + confidence * 0.20
        });
    }

    if (doubleAway >= 70) {
        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "X2",
            probability: doubleAway,
            score: doubleAway + confidence * 0.20
        });
    }

    if (overMarket.probability >= 68) {
        candidates.push({
            type: "OVER_UNDER",
            option: overMarket.option,
            probability: overMarket.probability,
            score: overMarket.probability + confidence * 0.30
        });
    }

    if (bttsMarket.probability >= 68) {
        candidates.push({
            type: "BTTS",
            option: bttsMarket.option,
            probability: bttsMarket.probability,
            score: bttsMarket.probability + confidence * 0.30
        });
    }

    if (!candidates.length)
        return null;

    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];

    return {
        type: best.type,
        option: best.option,
        probability: Math.round(best.probability),
        score: Math.round(best.score)
    };
}

async function analyzeMatch(match) {

    if (!match?.homeTeam?.id || !match?.awayTeam?.id)
        return null;

    if (!["SCHEDULED", "TIMED"].includes(match.status))
        return null;

    const key = `${match.id}_${match.utcDate}`;

    const cached = CACHE.get(key);

    if (cached && Date.now() - cached.time < TTL)
        return cached.data;

    try {

        const [homeStats, awayStats] = await Promise.all([
            analyzeTeam(match.homeTeam),
            analyzeTeam(match.awayTeam)
        ]);

        if (!homeStats || !awayStats)
            return null;

        const homeElo = Number(getTeamElo(match.homeTeam.id)) || 1500;
        const awayElo = Number(getTeamElo(match.awayTeam.id)) || 1500;

        const eloProbability = clamp(
            calculateEloProbability(homeElo, awayElo),
            0,
            1
        );

        const xg = calculateExpectedGoals(
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
            return null;
        }

        const poisson = buildPoissonMatrix(
            xg.expectedHomeGoals,
            xg.expectedAwayGoals
        );

        if (!poisson?.probabilities)
            return null;

        const confidence = clamp(
            calculateConfidence({
                probabilities: poisson.probabilities,
                homeStats,
                awayStats,
                eloProbability,
                poisson
            }),
            0,
            100
        );

        const selectedBet = selectBestBet(
            poisson,
            confidence,
            homeStats,
            awayStats
        );

        if (!selectedBet)
            return null;

        const dataQuality =
            Math.min(
                Number(homeStats.played || 0),
                Number(awayStats.played || 0)
            ) >= 5
                ? "HIGH"
                : "LIMITED";

        const qualityScore = Math.round(
            clamp(
                selectedBet.probability * 0.55 +
                confidence * 0.30 +
                Number(poisson.matchScore || 0) * 0.15,
                0,
                100
            )
        );

        const result = {

            match: {
                id: match.id,
                utcDate: match.utcDate,
                competition: match.competition,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam
            },

            selectedBet: {
                type: selectedBet.type,
                option: selectedBet.option
            },

            analysis: buildAnalysis(
                selectedBet,
                Number(poisson.expectedGoals || xg.expectedHomeGoals + xg.expectedAwayGoals),
                confidence
            ),

            qualityScore,

            internal: {
                probability: selectedBet.probability,
                confidence,
                dataQuality,
                expectedGoals: Number(
                    (
                        xg.expectedHomeGoals +
                        xg.expectedAwayGoals
                    ).toFixed(2)
                ),
                poisson
            }
        };

        CACHE.set(key, {
            time: Date.now(),
            data: result
        });

        return result;

    } catch (error) {

        console.error(
            `❌ Prediction error ${match.homeTeam?.name} vs ${match.awayTeam?.name}:`,
            error.message
        );

        return null;
    }
}

module.exports = {
    analyzeMatch
};
