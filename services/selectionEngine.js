const {
  rankMatches,
  rankOver25Matches,
  rankBTTSMatches,
  rankScoreMatches
} = require("./rankingEngine");

async function buildSelections(matches, SETTINGS) {

  const selections = {};

  const usedMatches = new Set();

  // ========= 1X2 =========
  const oneXTwo = await rankMatches(matches);

  selections.oneXTwo = oneXTwo
    .filter(a => !usedMatches.has(a.match))
    .slice(0, SETTINGS.maxVIP_1X2);

  selections.oneXTwo.forEach(a =>
    usedMatches.add(a.match)
  );

  // ========= OVER 2.5 =========
  const over = await rankOver25Matches(matches);

  selections.over25 = over
    .filter(a => !usedMatches.has(a.match))
    .slice(0, SETTINGS.maxOVER);

  selections.over25.forEach(a =>
    usedMatches.add(a.match)
  );

  // ========= BTTS =========
  const btts = await rankBTTSMatches(matches);

  selections.btts = btts
    .filter(a => !usedMatches.has(a.match))
    .slice(0, SETTINGS.maxBTTS);

  selections.btts.forEach(a =>
    usedMatches.add(a.match)
  );

  // ========= SCORE =========
  const scores = await rankScoreMatches(matches);

  selections.score = scores
    .filter(a => !usedMatches.has(a.match))
    .slice(0, SETTINGS.maxSCORE);

  return selections;
}

module.exports = {
  buildSelections
};
