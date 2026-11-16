const express = require("express");
const cors = require("cors");
require("dotenv").config();


console.log("🚀 SERVER STARTUP BEGINNING");
console.log("Node version:", process.version);
console.log("Working directory:", process.cwd());


const {
  scrapeHarvestData,
  listAvailableDates,
  getSummaryStats,
  formatDateForURL,
} = require("./scrapers/harvestScraper");
console.log("✅ Loaded harvestScraper");


const {
  initDatabase,
  saveScrapedData,
  getDataByDate,
  getAvailableDates,
  getAvailableDatesBySeason,
  getRiverSeries,
  DATE_SORT,
} = require("./database");
const {
  loadAnnouncements,
  announcementYears,
  loadReference,
  loadPortMoller,
  portMollerYears,
  historyYears,
  loadHistory,
} = require("./store");
const {
  parseStockComposition,
  sharesByDistrict,
  cumulativeIndex,
  arrivalWindow,
  TRAVEL_DAYS,
} = require("./scrapers/portMoller");
const { computeStatus, registrationSeries, latestRegistrations, alaskaNow } = require("./openingsStatus");

console.log("✅ Loaded database module");

const app = express();
const PORT = process.env.PORT || 3001;

// Database instance
let db = null;

// Cache for current/latest data
let cachedData = null;
let lastScraped = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes


/**
 * Check if current date is within the Bristol Bay fishing season.
 * ADF&G publishes run summaries from about June 1 to mid August.
 * Change the window here if needed.
 */
const SEASON_WINDOW = { startMonth: 6, startDay: 1, endMonth: 8, endDay: 15 };
function isInFishingSeason(date = new Date()) {
  const key = (date.getMonth() + 1) * 100 + date.getDate();
  return (
    key >= SEASON_WINDOW.startMonth * 100 + SEASON_WINDOW.startDay &&
    key <= SEASON_WINDOW.endMonth * 100 + SEASON_WINDOW.endDay
  );
}

/**
 * Protect admin endpoints. Set ADMIN_TOKEN in the Railway variables, then
 * send it in the "x-admin-token" header. With no ADMIN_TOKEN set, the
 * endpoint is switched off.
 */
function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return res.status(403).json({ error: "Refresh is disabled (no ADMIN_TOKEN set on the server)" });
  }
  if (req.get("x-admin-token") !== token) {
    return res.status(401).json({ error: "Wrong or missing admin token" });
  }
  next();
}

// Middleware
app.use(cors({
  origin: [
    "https://bristol-predict.vercel.app",
    /^https:\/\/bristol-predict[a-z0-9-]*\.vercel\.app$/, // Vercel preview builds
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/ // local dev, also from a phone on the same Wi-Fi
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
      `SELECT * FROM daily_summaries ORDER BY ${DATE_SORT} DESC LIMIT ?`,
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
 * Get data from database only (no scraping)
 */
async function getDataFromDatabaseOnly(db, runDate) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM daily_summaries WHERE run_date = ?`,
      [runDate],
      async (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (!row) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(row.data_json));
        } catch (e) {
          reject(e);
        }
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

    // Check if we have cached data and it's for today
    if (
      cachedData &&
      cachedData.runDate === dateStr &&
      Date.now() - lastScraped < CACHE_DURATION
    ) {
      console.log("📦 Using cached data");
      return cachedData;
    }

    // Try to get from database first
    const dbData = await getDataFromDatabaseOnly(db, dateStr);
    if (dbData) {
      console.log("✅ Retrieved data from database");
      if (!runDate) {
        cachedData = dbData;
        lastScraped = Date.now();
      }
      return dbData;
    }

    // No date asked: serve the newest day in the database. The scheduled
    // update job (GitHub Actions) keeps the database current, so a page view
    // never has to wait for a scrape.
    if (!runDate) {
      const latest = await getAvailableDates(db);
      if (latest.length > 0) {
        const latestData = await getDataFromDatabaseOnly(db, latest[0].run_date);
        if (latestData) return latestData;
      }
    }

    // If no database data and a specific date was requested, throw error
    if (runDate) {
      throw new Error(`No data available for date ${dateStr}. Run backfill script to populate the database.`);
    }

    // For today with no database data, try to scrape fresh
    console.log("🌐 Scraping fresh data from ADF&G...");
    const freshData = await scrapeHarvestData(requestedDate);
    await saveScrapedData(db, freshData);

    cachedData = freshData;
    lastScraped = Date.now();

    return freshData;
  } catch (error) {
    console.error("Error fetching fresh data:", error);
    throw error;
  }
}

// ====== API ENDPOINTS ======

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    database:
      db !== null
        ? "connected"
        : "disconnected",
    cacheStatus: cachedData ? "populated" : "empty",
    lastScraped: lastScraped ? new Date(lastScraped).toISOString() : null,
  });
});

// Get all available dates (optionally filtered by season)
app.get("/api/dates", async (req, res) => {
  try {
    const season = req.query.season ? parseInt(req.query.season) : null;
    let dates;

    if (season) {
      // Get dates for specific season
      dates = await getAvailableDatesBySeason(db, season);
      console.log(`📅 Retrieved ${dates.length} dates for season ${season}`);
    } else {
      // Get all dates
      dates = await getAvailableDates(db);
      console.log(`📅 Retrieved ${dates.length} total dates`);
    }

    // Extract unique seasons from the data
    const seasons = [...new Set(dates.map(d => d.season))].sort((a, b) => a - b);

    res.json({
      count: dates.length,
      dates: dates.map((d) => d.run_date),
      seasons: seasons,
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

// Get the actual start date for a season
app.get("/api/season/:year/start", async (req, res) => {
  try {
    const season = parseInt(req.params.year);
    
    const result = await new Promise((resolve, reject) => {
      db.get(
        `SELECT MIN(run_date) as start_date FROM daily_summaries WHERE season = ?`,
        [season],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!result || !result.start_date) {
      return res.status(404).json({ error: "No data found for this season" });
    }
    
    res.json({ seasonStart: result.start_date });
  } catch (error) {
    console.error("Error in /api/season/:year/start:", error);
    res.status(500).json({ error: error.message });
  }
});

// Districts endpoint - returns array of districts with current data
// ALWAYS returns all 5 districts, even if they have zero values
app.get("/api/districts", async (req, res) => {
  try {
    const date = req.query.date;
    const data = await getFreshData(date);
    
    // Define all districts that should always be present
    const allDistricts = [
      { id: "naknek", name: "Naknek-Kvichak" },
      { id: "egegik", name: "Egegik" },
      { id: "ugashik", name: "Ugashik" },
      { id: "nushagak", name: "Nushagak" },
      { id: "togiak", name: "Togiak" },
    ];
    
    // If no districts in data, create zero-value districts
    if (!data.districts || data.districts.length === 0) {
      console.log(`⚠️ No district data found for ${date || 'today'}, returning zero-value districts`);
      const zeroDistricts = allDistricts.map(d => ({
        ...d,
        catchDaily: 0,
        catchCumulative: 0,
        escapementDaily: 0,
        escapementCumulative: 0,
        sockeyePerDelivery: 0,
        totalRun: 0,
        inRiverEstimate: 0,
      }));
      res.json(zeroDistricts);
    } else {
      // If we have data, make sure all districts are present (fill in missing ones with zeros)
      const districtMap = {};
      data.districts.forEach(d => {
        districtMap[d.id] = d;
      });
      
      const completeDistricts = allDistricts.map(d => {
        if (districtMap[d.id]) {
          return districtMap[d.id];
        } else {
          // Fill in missing district with zeros
          return {
            ...d,
            catchDaily: 0,
            catchCumulative: 0,
            escapementDaily: 0,
            escapementCumulative: 0,
            sockeyePerDelivery: 0,
            totalRun: 0,
            inRiverEstimate: 0,
          };
        }
      });
      
      res.json(completeDistricts);
    }
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

// Historical Data endpoint - get last N days (optionally filtered by season)
app.get("/api/historical", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 40, 90); // Max 90 days
    const season = req.query.season ? parseInt(req.query.season) : null;
    
    console.log(`📊 Fetching last ${days} days of data${season ? ` for season ${season}` : ""}`);

    let query = `SELECT * FROM daily_summaries ORDER BY ${DATE_SORT} DESC LIMIT ?`;
    let params = [days];

    if (season) {
      query = `SELECT * FROM daily_summaries WHERE season = ? ORDER BY ${DATE_SORT} DESC LIMIT ?`;
      params = [season, days];
    }

    const historicalData = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const data = rows.map(row => {
          try {
            return JSON.parse(row.data_json);
          } catch (e) {
            console.warn(`⚠️  Could not parse data for ${row.run_date}`);
            return null;
          }
        }).filter(Boolean);

        resolve(data);
      });
    });
    
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

    // Parse dates in local time (MM-DD-YYYY format) without timezone conversion
    const parseDate = (dateStr) => {
      const [month, day, year] = dateStr.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
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
        const data = await getDataFromDatabaseOnly(db, date);
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
app.post("/api/refresh", requireAdmin, async (req, res) => {
  try {
    console.log("🔄 Force refresh requested");
    cachedData = null;
    lastScraped = null;
    // Read the newest day ADF&G has and save it.
    const available = await listAvailableDates();
    const data = await scrapeHarvestData(available[0]);
    await saveScrapedData(db, data);
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

// ====== V4 ENDPOINTS ======

// Small in-memory cache for the JSON files (they change only on deploy)
const fileCache = new Map();
function cached(key, loader, ttlMs = 60 * 1000) {
  const hit = fileCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = loader();
  fileCache.set(key, { at: Date.now(), value });
  return value;
}

function announcementsForYear(yearParam) {
  const years = announcementYears();
  const year = parseInt(yearParam) || years[0] || new Date().getFullYear();
  return { year, years, store: cached(`ann-${year}`, () => loadAnnouncements(year)) };
}

// Announcement feed. ?year=2026  ?kind=eastside,westside  ?full=1 (include text)
app.get("/api/announcements", (req, res) => {
  try {
    const { year, years, store } = announcementsForYear(req.query.year);
    const kinds = req.query.kind ? String(req.query.kind).split(",") : null;
    const items = store.items
      .filter((i) => !kinds || kinds.includes(i.kind))
      .map((i) => (req.query.full ? i : { ...i, text: undefined }));
    res.json({ year, years, updatedAt: store.updatedAt, checkedAt: store.checkedAt, count: items.length, items });
  } catch (error) {
    res.status(500).json({ error: "Failed to load announcements", message: error.message });
  }
});

// One announcement with full text
app.get("/api/announcements/:id", (req, res) => {
  for (const year of announcementYears()) {
    const item = cached(`ann-${year}`, () => loadAnnouncements(year)).items.find((i) => i.id === req.params.id);
    if (item) return res.json(item);
  }
  res.status(404).json({ error: "Announcement not found" });
});

// District status board. ?asOf=2026-07-01T08:00 (Alaska time) replays a past moment.
app.get("/api/openings", (req, res) => {
  try {
    const asOf = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(req.query.asOf || "") ? req.query.asOf : alaskaNow();
    const { year, years, store } = announcementsForYear(asOf.slice(0, 4));
    res.json({
      ...computeStatus(store.items, asOf),
      now: alaskaNow(),
      year,
      years,
      checkedAt: store.checkedAt,
      updatedAt: store.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to compute openings", message: error.message });
  }
});

// Boat counts found in the announcements. ?year=2026
app.get("/api/registrations", (req, res) => {
  try {
    const { year, years, store } = announcementsForYear(req.query.year);
    res.json({ year, years, series: registrationSeries(store.items) });
  } catch (error) {
    res.status(500).json({ error: "Failed to load registrations", message: error.message });
  }
});

// Escapement by river for a season, with the ADF&G goal ranges. ?season=2026
app.get("/api/escapement", async (req, res) => {
  try {
    const dates = await getAvailableDates(db);
    const dbSeasons = [...new Set(dates.map((d) => d.season))];
    const seasons = [...new Set([...dbSeasons, ...historyYears()])].sort((a, b) => b - a);
    const season = parseInt(req.query.season) || seasons[0];

    // A season that is not in the run summary database: use the ADF&G annual report
    if (!dbSeasons.includes(season)) {
      const h = historyOf(season);
      const rivers = {};
      for (const [name, rows] of Object.entries(h?.escapement || {})) {
        rivers[name] = rows.map((r) => ({ date: r.date, daily: r.daily ?? 0, cumulative: r.cumulative ?? 0, inRiver: 0 }));
      }
      return res.json({
        season,
        seasons,
        source: "amr",
        sourceUrl: h?.source || null,
        goals: cached("goals", () => loadReference("escapement_goals")),
        rivers,
      });
    }

    const rows = await getRiverSeries(db, season);
    const rivers = {};
    rows.forEach((r) => {
      (rivers[r.river_name] ||= []).push({
        date: r.run_date,
        daily: r.escapement_daily,
        cumulative: r.escapement_cumulative,
        inRiver: r.in_river_estimate,
      });
    });
    res.json({
      season,
      seasons,
      source: "in-season",
      goals: cached("goals", () => loadReference("escapement_goals")),
      rivers,
    });
  } catch (error) {
    console.error("Error in /api/escapement:", error);
    res.status(500).json({ error: "Failed to load escapement", message: error.message });
  }
});

// Port Moller test fishery. ?year=2026
// Catch index from BBSRI (data/portmoller), stock composition from the saved ADF&G announcements.
function portMollerData(yearParam) {
  const years = [...new Set([...portMollerYears(), ...announcementYears()])].sort((a, b) => b - a);
  const year = parseInt(yearParam) || years[0] || new Date().getFullYear();
  const pm = loadPortMoller(year);
  const ann = loadAnnouncements(year);
  const stockComposition = ann.items
    .filter((i) => i.kind === "portmoller" && i.text)
    .map((i) => {
      const sc = parseStockComposition(i.text, i.title);
      return {
        id: i.id,
        title: i.title,
        url: i.url,
        issued: i.issued,
        ...sc,
        byDistrict: sharesByDistrict(sc.groups),
        arrival: arrivalWindow(sc.periodStart, sc.periodEnd),
      };
    })
    .sort((a, b) => (a.periodStart || "").localeCompare(b.periodStart || ""));
  const catchUpdates = [...pm.catchUpdates].sort((a, b) => a.number - b.number);
  return {
    year,
    years,
    source: pm.source,
    checkedAt: pm.checkedAt,
    updatedAt: pm.updatedAt,
    announcementsCheckedAt: ann.checkedAt,
    travelDays: TRAVEL_DAYS,
    catchUpdates,
    cumulativeIndex: cumulativeIndex(catchUpdates),
    stockComposition,
  };
}

app.get("/api/portmoller", (req, res) => {
  try {
    res.json(cached(`pm-${req.query.year || "latest"}`, () => portMollerData(req.query.year)));
  } catch (error) {
    res.status(500).json({ error: "Failed to load Port Moller data", message: error.message });
  }
});

// Daily briefing: one small answer for the morning check on a weak signal.
// ?asOf=2026-07-01T06:00 (Alaska time) replays a past morning.
const mdyKey = (d) => d.slice(6) + d.slice(0, 2) + d.slice(3, 5); // MM-DD-YYYY -> YYYYMMDD

function riverState(value, goal) {
  if (value < goal.lower) return "below";
  if (goal.upper && value > goal.upper) return "above";
  return "within";
}

app.get("/api/briefing", async (req, res) => {
  try {
    const asOf = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(req.query.asOf || "") ? req.query.asOf : alaskaNow();
    const asOfKey = asOf.slice(0, 10).replace(/-/g, "");

    // Newest run summary day before asOf (ADF&G posts day D on the morning of D+1)
    const dates = await getAvailableDates(db);
    const day = dates.find((d) => mdyKey(d.run_date) < asOfKey) || null;
    const run = day ? await getDataByDate(db, day.run_date) : null;
    const prevDay = day ? dates.find((d) => mdyKey(d.run_date) < mdyKey(day.run_date) && d.season === day.season) : null;
    const prev = prevDay ? await getDataByDate(db, prevDay.run_date) : null;

    const { year, store } = announcementsForYear(asOf.slice(0, 4));
    const status = computeStatus(store.items, asOf);
    const drift = {};
    for (const [id, d] of Object.entries(status.districts)) {
      drift[id] = { ...d.drift, registration: d.registration || null };
    }
    const fleet = latestRegistrations(store.items.filter((i) => i.issued && i.issued <= asOf));

    const season = run ? run.season : year;
    const forecasts = cached("forecasts", () => loadReference("forecasts")) || { years: {} };
    const goals = cached("goals", () => loadReference("escapement_goals"));
    const escapement = run && goals
      ? goals.rivers
          .map((g) => {
            const r = (run.rivers || []).find((x) => x.name === g.name);
            if (!r) return null;
            return { river: g.name, district: g.district, cumulative: r.escapementCumulative, daily: r.escapementDaily,
              lower: g.lower, upper: g.upper, state: riverState(r.escapementCumulative, g) };
          })
          .filter(Boolean)
      : [];

    const pm = portMollerData(season);
    // BBSRI posts the catch update in the evening of its date
    const pmLast = [...pm.cumulativeIndex].reverse().find((c) => `${c.date}T21:00` <= asOf) || null;
    const pmUpdate = pmLast ? pm.catchUpdates.find((u) => u.number === pmLast.number) : null;
    const pmStock = [...pm.stockComposition].reverse().find((s) => s.issued && s.issued <= asOf) || null;

    res.json({
      asOf,
      now: alaskaNow(),
      season,
      inSeason: status.inSeason,
      status: drift,
      latestRun: run && {
        runDate: run.runDate,
        scrapedAt: run.scrapedAt,
        totalRun: run.totalRun,
        districts: run.districts,
        sockeyePerDelivery: run.sockeyePerDelivery || {},
        previous: prev && { runDate: prev.runDate, districts: prev.districts, sockeyePerDelivery: prev.sockeyePerDelivery || {} },
      },
      forecast: forecasts.years?.[season] || null,
      escapement,
      portMoller: {
        date: pmLast?.date || null,
        number: pmLast?.number || null,
        dailyIndex: pmLast?.dailyIndex ?? null,
        cumulativeIndex: pmLast?.cumulative ?? null,
        url: pmUpdate?.url || null,
        stock: pmStock && { period: [pmStock.periodStart, pmStock.periodEnd], byDistrict: pmStock.byDistrict,
          arrival: pmStock.arrival, url: pmStock.url, complete: pmStock.complete },
      },
      fleet,
      freshness: {
        runSummary: run ? run.runDate : null,
        runSummaryScrapedAt: run ? run.scrapedAt : null,
        announcements: store.checkedAt,
        portMoller: pm.checkedAt,
      },
    });
  } catch (error) {
    console.error("Error in /api/briefing:", error);
    res.status(500).json({ error: "Failed to build the briefing", message: error.message });
  }
});

// History from the ADF&G Annual Management Reports (2017 and later).
// These are FINAL numbers. The screens show them as their own seasons, with the
// source, and never mix them into the in-season (run summary) days.
const historyOf = (year) => cached(`history-${year}`, () => loadHistory(year), 10 * 60 * 1000);
const HISTORY_DISTRICTS = ["naknek", "egegik", "ugashik", "nushagak", "togiak"];

/** River -> district, from the escapement goal list */
function riverDistricts() {
  const goals = cached("goals", () => loadReference("escapement_goals"));
  return Object.fromEntries((goals?.rivers || []).map((g) => [g.name, g.district]));
}

/** AMR forecast-vs-actual table -> the forecasts.json shape (millions of fish) */
function historyForecast(h) {
  const f = h?.forecast;
  if (!f?.total) return null;
  const m = (n) => (n == null ? null : Math.round(n / 1e4) / 100);
  const map = riverDistricts();
  const districts = {};
  for (const [river, r] of Object.entries(f.rivers)) {
    const id = map[river];
    if (!id) continue;
    const d = (districts[id] ||= { inshoreRun: 0, actualInshoreRun: 0, harvest: 0, actualHarvest: 0, escapement: null, actualEscapement: 0 });
    d.inshoreRun += r.forecast || 0;
    d.actualInshoreRun += r.actual || 0;
    d.harvest += r.projectedHarvest || 0;
    d.actualHarvest += r.harvest || 0;
    d.actualEscapement += r.escapement || 0;
  }
  for (const d of Object.values(districts)) {
    for (const k of ["inshoreRun", "actualInshoreRun", "harvest", "actualHarvest", "actualEscapement"]) d[k] = m(d[k]);
  }
  return {
    source: "amr",
    sourceUrl: h.source,
    units: "millions of sockeye",
    baywide: {
      inshoreRun: m(f.total.forecast),
      actualInshoreRun: m(f.total.actual),
      harvest: m(f.total.projectedHarvest),
      actualHarvest: m(f.total.harvest),
      escapement: null,
      actualEscapement: m(f.total.escapement),
    },
    districts,
  };
}

app.get("/api/history", (req, res) => {
  const years = cached("history-years", () =>
    historyYears().map((year) => {
      const h = historyOf(year);
      return { year, source: h?.source, importedAt: h?.importedAt, districts: Object.keys(h?.catch || {}), registrationDays: h?.registration?.length || 0 };
    })
  );
  res.json({ years });
});

// Daily sockeye catch and deliveries for every history season (small, for Run Timing)
// { years: { 2019: { source, naknek: [["06-19", sockeye, deliveries], ...] } } }
app.get("/api/history/catch", (req, res) => {
  res.json(
    cached("history-catch", () => {
      const years = {};
      for (const year of historyYears()) {
        const h = historyOf(year);
        if (!h) continue;
        const y = { source: h.source };
        for (const id of HISTORY_DISTRICTS) {
          y[id] = (h.catch?.[id] || [])
            .filter((r) => r.sockeye)
            .map((r) => [r.date.slice(0, 5), r.sockeye, (r.deliveriesDrift || 0) + (r.deliveriesSet || 0)]);
        }
        years[year] = y;
      }
      return { years };
    })
  );
});

// Fish per delivery in past seasons near one day. ?date=07-04 (MM-DD), ?window=1 (days each side)
// All gear: AMR deliveries are drift + set net together.
app.get("/api/history/day", (req, res) => {
  const md = String(req.query.date || "").slice(0, 5);
  if (!/^\d{2}-\d{2}$/.test(md)) return res.status(400).json({ error: "date must be MM-DD" });
  const win = Math.min(Math.max(parseInt(req.query.window) || 1, 0), 3);
  res.json(
    cached(`history-day-${md}-${win}`, () => {
      const target = new Date(`2000-${md}T00:00:00Z`).getTime();
      const near = (date) => Math.abs(new Date(`2000-${date.slice(0, 5)}T00:00:00Z`).getTime() - target) <= win * 864e5;
      const districts = {};
      for (const id of HISTORY_DISTRICTS) {
        const values = [];
        for (const year of historyYears()) {
          const rows = (historyOf(year)?.catch?.[id] || []).filter((r) => near(r.date) && r.sockeye != null);
          const fish = rows.reduce((s, r) => s + r.sockeye, 0);
          const deliveries = rows.reduce((s, r) => s + (r.deliveriesDrift || 0) + (r.deliveriesSet || 0), 0);
          if (deliveries >= 20) values.push({ year, fishPerDelivery: Math.round(fish / deliveries) });
        }
        const sorted = values.map((v) => v.fishPerDelivery).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        districts[id] = {
          values,
          median: sorted.length ? (sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)) : null,
          min: sorted[0] ?? null,
          max: sorted.at(-1) ?? null,
        };
      }
      return { date: md, window: win, gear: "all", districts };
    })
  );
});

app.get("/api/history/:year", (req, res) => {
  const year = parseInt(req.params.year);
  const data = year ? historyOf(year) : null;
  if (!data) return res.status(404).json({ error: `No history for ${req.params.year}` });
  res.json(data);
});

// Preseason forecasts by year and district
app.get("/api/forecasts", (req, res) => {
  res.json(
    cached("forecasts-merged", () => {
      const base = loadReference("forecasts") || { years: {} };
      const years = { ...base.years };
      // Seasons with an ADF&G annual report: add the final run. Add the forecast where
      // forecasts.json has none.
      for (const year of historyYears()) {
        const hf = historyForecast(historyOf(year));
        if (!hf) continue;
        if (!years[year]) {
          years[year] = hf;
        } else {
          const y = (years[year] = { ...years[year], final: { sourceUrl: hf.sourceUrl, baywide: hf.baywide, districts: hf.districts } });
          y.final.source = "amr";
        }
      }
      return { ...base, years };
    })
  );
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
    
    // ======= CONDITIONAL FRESH DATA CHECK =======
    // Only check for fresh data during fishing season
    if (isInFishingSeason()) {
      console.log("🔄 Fetching initial data (in season)...");
      try {
        await getFreshData();
        console.log("✅ Initial data loaded successfully");
      } catch (error) {
        console.error("⚠️  Failed to load initial data:", error.message);
        console.log("📌 Server will retry on first request");
      }
    } else {
      console.log("🏖️  Outside fishing season - skipping fresh data check");
      console.log("📌 Using database records only");
    }
    // ============================================
  });
}

startServer().catch((error) => {
  console.error("💥 Failed to start server:", error);
  process.exit(1);
});

module.exports = app;