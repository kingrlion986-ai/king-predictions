const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

// 🌍 HOME
app.get("/", (req, res) => {
  res.send("⚽ KING PREDICTIONS PRO LIVE 🔥");
});

// 🔑 API KEY (Render environment variable)
const API_KEY = process.env.API_KEY;

// ⚽ MATCHS RÉELS DU JOUR (API FOOTBALL)
app.get("/matches", async (req, res) => {
  try {
    let today = new Date().toISOString().split("T")[0];

    let response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    let data = await response.json();
    res.json(data.response);

  } catch (error) {
    res.json({ error: true, message: "API error" });
  }
});

// 🔮 PRÉDICTION IA SIMPLE
app.get("/predict", (req, res) => {
  const match = req.query.match || "PSG vs Marseille";

  const prediction = {
    match: match,
    probabilities: {
      team1: Math.floor(Math.random() * 40) + 30,
      draw: Math.floor(Math.random() * 20) + 10,
      team2: Math.floor(Math.random() * 40) + 30
    },
    score_guess: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`
  };

  res.json(prediction);
});

// 🚀 START SERVER
app.listen(process.env.PORT || 3000, () => {
  console.log("KING PREDICTIONS PRO RUNNING ⚽🔥");
});
