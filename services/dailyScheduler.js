let DAILY_JOB_RUNNING = false;

async function startDailyScheduler(buildPredictions) {

  if (DAILY_JOB_RUNNING) {
    return;
  }

  DAILY_JOB_RUNNING = true;

  console.log("🕖 DAILY SCHEDULER STARTED");

  setInterval(async () => {

    const now = new Date();

    // Heure de Brazzaville (UTC+1)
    const hour = (now.getUTCHours() + 1) % 24;
    const minute = now.getUTCMinutes();

    if (hour === 7 && minute < 5) {

      console.log("🚀 BUILDING NEW DAILY PREDICTIONS");

      try {

        await buildPredictions();

        console.log("✅ DAILY PREDICTIONS UPDATED");

      } catch (err) {

        console.error("❌ DAILY BUILD ERROR", err);

      }

    }

  }, 60000);

}

module.exports = {
  startDailyScheduler
};
