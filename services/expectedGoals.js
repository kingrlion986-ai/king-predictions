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
        home.attackPower * 0.35
    )
    +
    (
        home.homeAttack * 0.30
    )
    +
    (
        home.avgScored * 0.20
    )
    +
    (
        home.formPoints * 0.15
    );



    /*
       Force offensive extérieur
    */

    const awayAttack =
    (
        away.attackPower * 0.35
    )
    +
    (
        away.awayAttack * 0.30
    )
    +
    (
        away.avgScored * 0.20
    )
    +
    (
        away.formPoints * 0.15
    );

   const homeReliability =
    home.reliability ?? 0.7;

const awayReliability =
    away.reliability ?? 0.7;

   const homeStability =
    (home.stability ?? 50) / 100;

const awayStability =
    (away.stability ?? 50) / 100;

   const homeMomentum =
    home.momentum ?? 0;

const awayMomentum =
    away.momentum ?? 0;

const homeOpponent =
    home.averageOpponentStrength ?? 50;

const awayOpponent =
    away.averageOpponentStrength ?? 50;



    /*
       Défenses adverses
    */

    const awayDefense =
(
    away.defensePower * 0.40
)
+
(
    away.awayDefense * 0.30
)
+
(
    away.avgConceded * 0.30
);



    const homeDefense =
(
    home.defensePower * 0.40
)
+
(
    home.homeDefense * 0.30
)
+
(
    home.avgConceded * 0.30
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

homeXG *=
    (0.80 +
    homeReliability * 0.10 +
    homeStability * 0.10);

awayXG *=
    (0.80 +
    awayReliability * 0.10 +
    awayStability * 0.10);


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
    Influence de la force globale
*/

const strengthDifference =
    home.strength -
    away.strength;

const strengthFactor =
    clamp(
        strengthDifference / 150,
        -0.35,
        0.35
    );

homeXG += strengthFactor;

awayXG -= strengthFactor;

   /*
   Momentum récent
*/

homeXG +=
    clamp(
        (homeMomentum - awayMomentum) * 0.08,
        -0.25,
        0.25
    );

awayXG +=
    clamp(
        (awayMomentum - homeMomentum) * 0.08,
        -0.25,
        0.25
    );

/*
   Niveau des adversaires affrontés
*/

homeXG +=
    clamp(
        (homeOpponent - awayOpponent) / 100,
        -0.15,
        0.15
    );

awayXG +=
    clamp(
        (awayOpponent - homeOpponent) / 100,
        -0.15,
        0.15
    );

       /*
    Difficulté à marquer
*/

homeXG -=
    (
        home.failedToScore /
        Math.max(home.played, 1)
    ) * 0.30;

awayXG -=
    (
        away.failedToScore /
        Math.max(away.played, 1)
    ) * 0.30;


   /*
    Solidité défensive
*/

homeXG -=
    (
        away.cleanSheets /
        Math.max(away.played, 1)
    ) * 0.20;

awayXG -=
    (
        home.cleanSheets /
        Math.max(home.played, 1)
    ) * 0.20;


   /*
    Bonus attaque efficace
*/

/*
   Bonus offensif avancé
*/

homeXG +=
    (home.over25Rate / 100) * 0.18;

awayXG +=
    (away.over25Rate / 100) * 0.18;

homeXG +=
    (home.bttsRate / 100) * 0.10;

awayXG +=
    (away.bttsRate / 100) * 0.10;

homeXG +=
    (home.attackPower / 10) * 0.05;

awayXG +=
    (away.attackPower / 10) * 0.05;

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

   /*
   Ajustement domination
*/

const dominance =
    Math.abs(home.strength - away.strength);

if (dominance >= 25) {

    if (home.strength > away.strength) {

        homeXG += 0.25;
        awayXG -= 0.15;

    } else {

        awayXG += 0.25;
        homeXG -= 0.15;

    }

}
else if (dominance >= 15) {

    if (home.strength > away.strength) {

        homeXG += 0.15;
        awayXG -= 0.08;

    } else {

        awayXG += 0.15;
        homeXG -= 0.08;

    }

}



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
