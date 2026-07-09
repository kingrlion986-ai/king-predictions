const { analyzeTeam } = require("./teamAnalyzer");


/* =========================
   HELPERS
========================= */

function clamp(value, min, max) {

  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );

}


function round(value) {

  return Number(
    value.toFixed(2)
  );

}



/* =========================
   POISSON MODEL
========================= */


function poisson(lambda, goals) {


  let result = 1;


  for (let i = 1; i <= goals; i++) {

    result *= lambda / i;

  }


  return (
    Math.exp(-lambda) *
    result
  );

}



/* =========================
   WINNER ENGINE V17
========================= */


function calculateWinner(home, away) {


  /*
    Puissance offensive
  */

  const homeAttack =
    home.avgScored * 18;


  const awayAttack =
    away.avgScored * 18;




  /*
    Défense
  */

  const homeDefense =
    Math.max(
      0,
      2.5 - home.avgConceded
    )
    * 12;


  const awayDefense =
    Math.max(
      0,
      2.5 - away.avgConceded
    )
    * 12;




  /*
    Force globale
  */

  const homePower =

    home.strength * 0.45 +

    homeAttack * 0.15 +

    homeDefense * 0.10 +

    home.formPoints * 20 +

    home.reliability * 10 +

    8; // avantage domicile



  const awayPower =

    away.strength * 0.45 +

    awayAttack * 0.15 +

    awayDefense * 0.10 +

    away.formPoints * 20 +

    away.reliability * 10;




  /*
    Probabilité nul
  */

  let drawPower =
    18 -
    (
      Math.abs(
        homePower - awayPower
      )
      / 8
    );


  if (
    Math.abs(
      home.strength -
      away.strength
    )
    < 10
  ) {

    drawPower += 4;

  }


  drawPower =
    clamp(
      drawPower,
      8,
      25
    );




  const total =

    homePower +
    awayPower +
    drawPower;



  let homeWin =
    Math.round(
      homePower /
      total *
      100
    );


  let awayWin =
    Math.round(
      awayPower /
      total *
      100
    );


  let draw =
    100 -
    homeWin -
    awayWin;



  let winner = "DRAW";

  let confidence = draw;



  if (
    homeWin > awayWin &&
    homeWin > draw
  ) {

    winner =
      home.teamName;

    confidence =
      homeWin;

  }



  if (
    awayWin > homeWin &&
    awayWin > draw
  ) {

    winner =
      away.teamName;

    confidence =
      awayWin;

  }



  return {

    winner,


    winnerConfidence:
      clamp(
        confidence,
        45,
        90
      ),


    probabilities:{

      homeWin,

      draw,

      awayWin

    }

  };


}

 /* =========================
    EXPECTED GOALS ENGINE V17
 ========================= */

function calculateExpectedGoals(home, away) {


  /*
    Force offensive domicile
  */

  const homeAttack =

    (
      home.homeAttack * 0.45
    )

    +

    (
      home.avgScored * 0.35
    )

    +

    (
      home.formPoints * 0.20
    );





  /*
    Force offensive extérieur
  */

  const awayAttack =

    (
      away.awayAttack * 0.45
    )

    +

    (
      away.avgScored * 0.35
    )

    +

    (
      away.formPoints * 0.20
    );





  /*
    Faiblesse défensive adverse
  */

  const awayDefense =

    (
      away.avgConceded * 0.60
    )

    +

    (
      away.awayDefense * 0.40
    );




  const homeDefense =

    (
      home.avgConceded * 0.60
    )

    +

    (
      home.homeDefense * 0.40
    );






  /*
    Calcul xG brut
  */

  let expectedHomeGoals =

    (
      homeAttack * 0.65
    )

    +

    (
      awayDefense * 0.35
    );




  let expectedAwayGoals =

    (
      awayAttack * 0.65
    )

    +

    (
      homeDefense * 0.35
    );






  /*
    Avantage domicile
  */

  expectedHomeGoals += 0.18;




  /*
    Ajustements de stabilité

    Une équipe instable
    produit moins de certitude
  */

  if (
    home.stability < 45
  ) {

    expectedHomeGoals *= 0.90;

  }


  if (
    away.stability < 45
  ) {

    expectedAwayGoals *= 0.90;

  }





  /*
    Normalisation finale
  */

  expectedHomeGoals =

    clamp(
      expectedHomeGoals,
      0.20,
      3.20
    );



  expectedAwayGoals =

    clamp(
      expectedAwayGoals,
      0.20,
      3.20
    );





  return {


    expectedHomeGoals:
      round(
        expectedHomeGoals
      ),



    expectedAwayGoals:
      round(
        expectedAwayGoals
      ),



    totalExpectedGoals:

      round(
        expectedHomeGoals +
        expectedAwayGoals
      )

  };


}
 /* =========================
    OVER / UNDER 2.5 ENGINE V17
 ========================= */

function calculateOver25(home, away, xg) {


  const totalXG =
    xg.expectedHomeGoals +
    xg.expectedAwayGoals;



  /*
    Probabilité approximative
    basée sur Poisson
  */

  let probabilityOver = 0;


  for (let goals = 3; goals <= 8; goals++) {


    /*
      Simplification :
      on utilise le total xG
      pour estimer les buts
    */

    probabilityOver +=
      poisson(
        totalXG,
        goals
      );

  }




  let confidence =

    Math.round(
      clamp(
        probabilityOver * 100,
        20,
        90
      )
    );




  /*
    Correction avec historiques
  */

  confidence +=

    (
      home.over25Rate +
      away.over25Rate
    )
    /
    20;



  confidence = Math.round(
    clamp(
      confidence,
      25,
      90
    )
  );



  return {


    value:

      confidence >= 55
      ?
      "OVER 2.5"
      :
      "UNDER 2.5",



    confidence,



    expectedGoals:
      round(totalXG)

  };


}





/* =========================
   BTTS ENGINE V17
========================= */

function calculateBTTS(home, away, xg) {


  /*
    Probabilité que chaque équipe
    marque au moins 1 but
  */


  const homeScoreChance =

    1 -
    Math.exp(
      -xg.expectedHomeGoals
    );



  const awayScoreChance =

    1 -
    Math.exp(
      -xg.expectedAwayGoals
    );



  let probability =

    homeScoreChance *
    awayScoreChance;



  /*
    Ajustement statistiques
  */


  probability +=

    (
      home.bttsRate +
      away.bttsRate
    )
    /
    500;



  /*
    Défenses solides
    réduisent BTTS
  */


  if (
    home.cleanSheets >= 4 ||
    away.cleanSheets >= 4
  ) {

    probability -= 0.08;

  }




  let confidence =

    Math.round(
      clamp(
        probability * 100,
        20,
        90
      )
    );





  return {


    value:

      confidence >= 55
      ?
      "OUI"
      :
      "NON",



    confidence

  };


}
 /* =========================
    SCORE EXACT ENGINE V17
 ========================= */

function generateScore(xg, winner, homeName, awayName) {


  let homeGoals =
    Math.round(
      xg.expectedHomeGoals
    );


  let awayGoals =
    Math.round(
      xg.expectedAwayGoals
    );



  homeGoals =
    clamp(
      homeGoals,
      0,
      4
    );


  awayGoals =
    clamp(
      awayGoals,
      0,
      4
    );



  /*
    Cohérence avec le vainqueur
  */


  if (
    winner === homeName &&
    homeGoals <= awayGoals
  ) {

    homeGoals =
      awayGoals + 1;

  }



  if (
    winner === awayName &&
    awayGoals <= homeGoals
  ) {

    awayGoals =
      homeGoals + 1;

  }



  if (
    winner === "DRAW"
  ) {

    const average =
      Math.round(
        (
          homeGoals +
          awayGoals
        )
        / 2
      );


    homeGoals = average;
    awayGoals = average;

  }




  /*
    Limite finale
  */

  homeGoals =
    clamp(
      homeGoals,
      0,
      4
    );


  awayGoals =
    clamp(
      awayGoals,
      0,
      4
    );



  return `${homeGoals}-${awayGoals}`;

}






/* =========================
   ANALYSIS CACHE
========================= */


const ANALYSIS_CACHE =
  new Map();



const ANALYSIS_TTL =
  5 * 60 * 1000;





function getMatchKey(match) {

  return (

    match.homeTeam.id +
    "_" +
    match.awayTeam.id +
    "_" +
    match.utcDate

  );

}





/* =========================
   MAIN ANALYZER V17
========================= */


async function analyzeMatch(match) {


  const key =
    getMatchKey(match);



  const cached =
    ANALYSIS_CACHE.get(key);



  if (
    cached &&
    Date.now() - cached.time
    <
    ANALYSIS_TTL
  ) {

    return cached.data;

  }





  const homeStats =
    await analyzeTeam(
      match.homeTeam
    );


  const awayStats =
    await analyzeTeam(
      match.awayTeam
    );





  const winner =
    calculateWinner(
      homeStats,
      awayStats
    );





  const xg =
    calculateExpectedGoals(
      homeStats,
      awayStats
    );





  const over25 =
    calculateOver25(
      homeStats,
      awayStats,
      xg
    );





  const btts =
    calculateBTTS(
      homeStats,
      awayStats,
      xg
    );





  const score =
    generateScore(
      xg,
      winner.winner,
      match.homeTeam.name,
      match.awayTeam.name
    );





  const result = {


    match: {
    id: match.id,
    utcDate: match.utcDate,
    competition: match.competition,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam
},



    predictions:{


      winner:
        winner.winner,


      winnerConfidence:
        winner.winnerConfidence,



      probabilities:
        winner.probabilities,



      over25:
        over25.value,


      over25Confidence:
        over25.confidence,



      btts:
        btts.value,


      bttsConfidence:
        btts.confidence,



      correctScore:
        score


    },



    teamStats:{


      home:
        homeStats,


      away:
        awayStats


    },



    model:{


      expectedGoals:
        xg.totalExpectedGoals,


      expectedHomeGoals:
        xg.expectedHomeGoals,


      expectedAwayGoals:
        xg.expectedAwayGoals


    }


  };





  ANALYSIS_CACHE.set(
    key,
    {
      time:Date.now(),
      data:result
    }
  );



  return result;


}





module.exports = {

  analyzeMatch

};
