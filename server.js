const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

app.use(cors());

const teams = [
"Manchester City",
"Arsenal",
"Real Madrid",
"Barcelona",
"PSG",
"Bayern Munich",
"Liverpool",
"Chelsea",
"Juventus",
"AC Milan"
];

function teamData(name) {
const seed = name.charCodeAt(0);

return {
attack: 65 + (seed % 35),
defense: 60 + (seed % 30),
form: 50 + (seed % 50)
};
}

function generateMatch() {
let home = teams[Math.floor(Math.random() * teams.length)];
let away = teams[Math.floor(Math.random() * teams.length)];

while (home === away) {
away = teams[Math.floor(Math.random() * teams.length)];
}

return { home, away };
}

app.get("/", (req, res) => {
res.send("KING PREDICTIONS V3 PRO ⚽🔥");
});

app.get("/test-api", async (req, res) => {
try {

const response = await fetch(
  "https://v3.football.api-sports.io/status",
  {
    headers: {
      "x-apisports-key": process.env.API_KEY
    }
  }
);

const data = await response.json();

res.json({
  api_key_exists: !!process.env.API_KEY,
  data
});

} catch (err) {

res.json({
  error: err.message,
  api_key_exists: !!process.env.API_KEY
});

}
});

app.get("/matches", async (req, res) => {

try {

const response = await fetch(
  "https://v3.football.api-sports.io/fixtures?next=10",
  {
    headers: {
      "x-apisports-key": process.env.API_KEY
    }
  }
);

const data = await response.json();

if (data.response && data.response.length > 0) {

  const matches = data.response.map(match => ({
    domicile: match.teams.home.name,
    exterieur: match.teams.away.name,
    heure: match.fixture.date
  }));

  return res.json(matches);
}

throw new Error("Aucun match retourné");

} catch (err) {

let fallback = [];

for (let i = 0; i < 5; i++) {
  const { home, away } = generateMatch();

  fallback.push({
    domicile: home,
    exterieur: away,
    heure: new Date().toISOString()
  });
}

res.json(fallback);

}
});

app.get("/free", (req, res) => {

const { home, away } = generateMatch();

const t1 = teamData(home);
const t2 = teamData(away);

const power1 = t1.attack + t1.form + (100 - t2.defense);
const power2 = t2.attack + t2.form + (100 - t1.defense);

const total = power1 + power2;

const score1 = Math.round(power1 / 80);
const score2 = Math.round(power2 / 80);

const p1 = Math.round((power1 / total) * 100);
const p2 = Math.round((power2 / total) * 100);

res.json({
match: "${home} vs ${away}",
prediction: "${score1}-${score2}",
winner: score1 > score2 ? home : away,
confidence: Math.max(p1, p2)
});
});

app.get("/vip", (req, res) => {

const results = [];

for (let i = 0; i < 5; i++) {

const { home, away } = generateMatch();

const t1 = teamData(home);
const t2 = teamData(away);

const power1 = t1.attack + t1.form + (100 - t2.defense);
const power2 = t2.attack + t2.form + (100 - t1.defense);

const score1 = Math.round(power1 / 75);
const score2 = Math.round(power2 / 75);

results.push({
  match: `${home} vs ${away}`,
  score: `${score1}-${score2}`,
  winner: score1 > score2 ? home : away,
  btts: Math.random() > 0.5 ? "YES" : "NO",
  over25: Math.random() > 0.5 ? "YES" : "NO"
});

}

res.json(results);
});

app.get("/live", (req, res) => {

const live = [];

for (let i = 0; i < 3; i++) {

const { home, away } = generateMatch();

live.push({
  match: `${home} vs ${away}`,
  score: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`,
  minute: Math.floor(Math.random() * 90)
});

}

res.json(live);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("KING PREDICTIONS RUNNING ON PORT ${PORT}");
});
