let DAILY_JOB_RUNNING = false;
let LAST_RUN_DATE = null;


async function startDailyScheduler(buildPredictions) {

  if (DAILY_JOB_RUNNING) {
    return;
  }

  DAILY_JOB_RUNNING = true;

  console.log("🕖 DAILY SCHEDULER STARTED");


  setInterval(async () => {

    const now = new Date();

    const brazzavilleDate =
      new Date(
        now.getTime() + 60 * 60 * 1000
      );


    const date =
      brazzavilleDate
      .toISOString()
      .split("T")[0];


    const hour =
      brazzavilleDate.getUTCHours();


    const minute =
      brazzavilleDate.getUTCMinutes();



    if (
      hour === 7 &&
      minute < 5 &&
      LAST_RUN_DATE !== date
    ) {


      LAST_RUN_DATE = date;


      console.log(
        "🚀 BUILDING NEW DAILY PREDICTIONS"
      );


      try {

        await buildPredictions();

        console.log(
          "✅ DAILY PREDICTIONS UPDATED"
        );


      } catch(err) {

        console.error(
          "❌ DAILY BUILD ERROR",
          err
        );

      }

    }


  },60000);

}


module.exports = {
  startDailyScheduler
};
