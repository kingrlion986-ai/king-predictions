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

  const avgGoalsFor = goalsFor / matches.length;
const avgGoalsAgainst = goalsAgainst / matches.length;

const formPoints = wins * 3 + draws;

const power =
  (formPoints * 2) +
  (avgGoalsFor * 12) -
  (avgGoalsAgainst * 8);

return {

  team: team.name,

  matches: matches.length,

  wins,
  draws,
  losses,

  formPoints,

  avgGoalsFor: Number(avgGoalsFor.toFixed(2)),

  avgGoalsAgainst: Number(avgGoalsAgainst.toFixed(2)),

  power: Number(power.toFixed(1))

};

}

module.exports = {
  analyzeTeam
};
