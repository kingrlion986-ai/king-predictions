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
  randomPoisson
};
