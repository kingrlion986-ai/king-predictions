/*
========================================================
 KING PREDICTIONS AI
 VIP FILTER ENGINE V32
 SIMPLE • STRICT • SMART
========================================================
*/

const n = v =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

const avg = (a, b) =>
  (n(a) + n(b)) / 2;

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n(v)));


/* =========================
   HELPERS
========================= */

function predictions(m) {
  return m?.predictions || {};
}

function home(m) {
  return m?.teamStats?.home || {};
}

function away(m) {
  return m?.teamStats?.away || {};
}

function dataQuality(m) {
  const h = n(home(m).played);
  const a = n(away(m).played);

  if (Math.min(h, a) >= 8) return 100;
  if (Math.min(h, a) >= 6) return 85;
  if (Math.min(h, a) >= 5) return 70;

  return 0;
}

function unsafe(m) {
  const p = predictions(m);

  return (
    p.aiDecision?.decision === "TRAP MATCH" ||
    p.aiDecision?.risk === "VERY HIGH" ||
    p.risk === "VERY HIGH"
  );
}


/* =========================
   1X2
========================= */

function calculateVIPScore(m) {

  const p = predictions(m);
  const h = home(m);
  const a = away(m);

  const probs = p.probabilities || {};

  const values = [
    n(probs.homeWin),
    n(probs.draw),
    n(probs.awayWin)
  ].sort((x, y) => y - x);

  const favorite = values[0];
  const separation = values[0] - values[1];

  const reliability =
    avg(h.reliability, a.reliability) * 100;

  const stability =
    avg(h.stability, a.stability);

  const quality = dataQuality(m);

  let score =
    n(p.winnerConfidence) * 0.35 +
    favorite * 0.25 +
    separation * 0.20 +
    reliability * 0.10 +
    stability * 0.05 +
    quality * 0.05;

  return Math.round(clamp(score));
}


/* =========================
   OVER 2.5
========================= */

function calculateOver25Score(m) {

  const p = predictions(m);
  const h = home(m);
  const a = away(m);

  const xg = n(m.model?.expectedGoals);

  const overRate =
    avg(h.over25Rate, a.over25Rate);

  const reliability =
    avg(h.reliability, a.reliability) * 100;

  let score =
    n(p.over25Confidence) * 0.40 +
    overRate * 0.20 +
    clamp((xg - 2) * 25) * 0.25 +
    reliability * 0.10 +
    dataQuality(m) * 0.05;

  return Math.round(clamp(score));
}


/* =========================
   BTTS
========================= */

function calculateBttsScore(m) {

  const p = predictions(m);
  const h = home(m);
  const a = away(m);

  const xg = n(m.model?.expectedGoals);

  const bttsRate =
    avg(h.bttsRate, a.bttsRate);

  const reliability =
    avg(h.reliability, a.reliability) * 100;

  let score =
    n(p.bttsConfidence) * 0.40 +
    bttsRate * 0.25 +
    clamp((xg - 1.8) * 30) * 0.20 +
    reliability * 0.10 +
    dataQuality(m) * 0.05;

  return Math.round(clamp(score));
}


/* =========================
   VIP 1X2
========================= */

function filterVipMatches(matches = []) {

  return matches
    .filter(m => !unsafe(m))
    .filter(m => dataQuality(m) >= 70)
    .map(m => ({
      ...m,
      vipScore: calculateVIPScore(m)
    }))
    .filter(m => {

      const p = predictions(m);
      const probs = p.probabilities || {};

      const values = [
        n(probs.homeWin),
        n(probs.draw),
        n(probs.awayWin)
      ].sort((a, b) => b - a);

      return (
        p.winner !== "DRAW" &&
        n(p.winnerConfidence) >= 62 &&
        values[0] >= 60 &&
        values[0] - values[1] >= 10 &&
        m.vipScore >= 68
      );
    })
    .sort((a, b) => b.vipScore - a.vipScore);
}


/* =========================
   VIP OVER
========================= */

function filterVipOver25(matches = []) {

  return matches
    .filter(m => !unsafe(m))
    .filter(m => dataQuality(m) >= 70)
    .map(m => ({
      ...m,
      vipScore: calculateOver25Score(m)
    }))
    .filter(m => {

      const p = predictions(m);
      const xg = n(m.model?.expectedGoals);

      return (
        p.over25 === "OVER 2.5" &&
        n(p.over25Confidence) >= 60 &&
        xg >= 2.20 &&
        m.vipScore >= 65
      );
    })
    .sort((a, b) => b.vipScore - a.vipScore);
}


/* =========================
   VIP BTTS
========================= */

function filterVipBtts(matches = []) {

  return matches
    .filter(m => !unsafe(m))
    .filter(m => dataQuality(m) >= 70)
    .map(m => ({
      ...m,
      vipScore: calculateBttsScore(m)
    }))
    .filter(m => {

      const p = predictions(m);
      const xg = n(m.model?.expectedGoals);

      return (
        p.btts === "OUI" &&
        n(p.bttsConfidence) >= 60 &&
        xg >= 2.00 &&
        m.vipScore >= 65
      );
    })
    .sort((a, b) => b.vipScore - a.vipScore);
}


/* =========================
   MASTER
========================= */

function getBestVipMatches(matches = []) {

  return [
    ...filterVipMatches(matches).map(m => ({
      ...m,
      vipMarket: "1X2"
    })),

    ...filterVipOver25(matches).map(m => ({
      ...m,
      vipMarket: "OVER 2.5"
    })),

    ...filterVipBtts(matches).map(m => ({
      ...m,
      vipMarket: "BTTS"
    }))
  ].sort((a, b) => b.vipScore - a.vipScore);
}


module.exports = {
  filterVipMatches,
  filterVipOver25,
  filterVipBtts,
  getBestVipMatches,
  calculateVIPScore,
  calculateOver25Score,
  calculateBttsScore,
  dataQuality,
  unsafe
};
