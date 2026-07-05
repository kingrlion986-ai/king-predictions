async function loadPredictions(url){

    const results = document.getElementById("results");

    results.innerHTML = "<h2>⏳ Chargement...</h2>";

    try{

        const response = await fetch(url);

        const data = await response.json();

        results.innerHTML = "";

        const list = Array.isArray(data) ? data : [data];

        document.getElementById("matches").innerText = list.length;
        document.getElementById("predictions").innerText = list.length;

        list.forEach(item=>{

            const card = document.createElement("div");

            card.className="card";

            card.style.marginBottom="20px";

            card.innerHTML=`

                <h2>${item.match ?? "Match"}</h2>

                <hr style="margin:15px 0;">

                <p><strong>Pronostic :</strong>
                ${item.pick || item.market || item.score || item.prediction || "-"}</p>

                <p><strong>Confiance :</strong>
                ${item.confidence ?? "-"}%</p>

            `;

            results.appendChild(card);

        });

    }

    catch(e){

        results.innerHTML="<h2>❌ Impossible de charger les données.</h2>";

    }

}

loadPredictions("/free");

Ajout du script de l'interface
