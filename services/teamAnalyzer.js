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



/* =========================
   BUILD TEAM STATISTICS
========================= */


function buildStats(matches, teamId) {


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

      const weight =
        1 +
        (
          index /
          totalMatches
        );



      const isHome =
        match.homeTeam.id === teamId;



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



      weightedScored +=
        goalsFor * weight;


      weightedConceded +=
        goalsAgainst * weight;



      if (isHome) {

        homeGames++;

        homeScored +=
          goalsFor * weight;

        homeConceded +=
          goalsAgainst * weight;


      } else {


        awayGames++;

        awayScored +=
          goalsFor * weight;

        awayConceded +=
          goalsAgainst * weight;


      }



      if (goalsFor > goalsAgainst)
        wins++;

      else if (goalsFor === goalsAgainst)
        draws++;

      else
        losses++;



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


    homeAttack:
      round(
        homeScored /
        Math.max(homeGames,1)
      ),


    awayAttack:
      round(
        awayScored /
        Math.max(awayGames,1)
      ),


    homeDefense:
      round(
        homeConceded /
        Math.max(homeGames,1)
      ),


    awayDefense:
      round(
        awayConceded /
        Math.max(awayGames,1)
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


  let strength = 50;



  /*
    Attaque
  */

  strength +=
    stats.avgScored * 12;



  /*
    Défense
  */

  strength +=
    Math.max(
      0,
      2.5 - stats.avgConceded
    )
    * 10;



  /*
    Résultats récents
  */

  const points =
    (
      stats.wins * 3 +
      stats.draws
    )
    /
    (
      stats.played * 3
    );


  strength +=
    points * 25;



  /*
    Avantage domicile / extérieur
  */

  strength +=
    stats.homeAttack * 4;


  strength +=
    stats.awayAttack * 4;



  /*
    Clean sheets
  */

  strength +=
    (
      stats.cleanSheets /
      stats.played
    )
    * 8;



  /*
    Difficulté à marquer
  */

  strength -=
    (
      stats.failedToScore /
      stats.played
    )
    * 12;



  /*
    Matchs offensifs
  */

  strength +=
    (
      stats.over25Rate /
      100
    )
    * 5;



  /*
    Régularité
  */

  strength +=
    computeStability(stats)
    * 0.10;



  return Math.round(
    clamp(
      strength,
      10,
      100
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


    const matches =
      await getTeamMatches(
        team.id
      );



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



      formPoints:
        round(
          (
            stats.wins * 3 +
            stats.draws
          )
          /
          (
            stats.played * 3
          )
        )


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
