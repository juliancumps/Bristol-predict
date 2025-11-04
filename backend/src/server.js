const express = require("express");
const cors = require("cors");
require("dotenv").config();
const {
  scrapeHarvestData,
  getSummaryStats,
} = require("./scrapers/harvestScraper");

const app = express();
const PORT = process.env.PORT || 3001;

// Cache for scraped data
let cachedData = null;
let lastScraped = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Middleware
app.use(cors());
app.use(express.json());

// Function to get fresh data (with caching)
async function getFreshData() {
  const now = Date.now();

  // Return cached data if it's still fresh
  if (cachedData && lastScraped && now - lastScraped < CACHE_DURATION) {
    console.log("📦 Returning cached data");
    return cachedData;
  }

  // Fetch fresh data
  console.log("🔄 Fetching fresh data from ADF&G...");
  try {
    const data = await scrapeHarvestData();
    cachedData = data;
    lastScraped = now;
    return data;
  } catch (error) {
    console.error("❌ Error fetching data:", error);
    // Return cached data if available, even if stale
    if (cachedData) {
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
    version: "1.0.0",
    lastScraped: lastScraped ? new Date(lastScraped).toISOString() : null,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    cacheStatus: cachedData ? "populated" : "empty",
    lastScraped: lastScraped ? new Date(lastScraped).toISOString() : null,
  });
});

// Districts endpoint - returns array of districts with current data
app.get("/api/districts", async (req, res) => {
  try {
    const data = await getFreshData();
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
    const data = await getFreshData();
    const summary = getSummaryStats(data);

    res.json({
      scrapedAt: data.scrapedAt,
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

// Specific district endpoint
app.get("/api/districts/:id", async (req, res) => {
  try {
    const data = await getFreshData();
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

// Start server and do initial data fetch
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

module.exports = app;
