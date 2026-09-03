console.log("👑 KING PREDICTIONS AI — APP V1 LOADED");

const API="/analysis";

const $=id=>document.getElementById(id);

function safe(value,fallback="-"){
return value===undefined||value===null||value===""?fallback:value;
}

function number(value){
const n=Number(value);
return Number.isFinite(n)?n:0;
}

function percent(value){
return "${Math.round(number(value))}%";
}

function team(team){
return safe(team?.name,"Équipe inconnue");
}

function date(value){
if(!value)return "Date inconnue";
const d=new Date(value);
if(Number.isNaN(d.getTime()))return "Date inconnue";
return d.toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
}

function render(data){
console.log("📦 DATA FRONTEND:",data);

const results=$("results");
if(!results){
console.error("❌ Élément #results introuvable");
return;
}

const analyses=Array.isArray(data?.analyses)?data.analyses:[];

$("matches").textContent=analyses.length;
$("predictions").textContent=analyses.length;

if($("lastUpdate")){
$("lastUpdate").textContent="📅 ${safe(data?.date)} • ${analyses.length} analyse(s)";
}

if(!analyses.length){
results.innerHTML="<div class="empty-card">🔍 Aucune analyse disponible.</div>";
return;
}

results.innerHTML=analyses.map((item,index)=>{
const match=item?.match||{};
const predictions=item?.predictions||{};
const model=item?.model||{};
const probabilities=predictions?.probabilities||{};

const home=team(match.homeTeam);
const away=team(match.awayTeam);

return `

<article class="prediction-card">
<div class="card-number">MATCH ${index+1}</div><h2>⚽ ${home}</h2>
<div class="vs">VS</div>
<h2>${away}</h2><p class="date">🕐 ${date(match.utcDate)}</p>
<p>🏆 ${safe(match.competition?.name,"Compétition inconnue")}</p><div class="section">
<h3>📊 Probabilités du modèle</h3>
<div class="probabilities">
<div>
<span>🏠 Domicile</span>
<strong>${percent(probabilities.homeWin)}</strong>
</div>
<div>
<span>🤝 Nul</span>
<strong>${percent(probabilities.draw)}</strong>
</div>
<div>
<span>✈️ Extérieur</span>
<strong>${percent(probabilities.awayWin)}</strong>
</div>
</div>
</div><div class="section">
<h3>⚽ Buts attendus</h3>
<p>🏠 ${home} : <strong>${number(model.expectedHomeGoals).toFixed(2)}</strong></p>
<p>✈️ ${away} : <strong>${number(model.expectedAwayGoals).toFixed(2)}</strong></p>
<p>📈 Total : <strong>${number(model.expectedGoals).toFixed(2)}</strong></p>
</div><div class="section">
<h3>🔎 Analyse complémentaire</h3>
<p>🎯 Tendance : <strong>${safe(predictions.winner)}</strong></p>
<p>⚽ Plus de 2,5 : <strong>${percent(predictions.over25Confidence)}</strong></p>
<p>🟠 BTTS : <strong>${safe(predictions.btts)}</strong> (${percent(predictions.bttsConfidence)})</p>
<p>🎯 Score théorique : <strong>${safe(predictions.correctScore)}</strong></p>
</div><div class="quality">
<p>🧠 Confiance du modèle : <strong>${percent(predictions.confidence)}</strong></p>
<p>📚 Données utilisées : <strong>${number(predictions.matchesUsed)}</strong> matchs</p>
<p>✅ Qualité : <strong>${safe(predictions.dataQuality)}</strong></p>
</div>
</article>
`;
}).join("");
}async function loadAnalysis(){
const results=$("results");

if(!results){
console.error("❌ #results absent");
return;
}

results.innerHTML="<div class="loading">⏳ Chargement des analyses...</div>";

try{
console.log("📡 REQUEST:",API);

const response=await fetch("${API}?v=${Date.now()}",{
method:"GET",
cache:"no-store",
headers:{
"Accept":"application/json"
}
});

console.log("🌐 HTTP:",response.status,response.statusText);

if(!response.ok){
throw new Error("HTTP ${response.status}");
}

const text=await response.text();

console.log("📄 RESPONSE LENGTH:",text.length);

if(!text){
throw new Error("Réponse vide du serveur");
}

let data;

try{
data=JSON.parse(text);
}catch(error){
console.error("❌ JSON INVALIDE:",text.slice(0,500));
throw new Error("Réponse JSON invalide");
}

render(data);

}catch(error){
console.error("❌ FRONTEND ERROR:",error);

results.innerHTML=`

<div class="error-card">
<h3>❌ Erreur de chargement</h3>
<p>${safe(error?.message,"Erreur inconnue")}</p>
<button onclick="loadAnalysis()">🔄 Réessayer</button>
</div>
`;
}
}async function refreshAnalysis(){
await loadAnalysis();
}

window.loadAnalysis=loadAnalysis;
window.refreshAnalysis=refreshAnalysis;

document.addEventListener("DOMContentLoaded",()=>{
console.log("🚀 DOM READY");
loadAnalysis();
});
