const { getTeamMatches } = require("./footballApi");
const { getTeamElo } = require("./eloEngine");

/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round(value) {
    return Number(value.toFixed(2));
}

function safe(value) {
    return (
        typeof value === "number" &&
        !isNaN(value)
    ) ? value : 0;
}

/* =========================
   CACHE
========================= */

const CACHE = new Map();
const RUNNING = new Map();

const CACHE_DURATION = 1000 * 60 * 60 * 6;

/* =========================
   COMPETITION WEIGHT
========================= */

const COMPETITION_LEVEL = {
    CL: 1.25,
    PL: 1.20,
    PD: 1.20,
    SA: 1.18,
    BL1: 1.18,
    FL1: 1.16,

    DED: 1.08,
    BSA: 1.08,
    PPL: 1.10,

    ELC: 1.05,
    BL2: 0.95,
    FL2: 0.95,
    SD: 0.90,
    SA2: 0.90,

    DEFAULT: 1.00
};

/* =========================
   BUILD STATS
========================= */

function buildStats(matches, teamId) {

    let momentum = 0;
    let opponentStrengthTotal = 0;

    let homeWeight = 0;
    let awayWeight = 0;
    let weightTotal = 0;

    let attackPower = 0;
    let defensePower = 0;

    let weightedScored = 0;
    let weightedConceded = 0;

    let homeScored = 0;
    let homeConceded = 0;

    let awayScored = 0;
    let awayConceded = 0;

    let wins = 0;
    let draws = 0;
    let losses = 0;

    let cleanSheets = 0;
    let failedToScore = 0;

    let over25 = 0;
    let btts = 0;

    let recentForm = 0;

    let winStreak = 0;
    let drawStreak = 0;
    let loseStreak = 0;

    let currentWinStreak = 0;
    let currentDrawStreak = 0;
    let currentLoseStreak = 0;

    const totalMatches = matches.length || 1;

    matches.forEach((match, index) => {

        const isHome =
            match.homeTeam.id === teamId;

        const opponent =
            isHome
                ? match.awayTeam
                : match.homeTeam;

        const opponentElo =
            getTeamElo(opponent.id);

        const opponentStrength = clamp(
            ((opponentElo - 1200) / 800) * 100,
            20,
            95
        );

        const competitionWeight =
            COMPETITION_LEVEL[
                match.competition?.code
            ] || COMPETITION_LEVEL.DEFAULT;

        const opponentFactor =
            0.80 +
            (opponentStrength / 100) * 0.40;

        /*
         * Match récent = poids supérieur.
         */
        const recencyWeight =
            1.25 -
            (index / totalMatches) * 0.35;

        const weight =
            recencyWeight *
            competitionWeight *
            opponentFactor;

        weightTotal += weight;

        opponentStrengthTotal +=
            opponentStrength * weight;

        const goalsFor =
            isHome
                ? safe(match.score.fullTime.home)
                : safe(match.score.fullTime.away);

        const goalsAgainst =
            isHome
                ? safe(match.score.fullTime.away)
                : safe(match.score.fullTime.home);

        attackPower +=
            goalsFor * weight;

        /*
         * Défense = moins de buts encaissés.
         */
        defensePower +=
            Math.max(0, 3 - goalsAgainst) * weight;

        weightedScored +=
            goalsFor * weight;

        weightedConceded +=
            goalsAgainst * weight;

        if (isHome) {

            homeWeight += weight;

            homeScored +=
                goalsFor * weight;

            homeConceded +=
                goalsAgainst * weight;

        } else {

            awayWeight += weight;

            awayScored +=
                goalsFor * weight;

            awayConceded +=
                goalsAgainst * weight;
        }

        /* =========================
           RESULTS
        ========================= */

        if (goalsFor > goalsAgainst) {

            wins++;

            recentForm += weight * 3;
            momentum += 3 * weight;

            currentWinStreak++;
            currentDrawStreak = 0;
            currentLoseStreak = 0;

            winStreak =
                Math.max(
                    winStreak,
                    currentWinStreak
                );

        } else if (goalsFor === goalsAgainst) {

            draws++;

            recentForm += weight;
            momentum += weight;

            currentDrawStreak++;
            currentWinStreak = 0;
            currentLoseStreak = 0;

            drawStreak =
                Math.max(
                    drawStreak,
                    currentDrawStreak
                );

        } else {

            losses++;

            currentLoseStreak++;
            currentWinStreak = 0;
            currentDrawStreak = 0;

            loseStreak =
                Math.max(
                    loseStreak,
                    currentLoseStreak
                );
        }

        if (goalsAgainst === 0)
            cleanSheets++;

        if (goalsFor === 0)
            failedToScore++;

        if (goalsFor + goalsAgainst >= 3)
            over25++;

        if (
            goalsFor > 0 &&
            goalsAgainst > 0
        )
            btts++;
    });

    return {

        played: matches.length,

        wins,
        draws,
        losses,

        winStreak,
        drawStreak,
        loseStreak,

        momentum:
            round(
                momentum /
                Math.max(weightTotal, 1)
            ),

        averageOpponentStrength:
            round(
                opponentStrengthTotal /
                Math.max(weightTotal, 1)
            ),

        avgScored:
            round(
                weightedScored /
                Math.max(weightTotal, 1)
            ),

        avgConceded:
            round(
                weightedConceded /
                Math.max(weightTotal, 1)
            ),

        goalBalance:
            round(
                (
                    weightedScored -
                    weightedConceded
                ) /
                Math.max(weightTotal, 1)
            ),

        homeAttack:
            round(
                homeScored /
                Math.max(homeWeight, 1)
            ),

        awayAttack:
            round(
                awayScored /
                Math.max(awayWeight, 1)
            ),

        homeDefense:
            round(
                homeConceded /
                Math.max(homeWeight, 1)
            ),

        awayDefense:
            round(
                awayConceded /
                Math.max(awayWeight, 1)
            ),

        attackPower:
            round(
                attackPower /
                Math.max(weightTotal, 1)
            ),

        defensePower:
            round(
                defensePower /
                Math.max(weightTotal, 1)
            ),

        cleanSheets,
        failedToScore,

        over25Rate:
            round(
                over25 /
                totalMatches *
                100
            ),

        bttsRate:
            round(
                btts /
                totalMatches *
                100
            ),

        recentForm:
            round(
                recentForm /
                Math.max(weightTotal, 1)
            )
    };
}

/* =========================
   STABILITY
========================= */

function computeStability(stats) {

    const total =
        Math.max(stats.played, 1);

    const resultConsistency =
        1 -
        Math.min(
            Math.abs(stats.wins - stats.losses) /
            total,
            1
        );

    const defensiveStability =
        1 -
        Math.min(
            stats.avgConceded / 3,
            1
        );

    const offensiveStability =
        Math.min(
            stats.avgScored / 2.5,
            1
        );

    const stability =
        (
            resultConsistency * 0.35 +
            defensiveStability * 0.35 +
            offensiveStability * 0.30
        ) * 100;

    return Math.round(
        clamp(
            stability,
            25,
            90
        )
    );
}

/* =========================
   STRENGTH ENGINE V18
========================= */

function computeStrength(stats) {

    /*
     * Base neutre.
     */
    let strength = 50;

    /*
     * Niveau des adversaires.
     */
    strength +=
        (stats.averageOpponentStrength - 50)
        * 0.12;

    /*
     * Attaque.
     *
     * On réduit volontairement l'impact
     * pour éviter la saturation à 95.
     */
    strength +=
        clamp(
            stats.avgScored - 1.0,
            -1,
            1.5
        ) * 5;

    /*
     * Différence de buts.
     */
    strength +=
        clamp(
            stats.goalBalance,
            -1.5,
            1.5
        ) * 5;

    /*
     * Défense.
     */
    strength +=
        clamp(
            1.8 - stats.avgConceded,
            -1,
            1.5
        ) * 4;

    /*
     * Résultats.
     */
    const pointsRate =
        (
            stats.wins * 3 +
            stats.draws
        ) /
        Math.max(
            stats.played * 3,
            1
        );

    strength +=
        (pointsRate - 0.5) * 20;

    /*
     * Clean sheets.
     */
    strength +=
        (
            stats.cleanSheets /
            Math.max(stats.played, 1)
        ) * 4;

    /*
     * Matchs sans marquer.
     */
    strength -=
        (
            stats.failedToScore /
            Math.max(stats.played, 1)
        ) * 4;

    /*
     * Forme récente.
     */
    const formRate =
        stats.recentForm / 3;

    strength +=
        clamp(
            formRate - 0.5,
            -0.5,
            0.5
        ) * 8;

    /*
     * Stabilité.
     */
    strength +=
        (
            computeStability(stats) - 50
        ) * 0.10;

    /*
     * IMPORTANT :
     * On élargit la plage mais on évite
     * les 95 artificiels.
     */
    return Math.round(
        clamp(
            strength,
            25,
            90
        )
    );
}

/* =========================
   RELIABILITY
========================= */

function computeReliability(stats) {

    const matchesFactor =
        Math.min(
            stats.played / 10,
            1
        );

    const formFactor =
        (
            stats.wins * 3 +
            stats.draws
        ) /
        Math.max(
            stats.played * 3,
            1
        );

    const stabilityFactor =
        computeStability(stats) / 100;

    let reliability =
        0.30 +
        matchesFactor * 0.20 +
        formFactor * 0.25 +
        stabilityFactor * 0.20;

    /*
     * Maximum volontairement limité.
     */
    return Number(
        clamp(
            reliability,
            0.30,
            0.85
        ).toFixed(2)
    );
}

/* =========================
   MAIN ANALYZER
========================= */

async function analyzeTeam(team) {

    if (CACHE.has(team.id)) {

        const cached =
            CACHE.get(team.id);

        if (
            Date.now() - cached.time <
            CACHE_DURATION
        ) {

            console.log(
                "⚡ TEAM CACHE:",
                team.name
            );

            return cached.data;
        }

        CACHE.delete(team.id);
    }

    if (RUNNING.has(team.id)) {

        console.log(
            "⏳ ANALYSE EN COURS:",
            team.name
        );

        return RUNNING.get(team.id);
    }

    const promise =
        (async () => {

            console.log(
                "TEAM OBJECT:",
                JSON.stringify(
                    team,
                    null,
                    2
                )
            );

            const matches =
                await getTeamMatches(team.id);

            console.log(
                "TEAM:",
                team.name
            );

            console.log(
                "MATCHES RECEIVED:",
                matches?.length
            );

            console.log(
                "TEAM ID USED:",
                team.id
            );

            if (
                matches?.length > 0
            ) {

                console.log(
                    "FIRST MATCH:",
                    JSON.stringify(
                        matches[0],
                        null,
                        2
                    )
                );
            }

            /*
             * FALLBACK
             */
            if (
                !matches ||
                matches.length < 5
            ) {

                const fallback = {

                    teamName: team.name,
                    teamId: team.id,

                    played: 0,

                    strength: 50,
                    rawStrength: 50,

                    reliability: 0.30,
                    stability: 30,

                    avgScored: 1,
                    avgConceded: 1,

                    goalBalance: 0,

                    attackPower: 1,
                    defensePower: 1,

                    homeAttack: 1,
                    awayAttack: 1,

                    homeDefense: 1,
                    awayDefense: 1,

                    wins: 0,
                    draws: 0,
                    losses: 0,

                    winStreak: 0,
                    drawStreak: 0,
                    loseStreak: 0,

                    cleanSheets: 0,
                    failedToScore: 0,

                    over25Rate: 50,
                    bttsRate: 50,

                    formPoints: 0.5,
                    momentum: 0,

                    averageOpponentStrength: 50,

                    formScore: 50
                };

                CACHE.set(
                    team.id,
                    {
                        time: Date.now(),
                        data: fallback
                    }
                );

                return fallback;
            }

            /*
             * 8 derniers matchs.
             */
            const recentMatches =
                matches
                    .filter(
                        m =>
                            m.status ===
                            "FINISHED"
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.utcDate) -
                            new Date(a.utcDate)
                    )
                    .slice(0, 8);

            console.log(
                "TEAM DATA DEBUG:",
                team.name,
                "TOTAL:",
                matches.length,
                "FINISHED:",
                recentMatches.length
            );

            const stats =
                buildStats(
                    recentMatches,
                    team.id
                );

            const strength =
                computeStrength(stats);

            const reliability =
                computeReliability(stats);

            const stability =
                computeStability(stats);

            const formScore =
                Math.round(
                    strength * 0.45 +
                    stability * 0.30 +
                    reliability * 100 * 0.25
                );

            const result = {

                teamName: team.name,
                teamId: team.id,

                played: stats.played,

                strength,
                rawStrength: strength,

                reliability,
                stability,

                avgScored:
                    stats.avgScored,

                avgConceded:
                    stats.avgConceded,

                goalBalance:
                    stats.goalBalance,

                homeAttack:
                    stats.homeAttack,

                awayAttack:
                    stats.awayAttack,

                homeDefense:
                    stats.homeDefense,

                awayDefense:
                    stats.awayDefense,

                attackPower:
                    stats.attackPower,

                defensePower:
                    stats.defensePower,

                wins: stats.wins,
                draws: stats.draws,
                losses: stats.losses,

                winStreak:
                    stats.winStreak,

                drawStreak:
                    stats.drawStreak,

                loseStreak:
                    stats.loseStreak,

                cleanSheets:
                    stats.cleanSheets,

                failedToScore:
                    stats.failedToScore,

                over25Rate:
                    stats.over25Rate,

                bttsRate:
                    stats.bttsRate,

                formPoints:
                    stats.recentForm,

                momentum:
                    stats.momentum,

                averageOpponentStrength:
                    stats.averageOpponentStrength,

                formScore
            };

            console.log(
                "===== TEAM ANALYZER V18 ====="
            );

            console.log(
                result.teamName,
                "STRENGTH:",
                result.strength,
                "RELIABILITY:",
                result.reliability,
                "STABILITY:",
                result.stability
            );

            CACHE.set(
                team.id,
                {
                    time: Date.now(),
                    data: result
                }
            );

            return result;

        })();

    RUNNING.set(
        team.id,
        promise
    );

    try {

        return await promise;

    } finally {

        RUNNING.delete(
            team.id
        );
    }
}

module.exports = {
    analyzeTeam
};
