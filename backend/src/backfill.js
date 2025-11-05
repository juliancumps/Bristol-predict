const {
  scrapeHarvestData,
  getSeasonDates,
} = require("./scrapers/harvestScraper");
const { initDatabase, saveScrapedData } = require("./database");
const fs = require("fs");
const path = require("path");

// 2025 Bristol Bay Salmon Season dates
const SEASON_START = new Date("2025-06-29");
const SEASON_END = new Date("2025-07-17");

// Delay between requests (to be nice to ADF&G servers)
const DELAY_MS = 2000; // 2 seconds between requests

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill all historical data for the season
 */
async function backfillSeason() {
  console.log("🐟 Bristol Bay Data Backfill Script");
  console.log("=".repeat(60));
  console.log(
    `Season: ${SEASON_START.toDateString()} to ${SEASON_END.toDateString()}`
  );

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Created data directory");
  }

  // Initialize database
  console.log("\n📂 Initializing database...");
  const db = await initDatabase();

  // Get all dates in the season
  const dates = getSeasonDates(SEASON_START, SEASON_END);
  console.log(`\n📅 Found ${dates.length} days in season`);
  console.log(
    `⏱️  Estimated time: ${Math.ceil((dates.length * DELAY_MS) / 1000 / 60)} minutes`
  );
  console.log("\n🚀 Starting backfill...\n");

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const dateStr = date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    try {
      console.log(`[${i + 1}/${dates.length}] Scraping ${dateStr}...`);

      // Scrape data for this date
      const data = await scrapeHarvestData(date);

      // Save to database
      await saveScrapedData(db, data);

      successCount++;

      // Log some stats
      const totalRun = data.totalRun.totalRun || 0;
      if (totalRun > 0) {
        console.log(`   ✅ ${totalRun.toLocaleString()} total run`);
      } else {
        console.log(`   ✅ (No fishing activity)`);
      }

      // Rate limiting - wait between requests
      if (i < dates.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (error) {
      errorCount++;
      errors.push({ date: dateStr, error: error.message });
      console.error(`   ❌ Error: ${error.message}`);

      // Continue with next date even if one fails
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 BACKFILL SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Successfully scraped: ${successCount} days`);
  console.log(`❌ Failed: ${errorCount} days`);

  if (errors.length > 0) {
    console.log("\n⚠️  Errors:");
    errors.forEach(({ date, error }) => {
      console.log(`   - ${date}: ${error}`);
    });
  }

  // Close database
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err);
    } else {
      console.log("\n✅ Database closed");
      console.log("🎉 Backfill complete!");
    }
  });
}

/**
 * Backfill specific date range
 */
async function backfillDateRange(startDate, endDate) {
  console.log(`🔄 Backfilling from ${startDate} to ${endDate}`);

  const db = await initDatabase();
  const dates = getSeasonDates(new Date(startDate), new Date(endDate));

  for (const date of dates) {
    try {
      const data = await scrapeHarvestData(date);
      await saveScrapedData(db, data);
      console.log(`✅ Saved ${data.runDate}`);
      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`❌ Error for ${date.toDateString()}:`, error.message);
    }
  }

  db.close();
  console.log("✅ Backfill complete");
}

// Run backfill if executed directly
if (require.main === module) {
  backfillSeason().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  backfillSeason,
  backfillDateRange,
};
