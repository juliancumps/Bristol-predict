const puppeteer = require("puppeteer");

// URL for Bristol Bay harvest data
const HARVEST_URL =
  "https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.harvestsummary";

/**
 * Debug version to identify working selectors
 */
async function debugScraper() {
  console.log("🔍 DEBUG: Identifying Working Selectors\n");
  console.log("=".repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    slowMo: 100,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log("🌐 Navigating to ADF&G website...");
    await page.goto(HARVEST_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("✅ Page loaded");

    // ==============================================
    // 🎯 IDENTIFY DATE DROPDOWN SELECTOR
    // ==============================================
    console.log("\n🎯 IDENTIFYING DATE DROPDOWN SELECTOR");
    console.log("=".repeat(40));

    const dateSelectors = [
      'select[name="rundate"]',
      'select[name="RunDate"]',
      'select[name="run_date"]',
      'select[name="dateDropdown"]',
      "select#rundate",
      "select.rundate",
      "select",
    ];

    let workingDateSelector = null;

    for (const selector of dateSelectors) {
      const element = await page.$(selector);
      if (element) {
        const details = await page.evaluate((el) => {
          return {
            tagName: el.tagName,
            name: el.name,
            id: el.id,
            className: el.className,
            optionsCount: el.options.length,
            selectedValue: el.value,
          };
        }, element);

        console.log(`\n🔍 Testing: ${selector}`);
        console.log(`   📋 Details:`, details);

        if (details.optionsCount > 0) {
          console.log(`   ✅ WORKING SELECTOR FOUND: ${selector}`);
          workingDateSelector = selector;

          // Test selecting a date
          const testDate = "07-07-2025";
          await page.select(selector, testDate);
          const newValue = await page.$eval(selector, (el) => el.value);
          console.log(`   📅 Test selection: ${testDate} → ${newValue}`);

          break;
        }
      } else {
        console.log(`❌ Not found: ${selector}`);
      }
    }

    if (!workingDateSelector) {
      console.log("❌ NO WORKING DATE SELECTOR FOUND!");
    } else {
      console.log(`\n🎉 FINAL WORKING DATE SELECTOR: ${workingDateSelector}`);
    }

    // ==============================================
    // 🎯 IDENTIFY GO BUTTON SELECTOR
    // ==============================================
    console.log("\n🎯 IDENTIFYING GO BUTTON SELECTOR");
    console.log("=".repeat(40));

    const goButtonSelectors = [
      'input[type="submit"][value="Go!"]',
      'input[type="submit"][value="Go"]',
      'input[value="Go!"]',
      'input[value="Go"]',
      'button:contains("Go")',
      'input[name="go"]',
      'button[name="go"]',
      'input[type="submit"]',
    ];

    let workingButtonSelector = null;

    for (const selector of goButtonSelectors) {
      try {
        // For text-based selectors, use evaluate
        if (selector.includes('contains("Go")')) {
          const button = await page.evaluate((sel) => {
            const buttons = document.querySelectorAll(
              'button, input[type="submit"], input[type="button"]'
            );
            for (let btn of buttons) {
              const text = btn.textContent || btn.value || "";
              if (text.includes("Go")) {
                return {
                  tagName: btn.tagName,
                  type: btn.type,
                  value: btn.value,
                  text: btn.textContent,
                  id: btn.id,
                  name: btn.name,
                };
              }
            }
            return null;
          });

          if (button) {
            console.log(`\n🔍 Testing: ${selector}`);
            console.log(`   📋 Details:`, button);
            console.log(`   ✅ WORKING BUTTON FOUND: ${selector}`);
            workingButtonSelector = 'button:contains("Go")';
            break;
          }
        } else {
          const button = await page.$(selector);
          if (button) {
            const details = await page.evaluate((el) => {
              return {
                tagName: el.tagName,
                type: el.type,
                value: el.value,
                text: el.textContent,
                id: el.id,
                name: el.name,
              };
            }, button);

            console.log(`\n🔍 Testing: ${selector}`);
            console.log(`   📋 Details:`, details);

            // Test clicking
            await button.click();
            console.log(`   ✅ WORKING BUTTON FOUND: ${selector}`);
            workingButtonSelector = selector;
            break;
          } else {
            console.log(`❌ Not found: ${selector}`);
          }
        }
      } catch (err) {
        console.log(`❌ Error with ${selector}: ${err.message}`);
      }
    }

    if (!workingButtonSelector) {
      console.log("❌ NO WORKING BUTTON SELECTOR FOUND!");
    } else {
      console.log(
        `\n🎉 FINAL WORKING BUTTON SELECTOR: ${workingButtonSelector}`
      );
    }

    // ==============================================
    // 🧪 TEST THE WORKING SELECTORS
    // ==============================================
    console.log("\n🧪 TESTING WORKING SELECTORS TOGETHER");
    console.log("=".repeat(40));

    if (workingDateSelector && workingButtonSelector) {
      console.log(`\n📋 Using selectors:`);
      console.log(`   Date: ${workingDateSelector}`);
      console.log(`   Button: ${workingButtonSelector}`);

      // Reset to original page if needed
      await page.goto(HARVEST_URL, { waitUntil: "networkidle2" });

      // Select a different date to confirm it works
      const testDate = "07-15-2025";
      console.log(`\n📅 Selecting date: ${testDate}`);
      await page.select(workingDateSelector, testDate);

      // Click the button
      console.log("🖱️ Clicking Go button...");
      if (workingButtonSelector === 'button:contains("Go")') {
        await page.evaluate(() => {
          const buttons = document.querySelectorAll(
            'button, input[type="submit"], input[type="button"]'
          );
          for (let btn of buttons) {
            const text = btn.textContent || btn.value || "";
            if (text.includes("Go")) {
              btn.click();
              return;
            }
          }
        });
      } else {
        const button = await page.$(workingButtonSelector);
        await button.click();
      }

      console.log("⏳ Waiting for page update...");
      await new Promise((r) => setTimeout(r, 5000));

      console.log("✅ SELECTORS WORKING CORRECTLY!");
    } else {
      console.log("❌ Cannot test - missing working selectors");
    }

    // ==============================================
    // 📊 FINAL REPORT
    // ==============================================
    console.log("\n📊 FINAL SELECTOR REPORT");
    console.log("=".repeat(40));
    console.log(`📍 Date Dropdown: ${workingDateSelector || "NOT FOUND"}`);
    console.log(`📍 Go Button: ${workingButtonSelector || "NOT FOUND"}`);

    if (workingDateSelector && workingButtonSelector) {
      console.log("\n🎉 COPY THIS TO YOUR MAIN SCRAPER:");
      console.log(`const DATE_SELECTOR = "${workingDateSelector}";`);
      console.log(`const BUTTON_SELECTOR = "${workingButtonSelector}";`);
    }

    // Keep browser open
    console.log("\n⏱️ Keeping browser open for 10 seconds...");
    await new Promise((r) => setTimeout(r, 10000));
  } catch (error) {
    console.error("\n❌ Debug error:", error.message);
  } finally {
    await browser.close();
    console.log("\n🔚 Browser closed");
  }
}

// Run debug
debugScraper().then(() => process.exit(0));
