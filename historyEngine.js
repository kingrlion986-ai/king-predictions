/* =========================
   HISTORY ENGINE V18
========================= */

const fs = require("fs");
const path = require("path");


const HISTORY_FILE =
    path.join(
        __dirname,
        "history.json"
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

            prediction.winner
            ===
            result.winner,



        scoreCorrect:

            prediction.correctScore
            ===
            result.score,



        bttsCorrect:

            prediction.btts
            ===
            result.btts,



        overCorrect:

            prediction.over25
            ===
            result.over25


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



module.exports = {


    savePrediction,

    updateResult,

    getStatistics,

    loadHistory

};
