const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* =======================
   TEAMS DATABASE
======================= */
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

/* =======================
   MATCH GENERATOR
======================= */
function generateMatch() {
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (away === home) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

/* =======================
   STATS ENGINE
======================= */
function stats(team) {
  const seed = team.charCodeAt(0);
  return {
    attack: 60 + (seed % 30),
    defense: 55 + (seed % 25),
    form: 50 + (seed % 20)
  };
}

/* =======================
   PREDICTION ENGINE CORE
======================= */
function predictMatch(section){

  const m = generateMatch();

  const t1 = stats(m.home);
  const t2 = stats(m.away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const confidence = Math.round((Math.max(power1, power2) / total) * 100);

  const score1 = Math.round(power1 / 80);
  const score2 = Math.round(power2 / 80);

  let pick = power1 > power2 ? m.home : m.away;

  return {
    section,
    match: `${m.home} vs ${m.away}`,
    prediction: {
      type: section,
      pick
    },
    score: `${score1}-${score2}`,
    winner: pick,
    confidence
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V14 BUSINESS CLEAN ⚽🔥");
});

/* =======================
   FREE (1 MATCH)
======================= */
app.get("/free", (req, res) => {
  res.json(predictMatch("1X2"));
});

/* =======================
   VIP 1X2 (3 MATCHES)
======================= */
app.get("/vip/1x2", (req, res) => {
  const arr = [];
  for (let i = 0; i < 3; i++) {
    arr.push(predictMatch("1X2"));
  }
  res.json(arr);
});

/* =======================
   OVER 2.5 (3 MATCHES)
======================= */
app.get("/vip/over25", (req, res) => {
  const arr = [];
  for (let i = 0; i < 3; i++) {
    const p = predictMatch("OVER_2_5");
    p.extra = { market: "Over 2.5 goals" };
    arr.push(p);
  }
  res.json(arr);
});

/* =======================
   BTTS (3 MATCHES)
======================= */
app.get("/vip/btts", (req, res) => {
  const arr = [];
  for (let i = 0; i < 3; i++) {
    const p = predictMatch("BTTS");
    p.extra = { market: "Both Teams To Score" };
    arr.push(p);
  }
  res.json(arr);
});

/* =======================
   SCORE EXACT (1 MATCH)
======================= */
app.get("/vip/score", (req, res) => {
  res.json(predictMatch("SCORE_EXACT"));
});

/* =======================
   HT/FT (1 MATCH)
======================= */
app.get("/vip/htft", (req, res) => {
  const p = predictMatch("HT_FT");
  p.htft = `${p.prediction.pick}/${p.prediction.pick}`;
  res.json(p);
});

/* =======================
   COMBOS (3–5 MATCHES)
======================= */
app.get("/vip/combos", (req, res) => {
  const arr = [];
  const size = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < size; i++) {
    arr.push(predictMatch("COMBI"));
  }

  res.json(arr);
});

/* =======================
   JACKPOT (7–8 MATCHES)
======================= */
app.get("/vip/jackpot", (req, res) => {
  const arr = [];
  const size = 7 + Math.floor(Math.random() * 2);

  for (let i = 0; i < size; i++) {
    arr.push(predictMatch("JACKPOT"));
  }

  res.json(arr);
});

/* =======================
   LIVE MATCHES
======================= */
app.get("/live", (req, res) => {
  const arr = [];

  for (let i = 0; i < 3; i++) {
    const m = generateMatch();

    arr.push({
      match: `${m.home} vs ${m.away}`,
      score: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`,
      minute: Math.floor(Math.random() * 90)
    });
  }

  res.json(arr);
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("KING PREDICTIONS V14 RUNNING ⚽🔥");
});
