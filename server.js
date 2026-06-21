const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("KING PREDICTIONS ONLINE ⚽");
});

app.get("/matches", (req, res) => {
  res.json([
    { home: "PSG", away: "OM", time: "20:00" }
  ]);
});

app.get("/predict", (req, res) => {
  res.json({
    match: "PSG vs OM",
    psg: "55%",
    draw: "20%",
    om: "25%",
    score: "2-1"
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("SERVER OK");
});
