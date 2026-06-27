function randomPoisson(lambda) {
  const L = Math.exp(-lambda);

  let p = 1;
  let k = 0;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

module.exports = {
  randomPoisson,
  simulateMatch
};

function simulateMatch(homeXG, awayXG) {

  const homeGoals = randomPoisson(homeXG);
  const awayGoals = randomPoisson(awayXG);

  return {
    homeGoals,
    awayGoals
  };

}

const { simulateMatch } = require("./monteCarloEngine");

const homeXG = 1.8;
const awayXG = 0.9;

let homeWins = 0;
let draws = 0;
let awayWins = 0;

for (let i = 0; i < 100; i++) {

  const result = simulateMatch(homeXG, awayXG);

  if (result.homeGoals > result.awayGoals) homeWins++;
  else if (result.homeGoals === result.awayGoals) draws++;
  else awayWins++;

}

console.log("HOME WINS:", homeWins);
console.log("DRAWS:", draws);
console.log("AWAY WINS:", awayWins);
