const {
  analyzeMatch
} = require("./predictionEngine");


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


/* =========================
   QUALITY SCORE ENGINE V17
========================= */


function calculateQuality(match) {


  const home =
    match.teamStats.home;


  const away =
    match.teamStats.away;



  let score = 0;



  /*
    Confiance vainqueur
  */

  score +=
    match.predictions.winnerConfidence
    *
    0.35;



  /*
    Fiabilité des équipes
  */

  score +=

    (
      home.reliability +
      away.reliability
    )
    *
    20;



  /*
    Stabilité
  */

  score +=

    (
      home.stability +
      away.stability
    )
    *
    0.15;



  /*
    Différence de niveau
  */

  score +=

    Math.abs(
      home.strength -
      away.strength
    )
    *
    0.30;



  /*
    Cohérence xG
  */


  if (

    match.model.expectedGoals >= 1.8
    &&
    match.model.expectedGoals <= 3.8

  ) {

    score += 8;

  }



  /*
    Pénalité équipes faibles
  */


  if (
    home.strength < 35 ||
    away.strength < 35
  ) {

    score -= 10;

  }




  return Math.round(
    clamp(
      score,
      0,
      100
    )
  );


}





/* =========================
   PREPARE RANKING
========================= */


function addQualityScores(matches) {


  return matches.map(match => {


    return {

      ...match,

      qualityScore:
        calculateQuality(match)

    };


  });


}
 /* =========================
    GENERIC RANKING
 ========================= */


function sortByQuality(matches) {

  return matches.sort(
    (a,b) =>
      b.qualityScore -
      a.qualityScore
  );

}





/* =========================
   WINNER RANKING
========================= */


function rankMatches(matches) {


  const ranked =
    addQualityScores(
      matches
    );


  return sortByQuality(
    ranked
  );


}





/* =========================
   OVER 2.5 RANKING
========================= */


function rankOver25Matches(matches) {


  const filtered =

    matches.filter(match => {


      return (
        match.predictions.over25Confidence
        >=
        50
      );


    });



  const ranked =
    addQualityScores(
      filtered
    );



  return ranked.sort(
    (a,b) => {


      const scoreA =
        a.predictions.over25Confidence
        +
        a.qualityScore;


      const scoreB =
        b.predictions.over25Confidence
        +
        b.qualityScore;



      return scoreB - scoreA;


    }
  );


}





/* =========================
   BTTS RANKING
========================= */


function rankBTTSMatches(matches) {


  const filtered =

    matches.filter(match => {


      return (

        match.predictions
        .bttsConfidence
        >=
        50

      );


    });



  const ranked =
    addQualityScores(
      filtered
    );



  return ranked.sort(
    (a,b)=>{


      const scoreA =

        a.predictions.bttsConfidence
        +
        a.qualityScore;



      const scoreB =

        b.predictions.bttsConfidence
        +
        b.qualityScore;



      return scoreB - scoreA;


    }
  );


}





/* =========================
   SCORE EXACT RANKING
========================= */


function rankScoreMatches(matches) {


  const ranked =
    addQualityScores(
      matches
    );



  return ranked.sort(
    (a,b)=>{


      const scoreA =

        a.qualityScore
        +
        (
          a.model.expectedGoals
          *
          10
        );



      const scoreB =

        b.qualityScore
        +
        (
          b.model.expectedGoals
          *
          10
        );



      return scoreB - scoreA;


    }
  );


}





/* =========================
   EXPORTS
========================= */


module.exports = {


  rankMatches,


  rankOver25Matches,


  rankBTTSMatches,


  rankScoreMatches,


  calculateQuality


};
