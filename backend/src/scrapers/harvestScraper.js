const puppeteer = require("puppeteer");
const HARVEST_URL =
  "https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.harvestsummary";

const DATE_SELECTOR = 'select#dateDropdown';
const BUTTON_SELECTOR = '#maincontentarticle > form > input[type=submit]';

/**
 * Format date for ADF&G dropdown (MM-DD-YYYY)
 */
function formatDateForURL(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

/**
 * Parse number safely
 */
function parseNumber(text) {
  if (!text) return 0;
  const cleaned = text
    .trim()
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getSummaryStats(data) {
  const totalCatch = data.districts.reduce(
    (sum, d) => sum + d.catchCumulative,
    0
  );
  const totalEscapement = data.districts.reduce(
    (sum, d) => sum + d.escapementCumulative,
    0
  );
  const totalRun = totalCatch + totalEscapement;

  return {
    totalCatch,
    totalEscapement,
    totalRun,
    districtCount: data.districts.length,
    riverCount: data.rivers.length,
    topDistrict: data.districts.reduce(
      (max, d) => (d.catchCumulative > (max?.catchCumulative || 0) ? d : max),
      null
    ),
  };
}


/**
 * Wait for an element with retry and debug logging
 */
async function waitForElement(page, selector, timeout = 3000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generate array of dates for the fishing season
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Date[]} Array of dates
 */
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
 * Scrape harvest data for a single date using an optional existing page
 */
async function scrapeHarvestDataSingleBrowser(runDate, page = null) {
  let browserLaunchedHere = false;
  try {
    const date = typeof runDate === "string" ? new Date(runDate) : runDate;
    const dateStr = formatDateForURL(date);

    if (!page) {
      browserLaunchedHere = true;
      const browser = await puppeteer.launch({
        headless: false,
        //args: ["--no-sandbox", "--disable-setuid-sandbox"],
        slowMo: 0,
        defaultViewport: null,
      });
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      page._browser = browser;
    }

    await page.goto(HARVEST_URL, { waitUntil: "networkidle0", timeout: 60000 });

    const found = await waitForElement(page, DATE_SELECTOR, 15000);
    if (!found) throw new Error("Date dropdown not found");

    await page.select(DATE_SELECTOR, dateStr);
    await new Promise((r) => setTimeout(r, 5000));

    const goButton = await page.$(BUTTON_SELECTOR);
    if (!goButton) throw new Error("Go button not found");

    await Promise.all([
      goButton.click(),
      page.waitForNetworkIdle({ timeout: 30000 }),
    ]);

    await new Promise((r) => setTimeout(r, 3000));

    const result = await page.evaluate(() => {
      const data = {
        scrapedAt: new Date().toISOString(),
        runDate: "",
        season: 0,
        totalRun: {},
        districts: [],
        rivers: [],
        sockeyePerDelivery: {},
      };

      function parseNum(text) {
        if (!text) return 0;
        const cleaned = text
          .trim()
          .replace(/,/g, "")
          .replace(/[^0-9.-]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }

      const dateSelect = document.querySelector('select#dateDropdown');
      if (dateSelect) {
        data.runDate = dateSelect.value;
        data.season =
          parseInt(dateSelect.value.split("-")[2]) || new Date().getFullYear();
      }

      const tables = document.querySelectorAll("table");

      // ============================================
      // --- parse 'total run' table ---
      // ============================================
      for (let table of tables) {
        const headerText = table.textContent;
        if (
          headerText.includes("District") &&
          headerText.includes("Catch") &&
          headerText.includes("Escapement")
        ) {
          const rows = table.querySelectorAll("tr");
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 7) {
              const firstCell = cells[0].textContent.trim();
              if (firstCell.toLowerCase().includes("total")) {
                data.totalRun = {
                  catchDaily: parseNum(cells[1].textContent),
                  catchCumulative: parseNum(cells[2].textContent),
                  escapementDaily: parseNum(cells[3].textContent),
                  escapementCumulative: parseNum(cells[4].textContent),
                  inRiverEstimate: parseNum(cells[5].textContent),
                  totalRun: parseNum(cells[6].textContent),
                };
              } else if (firstCell && !firstCell.includes("District")) {
                // ✅ FIXED: Use proper district mapping instead of auto-generating IDs
                const districtMap = {
                  "Ugashik": "ugashik",
                  "Egegik": "egegik",
                  "Naknek-Kvichak": "naknek",
                  "Naknek/Kvichak": "naknek",
                  "Nushagak": "nushagak",
                  "Togiak": "togiak",
                };

                let districtId = null;
                let districtName = firstCell.trim();

                // Try exact match first
                if (districtMap[districtName]) {
                  districtId = districtMap[districtName];
                } else {
                  // Try partial match
                  for (let [key, value] of Object.entries(districtMap)) {
                    if (
                      firstCell.includes(key.split("-")[0]) ||
                      firstCell.includes(key.split("/")[0])
                    ) {
                      districtId = value;
                      districtName = key;
                      break;
                    }
                  }
                }

                if (districtId) {
                  data.districts.push({
                    id: districtId,
                    name: districtName,
                    catchDaily: parseNum(cells[1].textContent),
                    catchCumulative: parseNum(cells[2].textContent),
                    escapementDaily: parseNum(cells[3].textContent),
                    escapementCumulative: parseNum(cells[4].textContent),
                    inRiverEstimate: parseNum(cells[5].textContent),
                    totalRun: parseNum(cells[6].textContent),
                  });
                }
              }
            }
          });
          if (data.districts.length > 0) break;
        }
      }

      // ============================================
      // --- parse River table ---
      // ============================================
      for (let table of tables) {
        const headerText = table.textContent;
        if (
          headerText.includes("River") &&
          headerText.includes("Escapement") &&
          !headerText.includes("District")
        ) {
          const rows = table.querySelectorAll("tr");
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 3) {
              const riverName = cells[0].textContent.trim();
              if (riverName && riverName.length > 2) {
                data.rivers.push({
                  name: riverName,
                  escapementDaily: parseNum(cells[1].textContent),
                  escapementCumulative: parseNum(cells[2].textContent),
                  inRiverEstimate: cells[3]
                    ? parseNum(cells[3].textContent)
                    : 0,
                });
              }
            }
          });
          if (data.rivers.length > 0) break;
        }
      }

      // ============================================
      // --- parse Sockeye per Drift Delivery table ---
      // ============================================
      for (let table of tables) {
        const headerText = table.textContent;
        if (
          headerText.includes("Sockeye") &&
          headerText.includes("Delivery")
        ) {
          const rows = table.querySelectorAll("tr");
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 2) {
              const districtName = cells[0].textContent.trim();
              const sockeye = parseNum(cells[1].textContent);

              const districtMap = {
                "Ugashik": "ugashik",
                "Egegik": "egegik",
                "Naknek-Kvichak": "naknek",
                "Naknek/Kvichak": "naknek",
                "Nushagak": "nushagak",
                "Togiak": "togiak",
              };

              let districtId = null;

              // Try exact match first
              if (districtMap[districtName]) {
                districtId = districtMap[districtName];
              } else {
                // Try partial match
                for (let [key, value] of Object.entries(districtMap)) {
                  if (
                    districtName.includes(key.split("-")[0]) ||
                    districtName.includes(key.split("/")[0])
                  ) {
                    districtId = value;
                    break;
                  }
                }
              }

              if (districtId) {
                data.sockeyePerDelivery[districtId] = sockeye;
              }
            }
          });

          if (Object.keys(data.sockeyePerDelivery).length > 0) break;
        }
      }

      return data;
    });

    result.runDate = dateStr;
    result.season = date.getFullYear();

    console.log("✅ Scraping completed successfully");
    console.log(`📊 Sockeye per Delivery:`, result.sockeyePerDelivery);
    console.log(`📈 Found ${result.districts.length} districts, ${result.rivers.length} rivers`);

    return result;
  } finally {
    if (browserLaunchedHere && page && page._browser) {
      await page._browser.close();
    }
  }
}

/**
 * Scrape entire season with a single browser
 */
async function scrapeEntireSeasonSingleBrowser(startDate, endDate) {
  const browser = await puppeteer.launch({
    headless: false,
    //args: ["--no-sandbox", "--disable-setuid-sandbox"],
    slowMo: 0,
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const dates = getSeasonDates(startDate, endDate);
  const seasonData = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    try {
      console.log(
        `[${i + 1}/${dates.length}] Scraping ${date.toDateString()}...`
      );
      const dailyData = await scrapeHarvestDataSingleBrowser(date, page);
      seasonData.push(dailyData);
    } catch (err) {
      console.error(
        `❌ Failed to scrape ${date.toDateString()}: ${err.message}`
      );
    }
  }

  await browser.close();
  return seasonData;
}

module.exports = {
  scrapeHarvestData: scrapeHarvestDataSingleBrowser,
  scrapeHarvestDataSingleBrowser,
  scrapeEntireSeasonSingleBrowser,
  getSeasonDates,
  parseNumber,
  formatDateForURL,
  waitForElement,
  getSummaryStats,
};