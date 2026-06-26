const { getTeamRecentMatches } = require("./footballApi");

async function analyzeTeam(team) {
  const matches = await getTeamRecentMatches(team.id, 10);

  if (!matches.length) {
    return null;
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {

    const home = match.homeTeam.id === team.id;

    const scored = home
      ? match.score.fullTime.home
      : match.score.fullTime.away;

    const conceded = home
      ? match.score.fullTime.away
      : match.score.fullTime.home;

    goalsFor += scored;
    goalsAgainst += conceded;

    if (scored > conceded) wins++;
    else if (scored === conceded) draws++;
    else losses++;
  }

  return {

    team: team.name,

    matches: matches.length,

    wins,
    draws,
    losses,

    avgGoalsFor:
      goalsFor / matches.length,

    avgGoalsAgainst:
      goalsAgainst / matches.length

  };

}

module.exports = {
  analyzeTeam
};
