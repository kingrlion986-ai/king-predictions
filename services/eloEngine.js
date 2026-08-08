const fs = require("fs");
const path = require("path");

const ELO_FILE = path.join(__dirname, "../data/eloRatings.json");

/* =========================
   ELO ENGINE V21
========================= */

const DEFAULT_ELO = 1500;
const K_FACTOR = 24;
const HOME_ADVANTAGE = 65;

const ELO_CACHE = new Map();

/* =========================
   LOAD / SAVE
========================= */

function loadRatings() {

    try {

        if (!fs.existsSync(ELO_FILE)) {

            fs.mkdirSync(
                path.dirname(ELO_FILE),
                { recursive: true }
            );

            fs.writeFileSync(
                ELO_FILE,
                JSON.stringify({})
            );

        }

        const ratings =
            JSON.parse(
                fs.readFileSync(
                    ELO_FILE,
                    "utf8"
                )
            );

        Object.entries(ratings).forEach(
            ([id, elo]) => {

                if (
                    typeof elo === "number" &&
                    Number.isFinite(elo)
                ) {

                    ELO_CACHE.set(
                        Number(id),
                        elo
                    );

                }

            }
        );

        console.log(
            "📊 ELO LOADED:",
            ELO_CACHE.size,
            "teams"
        );

    }
    catch (err) {

        console.log(
            "ELO LOAD ERROR:",
            err.message
        );

    }

}


function saveRatings() {

    try {

        const data = {};

        for (
            const [id, elo]
            of ELO_CACHE.entries()
        ) {

            data[id] =
                Math.round(elo);

        }

        fs.writeFileSync(
            ELO_FILE,
            JSON.stringify(
                data,
                null,
                2
            )
        );

    }
    catch (err) {

        console.log(
            "ELO SAVE ERROR:",
            err.message
        );

    }

}

/* =========================
   HELPERS
========================= */

function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


/* =========================
   GET ELO
========================= */

function getTeamElo(teamId) {

    if (!ELO_CACHE.has(teamId)) {

        ELO_CACHE.set(
            teamId,
            DEFAULT_ELO
        );

    }

    return ELO_CACHE.get(teamId);

}


/* =========================
   SET ELO
========================= */

function setTeamElo(
    teamId,
    elo
) {

    ELO_CACHE.set(
        teamId,
        Math.round(
            clamp(
                elo,
                1000,
                2500
            )
        )
    );

}


/* =========================
   EXPECTED SCORE
========================= */

function calculateEloProbability(
    homeElo,
    awayElo
) {

    return 1 /
    (
        1 +
        Math.pow(
            10,
            (
                awayElo -
                (
                    homeElo +
                    HOME_ADVANTAGE
                )
            ) / 400
        )
    );

}


/* =========================
   UPDATE MATCH
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
        1 -
        expectedHome;


    let actualHome = 0.5;
    let actualAway = 0.5;


    if (
        homeGoals >
        awayGoals
    ) {

        actualHome = 1;
        actualAway = 0;

    }
    else if (
        homeGoals <
        awayGoals
    ) {

        actualHome = 0;
        actualAway = 1;

    }


    const goalDifference =
        Math.abs(
            homeGoals -
            awayGoals
        );


    const multiplier =

        goalDifference <= 1
            ? 1

        : goalDifference === 2
            ? 1.30

        : goalDifference === 3
            ? 1.55

        : 1.75;


    const eloGap =
        Math.abs(
            homeElo -
            awayElo
        );


    const adjustment =
        eloGap > 250
            ? 0.70
            : 1;


    const change =
        K_FACTOR *
        adjustment *
        multiplier;


    const newHomeElo =
        homeElo +
        change *
        (
            actualHome -
            expectedHome
        );


    const newAwayElo =
        awayElo +
        change *
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
            Math.round(
                newHomeElo
            ),

        away:
            Math.round(
                newAwayElo
            )

    };

}


/* =========================
   BUILD ELO FROM HISTORY
========================= */

function buildHistoricalElo(
    matches
) {

    if (
        !Array.isArray(matches) ||
        matches.length === 0
    ) {

        console.log(
            "⚠ ELO HISTORY EMPTY"
        );

        return;

    }


    console.log(
        "🧠 BUILDING HISTORICAL ELO:",
        matches.length,
        "matches"
    );


    /*
      Important :

      On repart d'une base propre.
      Cela évite de reconstruire plusieurs
      fois le même historique.
    */

    ELO_CACHE.clear();


    /*
      Les matchs doivent être traités
      du plus ancien au plus récent.
    */

    const sortedMatches =
        [...matches]
        .filter(match =>
            match &&
            match.status === "FINISHED" &&
            match.homeTeam &&
            match.awayTeam &&
            match.score &&
            match.score.fullTime
        )
        .sort(
            (a, b) =>
                new Date(a.utcDate) -
                new Date(b.utcDate)
        );


    let processed = 0;


    for (
        const match
        of sortedMatches
    ) {

        const homeGoals =
            Number(
                match.score.fullTime.home
            );

        const awayGoals =
            Number(
                match.score.fullTime.away
            );


        if (
            !Number.isFinite(homeGoals) ||
            !Number.isFinite(awayGoals)
        ) {

            continue;

        }


        updateMatchElo(
            match.homeTeam.id,
            match.awayTeam.id,
            homeGoals,
            awayGoals
        );


        processed++;

    }


    console.log(
        "✅ HISTORICAL ELO BUILT:",
        processed,
        "matches"
    );


    console.log(
        "📊 TEAMS WITH ELO:",
        ELO_CACHE.size
    );


    saveRatings();

}


/* =========================
   DEBUG
========================= */

function getEloDebug(
    homeTeamId,
    awayTeamId
) {

    const homeElo =
        getTeamElo(homeTeamId);

    const awayElo =
        getTeamElo(awayTeamId);


    const probability =
        calculateEloProbability(
            homeElo,
            awayElo
        );


    return {

        homeElo:
            Math.round(homeElo),

        awayElo:
            Math.round(awayElo),

        homeProbability:
            Math.round(
                probability * 100
            ),

        awayProbability:
            Math.round(
                (1 - probability) * 100
            )

    };

}


/* =========================
   CACHE
========================= */

function clearEloCache() {

    ELO_CACHE.clear();

}


/* =========================
   INITIAL LOAD
========================= */

loadRatings();


/* =========================
   EXPORT
========================= */

module.exports = {

    getTeamElo,

    setTeamElo,

    calculateEloProbability,

    updateMatchElo,

    buildHistoricalElo,

    getEloDebug,

    clearEloCache

};
