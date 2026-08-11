/*
========================================================
 KING PREDICTIONS AI
 VIP FILTER ENGINE V30
 MARKET-SPECIFIC INTELLIGENT FILTER
========================================================

OBJECTIF :

- Sélectionner uniquement les matchs réellement solides
- Éviter les TRAP MATCH
- Vérifier l'accord entre plusieurs modèles
- Séparer 1X2 / OVER 2.5 / BTTS
- Utiliser ELO + Poisson + XG + forme + stabilité
- Ne jamais transformer un mauvais match en VIP
========================================================
*/


/* ======================================================
   HELPERS
====================================================== */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function avg(a, b) {
    return (num(a) + num(b)) / 2;
}


function getPredictions(match) {
    return match?.predictions || {};
}


function getHome(match) {
    return match?.teamStats?.home || {};
}


function getAway(match) {
    return match?.teamStats?.away || {};
}


function getModelConfidence(match) {

    const p = getPredictions(match);

    return num(
        p.winnerConfidence ??
        p.confidence,
        0
    );
}


/* ======================================================
   RISK
====================================================== */

function getRiskPenalty(match) {

    const p = getPredictions(match);

    const decision =
        p?.aiDecision?.decision;

    const risk =
        p?.aiDecision?.risk ||
        p?.risk;

    let penalty = 0;


    if (decision === "TRAP MATCH")
        penalty += 30;

    if (risk === "VERY HIGH")
        penalty += 25;

    else if (risk === "HIGH")
        penalty += 15;

    else if (risk === "MEDIUM")
        penalty += 5;


    return penalty;
}


/* ======================================================
   DATA QUALITY
====================================================== */

function getDataQuality(match) {

    const home = getHome(match);
    const away = getAway(match);

    const minPlayed =
        Math.min(
            num(home.played),
            num(away.played)
        );


    if (minPlayed >= 10)
        return 100;

    if (minPlayed >= 8)
        return 90;

    if (minPlayed >= 6)
        return 75;

    if (minPlayed >= 5)
        return 60;

    return 25;
}


/* ======================================================
   MODEL AGREEMENT
====================================================== */

function getModelAgreement(match) {

    const p = getPredictions(match);

    const probabilities =
        p.probabilities || {};

    const homeWin =
        num(probabilities.homeWin);

    const draw =
        num(probabilities.draw);

    const awayWin =
        num(probabilities.awayWin);


    const values = [
        homeWin,
        draw,
        awayWin
    ];


    const favorite =
        Math.max(...values);


    const second =
        [...values]
            .sort((a, b) => b - a)[1];


    const separation =
        favorite - second;


    /*
       Plus la séparation est importante,
       plus le modèle est clair.
    */

    return clamp(
        50 + separation * 2,
        0,
        100
    );
}


/* ======================================================
   1X2 VIP SCORE
====================================================== */

function calculateVIPScore(match) {

    const p = getPredictions(match);
    const home = getHome(match);
    const away = getAway(match);


    const probabilities =
        p.probabilities || {};


    const homeWin =
        num(probabilities.homeWin);

    const draw =
        num(probabilities.draw);

    const awayWin =
        num(probabilities.awayWin);


    const values = [
        homeWin,
        draw,
        awayWin
    ];


    const sorted =
        [...values].sort(
            (a, b) => b - a
        );


    const favorite =
        sorted[0];

    const second =
        sorted[1];

    const separation =
        favorite - second;


    const confidence =
        getModelConfidence(match);


    const stability =
        avg(
            home.stability,
            away.stability
        );


    const reliability =
        avg(
            home.reliability,
            away.reliability
        ) * 100;


    const strengthGap =
        Math.abs(
            num(home.strength) -
            num(away.strength)
        );


    const modelAgreement =
        getModelAgreement(match);


    const dataQuality =
        getDataQuality(match);


    const riskPenalty =
        getRiskPenalty(match);


    /*
       SCORE PRINCIPAL
    */

    let score = 0;


    score +=
        confidence * 0.30;


    score +=
        favorite * 0.25;


    score +=
        clamp(
            separation * 1.5,
            0,
            20
        );


    score +=
        stability * 0.10;


    score +=
        reliability * 0.10;


    score +=
        modelAgreement * 0.10;


    score +=
        dataQuality * 0.05;


    /*
       FORCE GAP
    */

    score +=
        clamp(
            strengthGap * 0.30,
            0,
            6
        );


    /*
       RISQUE
    */

    score -= riskPenalty;


    /*
       PAS DE FAVORI CLAIR
    */

    if (favorite < 55)
        score -= 15;


    if (favorite < 50)
        score -= 20;


    return Math.round(
        clamp(score, 0, 100)
    );
}


/* ======================================================
   OVER 2.5
====================================================== */

function calculateOver25Score(match) {

    const p = getPredictions(match);
    const home = getHome(match);
    const away = getAway(match);


    const confidence =
        num(p.over25Confidence);


    const overPrediction =
        p.over25;


    const overRate =
        avg(
            home.over25Rate,
            away.over25Rate
        ) * 100;


    const bttsRate =
        avg(
            home.bttsRate,
            away.bttsRate
        ) * 100;


    const reliability =
        avg(
            home.reliability,
            away.reliability
        ) * 100;


    const expectedGoals =
        num(
            match?.model?.expectedGoals
        );


    const xgScore =
        clamp(
            (expectedGoals - 1.5)
            / 2 * 100,
            0,
            100
        );


    const attackScore =
        clamp(
            (
                num(home.avgScored) +
                num(away.avgScored)
            ) / 4 * 100,
            0,
            100
        );


    let score = 0;


    score += confidence * 0.35;

    score += overRate * 0.20;

    score += xgScore * 0.25;

    score += bttsRate * 0.05;

    score += reliability * 0.10;

    score += attackScore * 0.05;


    /*
       Sécurité supplémentaire
    */

    if (overPrediction !== "OVER 2.5")
        score -= 30;


    if (expectedGoals < 2.0)
        score -= 20;


    if (expectedGoals < 1.6)
        score -= 25;


    return Math.round(
        clamp(score, 0, 100)
    );
}


/* ======================================================
   BTTS
====================================================== */

function calculateBttsScore(match) {

    const p = getPredictions(match);
    const home = getHome(match);
    const away = getAway(match);


    const confidence =
        num(p.bttsConfidence);


    const prediction =
        p.btts;


    const bttsRate =
        avg(
            home.bttsRate,
            away.bttsRate
        ) * 100;


    const reliability =
        avg(
            home.reliability,
            away.reliability
        ) * 100;


    const expectedGoals =
        num(
            match?.model?.expectedGoals
        );


    const avgScored =
        avg(
            home.avgScored,
            away.avgScored
        );


    const xgScore =
        clamp(
            (expectedGoals - 1.5)
            / 2 * 100,
            0,
            100
        );


    const attackScore =
        clamp(
            avgScored * 30,
            0,
            100
        );


    let score = 0;


    score += confidence * 0.35;

    score += bttsRate * 0.25;

    score += reliability * 0.10;

    score += xgScore * 0.20;

    score += attackScore * 0.10;


    if (prediction !== "OUI")
        score -= 30;


    if (expectedGoals < 1.8)
        score -= 20;


    if (expectedGoals < 1.5)
        score -= 20;


    return Math.round(
        clamp(score, 0, 100)
    );
}


/* ======================================================
   VIP 1X2 FILTER
====================================================== */

function filterVipMatches(matches = []) {

    return matches

        .map(match => ({
            ...match,

            vipScore:
                calculateVIPScore(match)
        }))

        .filter(match => {

            const p =
                getPredictions(match);


            const confidence =
                getModelConfidence(match);


            const decision =
                p?.aiDecision?.decision;


            const risk =
                p?.aiDecision?.risk;


            /*
               BLOQUER LES TRAPS
            */

            if (
                decision === "TRAP MATCH"
            )
                return false;


            if (
                risk === "VERY HIGH"
            )
                return false;


            /*
               CONDITIONS VIP
            */

            return (

                match.vipScore >= 70 &&

                confidence >= 65 &&

                getDataQuality(match) >= 75 &&

                getModelAgreement(match) >= 60

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );
}


/* ======================================================
   VIP OVER 2.5 FILTER
====================================================== */

function filterVipOver25(matches = []) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateOver25Score(match)

        }))

        .filter(match => {

            const p =
                getPredictions(match);


            const confidence =
                num(p.over25Confidence);


            const xg =
                num(
                    match?.model?.expectedGoals
                );


            return (

                p.over25 ===
                    "OVER 2.5" &&

                confidence >= 60 &&

                xg >= 2.0 &&

                match.vipScore >= 65 &&

                getDataQuality(match) >= 75

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );
}


/* ======================================================
   VIP BTTS FILTER
====================================================== */

function filterVipBtts(matches = []) {

    return matches

        .map(match => ({

            ...match,

            vipScore:
                calculateBttsScore(match)

        }))

        .filter(match => {

            const p =
                getPredictions(match);


            const confidence =
                num(p.bttsConfidence);


            const xg =
                num(
                    match?.model?.expectedGoals
                );


            return (

                p.btts === "OUI" &&

                confidence >= 60 &&

                xg >= 1.8 &&

                match.vipScore >= 65 &&

                getDataQuality(match) >= 75

            );

        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );
}


/* ======================================================
   VIP MASTER FILTER
====================================================== */

function getBestVipMatches(matches = []) {

    const all = [];


    for (const match of matches) {

        const oneX2 =
            calculateVIPScore(match);

        const over =
            calculateOver25Score(match);

        const btts =
            calculateBttsScore(match);


        const p =
            getPredictions(match);


        /*
           On conserve uniquement
           les matchs suffisamment solides.
        */

        if (
            oneX2 >= 70 &&
            getModelConfidence(match) >= 65
        ) {

            all.push({
                ...match,
                vipMarket: "1X2",
                vipScore: oneX2
            });

        }


        if (
            over >= 65 &&
            p.over25 === "OVER 2.5"
        ) {

            all.push({
                ...match,
                vipMarket: "OVER 2.5",
                vipScore: over
            });

        }


        if (
            btts >= 65 &&
            p.btts === "OUI"
        ) {

            all.push({
                ...match,
                vipMarket: "BTTS",
                vipScore: btts
            });

        }

    }


    return all.sort(
        (a, b) =>
            b.vipScore -
            a.vipScore
    );
}


/* ======================================================
   EXPORTS
====================================================== */

module.exports = {

    filterVipMatches,

    filterVipOver25,

    filterVipBtts,

    getBestVipMatches,

    calculateVIPScore,

    calculateOver25Score,

    calculateBttsScore,

    getDataQuality,

    getModelAgreement

};
