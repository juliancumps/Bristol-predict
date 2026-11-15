/**
 * ADF&G Bristol Bay "Daily Run Summary" scraper.
 *
 * V4: no browser. The page is a plain HTML form, so one HTTP POST with the
 * date returns all tables. This is fast, runs on any server, and is free.
 *
 * Page: https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.harvestsummary
 * Tables on the page (in order):
 *   1. District | Catch Daily | Catch Cumulative | Escapement Daily | Escapement Cumulative | In-River Estimate | Total Run
 *   2. District | Escapement Daily | Escapement Cumulative | In-River Estimate   (rows are RIVERS: "Ugashik River", ...)
 *   3. District | Sockeye per Delivery
 *   4. (in season only) Registrations - vessel / permit counts
 */
const axios = require("axios");
const cheerio = require("cheerio");

const HARVEST_URL =
  "https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.harvestsummary";

const HTTP_OPTIONS = {
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; BristolPredict/4.0; personal fishery dashboard)",
    Accept: "text/html",
  },
};

const DISTRICT_MAP = {
  "ugashik": "ugashik",
  "egegik": "egegik",
  "naknek-kvichak": "naknek",
  "naknek/kvichak": "naknek",
  "nushagak": "nushagak",
  "togiak": "togiak",
};

const DISTRICT_NAMES = {
  ugashik: "Ugashik",
  egegik: "Egegik",
  naknek: "Naknek-Kvichak",
  nushagak: "Nushagak",
  togiak: "Togiak",
};

/** Format a Date as MM-DD-YYYY (the format ADF&G and the database use) */
function formatDateForURL(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

/** Accept a Date or an MM-DD-YYYY string, return MM-DD-YYYY */
function toDateString(runDate) {
  if (typeof runDate === "string" && /^\d{2}-\d{2}-\d{4}$/.test(runDate)) {
    return runDate;
  }
  const date = typeof runDate === "string" ? new Date(runDate) : runDate;
  return formatDateForURL(date);
}

/** Parse number safely ("1,234" -> 1234, "" -> 0) */
function parseNumber(text) {
  if (!text) return 0;
  const cleaned = String(text)
    .trim()
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function districtIdFromName(name) {
  const key = name.trim().toLowerCase();
  if (DISTRICT_MAP[key]) return DISTRICT_MAP[key];
  for (const [k, v] of Object.entries(DISTRICT_MAP)) {
    if (key.startsWith(k.split(/[-/]/)[0])) return v;
  }
  return null;
}

function getSummaryStats(data) {
  const totalCatch = data.districts.reduce((sum, d) => sum + d.catchCumulative, 0);
  const totalEscapement = data.districts.reduce(
    (sum, d) => sum + d.escapementCumulative,
    0
  );
  return {
    totalCatch,
    totalEscapement,
    totalRun: totalCatch + totalEscapement,
    districtCount: data.districts.length,
    riverCount: data.rivers.length,
    topDistrict: data.districts.reduce(
      (max, d) => (d.catchCumulative > (max?.catchCumulative || 0) ? d : max),
      null
    ),
  };
}

/** Array of Date objects from startDate to endDate (inclusive) */
function getSeasonDates(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Parse the run summary HTML. Pure function (no network) so it can be tested.
 * @param {string} html
 * @returns {object} data in the same shape the app has always used
 */
function parseHarvestHtml(html) {
  const $ = cheerio.load(html);

  const data = {
    scrapedAt: new Date().toISOString(),
    runDate: "",
    season: 0,
    totalRun: {},
    districts: [],
    rivers: [],
    sockeyePerDelivery: {},
    registrations: null, // filled in season when ADF&G shows the table
    availableDates: [],
  };

  const $select = $("select#dateDropdown");
  data.availableDates = $select
    .find("option")
    .map((_, o) => $(o).attr("value"))
    .get();
  data.runDate =
    $select.find("option[selected]").attr("value") || data.availableDates[0] || "";
  data.season = parseInt(data.runDate.split("-")[2]) || new Date().getFullYear();

  $("table").each((_, table) => {
    const $table = $(table);
    const headers = $table
      .find("th")
      .map((_, th) => $(th).text().trim().replace(/\s+/g, " "))
      .get();
    const headerText = headers.join("|").toLowerCase();
    const rows = $table
      .find("tr")
      .map((_, tr) => [
        $(tr)
          .find("td")
          .map((_, td) => $(td).text().trim())
          .get(),
      ])
      .get()
      .filter((cells) => cells.length > 0);

    // 1. District catch / escapement / total run
    if (headerText.includes("catch daily") && headerText.includes("total run")) {
      rows.forEach((c) => {
        if (c.length < 7) return;
        const values = {
          catchDaily: parseNumber(c[1]),
          catchCumulative: parseNumber(c[2]),
          escapementDaily: parseNumber(c[3]),
          escapementCumulative: parseNumber(c[4]),
          inRiverEstimate: parseNumber(c[5]),
          totalRun: parseNumber(c[6]),
        };
        if (/total/i.test(c[0])) {
          data.totalRun = values;
          return;
        }
        const id = districtIdFromName(c[0]);
        if (id) data.districts.push({ id, name: DISTRICT_NAMES[id], ...values });
      });
      return;
    }

    // 2. River escapement (first header is "District" but the rows are rivers)
    if (
      headerText.includes("escapement daily") &&
      !headerText.includes("catch") &&
      headers.length <= 5
    ) {
      rows.forEach((c) => {
        if (c.length < 3 || !c[0] || /total/i.test(c[0])) return;
        data.rivers.push({
          name: c[0],
          escapementDaily: parseNumber(c[1]),
          escapementCumulative: parseNumber(c[2]),
          inRiverEstimate: parseNumber(c[3]),
        });
      });
      return;
    }

    // 3. Sockeye per drift delivery
    if (headerText.includes("sockeye per delivery")) {
      rows.forEach((c) => {
        const id = districtIdFromName(c[0] || "");
        if (id) data.sockeyePerDelivery[id] = parseNumber(c[1]);
      });
      return;
    }

    // 4. Registrations (in season only). The exact layout is confirmed in
    //    June; keep the raw table so no data is lost if the layout differs.
    if (/permit|vessel|boat|regist/.test(headerText)) {
      data.registrations = { headers, rows };
    }
  });

  return data;
}

/** Download the run summary page for one date. */
async function fetchHarvestHtml(dateStr) {
  const body = new URLSearchParams({ dateDropdown: dateStr, submit: "Go!" });
  const response = await axios.post(HARVEST_URL, body.toString(), {
    ...HTTP_OPTIONS,
    headers: {
      ...HTTP_OPTIONS.headers,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data;
}

/**
 * Scrape harvest data for one date.
 * @param {Date|string} runDate - Date object or MM-DD-YYYY string
 */
async function scrapeHarvestData(runDate) {
  const dateStr = toDateString(runDate);
  const html = await fetchHarvestHtml(dateStr);
  const data = parseHarvestHtml(html);

  // Safety: ADF&G returns the newest date if it does not know the date we
  // asked for. Never save that data under the wrong date.
  if (data.runDate !== dateStr) {
    throw new Error(
      `ADF&G has no run summary for ${dateStr} (page returned ${data.runDate || "nothing"})`
    );
  }
  if (data.districts.length === 0) {
    throw new Error(`No district table found for ${dateStr}`);
  }
  delete data.availableDates;
  return data;
}

/** List every date ADF&G has a run summary for (newest first, MM-DD-YYYY). */
async function listAvailableDates() {
  const response = await axios.get(HARVEST_URL, HTTP_OPTIONS);
  return parseHarvestHtml(response.data).availableDates;
}

module.exports = {
  scrapeHarvestData,
  scrapeHarvestDataSingleBrowser: scrapeHarvestData, // old name, kept so nothing breaks
  parseHarvestHtml,
  listAvailableDates,
  getSeasonDates,
  parseNumber,
  formatDateForURL,
  toDateString,
  getSummaryStats,
  DISTRICT_NAMES,
  HARVEST_URL,
};

// Quick manual test:  node src/scrapers/harvestScraper.js 07-01-2026
if (require.main === module) {
  const date = process.argv[2] || formatDateForURL(new Date());
  scrapeHarvestData(date)
    .then((d) => console.log(JSON.stringify(d, null, 2)))
    .catch((e) => {
      console.error("❌", e.message);
      process.exit(1);
    });
}
