const axios = require("axios");
const cheerio = require("cheerio");

// URL for Bristol Bay harvest data (with date parameter)
const HARVEST_URL =
  "https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.harvestsummary";

// District mapping to match our frontend
const DISTRICT_MAP = {
  Ugashik: "ugashik",
  Egegik: "egegik",
  "Naknek-Kvichak": "naknek",
  Nushagak: "nushagak",
  Togiak: "togiak",
};

/**
 * Format date for ADF&G URL (MM-DD-YYYY)
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
 * Scrapes harvest data from ADF&G website for a specific date
 * @param {Date|string} runDate - Date to scrape (defaults to today)
 * @returns {Promise<Object>} Harvest data by district
 */
async function scrapeHarvestData(runDate = new Date()) {
  try {
    // Convert string to Date if needed
    const date = typeof runDate === "string" ? new Date(runDate) : runDate;
    const dateStr = formatDateForURL(date);

    console.log(`🎣 Scraping harvest data for ${dateStr}...`);
    console.log(`📍 URL: ${HARVEST_URL}`);

    // Fetch the page with date parameter
    const response = await axios.post(HARVEST_URL, `rundate=${dateStr}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const result = {
      scrapedAt: new Date().toISOString(),
      runDate: dateStr,
      season: date.getFullYear(),
      totalRun: {},
      districts: [],
      rivers: [],
      sockeyePerDelivery: {},
    };

    // Parse Total Run Summary table
    console.log("📊 Parsing Total Run Summary...");
    const totalRunTable = $(
      'h2:contains("Total Run Summary"), h3:contains("Total Run Summary")'
    ).next("table");

    if (!totalRunTable.length) {
      console.log("⚠️  Could not find Total Run Summary table");
      console.log(
        "Available headers:",
        $("h2, h3")
          .map((i, el) => $(el).text().trim())
          .get()
      );
    } else {
      console.log(
        `✅ Found Total Run Summary table with ${totalRunTable.find("tbody tr").length} rows`
      );
    }

    if (totalRunTable.length) {
      totalRunTable.find("tbody tr, tr").each((i, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 7) {
          const districtName = $(cells[0]).text().trim();

          console.log(`  Row ${i}: "${districtName}" - ${cells.length} cells`);

          // Skip the totals row
          if (districtName.toLowerCase().includes("total")) {
            result.totalRun = {
              catchDaily: parseNumber($(cells[1]).text()),
              catchCumulative: parseNumber($(cells[2]).text()),
              escapementDaily: parseNumber($(cells[3]).text()),
              escapementCumulative: parseNumber($(cells[4]).text()),
              inRiverEstimate: parseNumber($(cells[5]).text()),
              totalRun: parseNumber($(cells[6]).text()),
            };
            console.log(`  ✅ Found totals row:`, result.totalRun);
          } else if (districtName) {
            const districtId =
              DISTRICT_MAP[districtName] || districtName.toLowerCase();
            result.districts.push({
              id: districtId,
              name: districtName,
              catchDaily: parseNumber($(cells[1]).text()),
              catchCumulative: parseNumber($(cells[2]).text()),
              escapementDaily: parseNumber($(cells[3]).text()),
              escapementCumulative: parseNumber($(cells[4]).text()),
              inRiverEstimate: parseNumber($(cells[5]).text()),
              totalRun: parseNumber($(cells[6]).text()),
            });
            console.log(`  ✅ Added district: ${districtName} (${districtId})`);
          }
        }
      });
    }

    // Parse Individual River Estimates
    console.log("🏞️  Parsing Individual River Estimates...");
    const riverTable = $(
      'h2:contains("Individual River Estimates"), h3:contains("Individual River Estimates")'
    ).next("table");
    if (riverTable.length) {
      console.log(
        `✅ Found river table with ${riverTable.find("tbody tr, tr").length} rows`
      );
      riverTable.find("tbody tr, tr").each((i, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 3) {
          const riverName = $(cells[0]).text().trim();
          if (riverName && !riverName.toLowerCase().includes("district")) {
            result.rivers.push({
              name: riverName,
              escapementDaily: parseNumber($(cells[1]).text()),
              escapementCumulative: parseNumber($(cells[2]).text()),
              inRiverEstimate: parseNumber($(cells[3]).text()),
            });
          }
        }
      });
    } else {
      console.log("⚠️  Could not find Individual River Estimates table");
    }

    // Parse Sockeye per Drift Delivery
    console.log("🐟 Parsing Sockeye per Delivery...");
    const deliveryTable = $(
      'h2:contains("Sockeye per Drift Delivery"), h3:contains("Sockeye per Drift Delivery")'
    ).next("table");
    if (deliveryTable.length) {
      deliveryTable.find("tbody tr, tr").each((i, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 2) {
          const districtName = $(cells[0]).text().trim();
          const districtId =
            DISTRICT_MAP[districtName] || districtName.toLowerCase();
          const sockeye = parseNumber($(cells[1]).text());

          if (districtName && districtId) {
            result.sockeyePerDelivery[districtId] = sockeye;
          }
        }
      });
    } else {
      console.log("⚠️  Could not find Sockeye per Delivery table");
    }

    console.log("✅ Scraping completed successfully");
    console.log(
      `📈 Found ${result.districts.length} districts, ${result.rivers.length} rivers`
    );

    return result;
  } catch (error) {
    console.error("❌ Error scraping harvest data:", error.message);
    if (error.response) {
      console.error("HTTP Status:", error.response.status);
    }
    throw error;
  }
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
  console.log("🧪 Testing Bristol Bay Harvest Scraper\n");
  console.log("=".repeat(60));

  try {
    // Test with today's date
    console.log("\n📅 Testing with today's date:");
    const todayData = await scrapeHarvestData();
    const todayStats = getSummaryStats(todayData);

    console.log("\n📊 SUMMARY STATISTICS:");
    console.log("=".repeat(60));
    console.log(`Run Date:                      ${todayData.runDate}`);
    console.log(
      `Total Catch (Cumulative):      ${todayStats.totalCatch.toLocaleString()} fish`
    );
    console.log(
      `Total Escapement (Cumulative): ${todayStats.totalEscapement.toLocaleString()} fish`
    );
    console.log(
      `Total Run:                     ${todayStats.totalRun.toLocaleString()} fish`
    );

    // Test with a historical date (July 15, 2025)
    console.log("\n\n📅 Testing with historical date (07-15-2025):");
    const historicalData = await scrapeHarvestData(new Date("2025-07-15"));
    const historicalStats = getSummaryStats(historicalData);

    console.log(
      `Total Catch on 07-15-2025:     ${historicalStats.totalCatch.toLocaleString()} fish`
    );

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testScraper();
}

module.exports = {
  scrapeHarvestData,
  getSummaryStats,
  parseNumber,
  formatDateForURL,
  getSeasonDates,
};
