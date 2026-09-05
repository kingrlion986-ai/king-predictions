const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

let initialized = false;

async function initDailyLock() {
    if (initialized) return;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_picks (
            target_date TEXT PRIMARY KEY,
            picks JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    initialized = true;

    console.log("🔒 DAILY LOCK DATABASE READY");
}

async function getLockedPicks(targetDate) {
    await initDailyLock();

    const result = await pool.query(
        `
        SELECT picks
        FROM daily_picks
        WHERE target_date = $1
        LIMIT 1
        `,
        [targetDate]
    );

    if (!result.rows.length) {
        return null;
    }

    console.log(
        "🔒 PICKS PERSISTANTS TROUVÉS:",
        targetDate
    );

    return result.rows[0].picks;
}

async function lockDailyPicks(targetDate, picks) {
    await initDailyLock();

    const result = await pool.query(
        `
        INSERT INTO daily_picks (
            target_date,
            picks
        )
        VALUES ($1, $2)
        ON CONFLICT (target_date)
        DO NOTHING
        RETURNING picks
        `,
        [
            targetDate,
            JSON.stringify(picks)
        ]
    );

    if (result.rows.length) {
        console.log(
            "💾 PICKS DÉFINITIVEMENT VERROUILLÉS:",
            targetDate,
            "|",
            picks.length
        );

        return result.rows[0].picks;
    }

    const existing =
        await getLockedPicks(targetDate);

    console.log(
        "🔒 PICKS DÉJÀ EXISTANTS:",
        targetDate
    );

    return existing;
}

module.exports = {
    initDailyLock,
    getLockedPicks,
    lockDailyPicks
};
