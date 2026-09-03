console.log("👑 KING PREDICTIONS AI V1");
const API="/analysis";

function num(v){
const n=Number(v);
return Number.isFinite(n)?n:0;
}

function teamName(team){
return team?.name||"Équipe inconnue";
}

function formatDate(date){
if(!date)return "Date inconnue";
const d=new Date(date);
if(Number.isNaN(d.getTime()))return "Date inconnue";
return d.toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
}

function probability(v){
return "${Math.round(num(v))}%";
}

function show(data){
const results=document.getElementById("results");
const list=Array.isArray(data?.analyses)?data.analyses:[];
document.getElementById("matches").textContent=list.length;
document.getElementById("predictions").textContent=list.length;

if(data?.date){
document.getElementById("lastUpdate").textContent="📅 ${data.date} • ${list.length} analyse(s)";
}

if(!list.length){
results.innerHTML="<div class="empty-card">🔍 Aucune analyse disponible pour le moment.</div>";
return;
}

results.innerHTML=list.map(a=>{
const m=a.match||{};
const p=a.predictions||{};
const model=a.model||{};
const stats=a.teamStats||{};
const probs=p.probabilities||{};
const home=teamName(m.homeTeam);
const away=teamName(m.awayTeam);

return `

<article class="prediction-card">
<h2>⚽ ${home} <span>vs</span> ${away}</h2>
<p class="date">🕐 ${formatDate(m.utcDate)}</p>
<p>🏆 <strong>${m.competition?.name||m.competition?.code||"Compétition inconnue"}</strong></p><div class="section">
<h3>🎯 Modèle 1X2</h3>
<div class="probabilities">
<div>🏠 Domicile<strong>${probability(probs.homeWin)}</strong></div>
<div>🤝 Nul<strong>${probability(probs.draw)}</strong></div>
<div>✈️ Extérieur<strong>${probability(probs.awayWin)}</strong></div>
</div>
<p>📌 Tendance du modèle : <strong>${p.winner||"-"}</strong></p>
</div><div class="section">
<h3>⚽ Expected Goals</h3>
<p>🏠 ${home} : <strong>${num(model.expectedHomeGoals).toFixed(2)}</strong></p>
<p>✈️ ${away} : <strong>${num(model.expectedAwayGoals).toFixed(2)}</strong></p>
<p>📊 Total xG : <strong>${num(model.expectedGoals).toFixed(2)}</strong></p>
</div><div class="section">
<h3>📈 Autres probabilités</h3>
<p>⚽ Over 2.5 : <strong>${probability(p.over25Confidence)}</strong></p>
<p>🟠 BTTS : <strong>${p.btts||"-"} (${probability(p.bttsConfidence)})</strong></p>
<p>🎯 Score le plus probable : <strong>${p.correctScore||"-"}</strong></p>
</div><div class="quality">
<p>🧠 Qualité des données : <strong>${p.dataQuality||"UNKNOWN"}</strong></p>
<p>📚 Matchs utilisés : <strong>${num(p.matchesUsed)}</strong></p>
<p>📊 Fiabilité du modèle : <strong>${probability(p.confidence)}</strong></p>
</div>
</article>
`;
}).join("");
}async function loadAnalysis(){
const results=document.getElementById("results");
results.innerHTML="<div class="loading">⏳ Analyse en cours...</div>";

try{
const response=await fetch("${API}?t=${Date.now()}",{cache:"no-store"});
if(!response.ok)throw new Error("HTTP ${response.status}");
const data=await response.json();
show(data);
}catch(error){
console.error("❌ API:",error);
results.innerHTML=`

<div class="error-card">
❌ Impossible de charger les analyses.
<br><small>${error.message}</small>
<br><br>
<button onclick="loadAnalysis()">🔄 Réessayer</button>
</div>`;
}
}async function refreshAnalysis(){
await loadAnalysis();
}

document.addEventListener("DOMContentLoaded",loadAnalysis);
