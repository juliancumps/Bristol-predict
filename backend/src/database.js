const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "bristol_bay.db");

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

      // per delivery data table
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

// Add index for faster queries
db.run(
  `CREATE INDEX IF NOT EXISTS idx_sockeye_date ON sockeye_per_delivery(run_date)`
);

      // Create indexes for faster queries
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_run_date ON daily_summaries(run_date)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_district_date ON district_data(run_date, district_id)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_river_date ON river_data(run_date)`
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

        // After saving river data, add this:

// Save sockeye per delivery data
const sockeeyeStmt = db.prepare(`
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
  sockeeyeStmt.run(
    data.runDate,
    districtId,
    districtName,
    sockeye
  );
});
sockeeyeStmt.finalize();


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
 * Get data for a specific date
 */
function getDataByDate(db, runDate) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT data_json FROM daily_summaries WHERE run_date = ?",
      [runDate],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (!row) {
          resolve(null);
          return;
        }
        try {
          const data = JSON.parse(row.data_json);
          resolve(data);
        } catch (parseErr) {
          reject(parseErr);
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
  getSeasonDateRange,
  DB_PATH,
};
