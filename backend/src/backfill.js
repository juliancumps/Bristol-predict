/**
 * Backfill script (V4: no browser, about 2 seconds per day).
 *
 *   npm run backfill            every day of every season below
 *   npm run backfill:rivers     only days that have no river data yet
 *   node src/backfill.js 2026   one season
 *   node src/backfill.js 07-01-2026 07-05-2026   a date range
 *
 * Dates are plain MM-DD strings, so the computer's time zone has no effect.
 * The windows are short on purpose: days outside them are almost all zero.
 */
const { scrapeHarvestData } = require("./scrapers/harvestScraper");
const { initDatabase, saveScrapedData, getRunDates } = require("./database");

const SEASONS = [
  { year: 2023, start: "06-20", end: "07-20" },
  { year: 2024, start: "06-17", end: "07-25" },
  { year: 2025, start: "06-16", end: "07-24" },
  { year: 2026, start: "06-17", end: "07-27" },
];

const DELAY_MS = 1500; // be polite to the ADF&G server
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

/** ["06-20-2023", "06-21-2023", ...] from MM-DD-YYYY to MM-DD-YYYY inclusive */
function dateStrings(startStr, endStr) {
  const parse = (s) => new Date(Date.UTC(+s.slice(6), +s.slice(0, 2) - 1, +s.slice(3, 5)));
  const out = [];
  for (let d = parse(startStr); d <= parse(endStr); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(`${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${d.getUTCFullYear()}`);
  }
  return out;
}

async function scrapeDates(dates) {
  const db = await initDatabase();
  let ok = 0;
  const errors = [];
  for (let i = 0; i < dates.length; i++) {
    try {
      const data = await scrapeHarvestData(dates[i]);
      await saveScrapedData(db, data);
      ok++;
      console.log(
        `[${i + 1}/${dates.length}] ${dates[i]} ✅ run ${(data.totalRun.totalRun || 0).toLocaleString()}, ${data.rivers.length} rivers`
      );
    } catch (e) {
      errors.push(`${dates[i]}: ${e.message}`);
      console.error(`[${i + 1}/${dates.length}] ${dates[i]} ❌ ${e.message}`);
    }
    if (i < dates.length - 1) await sleep(DELAY_MS);
  }
  await new Promise((r) => db.close(r));
  console.log(`\n✅ ${ok} days saved, ❌ ${errors.length} failed`);
  errors.forEach((e) => console.log(`   - ${e}`));
  if (ok === 0 && dates.length > 0) process.exitCode = 1;
}

const seasonDates = (s) => dateStrings(`${s.start}-${s.year}`, `${s.end}-${s.year}`);

async function backfillAllSeasons() {
  await scrapeDates(SEASONS.flatMap(seasonDates));
}

async function backfillSeason(year) {
  const season = SEASONS.find((s) => s.year === +year);
  if (!season) {
    console.error(`❌ Season ${year} not found. Available: ${SEASONS.map((s) => s.year).join(", ")}`);
    return;
  }
  await scrapeDates(seasonDates(season));
}

async function backfillDateRange(startStr, endStr) {
  await scrapeDates(dateStrings(startStr, endStr));
}

/** Read again every day in the database that has no river rows. */
async function backfillMissingRivers() {
  const db = await initDatabase();
  const rows = await getRunDates(db);
  await new Promise((r) => db.close(r));
  const dates = rows.filter((r) => r.river_rows === 0).map((r) => r.run_date);
  console.log(`🏞️  ${dates.length} of ${rows.length} days have no river data`);
  if (dates.length) await scrapeDates(dates);
}

if (require.main === module) {
  const [a, b] = process.argv.slice(2);
  const job =
    a === "rivers" ? backfillMissingRivers()
    : /^\d{4}$/.test(a || "") ? backfillSeason(a)
    : a && b ? backfillDateRange(a, b)
    : backfillAllSeasons();
  job.catch((e) => {
    console.error("💥 Fatal error:", e);
    process.exit(1);
  });
}

module.exports = {
  backfillAllSeasons,
  backfillSeason,
  backfillDateRange,
  backfillMissingRivers,
  dateStrings,
  SEASONS,
};
