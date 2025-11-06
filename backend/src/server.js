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
app.use(cors({
  origin: [
    "https://bristol-predict.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173"
  ]
}));
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

/**
 * Get historical data from database
 */
async function getHistoricalData(db, days) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM daily_summaries ORDER BY run_date DESC LIMIT ?`,
      [days],
      (err, rows) => {
        if (err) {
          console.error("Error querying historical data:", err);
          reject(err);
          return;
        }
        
        // Parse JSON data from each row
        const historicalData = rows.map(row => {
          try {
            return JSON.parse(row.data_json);
          } catch (e) {
            console.warn(`⚠️  Could not parse data for ${row.run_date}`);
            return null;
          }
        }).filter(Boolean);

        console.log(`✅ Retrieved ${historicalData.length} days of historical data`);
        resolve(historicalData);
      }
    );
  });
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


/**
 * Get data from database only - NO SCRAPING
 * Used for date ranges to avoid triggering fresh scrapes
 */
async function getDataFromDatabaseOnly(dateStr) {
  try {
    console.log(`🔍 Querying database for ${dateStr}...`);
    const dbData = await getDataByDate(db, dateStr);
    
    if (dbData) {
      console.log(`✅ Found ${dateStr} in database`);
      return dbData;
    } else {
      console.log(`⚠️  No data for ${dateStr} in database`);
      return null;
    }
  } catch (error) {
    console.error(`Error querying ${dateStr}:`, error);
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

    // ✅ Use DAILY values, not cumulative
    const dailyTotals = {
      catchDaily: data.districts.reduce((sum, d) => sum + (d.catchDaily || 0), 0),
      escapementDaily: data.districts.reduce((sum, d) => sum + (d.escapementDaily || 0), 0),
    };

    res.json({
      scrapedAt: data.scrapedAt,
      runDate: data.runDate,
      season: data.season,
      summary: {
        totalCatch: dailyTotals.catchDaily,        // ✅ Daily, not cumulative
        totalEscapement: dailyTotals.escapementDaily, // ✅ Daily, not cumulative
        totalRun: data.totalRun.totalRun || 0,   // This is already total
        districtCount: data.districts.length,
        riverCount: data.rivers.length,
      },
      districts: data.districts,  // Return full district data with all fields
      rivers: data.rivers,        // Return full river data
      totalRun: data.totalRun,    // Return all the run data
      sockeyePerDelivery: data.sockeyePerDelivery || {},
    });
  } catch (error) {
    console.error("Error in /api/daily:", error);
    res.status(500).json({
      error: "Failed to fetch daily summary",
      message: error.message
    });
  }
});

// Historical Data endpoint - get last N days
app.get("/api/historical", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90); // Max 90 days
    
    console.log(`📊 Fetching last ${days} days of data`);

    const historicalData = await getHistoricalData(db, days);
    
    if (historicalData.length === 0) {
      return res.status(404).json({
        error: "No historical data available",
        message: "Run backfill script to populate the database"
      });
    }

    res.json(historicalData);
  } catch (error) {
    console.error("Error in /api/historical:", error);
    res.status(500).json({
      error: "Failed to fetch historical data",
      message: error.message,
    });
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

    //  Add sockeye per delivery data to the district object
    const sockeyePerDelivery = data.sockeyePerDelivery?.[district.id] || 0;

    //console.log("🔍 DEBUG - data.sockeyePerDelivery:", data.sockeyePerDelivery);
    //console.log("🔍 DEBUG - district.id:", district.id);
    //console.log("🔍 DEBUG - value for this district:", data.sockeyePerDelivery?.[district.id]); 

    res.json({
      ...district,
      sockeyePerDelivery: data.sockeyePerDelivery?.[district.id] || 0,
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


// Date range endpoint - fetches multiple days and returns as array
app.get("/api/range", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Missing startDate or endDate",
        example: "/api/range?startDate=06-01-2024&endDate=06-07-2024"
      });
    }

    console.log(`📅 Fetching date range: ${startDate} to ${endDate}`);

    // Convert dates for comparison
    const start = new Date(startDate.split('-').reverse().join('-'));
    const end = new Date(endDate.split('-').reverse().join('-'));
    
    if (start > end) {
      return res.status(400).json({
        error: "startDate must be before endDate"
      });
    }

    // Build array of all dates in range
    const datesInRange = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = currentDate.getFullYear();
      datesInRange.push(`${month}-${day}-${year}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`📆 Dates to fetch: ${datesInRange.length} days`);

    // Fetch data for each date
    const rangeData = [];
    for (const date of datesInRange) {
      try {
        const data = await getDataFromDatabaseOnly(date);
        if (data) {
          rangeData.push(data);
        }
      } catch (error) {
        console.warn(`⚠️  Error querying ${date}:`, error.message);
      }
    }

    if (rangeData.length === 0) {
      return res.status(404).json({
        error: "No data found for date range in database",
        startDate,
        endDate,
        message: "The requested date range has no available data. Run backfill script to populate dates."
      });
    }

    console.log(`✅ Retrieved ${rangeData.length} days of data`);

    // Return raw array - let frontend handle aggregation
    res.json(rangeData);
  } catch (error) {
    console.error("Error in /api/range:", error);
    res.status(500).json({
      error: "Failed to fetch date range data",
      message: error.message
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