/*
=========================================
 KING PREDICTIONS AI
 EXPECTED GOALS ENGINE
 STABLE / CALIBRATED
=========================================
*/

function clamp(value, min, max) {
    return Math.max(
        min,
        Math.min(max, value)
    );
}

function round(value) {
    return Number(
        value.toFixed(2)
    );
}

function safe(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}

/*
=========================================
 BASELINES

 Valeurs neutres utilisées uniquement
 lorsque les données sont insuffisantes.
=========================================
*/

const LEAGUE_HOME_GOALS = 1.45;
const LEAGUE_AWAY_GOALS = 1.15;

/*
=========================================
 NORMALISATION

 On compare les équipes à une base
 neutre plutôt que de soustraire
 directement defensePower.

 C'est important :

 defensePower = 3 - buts encaissés

 Donc une bonne défense donne un
 chiffre élevé.

 Il ne faut PAS faire :

 attaque - defensePower

 car cela écrase artificiellement le xG.
=========================================
*/

function calculateAttackStrength(
    avgScored,
    venueAttack,
    leagueBaseline
) {

    const generalAttack =
        safe(avgScored, leagueBaseline);

    const specificAttack =
        safe(
            venueAttack,
            generalAttack
        );

    /*
     * 60% attaque générale
     * 40% attaque spécifique
     */

    const blendedAttack =
        generalAttack * 0.60 +
        specificAttack * 0.40;

    return clamp(
        blendedAttack /
        leagueBaseline,
        0.55,
        1.80
    );
}


function calculateDefenseStrength(
    avgConceded,
    venueDefense,
    leagueBaseline
) {

    const generalDefense =
        safe(avgConceded, leagueBaseline);

    const specificDefense =
        safe(
            venueDefense,
            generalDefense
        );

    /*
     * 60% défense générale
     * 40% défense spécifique
     */

    const blendedDefense =
        generalDefense * 0.60 +
        specificDefense * 0.40;

    /*
     * Plus une équipe encaisse,
     * plus le multiplicateur devient élevé.
     *
     * Exemple :
     *
     * 1.0 encaissé
     * → facteur défensif faible
     *
     * 2.0 encaissés
     * → facteur défensif élevé
     */

    return clamp(
        blendedDefense /
        leagueBaseline,
        0.55,
        1.80
    );
}


/*
=========================================
 ELO ADJUSTMENT

 Influence volontairement faible.

 ELO ne doit pas remplacer les buts
 réellement observés.
=========================================
*/

function calculateEloAdjustment(
    eloHome,
    eloAway
) {

    if (
        !Number.isFinite(eloHome) ||
        !Number.isFinite(eloAway)
    ) {
        return 0;
    }

    const difference =
        eloHome - eloAway;

    return clamp(
        difference / 1000,
        -0.10,
        0.10
    );
}


/*
=========================================
 MAIN XG
=========================================
*/

function calculateExpectedGoals(
    home,
    away,
    elo = null
) {

    /*
    =================================
    DONNÉES DE BASE
    =================================
    */

    const homeAvgScored =
        safe(
            home?.avgScored,
            LEAGUE_HOME_GOALS
        );

    const awayAvgScored =
        safe(
            away?.avgScored,
            LEAGUE_AWAY_GOALS
        );

    const homeAvgConceded =
        safe(
            home?.avgConceded,
            LEAGUE_HOME_GOALS
        );

    const awayAvgConceded =
        safe(
            away?.avgConceded,
            LEAGUE_AWAY_GOALS
        );


    /*
    =================================
    ATTAQUE
    =================================
    */

    const homeAttackStrength =
        calculateAttackStrength(
            homeAvgScored,
            home?.homeAttack,
            LEAGUE_HOME_GOALS
        );

    const awayAttackStrength =
        calculateAttackStrength(
            awayAvgScored,
            away?.awayAttack,
            LEAGUE_AWAY_GOALS
        );


    /*
    =================================
    DÉFENSE
    =================================
    */

    const homeDefenseStrength =
        calculateDefenseStrength(
            homeAvgConceded,
            home?.homeDefense,
            LEAGUE_HOME_GOALS
        );

    const awayDefenseStrength =
        calculateDefenseStrength(
            awayAvgConceded,
            away?.awayDefense,
            LEAGUE_AWAY_GOALS
        );


    /*
    =================================
    BASE XG

    Formule simple :

    attaque équipe
    ×
    défense adverse

    Cela évite les soustractions
    artificielles.
    =================================
    */

    let homeXG =
        LEAGUE_HOME_GOALS *
        homeAttackStrength *
        awayDefenseStrength;

    let awayXG =
        LEAGUE_AWAY_GOALS *
        awayAttackStrength *
        homeDefenseStrength;


    /*
    =================================
    AVANTAGE DOMICILE

    Petit bonus fixe.

    Pas de +0.25 énorme après
    plusieurs autres bonus.
    =================================
    */

    homeXG += 0.12;


    /*
    =================================
    ELO

    Influence très modérée.
    =================================
    */

    if (
        elo &&
        Number.isFinite(Number(elo.home)) &&
        Number.isFinite(Number(elo.away))
    ) {

        const eloAdjustment =
            calculateEloAdjustment(
                Number(elo.home),
                Number(elo.away)
            );

        homeXG += eloAdjustment;
        awayXG -= eloAdjustment * 0.70;
    }


    /*
    =================================
    FORME

    Influence légère uniquement.

    On ne réutilise PAS ici :
    strength + formScore + momentum
    tous ensemble.

    Sinon les mêmes informations
    sont comptées plusieurs fois.
    =================================
    */

    const homeMomentum =
        safe(home?.momentum, 0);

    const awayMomentum =
        safe(away?.momentum, 0);

    const momentumDifference =
        homeMomentum - awayMomentum;

    const momentumAdjustment =
        clamp(
            momentumDifference * 0.025,
            -0.08,
            0.08
        );

    homeXG += momentumAdjustment;
    awayXG -= momentumAdjustment * 0.70;


    /*
    =================================
    DIFFICULTÉ À MARQUER

    Petit ajustement seulement.
    =================================
    */

    const homeFailedRate =
        safe(home?.failedToScore, 0) /
        Math.max(
            safe(home?.played, 1),
            1
        );

    const awayFailedRate =
        safe(away?.failedToScore, 0) /
        Math.max(
            safe(away?.played, 1),
            1
        );

    homeXG -=
        clamp(
            homeFailedRate * 0.08,
            0,
            0.08
        );

    awayXG -=
        clamp(
            awayFailedRate * 0.08,
            0,
            0.08
        );


    /*
    =================================
    CLEAN SHEETS

    Influence faible.

    Une clean sheet ne doit pas
    réduire brutalement le xG adverse.
    =================================
    */

    const awayCleanSheetRate =
        safe(away?.cleanSheets, 0) /
        Math.max(
            safe(away?.played, 1),
            1
        );

    const homeCleanSheetRate =
        safe(home?.cleanSheets, 0) /
        Math.max(
            safe(home?.played, 1),
            1
        );

    homeXG -=
        clamp(
            awayCleanSheetRate * 0.06,
            0,
            0.06
        );

    awayXG -=
        clamp(
            homeCleanSheetRate * 0.06,
            0,
            0.06
        );


    /*
    =================================
    STABILITÉ / FIABILITÉ

    Seulement une correction minime.

    Elles servent principalement à la
    confidence, pas à fabriquer des buts.
    =================================
    */


    /*
    =================================
    LIMITES

    Un match réel peut avoir beaucoup
    de buts, mais on évite les valeurs
    extrêmes dans le modèle.
    =================================
    */

    homeXG =
        clamp(
            homeXG,
            0.35,
            3.20
        );

    awayXG =
        clamp(
            awayXG,
            0.25,
            3.00
        );


    const totalExpectedGoals =
        homeXG + awayXG;


    /*
    =================================
    DEBUG
    =================================
    */

    console.log(
        "===== EXPECTED GOALS ====="
    );

    console.log({
        homeAttackStrength:
            round(homeAttackStrength),

        awayAttackStrength:
            round(awayAttackStrength),

        homeDefenseStrength:
            round(homeDefenseStrength),

        awayDefenseStrength:
            round(awayDefenseStrength),

        expectedHomeGoals:
            round(homeXG),

        expectedAwayGoals:
            round(awayXG),

        totalExpectedGoals:
            round(totalExpectedGoals)
    });


    return {

        expectedHomeGoals:
            round(homeXG),

        expectedAwayGoals:
            round(awayXG),

        totalExpectedGoals:
            round(totalExpectedGoals)
    };
}


module.exports = {
    calculateExpectedGoals
};
