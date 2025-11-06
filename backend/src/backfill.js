const {
  scrapeHarvestData,
  getSeasonDates,
} = require("./scrapers/harvestScraper");
const { initDatabase, saveScrapedData } = require("./database");
const fs = require("fs");
const path = require("path");

// Define all three seasons with specific date ranges
// Fishing season runs June to August
const SEASONS = [
  {
    year: 2023,
    start: new Date("2023-06-21"), //actual start is 06/20
    end: new Date("2023-07-22"),    //actual end is 07/21
  },
  {
    year: 2024,
    start: new Date("2024-06-18"), //actual start is 06/17
    end: new Date("2024-07-27"),    //actual end is 07/26
  },
  {
    year: 2025,
    start: new Date("2025-06-17"), //actual start is 06/16
    end: new Date("2025-07-25"),    //actual end is 07/24
  },
];
////////////////////////////////////////////


// Delay between requests (to be nice to ADF&G servers)
const DELAY_MS = 2000; // 2 seconds between requests

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill all three seasons (2023, 2024, 2025)
 */
async function backfillAllSeasons() {
  console.log("🐟 Bristol Bay Data Backfill Script - All Seasons");
  console.log("=".repeat(60));

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Created data directory");
  }

  // Initialize database
  console.log("\n📂 Initializing database...");
  const db = await initDatabase();

  let totalSuccessCount = 0;
  let totalErrorCount = 0;
  const allErrors = [];

  // Loop through each season
  for (const season of SEASONS) {
    console.log("\n" + "=".repeat(60));
    console.log(`📅 SEASON ${season.year}`);
    console.log("=".repeat(60));
    console.log(
      `Date range: ${season.start.toDateString()} to ${season.end.toDateString()}`
    );

    // Get all dates in the season
    const dates = getSeasonDates(season.start, season.end);
    console.log(`📍 Found ${dates.length} days in season`);
    console.log(
      `⏱️  Estimated time: ${Math.ceil((dates.length * DELAY_MS) / 1000 / 60)} minutes`
    );
    console.log("\n🚀 Starting backfill...\n");

    let successCount = 0;
    let errorCount = 0;

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
        totalSuccessCount++;

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
        totalErrorCount++;
        allErrors.push({ date: dateStr, season: season.year, error: error.message });
        console.error(`   ❌ Error: ${error.message}`);

        // Continue with next date even if one fails
        await sleep(DELAY_MS);
      }
    }

    // Season summary
    console.log("\n" + "-".repeat(60));
    console.log(`📊 Season ${season.year} Summary:`);
    console.log(`✅ Successfully scraped: ${successCount} days`);
    console.log(`❌ Failed: ${errorCount} days`);
  }

  // Overall summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 OVERALL BACKFILL SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Total successfully scraped: ${totalSuccessCount} days`);
  console.log(`❌ Total failed: ${totalErrorCount} days`);

  if (allErrors.length > 0) {
    console.log("\n⚠️  Errors:");
    allErrors.forEach(({ date, season, error }) => {
      console.log(`   - ${date} (${season}): ${error}`);
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
 * Backfill test - scrape specific dates to fix missing/incomplete data
 */
async function backfillTest() {
  console.log("🧪 Bristol Bay Data Backfill TEST - Scraping specific dates");
  console.log("=".repeat(60));

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Created data directory");
  }

  // Initialize database
  console.log("\n📂 Initializing database...");
  const db = await initDatabase();

  let totalSuccessCount = 0;
  let totalErrorCount = 0;

  // Specific dates to scrape (MM-DD-YYYY format)
  const datesToScrape = [
    "07-23-2025",
    "07-21-2025",
    "07-19-2025",
    "07-18-2025",
    "07-20-2024",
    "07-19-2024",
    "07-12-2023"
  ];

  console.log("\n🚀 Starting backfill for specific dates...\n");

  for (let i = 0; i < datesToScrape.length; i++) {
    const dateStr = datesToScrape[i];
    const [month, day, year] = dateStr.split("-");
    const date = new Date(year, month - 1, day);

    try {
      console.log(`[${i + 1}/${datesToScrape.length}] Scraping ${dateStr}...`);

      // Scrape data for this date
      const data = await scrapeHarvestData(date);

      // Save to database (will replace if exists)
      await saveScrapedData(db, data);

      totalSuccessCount++;

      // Log some stats
      const totalRun = data.totalRun.totalRun || 0;
      if (totalRun > 0) {
        console.log(`       ✅ ${totalRun.toLocaleString()} total run`);
      } else {
        console.log(`       ✅ (No fishing activity)`);
      }

      if (i < datesToScrape.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (error) {
      totalErrorCount++;
      console.error(`       ❌ Error: ${error.message}`);
      await sleep(DELAY_MS);
    }
  }

  // Test summary
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Total successfully scraped: ${totalSuccessCount} dates`);
  console.log(`❌ Total failed: ${totalErrorCount} dates`);
  console.log(`Expected: ${datesToScrape.length} dates`);

  if (totalSuccessCount === datesToScrape.length) {
    console.log(`\n✨ TEST PASSED! All ${datesToScrape.length} dates loaded successfully.`);
  } else if (totalSuccessCount > 0) {
    console.log(`\n⚠️  TEST PARTIAL - ${totalSuccessCount}/${datesToScrape.length} dates loaded. Check errors above.`);
  } else {
    console.log("\n❌ TEST FAILED - No dates loaded. Check errors above.");
  }

  // Close database
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err);
    } else {
      console.log("\n✅ Database closed");
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

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    try {
      const data = await scrapeHarvestData(date);
      await saveScrapedData(db, data);
      console.log(`✅ Saved ${data.runDate}`);
      successCount++;
      if (i < dates.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Error for ${date.toDateString()}:`, error.message);
    }
  }

  console.log(`\n✅ Scraped ${successCount} days`);
  console.log(`❌ Failed ${errorCount} days`);

  db.close();
  console.log("✅ Backfill complete");
}

/**
 * Backfill specific season by year
 */
async function backfillSeason(year) {
  const season = SEASONS.find((s) => s.year === year);
  if (!season) {
    console.error(`❌ Season ${year} not found. Available: ${SEASONS.map(s => s.year).join(", ")}`);
    return;
  }
  await backfillDateRange(
    season.start.toISOString().split("T")[0],
    season.end.toISOString().split("T")[0]
  );
}

// Run backfill if executed directly
if (require.main === module) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  if (args[0] === "test") {
    backfillTest().catch((error) => {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    });
  } else {
    backfillAllSeasons().catch((error) => {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    });
  }
}

module.exports = {
  backfillAllSeasons,
  backfillTest,
  backfillSeason,
  backfillDateRange,
  SEASONS,
};