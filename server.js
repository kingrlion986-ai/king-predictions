const express=require("express");
const cors=require("cors");
const path=require("path");

const {getMatches,initializeDatabase}=require("./services/footballApi");
const {analyzeMatch}=require("./services/predictionEngine");

const app=express();
const PORT=process.env.PORT||3000;

const VERSION="KING-V1-INTELLIGENT";
const CACHE_TTL=30*60*1000;
const EMPTY_CACHE_TTL=2*60*1000;

const MAX_MATCHES_TO_ANALYZE=30;
const TOP_ANALYSES=4;
const DAILY_INTERVAL=24*60*60*1000;

app.use(cors());
app.use(express.json());

app.use((req,res,next)=>{
    const file=req.path.toLowerCase();

    if(
        file==="/"||
        file.endsWith(".html")||
        file.endsWith(".js")||
        file.endsWith(".css")
    ){
        res.setHeader(
            "Cache-Control",
            "no-store,no-cache,must-revalidate,proxy-revalidate"
        );
        res.setHeader("Pragma","no-cache");
        res.setHeader("Expires","0");
    }

    res.setHeader("X-KING-VERSION",VERSION);
    next();
});

app.get("/",(req,res)=>{
    res.setHeader("Cache-Control","no-store,no-cache,must-revalidate");

    res.sendFile(
        path.join(__dirname,"public","index.html"),
        {
            cacheControl:false,
            etag:false
        }
    );
});

app.use(express.static(path.join(__dirname,"public"),{
    etag:false,
    maxAge:0,
    index:false
}));

let cache=[];
let cacheTime=0;
let cacheValid=false;
let building=null;

let dailyDate="";
let lastStatus="STARTING";
let lastError=null;
let lastUpdate=null;

/* =====================================================
   DATE — AFRICA/BRAZZAVILLE
===================================================== */

function getBrazzavilleDate(date=new Date()){
    const parts=new Intl.DateTimeFormat("en-CA",{
        timeZone:"Africa/Brazzaville",
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
    }).formatToParts(date);

    const values={};

    for(const part of parts){
        if(part.type!=="literal"){
            values[part.type]=part.value;
        }
    }

    return{
        year:Number(values.year),
        month:Number(values.month),
        day:Number(values.day)
    };
}

function formatDate({year,month,day}){
    return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function getTomorrow(){
    const today=getBrazzavilleDate();

    const tomorrow=new Date(
        Date.UTC(
            today.year,
            today.month-1,
            today.day+1
        )
    );

    return formatDate({
        year:tomorrow.getUTCFullYear(),
        month:tomorrow.getUTCMonth()+1,
        day:tomorrow.getUTCDate()
    });
}

function getMatchBrazzavilleDate(utcDate){
    if(!utcDate)return null;

    const date=new Date(utcDate);

    if(Number.isNaN(date.getTime())){
        return null;
    }

    return formatDate(getBrazzavilleDate(date));
}

/* =====================================================
   UTILITIES
===================================================== */

function num(value,fallback=0){
    const n=Number(value);

    return Number.isFinite(n)
        ?n
        :fallback;
}

function clamp(value,min,max){
    return Math.max(
        min,
        Math.min(max,num(value))
    );
}

function removeDuplicates(matches){
    const seen=new Set();

    return matches.filter(match=>{
        const key=String(
            match?.id||
            `${match?.homeTeam?.id}_${match?.awayTeam?.id}_${match?.utcDate}`
        );

        if(seen.has(key)){
            return false;
        }

        seen.add(key);
        return true;
    });
}

function isUsable(analysis){
    return !!(
        analysis&&
        analysis.match&&
        analysis.match.homeTeam&&
        analysis.match.awayTeam&&
        analysis.predictions
    );
}

/* =====================================================
   POST-ANALYSIS INTELLIGENT SIGNAL
===================================================== */

function getDominantSignal(analysis){
    const predictions=analysis?.predictions||{};
    const model=analysis?.model||{};
    const probabilities=predictions?.probabilities||{};

    const homeWin=num(probabilities.homeWin);
    const draw=num(probabilities.draw);
    const awayWin=num(probabilities.awayWin);

    const over25Confidence=num(predictions.over25Confidence);
    const bttsConfidence=num(predictions.bttsConfidence);

    const winnerConfidence=Math.max(
        homeWin,
        draw,
        awayWin
    );

    const signals=[
        {
            type:"1X2",
            confidence:winnerConfidence,
            value:predictions.winner||"INDÉTERMINÉ",
            reason:"Probabilité 1X2 dominante"
        },
        {
            type:"TOTAL_BUTS",
            confidence:over25Confidence,
            value:predictions.over25||"INDÉTERMINÉ",
            reason:"Signal buts du modèle"
        },
        {
            type:"BTTS",
            confidence:bttsConfidence,
            value:predictions.btts||"INDÉTERMINÉ",
            reason:"Signal BTTS du modèle"
        }
    ];

    const expectedGoals=num(
        model.expectedGoals,
        num(model.expectedHomeGoals)+num(model.expectedAwayGoals)
    );

    if(expectedGoals>0){
        signals.push({
            type:"GOALS",
            confidence:clamp(
                Math.abs(expectedGoals-2.5)*25+50,
                50,
                100
            ),
            value:`${expectedGoals.toFixed(2)} xG`,
            reason:"Projection de buts attendus"
        });
    }

    signals.sort((a,b)=>b.confidence-a.confidence);

    return signals[0]||{
        type:"UNKNOWN",
        confidence:0,
        value:"INDÉTERMINÉ",
        reason:"Aucun signal exploitable"
    };
}

/* =====================================================
   ROBUSTESSE POST-ANALYSE
===================================================== */

function getRobustnessScore(analysis,signal){
    const predictions=analysis?.predictions||{};

    const confidence=clamp(
        predictions.confidence,
        0,
        100
    );

    const matchesUsed=num(
        predictions.matchesUsed
    );

    const dataQuality=String(
        predictions.dataQuality||""
    ).toUpperCase();

    let qualityScore=40;

    if(dataQuality==="HIGH"){
        qualityScore=100;
    }else if(dataQuality==="MEDIUM"){
        qualityScore=75;
    }else if(dataQuality==="LOW"){
        qualityScore=40;
    }

    const dataVolumeScore=clamp(
        matchesUsed*10,
        0,
        100
    );

    const signalScore=clamp(
        signal?.confidence,
        0,
        100
    );

    const probabilities=
        predictions?.probabilities||{};

    const values=[
        num(probabilities.homeWin),
        num(probabilities.draw),
        num(probabilities.awayWin)
    ].sort((a,b)=>b-a);

    const separation=values.length>=2
        ?clamp(values[0]-values[1],0,100)
        :0;

    const score=
        qualityScore*0.35+
        confidence*0.25+
        signalScore*0.25+
        dataVolumeScore*0.10+
        separation*0.05;

    return Math.round(
        clamp(score,0,100)
    );
}

/* =====================================================
   FINAL SELECTION
===================================================== */

function prepareIntelligentSelection(analyses){
    const prepared=analyses.map(analysis=>{
        const dominantSignal=
            getDominantSignal(analysis);

        const robustnessScore=
            getRobustnessScore(
                analysis,
                dominantSignal
            );

        return{
            ...analysis,
            intelligentSelection:{
                dominantSignal,
                robustnessScore
            }
        };
    });

    prepared.sort((a,b)=>{
        const scoreA=
            num(
                a.intelligentSelection?.robustnessScore
            );

        const scoreB=
            num(
                b.intelligentSelection?.robustnessScore
            );

        if(scoreB!==scoreA){
            return scoreB-scoreA;
        }

        const signalA=
            num(
                a.intelligentSelection
                ?.dominantSignal
                ?.confidence
            );

        const signalB=
            num(
                b.intelligentSelection
                ?.dominantSignal
                ?.confidence
            );

        if(signalB!==signalA){
            return signalB-signalA;
        }

        return num(
            b.predictions?.matchesUsed
        )-
        num(
            a.predictions?.matchesUsed
        );
    });

    return prepared.slice(0,TOP_ANALYSES);
}

/* =====================================================
   FORMAT API
===================================================== */

function formatAnalysis(analysis){
    const selection=
        analysis.intelligentSelection||{};

    const signal=
        selection.dominantSignal||{};

    return{
        match:{
            id:analysis.match?.id??null,
            utcDate:analysis.match?.utcDate??null,
            status:analysis.match?.status??null,
            competition:analysis.match?.competition??null,
            homeTeam:analysis.match?.homeTeam??null,
            awayTeam:analysis.match?.awayTeam??null
        },

        predictions:
            analysis.predictions||{},

        model:
            analysis.model||{},

        teamStats:
            analysis.teamStats||{},

        marketScores:
            analysis.marketScores||{},

        intelligentSelection:{
            dominantSignal:{
                type:signal.type||"UNKNOWN",
                confidence:num(signal.confidence),
                value:signal.value||"INDÉTERMINÉ",
                reason:signal.reason||""
            },
            robustnessScore:num(
                selection.robustnessScore
            )
        }
    };
}

/* =====================================================
   DAILY ENGINE
===================================================== */

async function buildDailyAnalysis(force=false){
    const targetDate=getTomorrow();

    if(dailyDate!==targetDate){
        cache=[];
        cacheTime=0;
        cacheValid=false;

        dailyDate=targetDate;

        console.log("");
        console.log("📅 ================================");
        console.log("📅 NOUVEAU CYCLE KING AI");
        console.log("🎯 DATE CIBLE:",targetDate);
        console.log("📅 ================================");
        console.log("");
    }

    if(!force&&cacheValid){
        const ttl=
            cache.length>0
                ?CACHE_TTL
                :EMPTY_CACHE_TTL;

        if(Date.now()-cacheTime<ttl){
            console.log(
                "⚡ CACHE ANALYSES:",
                cache.length
            );

            return cache;
        }
    }

    if(building){
        console.log(
            "⏳ ANALYSE DÉJÀ EN COURS"
        );

        return building;
    }

    building=(async()=>{
        lastStatus="LOADING";
        lastError=null;

        try{
            console.log(
                "📡 RÉCUPÉRATION DES MATCHS..."
            );

            const matches=await getMatches();

            if(!Array.isArray(matches)){
                throw new Error(
                    "getMatches() ne retourne pas un tableau"
                );
            }

            console.log(
                "📦 MATCHS REÇUS:",
                matches.length
            );

            const uniqueMatches=
                removeDuplicates(matches);

            const tomorrowMatches=
                uniqueMatches
                .filter(match=>{
                    return(
                        getMatchBrazzavilleDate(
                            match?.utcDate
                        )===targetDate
                    );
                })
                .sort((a,b)=>{
                    return(
                        new Date(a.utcDate)-
                        new Date(b.utcDate)
                    );
                });

            console.log(
                "🎯 MATCHS DE DEMAIN:",
                tomorrowMatches.length
            );

            if(!tomorrowMatches.length){
                cache=[];
                cacheTime=Date.now();
                cacheValid=true;

                lastStatus="NO_MATCHES";
                lastUpdate=
                    new Date().toISOString();

                return[];
            }

            const analyses=[];

            for(
                const match of tomorrowMatches
                .slice(0,MAX_MATCHES_TO_ANALYZE)
            ){
                try{
                    console.log(
                        "🔎 ANALYSE:",
                        `${match.homeTeam?.name||"HOME"} vs ${match.awayTeam?.name||"AWAY"}`
                    );

                    const analysis=
                        await analyzeMatch(match);

                    if(!isUsable(analysis)){
                        console.log(
                            "⚠️ ANALYSE INVALIDE"
                        );

                        continue;
                    }

                    analyses.push(analysis);

                }catch(error){
                    console.error(
                        "❌ AI ERROR:",
                        `${match.homeTeam?.name||"HOME"} vs ${match.awayTeam?.name||"AWAY"}`,
                        error.message
                    );
                }
            }

            console.log(
                "🧠 ANALYSES VALIDES:",
                analyses.length
            );

            /*
             * IMPORTANT :
             * La sélection intervient APRÈS
             * l'analyse complète des matchs.
             */

            const selected=
                prepareIntelligentSelection(
                    analyses
                );

            cache=selected;
            cacheTime=Date.now();
            cacheValid=true;

            lastStatus=
                cache.length
                    ?"READY"
                    :"NO_VALID_ANALYSES";

            lastUpdate=
                new Date().toISOString();

            console.log("");
            console.log(
                "👑 ================================"
            );
            console.log(
                "👑 SÉLECTION INTELLIGENTE TERMINÉE"
            );
            console.log(
                "👑 MATCHS RETENUS:",
                cache.length
            );
            console.log(
                "👑 ================================"
            );

            cache.forEach((analysis,index)=>{
                const selection=
                    analysis.intelligentSelection;

                const signal=
                    selection?.dominantSignal;

                console.log(
                    `🏆 #${index+1}`,
                    `${analysis.match?.homeTeam?.name||"HOME"} vs ${analysis.match?.awayTeam?.name||"AWAY"}`
                );

                console.log(
                    "   🧠 SIGNAL:",
                    signal?.type||"UNKNOWN"
                );

                console.log(
                    "   📊 VALEUR:",
                    signal?.value||"INDÉTERMINÉ"
                );

                console.log(
                    "   🎯 CONFIANCE:",
                    Math.round(
                        num(signal?.confidence)
                    )+"%"
                );

                console.log(
                    "   💪 ROBUSTESSE:",
                    num(
                        selection?.robustnessScore
                    )+"%"
                );
            });

            console.log("");

            return cache;

        }catch(error){
            lastStatus="ERROR";
            lastError=error.message;
            lastUpdate=
                new Date().toISOString();

            console.error(
                "❌ DAILY ENGINE ERROR:",
                error.stack
            );

            return cacheValid
                ?cache
                :[];

        }finally{
            building=null;
        }
    })();

    return building;
}

/* =====================================================
   DAILY REFRESH
===================================================== */

async function refreshDaily(){
    if(building){
        console.log(
            "⏳ REFRESH IGNORÉ: analyse en cours"
        );

        return;
    }

    console.log(
        "🔄 REFRESH QUOTIDIEN"
    );

    cacheValid=false;

    try{
        await buildDailyAnalysis(true);

        console.log(
            "✅ REFRESH TERMINÉ"
        );

    }catch(error){
        console.error(
            "❌ REFRESH ERROR:",
            error.message
        );
    }
}

/* =====================================================
   API — ANALYSIS
===================================================== */

app.get("/analysis",async(req,res)=>{
    try{
        const data=
            await buildDailyAnalysis();

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        res.json({
            version:VERSION,
            date:dailyDate,
            target:"TOMORROW",
            timezone:"Africa/Brazzaville",
            count:data.length,
            max:TOP_ANALYSES,
            selection:"POST_ANALYSIS",
            analyses:data.map(
                formatAnalysis
            )
        });

    }catch(error){
        res.status(500).json({
            error:error.message
        });
    }
});

/* =====================================================
   API — STATUS
===================================================== */

app.get("/status",(req,res)=>{
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        status:lastStatus,
        ai:"ACTIVE",
        version:VERSION,
        matches:cache.length,
        analyses:cache.length,
        maxAnalyses:TOP_ANALYSES,
        targetDate:dailyDate,
        cacheValid,
        analyzing:!!building,
        lastUpdate,
        error:lastError
    });
});

/* =====================================================
   API — HEALTH
===================================================== */

app.get("/health",(req,res)=>{
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        status:"ok",
        ai:"ACTIVE",
        version:VERSION,
        analyses:cache.length,
        maxAnalyses:TOP_ANALYSES,
        targetDate:dailyDate,
        analyzing:!!building,
        lastStatus,
        lastError,
        lastUpdate
    });
});

/* =====================================================
   API — VERSION
===================================================== */

app.get("/__king_version",(req,res)=>{
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        project:"KING PREDICTIONS AI",
        version:VERSION,
        frontend:"V1",
        engine:"POST_ANALYSIS_INTELLIGENT",
        dailyRefresh:true,
        intervalHours:24,
        target:"TOMORROW",
        maxAnalyses:TOP_ANALYSES,
        timezone:"Africa/Brazzaville",
        timestamp:new Date().toISOString()
    });
});

/* =====================================================
   SERVER
===================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    async()=>{
        console.log("");
        console.log(
            "👑 KING PREDICTIONS AI V1 ONLINE"
        );
        console.log(
            "🔥 VERSION:",
            VERSION
        );
        console.log(
            "🌐 PORT:",
            PORT
        );
        console.log(
            "🎯 CIBLE:",
            "MATCHS DE DEMAIN"
        );
        console.log(
            "🧠 MODE:",
            "POST-ANALYSIS INTELLIGENT"
        );
        console.log(
            "🏆 MAX:",
            TOP_ANALYSES
        );
        console.log(
            "🔄 REFRESH:",
            "24H"
        );
        console.log(
            "🇨🇬 TIMEZONE:",
            "Africa/Brazzaville"
        );
        console.log("");

        try{
            await initializeDatabase();

            console.log(
                "✅ DATABASE READY"
            );

            await buildDailyAnalysis();

            console.log(
                "✅ PREMIÈRE ANALYSE TERMINÉE"
            );

            setInterval(
                async()=>{
                    console.log(
                        "⏰ 24H REFRESH"
                    );

                    await refreshDaily();
                },
                DAILY_INTERVAL
            );

            console.log(
                "🚀 V1 READY"
            );

        }catch(error){
            console.error(
                "❌ STARTUP:",
                error.stack
            );
        }
    }
);
        
