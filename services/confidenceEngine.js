/*
=========================================
 KING PREDICTIONS AI
 CONFIDENCE ENGINE V25
 CALIBRATED / STRICT / ANTI-OVERCONFIDENCE
=========================================
*/

function clamp(value, min, max) {
    return Math.max(
        min,
        Math.min(max, Number(value) || 0)
    );
}

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function calculateConfidence({
    probabilities = {},
    homeStats = {},
    awayStats = {},
    eloProbability = 0.5,
    poisson = null
}) {

    /* =================================
       1. PROBABILITÉS POISSON
    ================================= */

    const home =
        clamp(
            num(probabilities.homeWin),
            0,
            100
        );

    const draw =
        clamp(
            num(probabilities.draw),
            0,
            100
        );

    const away =
        clamp(
            num(probabilities.awayWin),
            0,
            100
        );


    /*
     * On conserve l'identité du résultat.
     * Important pour comparer correctement
     * le favori avec l'ELO.
     */

    const outcomes = [
        {
            name: "HOME",
            probability: home
        },
        {
            name: "DRAW",
            probability: draw
        },
        {
            name: "AWAY",
            probability: away
        }
    ].sort(
        (a, b) =>
            b.probability -
            a.probability
    );


    const favorite =
        outcomes[0].probability;

    const second =
        outcomes[1].probability;

    const favoriteOutcome =
        outcomes[0].name;

    const separation =
        Math.max(
            0,
            favorite - second
        );


    /* =================================
       2. DONNÉES
    ================================= */

    const played =
        Math.min(
            num(homeStats.played),
            num(awayStats.played)
        );


    /*
     * La qualité des données progresse
     * progressivement sans dépasser 80
     * avec les 8 derniers matchs.
     */

    const dataQuality =
        clamp(
            played / 10 * 100,
            0,
            80
        );


    /* =================================
       3. FIABILITÉ
    ================================= */

    const reliability =
        clamp(
            (
                num(
                    homeStats.reliability,
                    0.5
                ) +
                num(
                    awayStats.reliability,
                    0.5
                )
            ) / 2,
            0,
            1
        );

    const reliabilityScore =
        reliability * 100;


    /* =================================
       4. FORCE DES ÉQUIPES
    ================================= */

    const strengthGap =
        Math.abs(
            num(
                homeStats.strength,
                50
            ) -
            num(
                awayStats.strength,
                50
            )
        );


    /* =================================
       5. ELO
    ================================= */

    /*
     * calculateEloProbability() renvoie :
     *
     * HOME = 0 → 1
     * AWAY = 1 - HOME
     *
     * L'ELO actuel ne possède pas
     * de véritable probabilité de nul.
     */

    const eloHome =
        clamp(
            num(
                eloProbability,
                0.5
            ),
            0,
            1
        );

    const eloAway =
        1 -
        eloHome;


    /*
     * On compare maintenant le favori
     * Poisson avec le côté correspondant
     * de l'ELO.
     *
     * Pour DRAW :
     * l'ELO est considéré neutre,
     * car ce moteur ELO ne modélise pas
     * le nul.
     */

    let eloFavorite =
        0.50;

    if (favoriteOutcome === "HOME") {

        eloFavorite =
            eloHome;

    }
    else if (favoriteOutcome === "AWAY") {

        eloFavorite =
            eloAway;

    }


    const eloFavoritePercent =
        eloFavorite * 100;


    /*
     * Accord entre les deux modèles.
     */

    const eloAgreement =
        clamp(
            100 -
            Math.abs(
                favorite -
                eloFavoritePercent
            ) * 1.5,
            0,
            100
        );


    /* =================================
       6. POISSON
    ================================= */

    const uncertainty =
        clamp(
            num(
                poisson?.uncertainty,
                50
            ),
            0,
            100
        );


    /*
     * Si dominance existe dans Poisson,
     * on l'utilise.
     *
     * Sinon, on utilise la séparation.
     */

    const dominance =
        clamp(
            num(
                poisson?.dominance,
                separation
            ),
            0,
            100
        );


    /* =================================
       7. SCORE DE BASE
    ================================= */

    let confidence =
        favorite * 0.35 +
        separation * 0.25 +
        eloAgreement * 0.10 +
        dataQuality * 0.10 +
        reliabilityScore * 0.10 +
        dominance * 0.10;


    /* =================================
       8. PÉNALITÉS
    ================================= */

    /*
     * Match serré
     */

    if (separation < 5)

        confidence -= 20;

    else if (separation < 8)

        confidence -= 12;

    else if (separation < 12)

        confidence -= 5;


    /*
     * Incertitude
     */

    if (uncertainty >= 60)

        confidence -= 25;

    else if (uncertainty >= 50)

        confidence -= 15;

    else if (uncertainty >= 40)

        confidence -= 8;


    /*
     * Équipes proches
     */

    if (strengthGap <= 4)

        confidence -= 15;

    else if (strengthGap <= 8)

        confidence -= 8;


    /*
     * Fiabilité faible
     */

    if (reliability < 0.50)

        confidence -= 18;

    else if (reliability < 0.60)

        confidence -= 10;

    else if (reliability < 0.70)

        confidence -= 5;


    /*
     * Peu de données
     */

    if (played < 5)

        confidence -= 20;

    else if (played < 8)

        confidence -= 8;


    /* =================================
       9. CAPS STRICTS
    ================================= */

    let cap = 80;


    if (favorite < 50)

        cap = 45;

    else if (favorite < 55)

        cap = 52;

    else if (favorite < 60)

        cap = 60;

    else if (favorite < 65)

        cap = 68;

    else if (favorite < 70)

        cap = 74;

    else if (favorite < 75)

        cap = 78;


    /*
     * Séparation faible
     */

    if (separation < 5)

        cap = Math.min(
            cap,
            45
        );

    else if (separation < 8)

        cap = Math.min(
            cap,
            55
        );

    else if (separation < 12)

        cap = Math.min(
            cap,
            65
        );


    /*
     * Incertitude élevée
     */

    if (uncertainty >= 60)

        cap = Math.min(
            cap,
            40
        );

    else if (uncertainty >= 50)

        cap = Math.min(
            cap,
            52
        );


    /*
     * Fiabilité faible
     */

    if (reliability < 0.50)

        cap = Math.min(
            cap,
            45
        );

    else if (reliability < 0.60)

        cap = Math.min(
            cap,
            55
        );


    /* =================================
       10. CONFIANCE FINALE
    ================================= */

    confidence =
        clamp(
            Math.round(
                Math.min(
                    confidence,
                    cap
                )
            ),
            5,
            80
        );


    /* =================================
       11. DEBUG
    ================================= */

    console.log(
        "===== CONFIDENCE ENGINE V25 =====",
        {
            favorite,
            favoriteOutcome,
            second,
            separation,
            played,
            dataQuality,
            reliability,
            strengthGap,
            eloHome:
                Math.round(
                    eloHome * 100
                ),
            eloAway:
                Math.round(
                    eloAway * 100
                ),
            eloFavorite:
                Math.round(
                    eloFavoritePercent
                ),
            eloAgreement,
            dominance,
            uncertainty,
            cap,
            confidence
        }
    );


    return confidence;
}


module.exports = {
    calculateConfidence
};
