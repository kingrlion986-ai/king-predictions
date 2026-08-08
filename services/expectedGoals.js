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
    home.attackPower * 0.45
)
+
(
    home.homeAttack * 0.35
)
+
(
    home.avgScored * 0.20
);



    /*
       Force offensive extérieur
    */

    const awayAttack =
(
    away.attackPower * 0.45
)
+
(
    away.awayAttack * 0.35
)
+
(
    away.avgScored * 0.20
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
    homeAttack * 0.72
)
-
(
    awayDefense * 0.18
);

let awayXG =
(
    awayAttack * 0.72
)
-
(
    homeDefense * 0.18
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
       Influence modérée pour éviter
       que l'Elo écrase complètement le xG
    */

    if (elo) {

        const difference =
            elo.home -
            elo.away;

        const factor =
            clamp(
                difference / 1600,
                -0.10,
                0.10
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

    const formDifference =
        home.formPoints -
        away.formPoints;

    homeXG +=
        clamp(
            formDifference * 0.06,
            -0.15,
            0.15
        );

    awayXG +=
        clamp(
            -formDifference * 0.06,
            -0.15,
            0.15
        );

    const strengthFactor =
        clamp(
            strengthDifference / 250,
            -0.15,
            0.15
        );

    homeXG += strengthFactor;
    awayXG -= strengthFactor;


    /*
       Momentum récent
    */

    homeXG +=
        clamp(
            (homeMomentum - awayMomentum) * 0.04,
            -0.12,
            0.12
        );

    awayXG +=
        clamp(
            (awayMomentum - homeMomentum) * 0.03,
            -0.10,
            0.10
        );


    /*
       Niveau des adversaires affrontés
    */

    homeXG +=
        clamp(
            (homeOpponent - awayOpponent) / 250,
            -0.08,
            0.08
        );

    awayXG +=
        clamp(
            (awayOpponent - homeOpponent) / 250,
            -0.08,
            0.08
        );


    /*
       Difficulté à marquer
    */

    homeXG -=
        (
            home.failedToScore /
            Math.max(home.played, 1)
        ) * 0.15;

    awayXG -=
        (
            away.failedToScore /
            Math.max(away.played, 1)
        ) * 0.15;


    /*
       Solidité défensive
    */

    homeXG -=
        (
            away.cleanSheets /
            Math.max(away.played, 1)
        ) * 0.10;

    awayXG -=
        (
            home.cleanSheets /
            Math.max(home.played, 1)
        ) * 0.10;


    /*
       Bonus offensifs
    */

    homeXG +=
        (home.over25Rate / 100) * 0.04;

    awayXG +=
        (away.over25Rate / 100) * 0.04;

    homeXG +=
        (home.bttsRate / 100) * 0.03;

    awayXG +=
        (away.bttsRate / 100) * 0.03;


    /*
       Limites réalistes
    */

    homeXG =
        clamp(
            homeXG,
            0.25,
            2.80
        );

    awayXG =
        clamp(
            awayXG,
            0.25,
            2.80
        );

/*
      Ajustement domination
      Bonus limité pour éviter
      les xG artificiellement élevés
   */

    const dominance =
        Math.abs(
            home.strength -
            away.strength
        );

    if (dominance >= 30) {

        if (home.strength > away.strength) {

            homeXG += 0.08;
            awayXG -= 0.03;

        } else {

            awayXG += 0.08;
            homeXG -= 0.03;

        }

    }
    else if (dominance >= 18) {

        if (home.strength > away.strength) {

            homeXG += 0.04;
            awayXG -= 0.02;

        } else {

            awayXG += 0.04;
            homeXG -= 0.02;

        }

    }

    homeXG =
        clamp(
            homeXG,
            0.30,
            2.80
        );

    awayXG =
        clamp(
            awayXG,
            0.30,
            2.80
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
