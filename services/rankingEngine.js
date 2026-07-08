function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}


/* =========================
   QUALITY SCORE
========================= */

function calculateQuality(a) {

  const home = a.teamStats.home;
  const away = a.teamStats.away;


  // confiance du marché principal
  let score =
    a.predictions.winnerConfidence * 0.45;


  // fiabilité des données
  const reliability =
    ((home.reliability || 0) +
     (away.reliability || 0)) / 2;

  score += reliability * 25;


  // écart de niveau
  const strengthDiff =
    Math.abs(
      home.strength -
      away.strength
    );

  // trop équilibré = plus dangereux
  if (strengthDiff < 5) {
    score -= 10;
  }

  if (strengthDiff > 20) {
    score += 8;
  }


  // forme récente
  score +=
    ((home.formPoints + away.formPoints) / 2) * 15;


  return clamp(
    Math.round(score),
    0,
    100
  );
}


/* =========================
   SORT FUNCTIONS
========================= */

function byWinnerConfidence(a, b) {

  function score(match){

    const home = match.teamStats.home;
    const away = match.teamStats.away;

    let quality =
      match.predictions.winnerConfidence;


    // pénalité manque de données
    if(home.played < 3 || away.played < 3){
      quality -= 15;
    }


    // pénalité match trop équilibré
    const diff =
      Math.abs(
        home.strength -
        away.strength
      );

    if(diff < 5){
      quality -= 10;
    }


    // bonus fiabilité
    quality +=
      (
        home.reliability +
        away.reliability
      ) * 5;


    return quality;

  }


  return score(b) - score(a);

}


function byOver25(a,b) {

  const scoreA =
    a.predictions.over25Confidence +
    a.model.expectedGoals * 5;

  const scoreB =
    b.predictions.over25Confidence +
    b.model.expectedGoals * 5;


  return scoreB - scoreA;

}


function byBTTS(a,b) {

  const scoreA =
    a.predictions.bttsConfidence +
    ((a.teamStats.home.bttsRate +
      a.teamStats.away.bttsRate) / 2);

  const scoreB =
    b.predictions.bttsConfidence +
    ((b.teamStats.home.bttsRate +
      b.teamStats.away.bttsRate) / 2);


  return scoreB - scoreA;

}


function byScore(a,b) {

  return (
    b.model.expectedGoals -
    a.model.expectedGoals
  );

}



/* =========================
   EXPORTS
========================= */

function rankMatches(analyses) {

  return [...analyses]
    .sort(byWinnerQuality);

}


function rankOver25Matches(analyses) {

  return [...analyses]
    .sort(byOver25);

}


function rankBTTSMatches(analyses) {

  return [...analyses]
    .sort(byBTTS);

}


function rankScoreMatches(analyses) {

  return [...analyses]
    .sort(byScore);

}


module.exports = {

  rankMatches,
  rankOver25Matches,
  rankBTTSMatches,
  rankScoreMatches,
  calculateQuality

};
