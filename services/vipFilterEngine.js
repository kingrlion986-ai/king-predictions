function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}


/* =========================
   VIP SCORE
========================= */

function getVipScore(home, away) {

  let score = 50;


  // Force générale
  const avgStrength =
    (home.strength + away.strength) / 2;

  score += avgStrength * 0.25;


  // Fiabilité des données
  const reliability =
    ((home.reliability || 0) +
     (away.reliability || 0)) / 2;

  score += reliability * 30;


  // Forme récente
  const form =
    ((home.formPoints || 0) +
     (away.formPoints || 0)) / 2;

  score += form * 20;


  // Écart de niveau
  const diff =
    Math.abs(
      home.strength -
      away.strength
    );


  // Trop équilibré = risque nul
  if (diff < 5) {
    score -= 15;
  }


  // Très gros écart = favori clair
  if (diff > 20) {
    score += 10;
  }


  // Attaque des équipes
  score +=
    (home.avgScored +
     away.avgScored) * 3;


  // Défense fragile = plus incertain
  if (
    home.avgConceded > 2.5 &&
    away.avgConceded > 2.5
  ) {
    score -= 10;
  }


  return clamp(
    Math.round(score),
    0,
    100
  );
}


/* =========================
   VIP CHECK
========================= */

function isVipMatch(home, away) {

  const vipScore =
    getVipScore(home, away);


  const avgStrength =
    (home.strength + away.strength) / 2;


  const reliability =
    ((home.reliability || 0) +
     (away.reliability || 0)) / 2;


  // équipes trop faibles
  if (avgStrength < 35)
    return false;


  // données insuffisantes
  if (reliability < 0.45)
    return false;


  // score minimum VIP
  if (vipScore < 65)
    return false;


  return true;
}


/* =========================
   FILTER
========================= */

function filterVipMatches(analyses) {

  return analyses.filter(a =>
    isVipMatch(
      a.teamStats.home,
      a.teamStats.away
    )
  );

}


module.exports = {

  getVipScore,
  isVipMatch,
  filterVipMatches

};
