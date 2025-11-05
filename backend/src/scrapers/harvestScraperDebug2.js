const puppeteer = require("puppeteer");

// URL for Bristol Bay harvest data
const HARVEST_URL =
  "https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.harvestsummary";

// WORKING SELECTORS FROM DEBUG
const DATE_SELECTOR = 'select[name="dateDropdown"]';
const BUTTON_SELECTOR = 'input[type="submit"][value="Go!"]';

// District mapping to match our frontend
const DISTRICT_MAP = {
  Ugashik: "ugashik",
  Egegik: "egegik",
  "Naknek-Kvichak": "naknek",
  Nushagak: "nushagak",
  Togiak: "togiak",
};

/**
 * Format date for ADF&G dropdown (MM-DD-YYYY)
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted date string
 */
function formatDateForURL(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

/**
 * Helper function to parse numbers from text (handles commas)
 * @param {string} text - Text containing a number
 * @returns {number} Parsed number
 */
function parseNumber(text) {
  if (!text) return 0;
  const cleaned = text.trim().replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Wait for element with retry logic
 */
async function waitForElement(page, selector, timeout = 10000) {
  console.log(`🔍 Waiting for element: ${selector}`);

  try {
    await page.waitForSelector(selector, { timeout });
    console.log(`✅ Element found: ${selector}`);
    return true;
  } catch (error) {
    console.log(`❌ Element not found: ${selector}`);

    // Debug: log available select elements
    const availableSelects = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("select")).map((select) => ({
        name: select.name,
        id: select.id,
        className: select.className,
        options: Array.from(select.options).map((opt) => opt.value),
      }));
    });

    console.log("📋 Available select elements:", availableSelects);
    return false;
  }
}

/**
 * Scrapes harvest data from ADF&G website for a specific date using Puppeteer
 * @param {Date|string} runDate - Date to scrape (defaults to today)
 * @returns {Promise<Object>} Harvest data by district
 */
async function scrapeHarvestData(runDate = new Date()) {
  const browser = await puppeteer.launch({
    headless: false, // Set to false to see what's happening
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    slowMo: 100, // Slow down to see actions
  });

  try {
    // Convert string to Date if needed
    const date = typeof runDate === "string" ? new Date(runDate) : runDate;
    const dateStr = formatDateForURL(date);

    console.log(`🎣 Scraping harvest data for ${dateStr}...`);
    console.log(`📍 URL: ${HARVEST_URL}`);

    const page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Go to the page
    console.log("🌐 Navigating to ADF&G website...");
    await page.goto(HARVEST_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("✅ Page loaded");

    // Take a screenshot for debugging
    await page.screenshot({
      path: "/Users/mtech/AI/PortfolioProjects/bristol-predict/backend/debug/debug-before-select.png",
    });
    console.log("📸 Screenshot saved: debug-before-select.png");

    // Wait for the date dropdown to be present with retry logic
    const elementFound = await waitForElement(page, DATE_SELECTOR, 15000);

    if (!elementFound) {
      // Try alternative selectors
      const alternativeSelectors = [
        'select[name="rundate"]',
        'select[name="RunDate"]',
        'select[name="run_date"]',
        "select#dateDropdown",
        "select",
      ];

      let foundSelector = null;
      for (const selector of alternativeSelectors) {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found alternative selector: ${selector}`);
          foundSelector = selector;
          break;
        }
      }

      if (!foundSelector) {
        throw new Error("No date dropdown found on page");
      }

      // Use the found selector
      console.log(`📅 Selecting date using: ${foundSelector}`);
      await page.select(foundSelector, dateStr);
    } else {
      // Use the original selector
      console.log(`📅 Selecting date: ${dateStr}`);
      await page.select(DATE_SELECTOR, dateStr);
    }

    // Verify selection
    const selectedValue = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      return element ? element.value : null;
    }, DATE_SELECTOR);

    console.log(`✅ Date selected: ${selectedValue}`);

    // Take screenshot after date selection
    await page.screenshot({
      path: "/Users/mtech/AI/PortfolioProjects/bristol-predict/backend/debug/debug-after-date-select.png",
    });
    console.log("📸 Screenshot saved: debug-after-date-select.png");

    // Click the Go button
    console.log("🔄 Clicking Go button...");
    const goButton = await page.$(BUTTON_SELECTOR);

    if (goButton) {
      console.log("✅ Found Go button, clicking...");

      // Click and wait for content to update
      await Promise.all([
        goButton.click(),
        page.waitForNetworkIdle({ timeout: 30000 }),
      ]);

      // Wait for data to render
      //await page.waitForTimeout(5000);
      await new Promise((r) => setTimeout(r, 5000));
      console.log("✅ Data loaded successfully");
    } else {
      // Try alternative button selectors
      const alternativeButtons = [
        'input[type="submit"]',
        'input[value="Go"]',
        "button",
      ];

      let buttonClicked = false;
      for (const selector of alternativeButtons) {
        const button = await page.$(selector);
        if (button) {
          console.log(`✅ Found alternative button: ${selector}`);
          await Promise.all([
            button.click(),
            page.waitForNetworkIdle({ timeout: 30000 }),
          ]);
          await page.waitForTimeout(5000);
          buttonClicked = true;
          break;
        }
      }

      if (!buttonClicked) {
        throw new Error("No Go button found");
      }
    }

    // Take screenshot after button click
    await page.screenshot({
      path: "/Users/mtech/AI/PortfolioProjects/bristol-predict/backend/debug/debug-after-button-click.png",
    });
    console.log("📸 Screenshot saved: debug-after-button-click.png");

    // Now scrape the data
    console.log("📊 Scraping data from page...");
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

      // Helper function to parse numbers
      function parseNum(text) {
        if (!text) return 0;
        const cleaned = text
          .trim()
          .replace(/,/g, "")
          .replace(/[^0-9.-]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }

      // Get the selected date from the dropdown
      const dateSelect = document.querySelector('select[name="dateDropdown"]');
      if (dateSelect) {
        data.runDate = dateSelect.value;
        const year = dateSelect.value.split("-")[2];
        data.season = parseInt(year) || new Date().getFullYear();
      }

      // Parse Total Run Summary table
      const tables = document.querySelectorAll("table");

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
                const districtMap = {
                  Ugashik: "ugashik",
                  Egegik: "egegik",
                  "Naknek-Kvichak": "naknek",
                  "Naknek/Kvichak": "naknek",
                  Nushagak: "nushagak",
                  Togiak: "togiak",
                };

                let districtId = null;
                let districtName = firstCell;

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

                if (!districtId) {
                  districtId = firstCell.toLowerCase().replace(/[^a-z]/g, "");
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

      // Parse Individual River Estimates table
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

              if (
                riverName &&
                !riverName.includes("River") &&
                !riverName.includes("Escapement") &&
                riverName.length > 2
              ) {
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

      // Parse Sockeye per Drift Delivery table
      for (let table of tables) {
        const headerText = table.textContent;

        if (
          headerText.includes("Sockeye") &&
          (headerText.includes("Delivery") || headerText.includes("Drift"))
        ) {
          const rows = table.querySelectorAll("tr");

          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 2) {
              const districtName = cells[0].textContent.trim();
              const sockeye = parseNum(cells[1].textContent);

              const districtMap = {
                Ugashik: "ugashik",
                Egegik: "egegik",
                Naknek: "naknek",
                "Naknek-Kvichak": "naknek",
                Nushagak: "nushagak",
                Togiak: "togiak",
              };

              for (let [key, value] of Object.entries(districtMap)) {
                if (districtName.includes(key.split("-")[0])) {
                  data.sockeyePerDelivery[value] = sockeye;
                  break;
                }
              }
            }
          });

          if (Object.keys(data.sockeyePerDelivery).length > 0) break;
        }
      }

      return data;
    });

    // Update the runDate to ensure it matches what we requested
    result.runDate = dateStr;
    result.season = date.getFullYear();

    console.log("✅ Scraping completed successfully");
    console.log(`📊 Total Run Summary:`, result.totalRun);
    console.log(
      `📈 Found ${result.districts.length} districts, ${result.rivers.length} rivers`
    );

    return result;
  } catch (error) {
    console.error("❌ Error scraping harvest data:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// ... rest of your functions remain the same (getSummaryStats, getSeasonDates, testScraper, etc.)

/**
 * Get summary statistics from scraped data
 * @param {Object} data - Scraped harvest data
 * @returns {Object} Summary statistics
 */
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
 * Generate array of dates for the fishing season
 * @param {Date} startDate - Start of season
 * @param {Date} endDate - End of season
 * @returns {Array<Date>} Array of dates
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
 * Test the scraper with detailed output
 */
async function testScraper() {
  console.log("🧪 Testing Bristol Bay Harvest Scraper with Puppeteer\n");
  console.log("=".repeat(60));

  try {
    // Test with July 15, 2025 (a date with known fishing activity)
    console.log("\n📅 Testing with date: 07-15-2025");
    const data = await scrapeHarvestData(new Date("2025-07-15"));
    const stats = getSummaryStats(data);

    console.log("\n📊 SUMMARY STATISTICS:");
    console.log("=".repeat(60));
    console.log(`Run Date:                      ${data.runDate}`);
    console.log(
      `Total Catch (Cumulative):      ${stats.totalCatch.toLocaleString()} fish`
    );
    console.log(
      `Total Escapement (Cumulative): ${stats.totalEscapement.toLocaleString()} fish`
    );
    console.log(
      `Total Run:                     ${stats.totalRun.toLocaleString()} fish`
    );

    console.log("\n📊 DISTRICT DETAILS:");
    data.districts.forEach((d) => {
      console.log(`  ${d.name}:`);
      console.log(`    - Daily Catch: ${d.catchDaily.toLocaleString()}`);
      console.log(
        `    - Cumulative Catch: ${d.catchCumulative.toLocaleString()}`
      );
      console.log(
        `    - Cumulative Escapement: ${d.escapementCumulative.toLocaleString()}`
      );
    });

    console.log("\n🏞️ RIVER DETAILS:");
    data.rivers.forEach((r) => {
      console.log(
        `  ${r.name}: ${r.escapementCumulative.toLocaleString()} escapement`
      );
    });

    console.log("\n🐟 Sockeye per Delivery:");
    Object.entries(data.sockeyePerDelivery).forEach(([district, count]) => {
      console.log(`  ${district}: ${count.toLocaleString()}`);
    });

    console.log("\n✅ Test passed!");
    return data;
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testScraper().then(() => process.exit(0));
}

module.exports = {
  scrapeHarvestData,
  getSummaryStats,
  parseNumber,
  formatDateForURL,
  getSeasonDates,
};
