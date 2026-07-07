function byWinnerConfidence(a, b) {
  return (
    b.predictions.winnerConfidence -
    a.predictions.winnerConfidence
  );
}

function byOver25(a, b) {
  return (
    b.predictions.over25Confidence -
    a.predictions.over25Confidence
  );
}

function byBTTS(a, b) {
  return (
    b.predictions.bttsConfidence -
    a.predictions.bttsConfidence
  );
}

function byScore(a, b) {
  return (
    b.model.expectedGoals -
    a.model.expectedGoals
  );
}

function rankMatches(analyses) {
  return [...analyses].sort(byWinnerConfidence);
}

function rankOver25Matches(analyses) {
  return [...analyses].sort(byOver25);
}

function rankBTTSMatches(analyses) {
  return [...analyses].sort(byBTTS);
}

function rankScoreMatches(analyses) {
  return [...analyses].sort(byScore);
}

module.exports = {
  rankMatches,
  rankOver25Matches,
  rankBTTSMatches,
  rankScoreMatches
};
