/* =========================
   CONFIDENCE ENGINE V18
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
    Calcul de confiance

    Sources :
    - écart des probabilités
    - qualité données
    - stabilité
    - accord Elo / Poisson
*/



function calculateConfidence({

    probabilities,
    homeStats,
    awayStats,
    eloProbability

}) {

    /*
        =========================
        1. PROBABILITÉS
        =========================
    */

    const values = [
        probabilities.homeWin,
        probabilities.draw,
        probabilities.awayWin
    ];

    const sorted = [...values].sort(
        (a, b) => b - a
    );

    const favoriteProbability = sorted[0];

    const separation =
        (sorted[0] - sorted[1]) * 2;

    const favoriteBonus = clamp(
        (favoriteProbability - 35) * 1.5,
        0,
        20
    );


    /*
        =========================
        2. QUALITÉ DES DONNÉES
        =========================
    */

    const homePlayed =
        Number(homeStats.played || 0);

    const awayPlayed =
        Number(awayStats.played || 0);

    const minPlayed =
        Math.min(
            homePlayed,
            awayPlayed
        );

    const dataQuality =
        clamp(
            (minPlayed / 8) * 100,
            0,
            100
        );


    /*
        =========================
        3. STABILITÉ
        =========================
    */

    const stability =
        (
            Number(homeStats.stability || 50) +
            Number(awayStats.stability || 50)
        ) / 2;


    /*
        =========================
        4. FIABILITÉ
        =========================
    */

    const reliability =
        (
            Number(homeStats.reliability || 0.5) +
            Number(awayStats.reliability || 0.5)
        ) / 2 * 100;


    /*
        =========================
        5. FORCE
        =========================
    */

    const strengthGap =
        Math.abs(
            Number(homeStats.strength || 50) -
            Number(awayStats.strength || 50)
        );

    const strengthBonus =
        clamp(
            strengthGap * 0.45,
            0,
            12
        );


    /*
        =========================
        6. FORME
        =========================
    */

    const formGap =
        Math.abs(
            Number(homeStats.formPoints || 0) -
            Number(awayStats.formPoints || 0)
        );

    const formBonus =
        clamp(
            formGap * 1.5,
            0,
            12
        );


    /*
        =========================
        7. MOMENTUM
        =========================
    */

    const momentumGap =
        Math.abs(
            Number(homeStats.momentum || 0) -
            Number(awayStats.momentum || 0)
        );

    const momentumBonus =
        clamp(
            momentumGap * 5,
            0,
            8
        );


    /*
        =========================
        8. ACCORD ELO / POISSON
        =========================
    */

    let eloAgreement = 50;

    if (
        typeof eloProbability === "number" &&
        Number.isFinite(eloProbability)
    ) {

        const poissonHome =
            probabilities.homeWin / 100;

        const difference =
            Math.abs(
                poissonHome -
                eloProbability
            );

        eloAgreement =
            clamp(
                100 - difference * 100,
                0,
                100
            );

    }


    /*
        =========================
        9. SCORE DE BASE
        =========================
    */

    let confidence =

        25 +

        separation * 0.35 +

        favoriteBonus * 0.55 +

        dataQuality * 0.10 +

        stability * 0.06 +

        reliability * 0.08 +

        eloAgreement * 0.08 +

        strengthBonus * 0.10 +

        formBonus * 0.08 +

        momentumBonus * 0.05;


    /*
        =========================
        10. BONUS FAVORI
        =========================
    */

    if (favoriteProbability >= 80)
        confidence += 4;

    else if (favoriteProbability >= 70)
        confidence += 2;


    /*
        =========================
        11. PÉNALITÉ DONNÉES
        =========================
    */

    if (minPlayed < 3) {

        confidence -= 18;

    }
    else if (minPlayed < 5) {

        confidence -= 10;

    }
    else if (minPlayed < 8) {

        confidence -= 5;

    }


    /*
        =========================
        12. FORME INSUFFISANTE
        =========================
    */

    const homeForm =
        Number(homeStats.formPoints || 0);

    const awayForm =
        Number(awayStats.formPoints || 0);

    if (
        homePlayed === 0 ||
        awayPlayed === 0
    ) {

        confidence -= 15;

    }


    /*
        =========================
        13. LIMITE FINALE
        =========================
    */

    return Math.round(
        clamp(
            confidence,
            35,
            90
        )
    );

}


module.exports = {

    calculateConfidence

};
