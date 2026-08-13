/*
========================================================
 KING PREDICTIONS AI
 VIP FILTER ENGINE V31
 STRICT MARKET FILTER
========================================================
*/

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
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


/* ======================================================
   CONFIDENCE
====================================================== */

function getModelConfidence(match) {
    const p = getPredictions(match);

    return num(
        p.winnerConfidence ??
        p.confidence,
        0
    );
}


/* ======================================================
   GLOBAL SAFETY
   UN MATCH DANGEREUX NE DOIT JAMAIS ÊTRE VIP
====================================================== */

function isUnsafeMatch(match) {

    const p = getPredictions(match);

    const decision =
        p?.aiDecision?.decision;

    const risk =
        p?.aiDecision?.risk ||
        p?.risk;

    if (decision === "TRAP MATCH")
        return true;

    if (risk === "VERY HIGH")
        return true;

    return false;
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
   1X2 PROBABILITIES
====================================================== */

function get1X2(match) {

    const p = getPredictions(match);

    const probabilities =
        p.probabilities || {};

    const home =
        num(probabilities.homeWin);

    const draw =
        num(probabilities.draw);

    const away =
        num(probabilities.awayWin);

    const values = [
        home,
        draw,
        away
    ];

    const sorted =
        [...values].sort(
            (a, b) => b - a
        );

    return {
        home,
        draw,
        away,
        favorite: sorted[0],
        second: sorted[1],
        separation: sorted[0] - sorted[1]
    };
}


/* ======================================================
   MODEL AGREEMENT
====================================================== */

function getModelAgreement(match) {

    const {
        separation
    } = get1X2(match);

    return clamp(
        50 + separation * 2,
        0,
        100
    );
}


/* ======================================================
   1X2 SCORE
====================================================== */

function calculateVIPScore(match) {

    const p = getPredictions(match);
    const home = getHome(match);
    const away = getAway(match);

    const {
        favorite,
        separation
    } = get1X2(match);

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

    const agreement =
        getModelAgreement(match);

    const dataQuality =
        getDataQuality(match);

    let score = 0;

    score += confidence * 0.30;

    score += favorite * 0.25;

    score +=
        clamp(
            separation * 1.5,
            0,
            20
        );

    score += stability * 0.10;

    score += reliability * 0.10;

    score += agreement * 0.10;

    score += dataQuality * 0.05;

    score +=
        clamp(
            strengthGap * 0.30,
            0,
            6
        );

    /*
       Sécurité
    */

    if (favorite < 55)
        score -= 15;

    if (favorite < 50)
        score -= 20;

    if (separation < 10)
        score -= 15;

    if (separation < 7)
        score -= 20;

    return Math.round(
        clamp(score, 0, 100)
    );
}


/* ======================================================
   OVER 2.5 SCORE
====================================================== */

function calculateOver25Score(match) {

    const p = getPredictions(match);
    const home = getHome(match);
    const away = getAway(match);

    const confidence =
        num(p.over25Confidence);

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

    /*
       XG
    */

    const xgScore =
        clamp(
            (
                expectedGoals - 1.5
            ) / 2 * 100,
            0,
            100
        );

    /*
       Attaque
    */

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
       Pénalités fortes
    */

    if (p.over25 !== "OVER 2.5")
        score -= 40;

    if (expectedGoals < 2.20)
        score -= 15;

    if (expectedGoals < 2.00)
        score -= 20;

    if (expectedGoals < 1.70)
        score -= 25;

    return Math.round(
        clamp(score, 0, 100)
    );
}


/* ======================================================
   BTTS SCORE
====================================================== */

function calculateBttsScore(match) {

    const p = getPredictions(match);
    const home = getHome(match);
    const away = getAway(match);

    const confidence =
        num(p.bttsConfidence);

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
            (
                expectedGoals - 1.5
            ) / 2 * 100,
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


    /*
       Pénalités
    */

    if (p.btts !== "OUI")
        score -= 40;

    if (expectedGoals < 2.00)
        score -= 15;

    if (expectedGoals < 1.80)
        score -= 20;

    if (expectedGoals < 1.60)
        score -= 25;

    return Math.round(
        clamp(score, 0, 100)
    );
}


/* ======================================================
   VIP 1X2
====================================================== */

function filterVipMatches(matches = []) {

    return matches

        .filter(match => !isUnsafeMatch(match))

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

            const {
                favorite,
                separation
            } = get1X2(match);

            const dataQuality =
                getDataQuality(match);

            const agreement =
                getModelAgreement(match);

            /*
               CONDITIONS STRICTES
            */

            if (confidence < 65)
    return false;

if (favorite < 62)
    return false;

if (separation < 12)
    return false;

if (dataQuality < 75)
    return false;

if (agreement < 70)
    return false;

if (p.winner === "DRAW")
    return false;

if (match.vipScore < 68)
    return false;
         
            if (match.vipScore < 75)
                return false;

            return true;
        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );
}


/* ======================================================
   VIP OVER 2.5
====================================================== */

function filterVipOver25(matches = []) {

    return matches

        .filter(match => !isUnsafeMatch(match))

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

            const dataQuality =
                getDataQuality(match);

            if (p.over25 !== "OVER 2.5")
                return false;

            if (confidence < 60)
    return false;

if (xg < 2.20)
    return false;

if (dataQuality < 75)
    return false;

if (match.vipScore < 65)
    return false;

            return true;
        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );
}


/* ======================================================
   VIP BTTS
====================================================== */

function filterVipBtts(matches = []) {

    return matches

        .filter(match => !isUnsafeMatch(match))

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

            const dataQuality =
                getDataQuality(match);

            if (p.btts !== "OUI")
                return false;

            if (confidence < 60)
    return false;

if (xg < 2.00)
    return false;

if (dataQuality < 75)
    return false;

if (match.vipScore < 65)
    return false;
         
            return true;
        })

        .sort(
            (a, b) =>
                b.vipScore -
                a.vipScore
        );
}


/* ======================================================
   MASTER VIP
====================================================== */

function getBestVipMatches(matches = []) {

    const all = [];

    for (const match of matches) {

        /*
           🚫 SÉCURITÉ ABSOLUE
        */

        if (isUnsafeMatch(match))
            continue;

        const p =
            getPredictions(match);

        const dataQuality =
            getDataQuality(match);

        if (dataQuality < 75)
            continue;


        /* ==========================
           1X2
        ========================== */

        const oneX2 =
            calculateVIPScore(match);

        const {
            favorite,
            separation
        } = get1X2(match);

        if (
            oneX2 >= 75 &&
            getModelConfidence(match) >= 70 &&
            favorite >= 60 &&
            separation >= 10 &&
            getModelAgreement(match) >= 70 &&
            p.winner !== "DRAW"
        ) {

            all.push({
                ...match,
                vipMarket: "1X2",
                vipScore: oneX2
            });
        }


        /* ==========================
           OVER 2.5
        ========================== */

        const over =
            calculateOver25Score(match);

        if (
            over >= 70 &&
            p.over25 === "OVER 2.5" &&
            num(p.over25Confidence) >= 65 &&
            num(match?.model?.expectedGoals) >= 2.20
        ) {

            all.push({
                ...match,
                vipMarket: "OVER 2.5",
                vipScore: over
            });
        }


        /* ==========================
           BTTS
        ========================== */

        const btts =
            calculateBttsScore(match);

        if (
            btts >= 70 &&
            p.btts === "OUI" &&
            num(p.bttsConfidence) >= 65 &&
            num(match?.model?.expectedGoals) >= 2.00
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

    getModelAgreement,

    isUnsafeMatch
};
