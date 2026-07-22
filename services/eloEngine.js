/* =========================
   ELO ENGINE V20
========================= */

const DEFAULT_ELO = 1500;
const K_FACTOR = 24;

const ELO_CACHE = new Map();

/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/* =========================
   GET ELO
========================= */

function getTeamElo(teamId) {

    if (!ELO_CACHE.has(teamId)) {
        ELO_CACHE.set(teamId, DEFAULT_ELO);
    }

    return ELO_CACHE.get(teamId);

}

/* =========================
   SET ELO
========================= */

function setTeamElo(teamId, elo) {

    ELO_CACHE.set(
        teamId,
        Math.round(
            clamp(elo, 1000, 2500)
        )
    );

}

/* =========================
   EXPECTED SCORE
========================= */

function calculateEloProbability(homeElo, awayElo) {

    return 1 /
    (
        1 +
        Math.pow(
            10,
            (awayElo - homeElo) / 400
        )
    );

}

/* =========================
   UPDATE BOTH TEAMS
========================= */

function updateMatchElo(

    homeTeamId,
    awayTeamId,
    homeGoals,
    awayGoals

) {

    const homeElo =
        getTeamElo(homeTeamId);

    const awayElo =
        getTeamElo(awayTeamId);

    const expectedHome =
        calculateEloProbability(
            homeElo,
            awayElo
        );

    const expectedAway =
        1 - expectedHome;

    let actualHome = 0.5;
    let actualAway = 0.5;

    if (homeGoals > awayGoals) {

        actualHome = 1;
        actualAway = 0;

    }
    else if (homeGoals < awayGoals) {

        actualHome = 0;
        actualAway = 1;

    }

    const goalDifference =
        Math.abs(
            homeGoals - awayGoals
        );

    const multiplier =
        1 + goalDifference * 0.15;

    const newHomeElo =
        homeElo +
        K_FACTOR *
        multiplier *
        (
            actualHome -
            expectedHome
        );

    const newAwayElo =
        awayElo +
        K_FACTOR *
        multiplier *
        (
            actualAway -
            expectedAway
        );

    setTeamElo(
        homeTeamId,
        newHomeElo
    );

    setTeamElo(
        awayTeamId,
        newAwayElo
    );

    return {

        home:
            Math.round(newHomeElo),

        away:
            Math.round(newAwayElo)

    };

}

/* =========================
   CACHE
========================= */

function clearEloCache() {

    ELO_CACHE.clear();

}

module.exports = {

    getTeamElo,

    setTeamElo,

    calculateEloProbability,

    updateMatchElo,

    clearEloCache

};
