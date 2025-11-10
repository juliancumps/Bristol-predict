/**
 * Script to remove November 2025 entries from the database
 * This cleans up any test/erroneous data scraped outside fishing season
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "bristol_bay.db");

function cleanNovemberData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Error opening database:", err);
        reject(err);
        return;
      }
      console.log("📂 Connected to database");
    });

    db.serialize(() => {
      console.log("\n🔍 Checking for November 2025 entries...\n");

      // First, see what we're about to delete
      db.all(
        `SELECT run_date, total_run FROM daily_summaries 
         WHERE run_date LIKE '11-%2025'
         ORDER BY run_date`,
        [],
        (err, rows) => {
          if (err) {
            console.error("❌ Error querying data:", err);
            db.close();
            reject(err);
            return;
          }

          if (rows.length === 0) {
            console.log("✅ No November 2025 entries found - database is clean!");
            db.close();
            resolve();
            return;
          }

          console.log(`Found ${rows.length} November 2025 entries to delete:`);
          rows.forEach(row => {
            console.log(`  - ${row.run_date} (total run: ${row.total_run || 0})`);
          });

          console.log("\n🗑️  Deleting November 2025 data...\n");

          // Start transaction for safe deletion
          db.run("BEGIN TRANSACTION");

          // Delete from all tables
          const tables = [
            'daily_summaries',
            'district_data', 
            'river_data',
            'sockeye_per_delivery'
          ];

          let completed = 0;
          let deleted = {
            daily_summaries: 0,
            district_data: 0,
            river_data: 0,
            sockeye_per_delivery: 0
          };

          tables.forEach(table => {
            db.run(
              `DELETE FROM ${table} WHERE run_date LIKE '11-%2025'`,
              function(err) {
                if (err) {
                  console.error(`❌ Error deleting from ${table}:`, err);
                  db.run("ROLLBACK");
                  db.close();
                  reject(err);
                  return;
                }

                deleted[table] = this.changes;
                console.log(`✅ Deleted ${this.changes} rows from ${table}`);
                
                completed++;

                // If all tables processed, commit
                if (completed === tables.length) {
                  db.run("COMMIT", (err) => {
                    if (err) {
                      console.error("❌ Error committing:", err);
                      db.run("ROLLBACK");
                      db.close();
                      reject(err);
                      return;
                    }

                    console.log("\n" + "=".repeat(50));
                    console.log("✨ CLEANUP COMPLETE");
                    console.log("=".repeat(50));
                    console.log(`Total rows deleted: ${Object.values(deleted).reduce((a,b) => a+b, 0)}`);
                    console.log("\n✅ Database cleaned successfully!");

                    db.close((err) => {
                      if (err) {
                        console.error("Error closing database:", err);
                      }
                      resolve();
                    });
                  });
                }
              }
            );
          });
        }
      );
    });
  });
}

// Run if executed directly
if (require.main === module) {
  console.log("🧹 Bristol Bay Database Cleanup Script");
  console.log("=".repeat(50));
  console.log("Removing November 2025 entries...\n");

  cleanNovemberData()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}

module.exports = { cleanNovemberData };