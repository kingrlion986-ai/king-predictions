/* =========================
   VIP FILTER ENGINE V18
========================= */


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );

}


/*
    Vérifie si un match possède
    un avantage statistique réel
*/

function calculateVIPScore(match) {


    let score = 0;


    const predictions =
        match.predictions;


    const home =
        match.teamStats.home;


    const away =
        match.teamStats.away;



    /*
       Qualité globale
    */

    score +=
        (
            match.qualityScore || 0
        )
        *
        0.35;



    /*
       Confiance modèle
    */

    score +=
        (
            predictions.confidence || 0
        )
        *
        0.30;



    /*
       Écart probabilités

       Évite les faux favoris
    */

    const probabilities =
        predictions.probabilities;


    const values = [

        probabilities.homeWin,

        probabilities.draw,

        probabilities.awayWin

    ];


    const sorted =
        [...values].sort(
            (a,b)=>b-a
        );


    const edge =
        sorted[0] -
        sorted[1];


    score +=
        edge
        *
        0.20;



    /*
       Stabilité équipes
    */

    score +=

        (
            home.stability +
            away.stability
        )
        /
        2
        *
        0.10;



    /*
       Pénalité manque de données
    */

    if (

        home.played < 5 ||
        away.played < 5

    ) {

        score -= 15;

    }



    return Math.round(
        clamp(
            score,
            0,
            100
        )
    );

}





/*
    Filtre VIP strict
*/

function filterVIPMatches(matches) {


    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateVIPScore(match)

        }))


        .filter(match => {


            return (

                match.vipScore >= 75

                &&

                match.predictions.confidence
                >=
                65

            );


        })


        .sort(
            (a,b)=>
            b.vipScore -
            a.vipScore
        );


}




module.exports = {


    filterVIPMatches,

    calculateVIPScore

};
