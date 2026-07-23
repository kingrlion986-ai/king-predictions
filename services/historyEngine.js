const {
    updateMatchElo
} = require("./eloEngine");

/* =========================
   HISTORY ENGINE V18
========================= */

const fs = require("fs");
const path = require("path");


const HISTORY_FILE =
    path.join(
        __dirname,
        "../history.json"
    );



/*
    Charger historique
*/

function loadHistory() {


    if (!fs.existsSync(HISTORY_FILE)) {

        return [];

    }


    try {

        return JSON.parse(
            fs.readFileSync(
                HISTORY_FILE,
                "utf8"
            )
        );

    }
    catch(error) {

        return [];

    }

}



/*
    Sauvegarder historique
*/

function saveHistory(history) {


    fs.writeFileSync(

        HISTORY_FILE,

        JSON.stringify(
            history,
            null,
            2
        )

    );

}



/*
    Enregistrer prédiction
*/

function savePrediction(prediction) {

    const history =
        loadHistory();

    const exists =
        history.some(
            h => h.id === prediction.match.id
        );

    if (exists) {
        return;
    }



    history.push({

        id:
            prediction.match.id,


        date:
            new Date()
            .toISOString(),


        match:
            prediction.match,


        prediction:
            prediction.predictions,

       teamStats: prediction.teamStats,

confidence:
prediction.predictions.winnerConfidence,

aiRating:
prediction.predictions.aiRating,

predictionStrength:
prediction.predictions.predictionStrength,


        model:
            prediction.model,


        result:
            null,


        evaluation:
            null


    });



    saveHistory(
        history
    );


}



/*
    Ajouter résultat réel
*/

function updateResult(
    matchId,
    result
) {


    const history =
        loadHistory();



    const item =
        history.find(
            h =>
            h.id === matchId
        );


    if (!item)
        return false;



    item.result =
        result;

   if (
    typeof result.homeGoals === "number" &&
    typeof result.awayGoals === "number"
) {

    updateMatchElo(

        item.match.homeTeam.id,

        item.match.awayTeam.id,

        result.homeGoals,

        result.awayGoals

    );

   }



    item.evaluation =
        evaluatePrediction(
            item,
            result
        );



    saveHistory(
        history
    );


    return true;

}





/*
    Evaluation
*/

function evaluatePrediction(
    item,
    result
) {


    const prediction =
        item.prediction;


return {

    winnerCorrect:
        prediction.winner === result.winner,

    scoreCorrect:
        prediction.correctScore === result.score,

    bttsCorrect:
        prediction.btts === result.btts,

    overCorrect:
        prediction.over25 === result.over25,

    globalScore:
        (
            (prediction.winner === result.winner ? 40 : 0) +
            (prediction.correctScore === result.score ? 30 : 0) +
            (prediction.btts === result.btts ? 15 : 0) +
            (prediction.over25 === result.over25 ? 15 : 0)
        )

};

}


/*
    Statistiques globales
*/

function getStatistics() {


    const history =
        loadHistory();



    const completed =
        history.filter(
            h =>
            h.evaluation
        );



    if (
        completed.length === 0
    ) {

        return {

            matches:0,

            accuracy:0

        };

    }



    const correct =
        completed.filter(
            h =>
            h.evaluation.winnerCorrect
        )
        .length;



    return {

        matches:
            completed.length,


        accuracy:
            Math.round(
                (
                    correct /
                    completed.length
                )
                *
                100
            )

    };


}

   function getLearningData() {

    const history = loadHistory();

    const completed =
        history.filter(
            h => h.evaluation
        );

    if (!completed.length) {

        return {

            winnerAccuracy: 0,
            averageScore: 0

        };

    }

    const winnerCorrect =
        completed.filter(
            h => h.evaluation.winnerCorrect
        ).length;

    const averageScore =
        completed.reduce(
            (sum, h) =>
                sum + h.evaluation.globalScore,
            0
        ) / completed.length;

    return {

        winnerAccuracy:
            Math.round(
                winnerCorrect /
                completed.length *
                100
            ),

        averageScore:
            Math.round(averageScore)

    };

   }



module.exports = {


    savePrediction,

    updateResult,

    getStatistics,

    loadHistory,

   getLearningData,

};
