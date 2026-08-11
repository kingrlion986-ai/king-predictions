const { analyzeTeam } = require("./teamAnalyzer");

const { buildPoissonMatrix } =
    require("./poissonEngine");

const {
    getTeamElo,
    calculateEloProbability,
    updateMatchElo
} = require("./eloEngine");

const {
    calculateExpectedGoals
} = require("./expectedGoals");

const {
    calculateConfidence
} = require("./confidenceEngine");

const {
    savePrediction
} = require("./historyEngine");

const {
    evaluateDecision
} = require("./decisionEngine");

const {
    buildLearningModel
} = require("./learningEngine");

const {
    getWeights
} = require("./adaptiveWeightEngine");


/* =========================
   CACHE
========================= */

const ANALYSIS_CACHE = new Map();

const ANALYSIS_TTL =
    24 * 60 * 60 * 1000;


/* =========================
   MATCH KEY
========================= */

function getMatchKey(match) {

    return (
        match.homeTeam.id +
        "_" +
        match.awayTeam.id +
        "_" +
        match.utcDate
    );

}


/* =========================
   MAIN ANALYZER
========================= */

async function analyzeMatch(match) {

    console.log(
        "START ANALYSIS:",
        match.homeTeam.name,
        "vs",
        match.awayTeam.name
    );

    const timer =
        `${match.homeTeam.name} vs ${match.awayTeam.name}`;

    console.time(timer);


    /* =========================
       CACHE
    ========================= */

    const key =
        getMatchKey(match);

    const cached =
        ANALYSIS_CACHE.get(key);

    if (
        cached &&
        Date.now() - cached.time < ANALYSIS_TTL
    ) {

        console.log(
            "♻️ CACHE USED:",
            match.homeTeam.name,
            "vs",
            match.awayTeam.name
        );

        return cached.data;
    }


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


    /* =========================
       ELO
    ========================= */

    const homeElo =
        getTeamElo(match.homeTeam.id);

    const awayElo =
        getTeamElo(match.awayTeam.id);


    const eloProbability =
        calculateEloProbability(
            homeElo,
            awayElo
        );


    console.log("===== ELO DEBUG =====");

    console.log(
        match.homeTeam.name,
        "ELO:",
        homeElo
    );

    console.log(
        match.awayTeam.name,
        "ELO:",
        awayElo
    );

    console.log(
        "ELO PROBABILITY:",
        Math.round(
            eloProbability * 100
        )
    );

    console.log("=====================");


    /* =========================
       WEIGHTS
    ========================= */

    const weights =
        getWeights();


    /* =========================
       EXPECTED GOALS
    ========================= */

    console.log("2 - XG");

    console.log(
        "HOME STATS =",
        {
            attackPower:
                homeStats.attackPower,

            defensePower:
                homeStats.defensePower,

            homeAttack:
                homeStats.homeAttack,

            homeDefense:
                homeStats.homeDefense,

            avgScored:
                homeStats.avgScored,

            avgConceded:
                homeStats.avgConceded,

            formPoints:
                homeStats.formPoints,

            strength:
                homeStats.strength
        }
    );


    console.log(
        "AWAY STATS =",
        {
            attackPower:
                awayStats.attackPower,

            defensePower:
                awayStats.defensePower,

            awayAttack:
                awayStats.awayAttack,

            awayDefense:
                awayStats.awayDefense,

            avgScored:
                awayStats.avgScored,

            avgConceded:
                awayStats.avgConceded,

            formPoints:
                awayStats.formPoints,

            strength:
                awayStats.strength
        }
    );

    /* =========================
   DATA VALIDATION
========================= */

if (
    !homeStats ||
    !awayStats ||
    Number(homeStats.played || 0) < 5 ||
    Number(awayStats.played || 0) < 5
) {
    console.log(
        "🚫 MATCH REJECTED - INSUFFICIENT TEAM DATA"
    );

    console.log(
        "HOME:",
        match.homeTeam.name,
        "| MATCHES:",
        homeStats?.played ?? 0
    );

    console.log(
        "AWAY:",
        match.awayTeam.name,
        "| MATCHES:",
        awayStats?.played ?? 0
    );

    console.timeEnd(timer);

    return null;
}

        /* =========================
       TEAM DATA VALIDATION
    ========================= */

    if (
        !homeStats ||
        !awayStats ||
        Number(homeStats.played || 0) < 5 ||
        Number(awayStats.played || 0) < 5
    ) {

        console.log(
            "🚫 MATCH REJECTED - INSUFFICIENT TEAM DATA"
        );

        console.log(
            "HOME:",
            match.homeTeam.name,
            "| MATCHES:",
            homeStats?.played ?? 0
        );

        console.log(
            "AWAY:",
            match.awayTeam.name,
            "| MATCHES:",
            awayStats?.played ?? 0
        );

        console.timeEnd(timer);

        return null;
    }


    /* =========================
       ELO
    ========================= */

    const homeElo =
        getTeamElo(match.homeTeam.id);

    const awayElo =
        getTeamElo(match.awayTeam.id);

    const eloProbability =
        calculateEloProbability(
            homeElo,
            awayElo
        );


    console.log("===== ELO DEBUG =====");

    console.log(
        match.homeTeam.name,
        "ELO:",
        homeElo
    );

    console.log(
        match.awayTeam.name,
        "ELO:",
        awayElo
    );

    console.log(
        "ELO PROBABILITY:",
        Math.round(
            eloProbability * 100
        )
    );

    console.log("=====================");


    /* =========================
       WEIGHTS
    ========================= */

    const weights =
        getWeights();


    /* =========================
       EXPECTED GOALS
    ========================= */

    console.log("2 - XG");

    console.log(
        "HOME STATS =",
        {
            attackPower:
                homeStats.attackPower,

            defensePower:
                homeStats.defensePower,

            homeAttack:
                homeStats.homeAttack,

            homeDefense:
                homeStats.homeDefense,

            avgScored:
                homeStats.avgScored,

            avgConceded:
                homeStats.avgConceded,

            formPoints:
                homeStats.formPoints,

            strength:
                homeStats.strength
        }
    );


    console.log(
        "AWAY STATS =",
        {
            attackPower:
                awayStats.attackPower,

            defensePower:
                awayStats.defensePower,

            awayAttack:
                awayStats.awayAttack,

            awayDefense:
                awayStats.awayDefense,

            avgScored:
                awayStats.avgScored,

            avgConceded:
                awayStats.avgConceded,

            formPoints:
                awayStats.formPoints,

            strength:
                awayStats.strength
        }
    );


    const xg =
        calculateExpectedGoals(
            homeStats,
            awayStats,
            {
                home: homeElo,
                away: awayElo
            }
        );


    console.log(
        "XG =",
        xg
    );


    /* =========================
       POISSON
    ========================= */

    console.log("3 - POISSON");

    const poisson =
        buildPoissonMatrix(

            xg.expectedHomeGoals,

            xg.expectedAwayGoals

        );

    console.log(
        "POISSON DEBUG:",
        poisson.uncertainty,
        poisson.dominance
    );

/* =========================
   EXPECTED GOALS
========================= */

console.log("2 - XG");

const xg =
    calculateExpectedGoals(
        homeStats,
        awayStats,
        {
            home: homeElo,
            away: awayElo
        }
    );

console.log(
    "XG =",
    xg
);

    /* =========================
       POISSON
    ========================= */

    console.log("3 - POISSON");


    const poisson =
        buildPoissonMatrix(

            xg.expectedHomeGoals,

            xg.expectedAwayGoals

        );


    console.log(
        "POISSON DEBUG:",
        poisson.uncertainty,
        poisson.dominance
    );


    /* =========================
       CONFIDENCE V20
    ========================= */

    console.log("5 - CONFIDENCE");


    const confidence =
        calculateConfidence({

            probabilities:
                poisson.probabilities,

            homeStats,

            awayStats,

            eloProbability,

            poisson

        });


    /*
    IMPORTANT

    On NE modifie plus confidence.

    Pas de :
        confidence * learningWeight

    Pas de :
        + dominance

    Pas de :
        + strength bonus

    Pas de :
        + probability bonus

    La confiance reste celle
    calculée par Confidence Engine.
    */


    const adjustedConfidence =
        confidence;


    /* =========================
       LEARNING
    ========================= */

    console.log("4 - LEARNING");


    const learning =
        buildLearningModel();


    /* =========================
       PREDICTION QUALITY
    ========================= */

    let predictionQuality =
        "LOW";


    if (adjustedConfidence >= 70) {

        predictionQuality =
            "HIGH";

    }

    else if (adjustedConfidence >= 55) {

        predictionQuality =
            "MEDIUM";

    }

    else {

        predictionQuality =
            "LOW";

    }


    console.log(
        "🎯 CALIBRATED CONFIDENCE:",
        adjustedConfidence
    );


    /* =========================
       WINNER PROBABILITIES
    ========================= */

    const homeProbability =

        (
            poisson.probabilities.homeWin
            * 0.50
        )

        +

        (
            eloProbability
            * 100
            * 0.25
        )

        +

        (
            homeStats.strength
            * 0.15
        )

        +

        (
            homeStats.formScore
            * 0.10
        );


    const awayProbability =

        (
            poisson.probabilities.awayWin
            * 0.50
        )

        +

        (
            (1 - eloProbability)
            * 100
            * 0.25
        )

        +

        (
            awayStats.strength
            * 0.15
        )

        +

        (
            awayStats.formScore
            * 0.10
        );


    /*
    DRAW :

    Le nul doit rester fortement
    lié au modèle Poisson.

    On évite de fabriquer
    artificiellement un gros
    pourcentage de nul.
    */

    const drawProbability =

        (
            poisson.probabilities.draw
            * 0.85
        )

        +

        (
            Math.max(
                0,
                15 -
                Math.abs(
                    homeStats.strength -
                    awayStats.strength
                )
            )
            * 0.15
        );


    /* =========================
       WINNER
    ========================= */

    let winner =
        "DRAW";


    const winnerGap =
        Math.abs(
            homeProbability -
            awayProbability
        );


    /*
    Si les probabilités sont
    très proches, on privilégie
    le nul seulement si Poisson
    donne également un nul solide.
    */

    if (
        winnerGap < 5 &&
        drawProbability >=
            Math.max(
                homeProbability,
                awayProbability
            ) - 3
    ) {

        winner =
            "DRAW";

    }

    else if (
        homeProbability >
        awayProbability
    ) {

        winner =
            match.homeTeam.name;

    }

    else {

        winner =
            match.awayTeam.name;

    }


    /* =========================
       OVER 2.5
    ========================= */

    let overScore =

        (
            poisson.over25
            * 0.50
        )

        +

        (
            (
                homeStats.over25Rate +
                awayStats.over25Rate
            ) / 2
            * 0.20
        )

        +

        (
            Math.min(
                xg.totalExpectedGoals,
                4
            ) / 4
            * 100
            * 0.20
        )

        +

        (
            (
                homeStats.reliability +
                awayStats.reliability
            ) / 2
            * 100
            * 0.10
        );


    overScore =
        Math.max(
            5,
            Math.min(
                95,
                overScore
            )
        );


    const over25Prediction =

        overScore >= 55
            ? "OVER 2.5"
            : "UNDER 2.5";


    const over25Confidence =
        Math.round(overScore);


    /* =========================
       BTTS
    ========================= */

    let bttsScore =

        (
            poisson.btts
            * 0.50
        )

        +

        (
            (
                homeStats.bttsRate +
                awayStats.bttsRate
            ) / 2
            * 0.20
        )

        +

        (
            (
                homeStats.avgScored +
                awayStats.avgScored
            ) / 2
            * 15
            * 0.10
        )

        +

        (
            (
                homeStats.reliability +
                awayStats.reliability
            ) / 2
            * 100
            * 0.10
        )

        +

        (
            Math.min(
                xg.totalExpectedGoals,
                4
            ) / 4
            * 100
            * 0.10
        );


    bttsScore =
        Math.max(
            5,
            Math.min(
                95,
                bttsScore
            )
        );


    const bttsPrediction =

        bttsScore >= 55
            ? "OUI"
            : "NON";


    const bttsConfidence =
        Math.round(bttsScore);


    /* =========================
       CORRECT SCORE
    ========================= */

    const goalDiff =
        Math.abs(
            homeStats.strength -
            awayStats.strength
        );


    let correctScore =
        poisson.exactScore.score;


    /*
    Match très ouvert
    */

    if (
        xg.totalExpectedGoals >= 3.2
    ) {

        if (
            winner ===
            match.homeTeam.name
        ) {

            correctScore =
                "2-1";

        }

        else if (
            winner ===
            match.awayTeam.name
        ) {

            correctScore =
                "1-2";

        }

        else {

            correctScore =
                "2-2";

        }

    }


    /*
    Forte différence
    */

    else if (
        goalDiff >= 20
    ) {

        if (
            winner ===
            match.homeTeam.name
        ) {

            correctScore =
                "2-0";

        }

        else if (
            winner ===
            match.awayTeam.name
        ) {

            correctScore =
                "0-2";

        }

    }


    /*
    Match fermé
    */

    else if (
        xg.totalExpectedGoals <= 2
    ) {

        if (
            winner === "DRAW"
        ) {

            correctScore =
                "0-0";

        }

        else if (
            winner ===
            match.homeTeam.name
        ) {

            correctScore =
                "1-0";

        }

        else {

            correctScore =
                "0-1";

        }

    }


    console.log(
        "OVER CONF:",
        over25Confidence
    );

    console.log(
        "BTTS CONF:",
        bttsConfidence
    );


    /* =========================
       FINAL AI SCORE
    ========================= */

    /*
    Le score AI est indépendant
    de la confidence.

    IMPORTANT :
    poisson.dominance est déjà
    exprimée sur une échelle
    de 0-100.

    On ne fait donc PAS :

        dominance * 100

    */

    const finalAIScore =

        (
            adjustedConfidence
            * 0.45
        )

        +

        (
            poisson.dominance
            * 0.20
        )

        +

        (
            (
                homeStats.stability +
                awayStats.stability
            ) / 2
            * 0.15
        )

        +

        (
            (
                homeStats.reliability +
                awayStats.reliability
            ) * 50
            * 0.20
        );


    const aiRating =
        Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    finalAIScore
                )
            )
        );


    /* =========================
       DECISION ENGINE V22
    ========================= */

    const aiDecision =
        evaluateDecision({

            confidence:
                adjustedConfidence,

            poisson,

            homeStats,

            awayStats,

            eloProbability,

            winner

        });


    console.log(
        "👑 AI DECISION:",
        aiDecision.decision,
        "| RISK:",
        aiDecision.risk,
        "| SCORE:",
        aiDecision.score
    );


    /* =========================
       PREDICTION STRENGTH
    ========================= */

    const predictionStrength =

        Math.round(

            (
                aiRating +
                adjustedConfidence +
                poisson.matchScore
            ) / 3

        );


    /* =========================
       FINAL RESULT
    ========================= */

    const result = {

        match: {

            id:
                match.id,

            utcDate:
                match.utcDate,

            competition:
                match.competition,

            homeTeam:
                match.homeTeam,

            awayTeam:
                match.awayTeam

        },


        predictions: {

            winner,

            winnerConfidence:
                adjustedConfidence,

            aiDecision,

            aiRating,

            predictionStrength,

            quality:
                predictionQuality,


            probabilities:
                poisson.probabilities,


            over25:
                over25Prediction,

            over25Confidence,


            btts:
                bttsPrediction,

            bttsConfidence,


            correctScore,

            correctScoreProbability:
                poisson.exactScore.probability

        },


        teamStats: {

            home:
                homeStats,

            away:
                awayStats

        },


        model: {

            elo: {

                home:
                    homeElo,

                away:
                    awayElo,

                homeProbability:
                    Math.round(
                        eloProbability * 100
                    )

            },


            learning,


            expectedGoals:
                xg.totalExpectedGoals,

            expectedHomeGoals:
                xg.expectedHomeGoals,

            expectedAwayGoals:
                xg.expectedAwayGoals,


            poissonMatrix:
                poisson.matrix

        }

    };


    /* =========================
       SAVE HISTORY
    ========================= */

    /*
    Désactivé actuellement.

    Si tu veux réactiver :

        savePrediction(result);

    */


    /* =========================
       UPDATE ELO
    ========================= */

    if (
        match.status === "FINISHED" &&
        match.score &&
        match.score.fullTime
    ) {

        updateMatchElo(

            match.homeTeam.id,

            match.awayTeam.id,

            match.score.fullTime.home,

            match.score.fullTime.away

        );

    }


    /* =========================
       CACHE RESULT
    ========================= */

    ANALYSIS_CACHE.set(

        key,

        {

            time:
                Date.now(),

            data:
                result

        }

    );


    console.log(
        "MATCH ANALYZED:",
        match.homeTeam.name,
        "vs",
        match.awayTeam.name
    );


    console.timeEnd(timer);


    return result;

}


/* =========================
   EXPORT
========================= */

module.exports = {

    analyzeMatch

};
