/* =========================
   EXPECTED GOALS ENGINE V18
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


function round(value) {

    return Number(
        value.toFixed(2)
    );

}


/*
    Calcul xG

    Utilise :
    - attaque équipe
    - défense adverse
    - forme
    - Elo
    - avantage domicile
*/

function calculateExpectedGoals(
    home,
    away,
    elo = null
) {


    /*
       Force offensive domicile
    */

    const homeAttack =
        (
            home.homeAttack * 0.45
        )
        +
        (
            home.avgScored * 0.35
        )
        +
        (
            home.formPoints * 0.20
        );



    /*
       Force offensive extérieur
    */

    const awayAttack =
        (
            away.awayAttack * 0.45
        )
        +
        (
            away.avgScored * 0.35
        )
        +
        (
            away.formPoints * 0.20
        );

   const homeReliability =
    home.reliability ?? 0.7;

const awayReliability =
    away.reliability ?? 0.7;



    /*
       Défenses adverses
    */

    const awayDefense =
        (
            away.awayDefense * 0.50
        )
        +
        (
            away.avgConceded * 0.50
        );



    const homeDefense =
        (
            home.homeDefense * 0.50
        )
        +
        (
            home.avgConceded * 0.50
        );



    /*
       Base xG
    */

    let homeXG =
    (
        homeAttack * 0.65
    )
    +
    (
        awayDefense * 0.35
    );

let awayXG =
    (
        awayAttack * 0.65
    )
    +
    (
        homeDefense * 0.35
    );

homeXG *= (0.85 + homeReliability * 0.15);
awayXG *= (0.85 + awayReliability * 0.15);



    /*
       Avantage domicile
    */

    homeXG += 0.25;

   /*
   Bonus domicile / extérieur
*/

homeXG +=
    (home.homeAttack - away.awayDefense) * 0.08;

awayXG +=
    (away.awayAttack - home.homeDefense) * 0.08;



    /*
       Influence Elo
    */

    if (elo) {

        const difference =
            elo.home -
            elo.away;


        const factor =
    clamp(
        difference / 1200,
        -0.12,
        0.12
    );


        homeXG += factor;

        awayXG -= factor;

    }



    /*
       Limites réalistes football
    */

    homeXG =
        clamp(
            homeXG,
            0.20,
            3.50
        );


    awayXG =
        clamp(
            awayXG,
            0.20,
            3.50
        );



    return {

        expectedHomeGoals:
            round(homeXG),


        expectedAwayGoals:
            round(awayXG),


        totalExpectedGoals:
            round(
                homeXG +
                awayXG
            )

    };

}


module.exports = {

    calculateExpectedGoals

};
