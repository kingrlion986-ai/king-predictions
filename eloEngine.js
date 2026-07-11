/* =========================
   ELO ENGINE V18
========================= */

const DEFAULT_ELO = 1500;


/*
  Cache Elo
*/

const ELO_CACHE = new Map();


/*
  Récupérer Elo équipe
*/

function getTeamElo(teamId) {

    if (ELO_CACHE.has(teamId)) {

        return ELO_CACHE.get(teamId);

    }


    ELO_CACHE.set(
        teamId,
        DEFAULT_ELO
    );


    return DEFAULT_ELO;

}



/*
  Probabilité Elo
*/

function calculateEloProbability(homeElo, awayElo) {

    const difference =
        awayElo - homeElo;


    const probability =
        1 /
        (
            1 +
            Math.pow(
                10,
                difference / 400
            )
        );


    return Number(
        probability.toFixed(4)
    );

}



/*
  Mise à jour après résultat
*/

function updateElo(
    teamId,
    opponentId,
    result
) {


    const teamElo =
        getTeamElo(teamId);


    const opponentElo =
        getTeamElo(opponentId);



    const expected =
        calculateEloProbability(
            teamElo,
            opponentElo
        );



    let actual = 0;


    if (result === "WIN")
        actual = 1;


    if (result === "DRAW")
        actual = 0.5;



    if (result === "LOSS")
        actual = 0;



    const K = 32;



    const newElo =
        teamElo +
        K *
        (
            actual -
            expected
        );



    ELO_CACHE.set(
        teamId,
        Math.round(newElo)
    );


    return Math.round(newElo);

}



module.exports = {

    getTeamElo,

    calculateEloProbability,

    updateElo

};
