/* =========================
   VIP FILTER ENGINE V17
========================= */


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
   VIP SCORE
========================= */


function calculateVipScore(match) {


  const home =
    match.teamStats.home;


  const away =
    match.teamStats.away;



  let score = 0;



  /*
    Confiance principale
  */

  score +=

    match.predictions
    .winnerConfidence
    *
    0.35;




  /*
    Qualité globale
  */

  score +=

    (
      match.qualityScore || 0
    )
    *
    0.30;




  /*
    Fiabilité
  */

  score +=

    (
      home.reliability +
      away.reliability
    )
    *
    15;




  /*
    Stabilité
  */

  score +=

    (
      home.stability +
      away.stability
    )
    *
    0.10;




  /*
    Différence de force
  */

  score +=

    Math.abs(
      home.strength -
      away.strength
    )
    *
    0.25;



  return Math.round(
    clamp(
      score,
      0,
      100
    )
  );

}





/* =========================
   VIP CONDITIONS
========================= */


function isVipMatch(match) {


  const home =
    match.teamStats.home;


  const away =
    match.teamStats.away;



  const confidence =
    match.predictions
    .winnerConfidence;



  const quality =
    match.qualityScore || 0;




  /*
    Conditions minimales
  */


  if (
    confidence < 65
  ) {

    return false;

  }



  if (
    quality < 55
  ) {

    return false;

  }



  if (
    home.reliability < 0.45 ||
    away.reliability < 0.45
  ) {

    return false;

  }



  if (
    home.stability < 40 ||
    away.stability < 40
  ) {

    return false;

  }




  /*
    Eviter les matchs trop équilibrés
  */


  const strengthDiff =

    Math.abs(
      home.strength -
      away.strength
    );



  if (
    strengthDiff < 5
  ) {

    return false;

  }



  return true;


}





/* =========================
   FILTER VIP MATCHES
========================= */


function filterVipMatches(matches) {


  return matches

    .filter(
      isVipMatch
    )

    .map(match => {


      return {

        ...match,

        vipScore:
          calculateVipScore(match)

      };


    })

    .sort(
      (a,b)=>
        b.vipScore -
        a.vipScore
    );


}





module.exports = {

  filterVipMatches,

  calculateVipScore

};
