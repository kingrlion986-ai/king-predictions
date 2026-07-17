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


  const probabilities =
    match.predictions.probabilities;


  let score = 0;

  if (match.model.elo) {

    const eloDiff =
        Math.abs(
            match.model.elo.home -
            match.model.elo.away
        );


    score +=
        Math.min(
            eloDiff / 20,
            10
        );

  }



  /*
     Confiance du modèle
  */

  score +=
    (
      match.predictions.confidence || 0
    )
    *
    0.35;



  /*
     Séparation des probabilités

     Exemple :
     55 / 25 / 20 = meilleur
     38 / 32 / 30 = faible
  */

  const values = [

    probabilities.homeWin,

    probabilities.draw,

    probabilities.awayWin

  ];


  const sorted =
    [...values].sort(
      (a,b)=>b-a
    );


  const separation =
    sorted[0] - sorted[1];


  score +=
    separation
    *
    0.40;



  /*
     Qualité données
  */

  const dataQuality =

    (
      Math.min(home.played,15)
      +
      Math.min(away.played,15)
    )
    /
    30
    *
    100;



  score +=
    dataQuality
    *
    0.10;



  /*
     Stabilité équipes
  */

  score +=

    (
      home.stability +
      away.stability
    )
    /
    2
    *
    0.10;



  /*
     xG réalistes
  */

  if (

    match.model.expectedGoals >= 1.8
    &&
    match.model.expectedGoals <= 4

  ) {

    score += 5;

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
    match.predictions.over25Confidence >= 30
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
30

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
