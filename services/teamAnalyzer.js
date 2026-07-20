const { getTeamMatches } = require("./footballApi");


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
  )
    ? value
    : 0;

}



/* =========================
   CACHE SYSTEM
========================= */

const CACHE = new Map();

const RUNNING = new Map();


const CACHE_DURATION =
  1000 * 60 * 60 * 6;

const COMPETITION_LEVEL = {

  // Top niveau
  CL: 1.25,
  PL: 1.20,
  PD: 1.20,
  SA: 1.18,
  BL1: 1.18,
  FL1: 1.16,


  // Bons championnats
  DED: 1.08,
  BSA: 1.08,
  PPL: 1.10,


  // Deuxième divisions
  ELC: 1.05,
  BL2: 0.95,
  FL2: 0.95,
  SD: 0.90,
  SA2: 0.90,


  DEFAULT: 1.00
};
const TEAM_STRENGTHS = new Map();

function getOpponentStrength(opponent) {

  if (!opponent || !opponent.id) {
    return 50;
  }

  return TEAM_STRENGTHS.get(opponent.id) || 50;

}

/* =========================
   BUILD TEAM STATISTICS
========================= */


function buildStats(matches, teamId) {

   let momentum = 0;
   let opponentStrengthTotal = 0;

   let homeWeight = 0;
   let awayWeight = 0;

   let attackPower = 0;
   let defensePower = 0;


  let weightedScored = 0;
  let weightedConceded = 0;


  let homeScored = 0;
  let homeConceded = 0;

  let awayScored = 0;
  let awayConceded = 0;


  let homeGames = 0;
  let awayGames = 0;


  let wins = 0;
  let draws = 0;
  let losses = 0;


  let cleanSheets = 0;
  let failedToScore = 0;


  let over25 = 0;
  let btts = 0;

let recentForm = 0;

  const totalMatches =
    matches.length || 1;



  matches.forEach(
    (match,index)=> {


      /*
        Match récent =
        poids plus élevé

        Match 1 = plus ancien
        Dernier match = poids maximum
      */

      const isHome =
  match.homeTeam.id === teamId;

const opponent =
  isHome
    ? match.awayTeam
    : match.homeTeam;

const opponentStrength =
  getOpponentStrength(opponent);

const competitionWeight =
  COMPETITION_LEVEL[
    match.competition?.code
  ] || COMPETITION_LEVEL.DEFAULT;

const opponentFactor =
  0.75 + (opponentStrength / 100) * 0.5;

const weight =
  (2 - (index / totalMatches)) *
  competitionWeight *
  opponentFactor;

opponentStrengthTotal += opponentStrength * weight;



      const goalsFor =
        isHome
        ? safe(
            match.score.fullTime.home
          )
        :
            safe(
            match.score.fullTime.away
          );



      const goalsAgainst =
        isHome
        ? safe(
            match.score.fullTime.away
          )
        :
            safe(
            match.score.fullTime.home
          );

       attackPower += goalsFor * weight;
defensePower += Math.max(0, 3 - goalsAgainst) * weight;



      weightedScored +=
        goalsFor * weight;


      weightedConceded +=
        goalsAgainst * weight;



      if (isHome) {

         homeWeight += weight;

        homeGames++;

        homeScored +=
          goalsFor * weight;

        homeConceded +=
          goalsAgainst * weight;

} else {

    awayWeight += weight;

    awayGames++;

    awayScored += goalsFor * weight;

    awayConceded += goalsAgainst * weight;

      }



      if (goalsFor > goalsAgainst) {
    wins++;
    recentForm += weight * 3;
    momentum += 3 * weight;
}
else if (goalsFor === goalsAgainst) {
    draws++;
    recentForm += weight;
    momentum += 1 * weight;
}
else {
    losses++;
}



      if (goalsAgainst === 0)
        cleanSheets++;



      if (goalsFor === 0)
        failedToScore++;



      if (
        goalsFor + goalsAgainst >= 3
      )
        over25++;



      if (
        goalsFor > 0 &&
        goalsAgainst > 0
      )
        btts++;



    }
  );


  const weightTotal =
    matches.reduce(
      (sum,_,index)=>
        sum +
        (1 + index / totalMatches),
      0
    );



  return {

    played: matches.length || 1,


    wins,
    draws,
    losses,


     momentum: round(momentum / weightTotal),

averageOpponentStrength: round(
    opponentStrengthTotal / weightTotal
),

    avgScored:
      round(
        weightedScored /
        weightTotal
      ),


    avgConceded:
      round(
        weightedConceded /
        weightTotal
      ),


    homeAttack: round(homeScored / Math.max(homeWeight, 1)),
    awayAttack: round(awayScored / Math.max(awayWeight, 1)),
    homeDefense: round(homeConceded / Math.max(homeWeight, 1)),
    awayDefense: round(awayConceded / Math.max(awayWeight, 1)),

     attackPower: round(attackPower / weightTotal),
     defensePower: round(defensePower / weightTotal),
     
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
    weightTotal
  )

};

}
/* =========================
    STABILITY INDEX
 ========================= */

function computeStability(stats) {


  const total =
    stats.played || 1;


  const resultSpread =
    Math.abs(stats.wins - stats.losses)
    /
    total;


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
      resultSpread * 0.35 +
      defensiveStability * 0.35 +
      offensiveStability * 0.30
    ) * 100;



  return Math.round(
    clamp(
      stability,
      20,
      95
    )
  );

}



/* =========================
   STRENGTH ENGINE V17
========================= */

function computeStrength(stats) {

  let strength = 40;

  // Attaque
strength += stats.avgScored * 6;

  // Défense
  strength += Math.max(
    0,
    2.5 - stats.avgConceded
  ) * 6;

  // Résultats
  const points =
    (
      stats.wins * 3 +
      stats.draws
    ) /
    (stats.played * 3);

  strength += points * 20;

  // Avantage domicile / extérieur
  strength += stats.homeAttack * 2;
  strength += stats.awayAttack * 2;

  // Clean sheets
  strength +=
(stats.cleanSheets / stats.played) * 8;
  // Difficulté à marquer
  strength -=
    (stats.failedToScore / stats.played) * 8;

  // Matchs offensifs
  strength +=
    (stats.over25Rate / 100) * 3;

  // Régularité
  strength +=
computeStability(stats) * 0.15;

   strength += stats.recentForm * 6;

   strength += stats.momentum * 5;

  return Math.round(
    clamp(
      strength,
      20,
      95
    )
  );

}



/* =========================
   RELIABILITY ENGINE V17
========================= */

function computeReliability(stats) {


  let reliability = 0.35;



  /*
    Quantité de données
  */

  reliability +=
    Math.min(
      stats.played,
      10
    )
    * 0.035;



  /*
    Forme récente
  */

  reliability +=
    (
      stats.wins /
      Math.max(
        stats.played,
        1
      )
    )
    * 0.20;



  /*
    Stabilité
  */

  reliability +=
    (
      computeStability(stats)
      /
      100
    )
    * 0.20;



  return Number(
    clamp(
      reliability,
      0.30,
      0.95
    )
    .toFixed(2)
  );

}

 /* =========================
    MAIN ANALYZER V17
 ========================= */

async function analyzeTeam(team) {


  /*
    CACHE
  */

  if (CACHE.has(team.id)) {


    const cached =
      CACHE.get(team.id);


    if (
      Date.now() - cached.time
      <
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




  /*
    ANTI DOUBLE REQUÊTE
  */

  if (RUNNING.has(team.id)) {


    console.log(
      "⏳ ANALYSE EN COURS:",
      team.name
    );


    return RUNNING.get(team.id);

  }

   



  const promise =
  (async()=>{

    const matches = await getTeamMatches(team.id);

    /*
      FALLBACK
      Si l'API ne donne aucune donnée
    */

    if (
      !matches ||
      matches.length === 0
    ) {


      const fallback = {


        teamName:
          team.name,


        teamId:
          team.id,



        played:0,


        strength:50,

        rawStrength:50,


        reliability:0.30,

        stability:30,



        avgScored:1,

        avgConceded:1,



        homeAttack:1,

        awayAttack:1,


        homeDefense:1,

        awayDefense:1,



        wins:0,

        draws:0,

        losses:0,


        cleanSheets:0,

        failedToScore:0,



        over25Rate:50,

        bttsRate:50,


        formPoints:0.5


      };



      CACHE.set(
        team.id,
        {
          time:Date.now(),
          data:fallback
        }
      );



      return fallback;

    }

    /*
      On garde uniquement
      les 8 derniers matchs
    */

    const recentMatches =
      matches

      .filter(
        m =>
        m.status === "FINISHED"
      )

      .sort(
        (a,b)=>
        new Date(b.utcDate)
        -
        new Date(a.utcDate)
      )

      .slice(0,8);





    const stats =
      buildStats(
        recentMatches,
        team.id
      );




    const strength =
      computeStrength(stats);

     TEAM_STRENGTHS.set(team.id, strength);



    const reliability =
      computeReliability(stats);



    const stability =
      computeStability(stats);





    const result = {


      teamName:
        team.name,


      teamId:
        team.id,



      played:
        stats.played,



      /*
        Même valeur partout
        pour éviter les incohérences
      */

      strength,

      rawStrength:
        strength,



      reliability,

      stability,



      avgScored:
        stats.avgScored,


      avgConceded:
        stats.avgConceded,

       


      homeAttack:
        stats.homeAttack,


      awayAttack:
        stats.awayAttack,



      homeDefense:
        stats.homeDefense,


      awayDefense:
        stats.awayDefense,

       attackPower: stats.attackPower,
       defensePower: stats.defensePower,



      wins:
        stats.wins,


      draws:
        stats.draws,


      losses:
        stats.losses,



      cleanSheets:
        stats.cleanSheets,


      failedToScore:
        stats.failedToScore,



      over25Rate:
        stats.over25Rate,


      bttsRate:
        stats.bttsRate,



      formPoints: stats.recentForm,

       momentum:
  stats.momentum,

averageOpponentStrength:
  stats.averageOpponentStrength,

formScore:
  Math.round(
    strength * 0.45 +
    stability * 0.30 +
    reliability * 100 * 0.25
  ),


    };




    console.log(
      "===== TEAM ANALYZER V17 ====="
    );


    console.log(
      result.teamName,
      result.strength,
      result.reliability
    );




    CACHE.set(
      team.id,
      {
        time:Date.now(),
        data:result
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



/* =========================
   EXPORT
========================= */

module.exports = {

  analyzeTeam

};
