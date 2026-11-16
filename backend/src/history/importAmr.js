/**
 * Import daily catch, boat registration and tower counts from the ADF&G
 * Bristol Bay Annual Management Reports (AMR). One-time job on your computer.
 *
 *   node src/history/importAmr.js 2023          one season
 *   node src/history/importAmr.js 2017-2025     a range
 *   node src/history/importAmr.js 2023 --check  parse and print the report, do not save
 *
 * Writes data/history/<year>.json. The PDFs are saved in data/history/pdf/
 * (not in git). Then prints a check report: the parsed daily sockeye against the
 * season total printed in the report, and against the ADF&G in-season numbers in
 * the database (2023 and later).
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const { parseAmrPages, itemsToLines } = require("./amrParser");
const { DATA_DIR } = require("../store");

const HISTORY_DIR = path.join(DATA_DIR, "history");
const PDF_DIR = path.join(HISTORY_DIR, "pdf");

/** Season -> report file. From the ADF&G Bristol Bay salmon page. */
const AMR_FILES = {
  2025: "FMR26-08",
  2024: "FMR25-17",
  2023: "FMR24-11",
  2022: "FMR23-08",
  2021: "FMR22-14",
  2020: "FMR21-16",
  2019: "FMR21-04",
  2018: "FMR19-12",
  2017: "FMR18-11",
  2016: "FMR17-27",
  2015: "FMR16-13",
  2014: "FMR15-24",
  2013: "FMR14-23",
  2012: "FMR13-20",
};
// Checked on 2026-11-16: 2017-2025 parse well. 2012-2016 use an older table layout
// and are not supported yet.
const SUPPORTED = new Set([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);

const urlFor = (year) => `https://www.adfg.alaska.gov/FedAidPDFs/${AMR_FILES[year]}.pdf`;

async function getPdf(year) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  const file = path.join(PDF_DIR, `${AMR_FILES[year]}.pdf`);
  if (!fs.existsSync(file)) {
    console.log(`⬇️  ${urlFor(year)}`);
    const res = await axios.get(urlFor(year), {
      responseType: "arraybuffer",
      timeout: 120000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BristolPredict/4.0; personal fishing tool)" },
    });
    fs.writeFileSync(file, Buffer.from(res.data));
  }
  return fs.readFileSync(file);
}

/** PDF -> array of pages, each an array of { text, cells } lines. */
async function pdfPages(buffer) {
  const pages = [];
  await pdfParse(buffer, {
    pagerender: (pageData) =>
      pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }).then((tc) => {
        pages.push(itemsToLines(tc.items));
        return "";
      }),
  });
  return pages;
}

/** In-season ADF&G numbers from the database, to compare. */
async function databaseTotals(year) {
  let db;
  try {
    const { initDatabase } = require("../database");
    db = await initDatabase();
  } catch {
    return null;
  }
  const rows = await new Promise((resolve) =>
    db.all(
      "SELECT run_date, district_id, catch_daily FROM district_data WHERE run_date LIKE ?",
      [`%-${year}`],
      (err, r) => resolve(err ? [] : r)
    )
  );
  await new Promise((r) => db.close(r));
  if (!rows.length) return null;
  const byDistrict = {};
  for (const r of rows) {
    (byDistrict[r.district_id] ||= {})[r.run_date] = r.catch_daily || 0;
  }
  return byDistrict;
}

const key = (mdy) => mdy.slice(6) + mdy.slice(0, 2) + mdy.slice(3, 5);
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");
const fmt = (n) => (n == null ? "–" : n.toLocaleString("en-US"));

async function report(year, result) {
  console.log(`\n=== ${year} check report ===`);
  console.log(`Tables found: ${result.tables.map((t) => `${t.num} ${t.type}${t.district ? ` ${t.district}` : ""}`).join(", ")}`);
  console.log("Catch: daily sockeye sum against the season total printed in the report");
  for (const [d, c] of Object.entries(result.checks)) {
    if (/River|registration/.test(d)) continue;
    console.log(
      `  ${d.padEnd(9)} ${String(c.rows).padStart(3)} days  sum ${fmt(c.sockeyeSum).padStart(11)}  printed ${fmt(c.printedTotal).padStart(11)}  ${c.percentOfTotal ?? "–"}%` +
        (c.rowsWithSumError ? `  (${c.rowsWithSumError} rows where the species do not add to the total)` : "")
    );
  }
  const reg = result.checks.registration;
  console.log(`Registration: ${reg.rows} days${reg.rowsWithSumError ? `, ${reg.rowsWithSumError} where the districts do not add to the total` : ""}`);
  console.log(
    "Tower counts: " +
      Object.entries(result.checks)
        .filter(([k]) => /River/.test(k))
        .map(([k, c]) => `${k.replace(" River", "")} ${c.rows}d${c.cumulativeErrors ? ` (${c.cumulativeErrors} cum. errors)` : ""}`)
        .join(", ")
  );
  const f = result.forecast?.total;
  console.log(
    f
      ? `Forecast: inshore run forecast ${fmt(f.forecast)}, actual ${fmt(f.actual)} (${Object.keys(result.forecast.rivers).length} rivers)`
      : "Forecast table: not found"
  );
  console.log(`Rejected rows: ${result.rejected.length}`);
  result.rejected.slice(0, 10).forEach((r) => console.log(`  p${r.page} table ${r.table}: ${r.reason} :: ${r.line.slice(0, 70)}`));

  const db = await databaseTotals(year);
  if (db) {
    console.log("Against the ADF&G in-season numbers in the database (same days only):");
    for (const [d, rows] of Object.entries(result.catch)) {
      const inSeason = db[d];
      if (!inSeason) continue;
      const days = Object.keys(inSeason);
      const last = days.sort((a, b) => key(a).localeCompare(key(b))).at(-1);
      const amrSum = rows.filter((r) => key(r.date) <= key(last)).reduce((s, r) => s + (r.sockeye || 0), 0);
      const dbSum = Object.values(inSeason).reduce((s, v) => s + v, 0);
      console.log(`  ${d.padEnd(9)} to ${last}: AMR ${fmt(amrSum).padStart(11)}  in-season ${fmt(dbSum).padStart(11)}  ${pct(amrSum, dbSum)}`);
    }
    console.log("  (The AMR is the final count by fishing day. In-season numbers are preliminary. Near 100% is good.)");
  }
}

function parseYears(args) {
  const out = [];
  for (const a of args) {
    const range = a.match(/^(\d{4})-(\d{4})$/);
    if (range) for (let y = +range[1]; y <= +range[2]; y++) out.push(y);
    else if (/^\d{4}$/.test(a)) out.push(+a);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const years = parseYears(args);
  const checkOnly = args.includes("--check");
  const force = args.includes("--force");
  if (!years.length) {
    console.log("Usage: node src/history/importAmr.js <year | 2017-2025> [--check] [--force]");
    return;
  }
  for (const year of years) {
    if (!AMR_FILES[year]) {
      console.log(`❌ ${year}: no report file known`);
      continue;
    }
    if (!SUPPORTED.has(year) && !force) {
      console.log(`⏭️  ${year}: older table layout, not supported yet (use --force to try)`);
      continue;
    }
    try {
      const pages = await pdfPages(await getPdf(year));
      const result = parseAmrPages(pages, year);
      await report(year, result);
      if (!checkOnly) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
        const out = {
          year,
          source: urlFor(year),
          importedAt: new Date().toISOString(),
          note: "ADF&G Annual Management Report. Null = no data or confidential (fewer than 3 permit holders).",
          catch: result.catch,
          registration: result.registration,
          escapement: result.escapement,
          totals: result.totals,
          forecast: result.forecast,
          checks: result.checks,
          rejected: result.rejected,
        };
        fs.writeFileSync(path.join(HISTORY_DIR, `${year}.json`), JSON.stringify(out) + "\n");
        console.log(`💾 Saved data/history/${year}.json`);
      }
    } catch (e) {
      console.error(`❌ ${year}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) main();

module.exports = { AMR_FILES, SUPPORTED, pdfPages };
