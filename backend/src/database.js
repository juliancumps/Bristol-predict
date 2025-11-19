const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "bristol_bay.db");

// CRITICAL: Ensure data directory exists before opening database
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  console.log(`📁 Creating data directory: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`✅ Data directory created`);
} else {
  console.log(`✅ Data directory already exists: ${dataDir}`);
}

/**
 * Initialize the database with tables
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Error opening database:", err);
        reject(err);
        return;
      }
      console.log("📂 Connected to SQLite database");
    });

    // Create tables
    db.serialize(() => {
      // Daily summary table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS daily_summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_date TEXT UNIQUE NOT NULL,
          scraped_at TEXT NOT NULL,
          season INTEGER NOT NULL,
          total_catch INTEGER,
          total_escapement INTEGER,
          total_run INTEGER,
          data_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Error creating daily_summaries table:", err);
            reject(err);
            return;
          }
          console.log("✅ daily_summaries table ready");
        }
      );

      // District daily data table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS district_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_date TEXT NOT NULL,
          district_id TEXT NOT NULL,
          district_name TEXT NOT NULL,
          catch_daily INTEGER,
          catch_cumulative INTEGER,
          escapement_daily INTEGER,
          escapement_cumulative INTEGER,
          in_river_estimate INTEGER,
          total_run INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(run_date, district_id)
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Error creating district_data table:", err);
            reject(err);
            return;
          }
          console.log("✅ district_data table ready");
        }
      );

      // River daily data table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS river_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_date TEXT NOT NULL,
          river_name TEXT NOT NULL,
          escapement_daily INTEGER,
          escapement_cumulative INTEGER,
          in_river_estimate INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(run_date, river_name)
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Error creating river_data table:", err);
            reject(err);
            return;
          }
          console.log("✅ river_data table ready");
        }
      );

      // Sockeye per delivery data table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS sockeye_per_delivery (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_date TEXT NOT NULL,
          district_id TEXT NOT NULL,
          district_name TEXT NOT NULL,
          sockeye_per_delivery REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(run_date, district_id)
        )
        `,
        (err) => {
          if (err) {
            console.error("❌ Error creating sockeye_per_delivery table:", err);
            reject(err);
            return;
          }
          console.log("✅ sockeye_per_delivery table ready");
        }
      );

      // Create indexes for faster queries
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_run_date ON daily_summaries(run_date)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_season ON daily_summaries(season)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_district_date ON district_data(run_date, district_id)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_river_date ON river_data(run_date)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_sockeye_date ON sockeye_per_delivery(run_date)`
      );

      console.log("✅ Database initialized successfully");
      resolve(db);
    });
  });
}

/**
 * Save scraped data to database
 */
function saveScrapedData(db, data) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Start transaction
      db.run("BEGIN TRANSACTION");

      try {
        // Save daily summary
        db.run(
          `
          INSERT OR REPLACE INTO daily_summaries 
          (run_date, scraped_at, season, total_catch, total_escapement, total_run, data_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            data.runDate,
            data.scrapedAt,
            data.season,
            data.totalRun.catchCumulative || 0,
            data.totalRun.escapementCumulative || 0,
            data.totalRun.totalRun || 0,
            JSON.stringify(data),
          ]
        );

        // Save district data
        const districtStmt = db.prepare(`
          INSERT OR REPLACE INTO district_data 
          (run_date, district_id, district_name, catch_daily, catch_cumulative, 
           escapement_daily, escapement_cumulative, in_river_estimate, total_run)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        data.districts.forEach((district) => {
          districtStmt.run(
            data.runDate,
            district.id,
            district.name,
            district.catchDaily,
            district.catchCumulative,
            district.escapementDaily,
            district.escapementCumulative,
            district.inRiverEstimate,
            district.totalRun
          );
        });
        districtStmt.finalize();

        // Save river data
        const riverStmt = db.prepare(`
          INSERT OR REPLACE INTO river_data 
          (run_date, river_name, escapement_daily, escapement_cumulative, in_river_estimate)
          VALUES (?, ?, ?, ?, ?)
        `);

        data.rivers.forEach((river) => {
          riverStmt.run(
            data.runDate,
            river.name,
            river.escapementDaily,
            river.escapementCumulative,
            river.inRiverEstimate
          );
        });
        riverStmt.finalize();

        // Save sockeye per delivery data
        const sockeyeStmt = db.prepare(`
          INSERT OR REPLACE INTO sockeye_per_delivery 
          (run_date, district_id, district_name, sockeye_per_delivery)
          VALUES (?, ?, ?, ?)
        `);

        // Map district IDs back to names for sockeye data
        const districtIdToName = {
          'ugashik': 'Ugashik',
          'egegik': 'Egegik',
          'naknek': 'Naknek-Kvichak',
          'nushagak': 'Nushagak',
          'togiak': 'Togiak',
        };

        Object.entries(data.sockeyePerDelivery).forEach(([districtId, sockeye]) => {
          const districtName = districtIdToName[districtId] || districtId;
          sockeyeStmt.run(
            data.runDate,
            districtId,
            districtName,
            sockeye
          );
        });
        sockeyeStmt.finalize();

        // Commit transaction
        db.run("COMMIT", (err) => {
          if (err) {
            console.error("❌ Error committing transaction:", err);
            db.run("ROLLBACK");
            reject(err);
            return;
          }
          console.log(`✅ Saved data for ${data.runDate}`);
          resolve();
        });
      } catch (error) {
        console.error("❌ Error saving data:", error);
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
}

/**
 * Get data for a specific date from the database
 */
async function getDataByDate(db, runDate) {
  return new Promise(async (resolve, reject) => {
    db.get(
      `
      SELECT * FROM daily_summaries 
      WHERE run_date = ?
      `,
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
          // Get the main data from JSON
          const data = JSON.parse(row.data_json);

          // Get sockeye per delivery data from database
          const sockeyeData = await getSockeyePerDeliveryByDate(db, runDate);
          data.sockeyePerDelivery = sockeyeData;

          resolve(data);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Get all available dates in the database
 */
function getAvailableDates(db) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT run_date, season, total_run FROM daily_summaries ORDER BY run_date DESC",
      [],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

/**
 * Get available dates for a specific season
 */
function getAvailableDatesBySeason(db, season) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT run_date, season, total_run FROM daily_summaries WHERE season = ? ORDER BY run_date DESC",
      [season],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

/**
 * Get all unique seasons in the database
 */
function getAvailableSeasons(db) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT DISTINCT season FROM daily_summaries ORDER BY season DESC",
      [],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(r => r.season));
      }
    );
  });
}

/**
 * Get sockeye per delivery data for a date
 */
function getSockeyePerDeliveryByDate(db, runDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT district_id, sockeye_per_delivery 
      FROM sockeye_per_delivery 
      WHERE run_date = ?
      ORDER BY district_id
      `,
      [runDate],
      (err, rows) => {
        if (err) {
          console.error("❌ Error fetching sockeye data:", err);
          reject(err);
          return;
        }

        // Convert to object format: { naknek: 1410, egegik: 991, ... }
        const sockeyeMap = {};
        rows.forEach((row) => {
          sockeyeMap[row.district_id] = row.sockeye_per_delivery;
        });

        resolve(sockeyeMap);
      }
    );
  });
}

/**
 * Get date range for a season
 */
function getSeasonDateRange(db, season) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT run_date, total_run 
       FROM daily_summaries 
       WHERE season = ? 
       ORDER BY run_date ASC`,
      [season],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

module.exports = {
  initDatabase,
  saveScrapedData,
  getDataByDate,
  getAvailableDates,
  getAvailableDatesBySeason,
  getAvailableSeasons,
  getSeasonDateRange,
  getSockeyePerDeliveryByDate,
  DB_PATH,
};