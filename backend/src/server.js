const express = require("express");
const cors = require("cors");
require("dotenv").config();
const {
  scrapeHarvestData,
  getSummaryStats,
  formatDateForURL,
} = require("./scrapers/harvestScraper");
const {
  initDatabase,
  saveScrapedData,
  getDataByDate,
  getAvailableDates,
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3001;

// Database instance
let db = null;

// Cache for current/latest data
let cachedData = null;
let lastScraped = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
async function initializeServer() {
  try {
    console.log("📂 Initializing database...");
    db = await initDatabase();
    console.log("✅ Database ready");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    process.exit(1);
  }
}

async function getDataByDateRange(db, startDate, endDate) {
  // Query all data between two dates
  // startDate and endDate in MM-DD-YYYY format
  return db.query(
    "SELECT * FROM harvest_data WHERE run_date >= ? AND run_date <= ? ORDER BY run_date DESC",
    [startDate, endDate]
  );
}

async function getHistoricalData(db, days) {
  // Query last N days of data
  return db.query(
    "SELECT * FROM harvest_data ORDER BY run_date DESC LIMIT ?",
    [days]
  );
}



/**
 * Get fresh data for a specific date (with caching for current date)
 */
async function getFreshData(runDate = null) {
  try {
    // If no date specified, use today
    const requestedDate = runDate ? new Date(runDate) : new Date();
    const dateStr = formatDateForURL(requestedDate);

    // Check if we're requesting today's data and have a fresh cache
    const isToday = dateStr === formatDateForURL(new Date());
    const now = Date.now();

    if (
      isToday &&
      cachedData &&
      lastScraped &&
      now - lastScraped < CACHE_DURATION
    ) {
      console.log("📦 Returning cached data for today");
      return cachedData;
    }

    // Try to get from database first
    console.log(`🔍 Checking database for ${dateStr}...`);
    const dbData = await getDataByDate(db, dateStr);

    if (dbData) {
      console.log(`✅ Found ${dateStr} in database`);
      if (isToday) {
        cachedData = dbData;
        lastScraped = now;
      }
      return dbData;
    }

    // If not in database, scrape it
    console.log(`🔄 Scraping fresh data for ${dateStr}...`);
    const data = await scrapeHarvestData(requestedDate);

    // Save to database
    await saveScrapedData(db, data);
    console.log(`💾 Saved ${dateStr} to database`);

    // Cache if today
    if (isToday) {
      cachedData = data;
      lastScraped = now;
    }

    return data;
  } catch (error) {
    console.error("❌ Error fetching data:", error);

    // Return cached data if available, even if stale
    if (cachedData && !runDate) {
      console.log("⚠️  Returning stale cached data due to error");
      return cachedData;
    }

    throw error;
  }
}

// Basic route to test server
app.get("/", (req, res) => {
  res.json({
    message: "Bristol Predict API Server",
    status: "running",
    version: "2.0.0",
    features: ["historical-data", "date-selection", "sqlite-database"],
    lastScraped: lastScraped ? new Date(lastScraped).toISOString() : null,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected",
    cacheStatus: cachedData ? "populated" : "empty",
    lastScraped: lastScraped ? new Date(lastScraped).toISOString() : null,
  });
});

// Get all available dates
app.get("/api/dates", async (req, res) => {
  try {
    const dates = await getAvailableDates(db);
    res.json({
      count: dates.length,
      dates: dates.map((d) => d.run_date),
      dateRanges:
        dates.length > 0
          ? {
              earliest: dates[dates.length - 1].run_date,
              latest: dates[0].run_date,
            }
          : null,
    });
  } catch (error) {
    console.error("Error in /api/dates:", error);
    res.status(500).json({
      error: "Failed to fetch available dates",
      message: error.message,
    });
  }
});

// Districts endpoint - returns array of districts with current data
app.get("/api/districts", async (req, res) => {
  try {
    const date = req.query.date;
    const data = await getFreshData(date);
    res.json(data.districts);
  } catch (error) {
    console.error("Error in /api/districts:", error);
    res.status(500).json({
      error: "Failed to fetch district data",
      message: error.message,
    });
  }
});

// Daily summary endpoint - returns full scraped data
app.get("/api/daily", async (req, res) => {
  try {
    const date = req.query.date;
    const data = await getFreshData(date);
    const summary = getSummaryStats(data);

    res.json({
      scrapedAt: data.scrapedAt,
      runDate: data.runDate,
      season: data.season,
      summary: {
        totalCatch: summary.totalCatch,
        totalEscapement: summary.totalEscapement,
        totalRun: summary.totalRun,
        districtCount: summary.districtCount,
        riverCount: summary.riverCount,
      },
      districts: data.districts,
      rivers: data.rivers,
      totalRun: data.totalRun,
    });
  } catch (error) {
    console.error("Error in /api/daily:", error);
    res.status(500).json({
      error: "Failed to fetch daily summary",
      message: error.message,
    });
  }
});

//Date range endpoint
app.get("/api/range", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Query database for data between dates
    // Return array of daily data objects
    const data = await getDataByDateRange(db, startDate, endDate);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Historical Data endpoint
app.get("/api/historical", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await getHistoricalData(db, days);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Specific district endpoint
app.get("/api/districts/:id", async (req, res) => {
  try {
    const date = req.query.date;
    const data = await getFreshData(date);
    const district = data.districts.find((d) => d.id === req.params.id);

    if (!district) {
      return res.status(404).json({
        error: "District not found",
        availableDistricts: data.districts.map((d) => d.id),
      });
    }

    // Include rivers for this district
    const districtRivers = data.rivers.filter((r) =>
      r.name.toLowerCase().includes(district.name.toLowerCase().split("-")[0])
    );

    res.json({
      ...district,
      rivers: districtRivers,
      runDate: data.runDate,
    });
  } catch (error) {
    console.error(`Error in /api/districts/${req.params.id}:`, error);
    res.status(500).json({
      error: "Failed to fetch district data",
      message: error.message,
    });
  }
});

// Force refresh endpoint
app.post("/api/refresh", async (req, res) => {
  try {
    console.log("🔄 Force refresh requested");
    cachedData = null;
    lastScraped = null;
    const data = await getFreshData();
    const summary = getSummaryStats(data);

    res.json({
      message: "Data refreshed successfully",
      scrapedAt: data.scrapedAt,
      runDate: data.runDate,
      summary,
    });
  } catch (error) {
    console.error("Error in /api/refresh:", error);
    res.status(500).json({
      error: "Failed to refresh data",
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// Start server
async function startServer() {
  await initializeServer();

  app.listen(PORT, async () => {
    console.log(`🐟 Bristol Predict API running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log("🔄 Fetching initial data...");

    try {
      await getFreshData();
      console.log("✅ Initial data loaded successfully");
    } catch (error) {
      console.error("⚠️  Failed to load initial data:", error.message);
      console.log("📌 Server will retry on first request");
    }
  });
}

startServer().catch((error) => {
  console.error("💥 Failed to start server:", error);
  process.exit(1);
});

module.exports = app;
