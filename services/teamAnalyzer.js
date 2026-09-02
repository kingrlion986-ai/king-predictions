const { getTeamMatches } = require("./footballApi");
const { getTeamElo } = require("./eloEngine");

const CACHE = new Map();
const RUNNING = new Map();

const TTL = 6 * 60 * 60 * 1000;
const EMPTY_CACHE_TTL = 2 * 60 * 1000;

const COMP_WEIGHT = {
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
  DEFAULT: 1
};

const clamp = (v, a, b) =>
  Math.max(a, Math.min(b, Number(v) || 0));

const avg = (a, b) =>
  b > 0 ? a / b : 0;


/* =========================
   ANALYSE STATISTIQUE
========================= */

function analyzeStats(matches, teamId) {

  let w = 0;

  let gf = 0;
  let ga = 0;

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let over25 = 0;
  let btts = 0;

  let clean = 0;
  let failed = 0;

  let opponentStrength = 0;


  matches.forEach((m, i) => {

    const home =
      Number(m.homeTeam.id) === Number(teamId);


    const scored = home
      ? Number(m.score.fullTime.home)
      : Number(m.score.fullTime.away);


    const conceded = home
      ? Number(m.score.fullTime.away)
      : Number(m.score.fullTime.home);


    const opponent =
      home
        ? m.awayTeam
        : m.homeTeam;


    const elo =
      Number(getTeamElo(opponent.id)) || 1500;


    /*
     * FORCE DE L'ADVERSAIRE
     */

    const oppStrength =
      clamp(
        ((elo - 1200) / 800) * 100,
        20,
        95
      );


    /*
     * RÉCENCE
     *
     * Les matchs récents comptent
     * légèrement davantage.
     */

    const recency =
      Math.max(
        0.85,
        1.25 - i * 0.04
      );


    const competitionWeight =
      COMP_WEIGHT[
        m.competition?.code
      ] || COMP_WEIGHT.DEFAULT;


    const weight =
      recency *
      competitionWeight *
      (0.8 + oppStrength / 250);


    w += weight;

    gf += scored * weight;
    ga += conceded * weight;

    opponentStrength +=
      oppStrength * weight;


    /*
     * RÉSULTAT
     */

    if (scored > conceded)
      wins++;

    else if (scored === conceded)
      draws++;

    else
      losses++;


    /*
     * MARCHÉS
     */

    if (scored + conceded >= 3)
      over25++;

    if (scored > 0 && conceded > 0)
      btts++;

    if (conceded === 0)
      clean++;

    if (scored === 0)
      failed++;
  });


  const played =
    matches.length;


  if (played === 0 || w <= 0)
    return null;


  /*
   * MOYENNES
   */

  const avgScored =
    avg(gf, w);


  const avgConceded =
    avg(ga, w);


  /*
   * POINTS
   */

  const points =
    wins * 3 + draws;


  const pointsRate =
    points /
    Math.max(
      played * 3,
      1
    );


  /*
   * DIFFÉRENCE DE BUTS
   */

  const goalBalance =
    avgScored -
    avgConceded;


  /*
   * FORCE
   */

  const strength =
    Math.round(
      clamp(
        50 +

        (avg(opponentStrength, w) - 50)
          * 0.12 +

        (avgScored - 1)
          * 7 +

        goalBalance
          * 5 +

        (1.8 - avgConceded)
          * 4 +

        (pointsRate - 0.5)
          * 20 +

        (clean / played)
          * 4 -

        (failed / played)
          * 4,

        25,
        90
      )
    );


  /*
   * STABILITÉ
   */

  const stability =
    Math.round(
      clamp(
        50 +

        (avgScored - 1)
          * 8 -

        (avgConceded - 1.2)
          * 8,

        25,
        90
      )
    );


  /*
   * FIABILITÉ
   */

  const reliability =
    Number(
      clamp(

        0.35 +

        Math.min(
          played / 10,
          1
        ) * 0.20 +

        pointsRate * 0.25 +

        (stability / 100)
          * 0.20,

        0.30,
        0.85

      ).toFixed(2)
    );


  /*
   * QUALITÉ DES DONNÉES
   */

  let dataQuality = "HIGH";

  if (played < 3)
    dataQuality = "LOW";

  else if (played < 5)
    dataQuality = "LIMITED";


  return {

    teamId,

    played,

    wins,
    draws,
    losses,

    strength,

    stability,

    reliability,

    avgScored:
      +avgScored.toFixed(2),

    avgConceded:
      +avgConceded.toFixed(2),

    goalBalance:
      +goalBalance.toFixed(2),

    over25Rate:
      Math.round(
        over25 / played * 100
      ),

    bttsRate:
      Math.round(
        btts / played * 100
      ),

    cleanSheets:
      clean,

    failedToScore:
      failed,

    averageOpponentStrength:
      Math.round(
        avg(opponentStrength, w)
      ),

    formPoints:
      +(
        points / played
      ).toFixed(2),

    dataAvailable: true,

    dataQuality,

    matchesUsed: played
  };
}


/* =========================
   ANALYSE ÉQUIPE
========================= */

async function analyzeTeam(team) {

  if (!team?.id)
    return null;


  const teamId =
    Number(team.id);


  /*
   * CACHE
   */

  if (CACHE.has(teamId)) {

    const cached =
      CACHE.get(teamId);

    const age =
      Date.now() - cached.time;


    const cacheTTL =
      cached.data === null
        ? EMPTY_CACHE_TTL
        : TTL;


    if (age < cacheTTL)
      return cached.data;


    CACHE.delete(teamId);
  }


  /*
   * ÉVITER DE LANCER
   * DEUX ANALYSES IDENTIQUES
   */

  if (RUNNING.has(teamId))
    return RUNNING.get(teamId);


  const promise =
    (async () => {

      try {

        const all =
          await getTeamMatches(teamId);


        const matches =
          (all || [])
            .filter(m =>

              m.status === "FINISHED" &&

              m.score?.fullTime &&

              Number.isFinite(
                Number(
                  m.score.fullTime.home
                )
              ) &&

              Number.isFinite(
                Number(
                  m.score.fullTime.away
                )
              )

            )
            .sort(
              (a, b) =>
                new Date(b.utcDate) -
                new Date(a.utcDate)
            )
            .slice(0, 8);


        /*
         * AUCUNE DONNÉE
         */

        if (matches.length === 0) {

          console.warn(
            `🚫 NO DATA → ${team.name}`
          );


          CACHE.set(teamId, {
            time: Date.now(),
            data: null
          });


          return null;
        }


        /*
         * ANALYSE
         */

        const result =
          analyzeStats(
            matches,
            teamId
          );


        if (!result) {

          CACHE.set(teamId, {
            time: Date.now(),
            data: null
          });

          return null;
        }


        result.teamName =
          team.name;


        CACHE.set(teamId, {
          time: Date.now(),
          data: result
        });


        console.log(
          `✅ ${team.name}` +
          ` | STR ${result.strength}` +
          ` | REL ${result.reliability}` +
          ` | DATA ${result.played}` +
          ` | QUALITY ${result.dataQuality}`
        );


        return result;


      } catch (error) {

        console.error(
          `❌ TEAM ANALYSIS ERROR → ${team.name}:`,
          error.message
        );


        CACHE.set(teamId, {
          time: Date.now(),
          data: null
        });


        return null;
      }

    })();


  RUNNING.set(
    teamId,
    promise
  );


  try {

    return await promise;

  } finally {

    RUNNING.delete(
      teamId
    );
  }
}


module.exports = {
  analyzeTeam
};
