const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

// =====================
// MATCH GENERATOR
// =====================
function generateMatch() {
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (away === home) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

// =====================
// STATS ENGINE
// =====================
function stats(team) {
  const seed = team.charCodeAt(0);
  return {
    attack: 60 + (seed % 35),
    defense: 55 + (seed % 30),
    form: 50 + (seed % 25)
  };
}

// =====================
// CORE PREDICT ENGINE
// =====================
function predict(m) {
  const t1 = stats(m.home);
  const t2 = stats(m.away);

  const p1 = t1.attack + t1.form + (100 - t2.defense);
  const p2 = t2.attack + t2.form + (100 - t1.defense);

  const total = p1 + p2;

  const prob1 = Math.round((p1 / total) * 100);
  const prob2 = Math.round((p2 / total) * 100);

  const score1 = Math.round(p1 / 75);
  const score2 = Math.round(p2 / 75);

  return {
    match: `${m.home} vs ${m.away}`,
    home: m.home,
    away: m.away,
    confidence: Math.max(prob1, prob2),
    score: `${score1}-${score2}`,
    winner: p1 > p2 ? m.home : m.away
  };
}

// =====================
// HOME
// =====================
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS PRO BOOKMAKER ⚽🔥");
});

// =====================
// FREE (1 MATCH SAFE)
// =====================
app.get("/free", (req, res) => {
  const m = predict(generateMatch());

  res.json({
    match: m.match,
    pick: m.winner,
    confidence: m.confidence
  });
});

// =====================
// VIP BTTS
// =====================
app.get("/vip/btts", (req, res) => {
  const data = [];

  for (let i = 0; i < 3; i++) {
    const m = predict(generateMatch());
    const t1 = stats(m.home);
    const t2 = stats(m.away);

    const btts = (t1.attack > 70 && t2.attack > 70) ? "YES" : "NO";

    data.push({
      match: m.match,
      btts
    });
  }

  res.json(data);
});

// =====================
// VIP OVER 2.5
// =====================
app.get("/vip/over25", (req, res) => {
  const data = [];

  for (let i = 0; i < 3; i++) {
    const m = predict(generateMatch());

    data.push({
      match: m.match,
      over25: Math.random() > 0.5 ? "OVER" : "UNDER"
    });
  }

  res.json(data);
});

// =====================
// VIP HT/FT
// =====================
app.get("/vip/htft", (req, res) => {
  const data = [];

  for (let i = 0; i < 3; i++) {
    const m = generateMatch();

    const winner = predict(m).winner;

    data.push({
      match: `${m.home} vs ${m.away}`,
      htft: `${winner}/${winner}`
    });
  }

  res.json(data);
});

// =====================
// VIP SCORE EXACT (1-3 MATCH MAX)
// =====================
app.get("/vip/score", (req, res) => {
  const data = [];

  for (let i = 0; i < 2; i++) {
    const m = predict(generateMatch());

    data.push({
      match: m.match,
      score: m.score
    });
  }

  res.json(data);
});

// =====================
// JACKPOT (7–8 MATCHES)
// =====================
app.get("/vip/jackpot", (req, res) => {
  const data = [];
  const size = 7 + Math.floor(Math.random() * 2);

  for (let i = 0; i < size; i++) {
    data.push(predict(generateMatch()));
  }

  res.json(data);
});

// =====================
// LIVE
// =====================
app.get("/live", (req, res) => {
  const data = [];

  for (let i = 0; i < 3; i++) {
    const m = generateMatch();

    data.push({
      match: `${m.home} vs ${m.away}`,
      score: `${Math.floor(Math.random()*3)}-${Math.floor(Math.random()*3)}`,
      minute: Math.floor(Math.random()*90)
    });
  }

  res.json(data);
});

// =====================
// START
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("PRO BOOKMAKER RUNNING ⚽🔥");
});
