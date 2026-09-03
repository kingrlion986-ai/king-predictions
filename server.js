const express=require("express");
const cors=require("cors");
const path=require("path");
const {getMatches,initializeDatabase}=require("./services/footballApi");
const {analyzeMatch}=require("./services/predictionEngine");

const app=express();
const PORT=process.env.PORT||3000;
const VERSION="KING-V1-DAILY";
const CACHE_TTL=30*60*1000;
const EMPTY_CACHE_TTL=2*60*1000;
const MAX_ANALYSES=30;
const TOP_ANALYSES=4;
const DAILY_INTERVAL=24*60*60*1000;

app.use(cors());
app.use(express.json());

app.use((req,res,next)=>{
    const file=req.path.toLowerCase();
    if(file==="/"||file.endsWith(".html")||file.endsWith(".js")||file.endsWith(".css")){
        res.setHeader("Cache-Control","no-store,no-cache,must-revalidate,proxy-revalidate");
        res.setHeader("Pragma","no-cache");
        res.setHeader("Expires","0");
    }
    res.setHeader("X-KING-VERSION",VERSION);
    next();
});

app.get("/",(req,res)=>{
    res.setHeader("Cache-Control","no-store,no-cache,must-revalidate");
    res.sendFile(path.join(__dirname,"public","index.html"),{
        cacheControl:false,
        etag:false
    });
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

function getBrazzavilleDate(date=new Date()){
    const parts=new Intl.DateTimeFormat("en-CA",{
        timeZone:"Africa/Brazzaville",
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
    }).formatToParts(date);

    const values={};

    for(const part of parts){
        if(part.type!=="literal") values[part.type]=part.value;
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

    if(Number.isNaN(date.getTime()))return null;

    const parts=new Intl.DateTimeFormat("en-CA",{
        timeZone:"Africa/Brazzaville",
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
    }).formatToParts(date);

    const values={};

    for(const part of parts){
        if(part.type!=="literal") values[part.type]=part.value;
    }

    return `${values.year}-${values.month}-${values.day}`;
}

function isUsable(a){
    return !!(
        a&&
        a.match&&
        a.match.homeTeam&&
        a.match.awayTeam&&
        a.predictions
    );
}

function removeDuplicates(matches){
    const seen=new Set();

    return matches.filter(match=>{
        const key=String(
            match?.id||
            `${match?.homeTeam?.id}_${match?.awayTeam?.id}_${match?.utcDate}`
        );

        if(seen.has(key))return false;

        seen.add(key);
        return true;
    });
}

function number(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
}

function getRobustnessScore(analysis){
    const p=analysis?.predictions||{};
    const confidence=number(p.confidence);
    const matchesUsed=number(p.matchesUsed);
    const dataQuality=String(p.dataQuality||"").toUpperCase();

    let qualityScore=50;

    if(dataQuality==="HIGH")qualityScore=100;
    else if(dataQuality==="MEDIUM")qualityScore=75;
    else if(dataQuality==="LOW")qualityScore=40;

    const matchesScore=Math.min(matchesUsed/10,1)*100;

    const probabilities=p?.probabilities||{};
    const probs=[
        number(probabilities.homeWin),
        number(probabilities.draw),
        number(probabilities.awayWin)
    ].sort((a,b)=>b-a);

    const separation=Math.max(
        0,
        Math.min(
            100,
            probs.length>=2?probs[0]-probs[1]:0
        )
    );

    const score=
        qualityScore*0.40+
        confidence*0.30+
        matchesScore*0.20+
        separation*0.10;

    return Math.round(Math.max(0,Math.min(100,score)));
}

function formatAnalysis(a){
    return{
        match:{
            id:a.match?.id??null,
            utcDate:a.match?.utcDate??null,
            status:a.match?.status??null,
            competition:a.match?.competition??null,
            homeTeam:a.match?.homeTeam??null,
            awayTeam:a.match?.awayTeam??null
        },
        predictions:a.predictions||{},
        model:a.model||{},
        teamStats:a.teamStats||{},
        marketScores:a.marketScores||{},
        robustnessScore:getRobustnessScore(a)
    };
}

async function buildDailyAnalysis(force=false){
    const targetDate=getTomorrow();

    if(dailyDate!==targetDate){
        cache=[];
        cacheTime=0;
        cacheValid=false;
        dailyDate=targetDate;

        console.log("📅 NOUVELLE JOURNÉE");
        console.log("🎯 MATCHS CIBLÉS:",targetDate);
    }

    if(!force&&cacheValid){
        const ttl=cache.length>0?CACHE_TTL:EMPTY_CACHE_TTL;

        if(Date.now()-cacheTime<ttl){
            console.log("⚡ CACHE ANALYSES:",cache.length);
            return cache;
        }
    }

    if(building){
        console.log("⏳ ANALYSE DÉJÀ EN COURS");
        return building;
    }

    building=(async()=>{
        lastStatus="LOADING";
        lastError=null;

        try{
            console.log("📡 RÉCUPÉRATION DES MATCHS...");

            const matches=await getMatches();

            if(!Array.isArray(matches)){
                throw new Error("getMatches() ne retourne pas un tableau");
            }

            console.log("📦 MATCHS REÇUS:",matches.length);

            const uniqueMatches=removeDuplicates(matches);

            const tomorrowMatches=uniqueMatches
                .filter(match=>{
                    return getMatchBrazzavilleDate(match?.utcDate)===targetDate;
                })
                .sort((a,b)=>{
                    return new Date(a.utcDate)-new Date(b.utcDate);
                });

            console.log(
                "📅 MATCHS DE DEMAIN:",
                tomorrowMatches.length
            );

            if(!tomorrowMatches.length){
                cache=[];
                cacheTime=Date.now();
                cacheValid=true;
                lastStatus="NO_MATCHES";
                lastUpdate=new Date().toISOString();

                return[];
            }

            const results=[];

            for(const match of tomorrowMatches.slice(0,MAX_ANALYSES)){
                try{
                    console.log(
                        "🔎 ANALYSE:",
                        `${match.homeTeam?.name||"HOME"} vs ${match.awayTeam?.name||"AWAY"}`
                    );

                    const analysis=await analyzeMatch(match);

                    if(!isUsable(analysis)){
                        console.log(
                            "⚠️ ANALYSE INVALIDE:",
                            match.homeTeam?.name,
                            "vs",
                            match.awayTeam?.name
                        );
                        continue;
                    }

                    const robustnessScore=getRobustnessScore(analysis);

                    results.push({
                        ...analysis,
                        robustnessScore
                    });

                }catch(err){
                    console.error(
                        "❌ AI ERROR:",
                        `${match.homeTeam?.name||"HOME"} vs ${match.awayTeam?.name||"AWAY"}`,
                        err.message
                    );
                }
            }

            results.sort((a,b)=>{
                const scoreDiff=
                    number(b.robustnessScore)-
                    number(a.robustnessScore);

                if(scoreDiff!==0)return scoreDiff;

                const confidenceDiff=
                    number(b.predictions?.confidence)-
                    number(a.predictions?.confidence);

                if(confidenceDiff!==0)return confidenceDiff;

                return number(b.predictions?.matchesUsed)-
                    number(a.predictions?.matchesUsed);
            });

            cache=results.slice(0,TOP_ANALYSES);
            cacheTime=Date.now();
            cacheValid=true;
            lastStatus=cache.length?"READY":"NO_VALID_ANALYSES";
            lastUpdate=new Date().toISOString();

            console.log(
                "👑 SÉLECTION V1 TERMINÉE:",
                cache.length
            );

            cache.forEach((a,index)=>{
                console.log(
                    `🏆 #${index+1}`,
                    `${a.match?.homeTeam?.name||"HOME"} vs ${a.match?.awayTeam?.name||"AWAY"}`,
                    "ROBUSTESSE:",
                    a.robustnessScore
                );
            });

            return cache;

        }catch(err){
            lastStatus="ERROR";
            lastError=err.message;
            lastUpdate=new Date().toISOString();

            console.error(
                "❌ DAILY ANALYSIS ERROR:",
                err.stack
            );

            return cacheValid?cache:[];

        }finally{
            building=null;
        }
    })();

    return building;
}

async function refreshDaily(){
    if(building){
        console.log("⏳ REFRESH IGNORÉ: analyse en cours");
        return;
    }

    console.log("🔄 REFRESH QUOTIDIEN");

    cacheValid=false;

    try{
        await buildDailyAnalysis(true);
        console.log("✅ REFRESH TERMINÉ");
    }catch(err){
        console.error(
            "❌ REFRESH ERROR:",
            err.message
        );
    }
}

app.get("/analysis",async(req,res)=>{
    try{
        const data=await buildDailyAnalysis();

        res.setHeader("Cache-Control","no-store");

        res.json({
            version:VERSION,
            date:dailyDate,
            target:"TOMORROW",
            timezone:"Africa/Brazzaville",
            count:data.length,
            max:TOP_ANALYSES,
            analyses:data.map(formatAnalysis)
        });

    }catch(err){
        res.status(500).json({
            error:err.message
        });
    }
});

app.get("/status",(req,res)=>{
    res.setHeader("Cache-Control","no-store");

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

app.get("/health",(req,res)=>{
    res.setHeader("Cache-Control","no-store");

    res.json({
        status:"ok",
        ai:"ACTIVE",
        version:VERSION,
        analyses:cache.length,
        maxAnalyses:TOP_ANALYSES,
        analyzing:!!building,
        targetDate:dailyDate,
        lastStatus,
        lastError,
        lastUpdate
    });
});

app.get("/__king_version",(req,res)=>{
    res.setHeader("Cache-Control","no-store");

    res.json({
        project:"KING PREDICTIONS AI",
        version:VERSION,
        frontend:"V1",
        dailyRefresh:true,
        intervalHours:24,
        target:"TOMORROW",
        maxAnalyses:TOP_ANALYSES,
        timezone:"Africa/Brazzaville",
        timestamp:new Date().toISOString()
    });
});

app.listen(PORT,"0.0.0.0",async()=>{
    console.log("👑 KING PREDICTIONS AI V1 ONLINE");
    console.log("🔥 VERSION:",VERSION);
    console.log("🌐 PORT:",PORT);
    console.log("🎯 CIBLE: MATCHS DE DEMAIN");
    console.log("🏆 MAX ANALYSES:",TOP_ANALYSES);
    console.log("🔄 REFRESH: 24H");
    console.log("🇨🇬 TIMEZONE: Africa/Brazzaville");

    try{
        await initializeDatabase();
        console.log("✅ DATABASE READY");

        await buildDailyAnalysis();
        console.log("✅ PREMIÈRE ANALYSE TERMINÉE");

        setInterval(async()=>{
            console.log("⏰ 24H REFRESH");
            await refreshDaily();
        },DAILY_INTERVAL);

        console.log("🚀 V1 READY");

    }catch(err){
        console.error(
            "❌ STARTUP:",
            err.stack
        );
    }
});
