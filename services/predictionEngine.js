const { analyzeTeam } = require("./teamAnalyzer");
const { buildPoissonMatrix } = require("./poissonEngine");
const { getTeamElo, calculateEloProbability } = require("./eloEngine");
const { calculateExpectedGoals } = require("./expectedGoals");
const { calculateConfidence } = require("./confidenceEngine");

const CACHE = new Map();
const TTL = 10 * 60 * 1000;

const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, Number(n) || 0));

/*
====================================================
MARKET HELPERS
====================================================
*/

function getMarket(probability, yes, no) {

    const p = clamp(probability, 0, 100);

    return p >= 50
        ? {
            option: yes,
            probability: p
        }
        : {
            option: no,
            probability: 100 - p
        };
}

/*
====================================================
BET EXPLANATION
====================================================
*/

function buildAnalysis(bet, xg) {

    if (bet.type === "OVER_UNDER") {

    switch (bet.option) {

        case "Over 1.5":
            return "Le modèle privilégie un scénario avec au moins deux buts dans le match.";

        case "Under 1.5":
            return "Le modèle privilégie un scénario avec au maximum un but dans le match.";

        case "Over 2.5":
            return "Le modèle prévoit un scénario offensif avec une forte probabilité d'au moins trois buts.";

        case "Under 2.5":
            return "Le modèle privilégie un scénario où le total de buts reste inférieur à 3.";

        case "Over 3.5":
            return "Le modèle détecte un potentiel élevé pour un match avec au moins quatre buts.";

        case "Under 3.5":
            return "Le modèle privilégie un scénario où le total de buts reste inférieur à 4.";

        default:
            return "Le modèle identifie une tendance intéressante sur le nombre de buts.";
    }
    }

    if (bet.type === "BTTS") {

        if (bet.option === "BTTS Oui") {

            return "Les profils offensifs des deux équipes favorisent un scénario où chacune peut marquer.";
        }

        return "Le modèle estime qu'une des deux équipes présente un risque important de ne pas marquer.";
    }

    if (bet.type === "DOUBLE_CHANCE") {

        if (bet.option === "1X") {

            return "Les probabilités combinées favorisent une protection du résultat en faveur de l'équipe locale.";
        }

        if (bet.option === "X2") {

            return "Les probabilités combinées favorisent une protection du résultat en faveur de l'équipe extérieure.";
        }

        return "Les probabilités du modèle favorisent une couverture des deux résultats les plus probables.";
    }

    if (bet.type === "RESULT") {

        if (bet.option === "Victoire domicile") {

            return "L'analyse combinée de l'Elo, des forces d'équipe et du modèle Poisson favorise la victoire locale.";
        }

        if (bet.option === "Victoire extérieure") {

            return "L'analyse combinée de l'Elo, des forces d'équipe et du modèle Poisson favorise la victoire extérieure.";
        }

        return "Les probabilités du modèle indiquent une forte possibilité de match nul.";
    }

    return "L'analyse combinée des différents modèles favorise ce scénario.";
}

/*
====================================================
BET QUALITY
====================================================

Le but n'est PAS de prendre simplement
la probabilité la plus élevée.

On tient compte de :

- probabilité
- confiance
- stabilité du modèle
- risque
- matchScore
====================================================
*/

function calculateBetScore(
    probability,
    confidence,
    matchScore,
    risk
) {

    let score =
        probability * 0.60 +
        confidence * 0.20 +
        matchScore * 0.20;

    if (risk === "VERY HIGH")
        score -= 10;

    else if (risk === "HIGH")
        score -= 5;

    else if (risk === "MEDIUM")
        score -= 2;

    return score;
}

/*
====================================================
SELECT BEST BET
====================================================
*/

function selectBestBet(poisson, confidence) {

    if (!poisson?.probabilities)
        return null;

    const p = poisson.probabilities;

    const home = clamp(p.homeWin, 0, 100);
    const draw = clamp(p.draw, 0, 100);
    const away = clamp(p.awayWin, 0, 100);

    const over25 = clamp(poisson.over25, 0, 100);
    const btts = clamp(poisson.btts, 0, 100);

    const matchScore =
        clamp(poisson.matchScore, 0, 100);

    const risk =
        poisson.risk || "HIGH";

    const candidates = [];

    /*
    ================================================
    1X2
    ================================================
    */

    const resultCandidates = [
        {
            option: "Victoire domicile",
            probability: home
        },
        {
            option: "Match nul",
            probability: draw
        },
        {
            option: "Victoire extérieure",
            probability: away
        }
    ];

    const bestResult =
        resultCandidates.sort(
            (a, b) => b.probability - a.probability
        )[0];

    /*
    On évite les victoires trop incertaines.
    */

    if (bestResult.probability >= 55) {

        candidates.push({
            type: "RESULT",
            option: bestResult.option,
            probability: bestResult.probability,
            score: calculateBetScore(
                bestResult.probability,
                confidence,
                matchScore,
                risk
            )
        });
    }

    /*
    ================================================
    DOUBLE CHANCE
    ================================================
    */

    const oneX = home + draw;
    const xTwo = away + draw;
    const oneTwo = home + away;

    if (oneX >= 65) {

        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "1X",
            probability: oneX,
            score: calculateBetScore(
                oneX,
                confidence,
                matchScore,
                risk
            )
        });
    }

    if (xTwo >= 65) {

        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "X2",
            probability: xTwo,
            score: calculateBetScore(
                xTwo,
                confidence,
                matchScore,
                risk
            )
        });
    }

    if (oneTwo >= 65) {

        candidates.push({
            type: "DOUBLE_CHANCE",
            option: "12",
            probability: oneTwo,
            score: calculateBetScore(
                oneTwo,
                confidence,
                matchScore,
                risk
            )
        });
    }

// ================================================
// OVER / UNDER
// ================================================

const over15 = clamp(poisson.over15, 0, 100);
const over35 = clamp(poisson.over35, 0, 100);

const markets = [
    getMarket(over15, "Over 1.5", "Under 1.5"),
    getMarket(over25, "Over 2.5", "Under 2.5"),
    getMarket(over35, "Over 3.5", "Under 3.5")
];

for (const market of markets) {

    if (market.probability < 60)
        continue;

    candidates.push({
        type: "OVER_UNDER",
        option: market.option,
        probability: market.probability,
        score: calculateBetScore(
            market.probability,
            confidence,
            matchScore,
            risk
        )
    });
}

    /*
    ================================================
    BTTS
    ================================================
    */

    const bttsMarket =
        getMarket(
            btts,
            "BTTS Oui",
            "BTTS Non"
        );

    if (bttsMarket.probability >= 60) {

        candidates.push({
            type: "BTTS",
            option: bttsMarket.option,
            probability: bttsMarket.probability,
            score: calculateBetScore(
                bttsMarket.probability,
                confidence,
                matchScore,
                risk
            )
        });
    }

    /*
    ================================================
    AUCUN PARI
    ================================================
    */

    if (!candidates.length)
        return null;

    /*
    ================================================
    CLASSEMENT
    ================================================
    */

    candidates.sort(
        (a, b) => b.score - a.score
    );

    const best = candidates[0];

    /*
    ================================================
    FILTRE FINAL
    ================================================
    
    On ne force jamais un pari très faible.

    Même si une option existe, elle doit avoir
    une qualité minimale.
    ================================================
    */

    if (best.probability < 60)
        return null;

    if (best.score < 55)
        return null;

    return {
        type: best.type,
        option: best.option,
        probability: Math.round(best.probability),
        score: Math.round(best.score)
    };
}

/*
====================================================
ANALYZE MATCH
====================================================
*/

async function analyzeMatch(match) {

    if (!match?.homeTeam?.id || !match?.awayTeam?.id)
        return null;

    if (!["SCHEDULED", "TIMED"].includes(match.status))
        return null;

    const key =
        `${match.id}_${match.utcDate}`;

    const cached = CACHE.get(key);

    if (
        cached &&
        Date.now() - cached.time < TTL
    ) {
        return cached.data;
    }

    try {

        /*
        ============================================
        TEAM ANALYSIS
        ============================================
        */

        const [
            homeStats,
            awayStats
        ] = await Promise.all([

            analyzeTeam(match.homeTeam),

            analyzeTeam(match.awayTeam)

        ]);

        if (!homeStats || !awayStats)
            return null;

        /*
        ============================================
        ELO
        ============================================
        */

        const homeElo =
            Number(
                getTeamElo(match.homeTeam.id)
            ) || 1500;

        const awayElo =
            Number(
                getTeamElo(match.awayTeam.id)
            ) || 1500;

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
        ============================================
        EXPECTED GOALS
        ============================================
        */

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
            !Number.isFinite(
                Number(xg.expectedHomeGoals)
            ) ||
            !Number.isFinite(
                Number(xg.expectedAwayGoals)
            )
        ) {
            return null;
        }

        /*
        ============================================
        POISSON
        ============================================
        */

        const poisson =
            buildPoissonMatrix(
                xg.expectedHomeGoals,
                xg.expectedAwayGoals
            );

        if (!poisson?.probabilities)
            return null;

        /*
        ============================================
        CONFIDENCE
        ============================================
        */

        const confidence =
            clamp(
                calculateConfidence({
                    probabilities:
                        poisson.probabilities,

                    homeStats,

                    awayStats,

                    eloProbability,

                    poisson
                }),
                0,
                100
            );

        /*
        ============================================
        BEST BET
        ============================================
        */

        const selectedBet =
            selectBestBet(
                poisson,
                confidence
            );

        console.log(
    `🎯 SELECTED BET ${match.homeTeam.name} vs ${match.awayTeam.name}:`,
    selectedBet
);

        if (!selectedBet) {
    console.log(
        `🚫 NO BET: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
        {
            confidence,
            homeWin: poisson.probabilities.homeWin,
            draw: poisson.probabilities.draw,
            awayWin: poisson.probabilities.awayWin,
            over25: poisson.over25,
            btts: poisson.btts,
            matchScore: poisson.matchScore,
            risk: poisson.risk
        }
    );

    return null;
        }

        if (!selectedBet)
            return null;

        /*
        ============================================
        DATA QUALITY
        ============================================
        */

        const played =
            Math.min(
                Number(homeStats.played || 0),
                Number(awayStats.played || 0)
            );

        const dataQuality =
            played >= 5
                ? "HIGH"
                : "LIMITED";

       /*
============================================
QUALITY SCORE
============================================

Le Quality Score sert à CLASSER les matchs.

Les données limitées pénalisent la qualité,
mais ne détruisent pas complètement le score.

8 matchs → 100%
7 matchs → 98%
6 matchs → 96%
5 matchs → 94%
4 matchs → 90%
3 matchs → 85%
2 matchs → 78%
1 match  → 70%
*/

const dataFactorMap = {
    8: 1.00,
    7: 0.98,
    6: 0.96,
    5: 0.94,
    4: 0.90,
    3: 0.85,
    2: 0.78,
    1: 0.70
};

const dataFactor =
    dataFactorMap[
        Math.min(played, 8)
    ] || 0.65;

const baseQuality =
    selectedBet.probability * 0.55 +
    selectedBet.score * 0.25 +
    Number(
        poisson.matchScore || 0
    ) * 0.20;

const qualityScore =
    Math.round(
        clamp(
            baseQuality * dataFactor,
            0,
            100
        )
    ); 
        
        /*
        ============================================
        RESULT
        ============================================
        */

        const result = {

            match: {

                id: match.id,

                utcDate:
                    match.utcDate,

                competition:
                    match.competition,

                homeTeam:
                    match.homeTeam,

                awayTeam:
                    match.awayTeam

            },

            selectedBet: {

                type:
                    selectedBet.type,

                option:
                    selectedBet.option

            },

            analysis:
                buildAnalysis(
                    selectedBet,
                    Number(
                        poisson.expectedGoals ||
                        (
                            xg.expectedHomeGoals +
                            xg.expectedAwayGoals
                        )
                    )
                ),

            qualityScore,

            internal: {

                probability:
                    selectedBet.probability,

                confidence,

                dataQuality,

                expectedGoals:
                    Number(
                        (
                            xg.expectedHomeGoals +
                            xg.expectedAwayGoals
                        ).toFixed(2)
                    ),

                poisson

            }

        };

        CACHE.set(
            key,
            {
                time: Date.now(),
                data: result
            }
        );

        return result;

    } catch (error) {

        console.error(
            `❌ Prediction error ${match.homeTeam?.name} vs ${match.awayTeam?.name}:`,
            error.message
        );

        return null;
    }
}

/*
====================================================
EXPORT
====================================================
*/

module.exports = {
    analyzeMatch
};
