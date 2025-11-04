const axios = require("axios");
const cheerio = require("cheerio");

// URL for Bristol Bay harvest data
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
 * Scrapes the current harvest data from ADF&G website
 * @returns {Promise<Object>} Harvest data by district
 */
async function scrapeHarvestData() {
  try {
    console.log("🎣 Starting harvest data scrape from ADF&G...");
    console.log(`📍 URL: ${HARVEST_URL}`);

    // Fetch the page
    const response = await axios.get(HARVEST_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const result = {
      scrapedAt: new Date().toISOString(),
      season: new Date().getFullYear(),
      totalRun: {},
      districts: [],
      rivers: [],
      "sockeye PerDelivery": {},
    };

    // Parse Total Run Summary table
    console.log("📊 Parsing Total Run Summary...");
    const totalRunTable = $('h3:contains("Total Run Summary")').next("table");
    if (totalRunTable.length) {
      totalRunTable.find("tbody tr").each((i, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 7) {
          const districtName = $(cells[0]).text().trim();

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
          }
        }
      });
    }

    // Parse Individual River Estimates
    console.log("🏞️  Parsing Individual River Estimates...");
    const riverTable = $('h3:contains("Individual River Estimates")').next(
      "table"
    );
    if (riverTable.length) {
      riverTable.find("tbody tr").each((i, row) => {
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
    }

    // Parse Sockeye per Drift Delivery
    console.log("🐟 Parsing Sockeye per Delivery...");
    const deliveryTable = $('h3:contains("Sockeye per Drift Delivery")').next(
      "table"
    );
    if (deliveryTable.length) {
      deliveryTable.find("tbody tr").each((i, row) => {
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
 * Test the scraper with detailed output
 */
async function testScraper() {
  console.log("🧪 Testing Bristol Bay Harvest Scraper\n");
  console.log("=".repeat(60));

  try {
    const data = await scrapeHarvestData();
    const stats = getSummaryStats(data);

    console.log("\n📊 SUMMARY STATISTICS:");
    console.log("=".repeat(60));
    console.log(
      `Total Catch (Cumulative):     ${stats.totalCatch.toLocaleString()} fish`
    );
    console.log(
      `Total Escapement (Cumulative): ${stats.totalEscapement.toLocaleString()} fish`
    );
    console.log(
      `Total Run:                     ${stats.totalRun.toLocaleString()} fish`
    );
    console.log(`Number of Districts:           ${stats.districtCount}`);
    console.log(`Number of Rivers:              ${stats.riverCount}`);

    if (stats.topDistrict) {
      console.log(`\n🏆 Top Producing District:     ${stats.topDistrict.name}`);
      console.log(
        `   Catch:                       ${stats.topDistrict.catchCumulative.toLocaleString()} fish`
      );
    }

    console.log("\n🎣 DISTRICT BREAKDOWN:");
    console.log("=".repeat(60));
    data.districts.forEach((district) => {
      console.log(`\n${district.name} (${district.id}):`);
      console.log(
        `  Daily Catch:        ${district.catchDaily.toLocaleString()}`
      );
      console.log(
        `  Cumulative Catch:   ${district.catchCumulative.toLocaleString()}`
      );
      console.log(
        `  Daily Escapement:   ${district.escapementDaily.toLocaleString()}`
      );
      console.log(
        `  Cumulative Escape:  ${district.escapementCumulative.toLocaleString()}`
      );
      console.log(
        `  Total Run:          ${district.totalRun.toLocaleString()}`
      );
    });

    console.log("\n🏞️  RIVER ESCAPEMENT:");
    console.log("=".repeat(60));
    data.rivers.forEach((river) => {
      console.log(
        `${river.name.padEnd(20)} ${river.escapementCumulative.toLocaleString().padStart(12)} fish`
      );
    });

    console.log("\n💾 Full JSON Data:");
    console.log("=".repeat(60));
    console.log(JSON.stringify(data, null, 2));
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
};
