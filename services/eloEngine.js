const fs = require("fs");
const path = require("path");

const ELO_FILE = path.join(__dirname, "../data/eloRatings.json");

/* =========================
   ELO ENGINE V20
========================= */

const DEFAULT_ELO = 1500;
const K_FACTOR = 24;

const ELO_CACHE = new Map();

function loadRatings() {

    try {

        if (!fs.existsSync(ELO_FILE)) {

            fs.mkdirSync(path.dirname(ELO_FILE), {
                recursive: true
            });

            fs.writeFileSync(
                ELO_FILE,
                JSON.stringify({})
            );

        }

        const ratings = JSON.parse(
            fs.readFileSync(ELO_FILE, "utf8")
        );

        Object.entries(ratings).forEach(([id, elo]) => {
            ELO_CACHE.set(Number(id), elo);
        });

    } catch (err) {

        console.log("ELO LOAD ERROR:", err.message);

    }

}

function saveRatings() {

    const data = {};

    for (const [id, elo] of ELO_CACHE.entries()) {
        data[id] = elo;
    }

    fs.writeFileSync(
        ELO_FILE,
        JSON.stringify(data, null, 2)
    );

}

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

    const HOME_ADVANTAGE = 65;

    return 1 /
    (
        1 +
        Math.pow(
            10,
            ((awayElo) - (homeElo + HOME_ADVANTAGE)) / 400
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

goalDifference <= 1 ? 1 :

goalDifference === 2 ? 1.30 :

goalDifference === 3 ? 1.55 :

1.75;

                  const eloGap = Math.abs(homeElo - awayElo);

const adjustment =
    eloGap > 250 ? 0.70 : 1;

    const newHomeElo =
        homeElo +
        K_FACTOR *
        adjustment *
        multiplier *
        (
            actualHome -
            expectedHome
        );

    const newAwayElo =
        awayElo +
        K_FACTOR *
        adjustment *
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

   saveRatings();

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

loadRatings();

module.exports = {

    getTeamElo,

    setTeamElo,

    calculateEloProbability,

    updateMatchElo,

    clearEloCache

};
