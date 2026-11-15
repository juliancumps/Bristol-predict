/**
 * Data update job. Run by GitHub Actions on a schedule (see
 * .github/workflows/update-data.yml) or by hand:
 *
 *   npm run update                    run summary + announcements
 *   npm run update:announcements      announcements only
 *   npm run update:portmoller         BBSRI Port Moller catch updates only
 *   node src/jobs/update.js --portmoller 2025 2026
 *                                     load whole seasons of Port Moller updates
 *   node src/jobs/update.js --reparse read the saved announcement text again
 *                                     (no network; use after a parser change)
 *
 * The job only ADDS data. It never deletes days from the database.
 */
const {
  scrapeHarvestData,
  listAvailableDates,
} = require("../scrapers/harvestScraper");
const {
  listAnnouncements,
  fetchAnnouncementText,
  parseAnnouncement,
} = require("../scrapers/announcements");
const { initDatabase, saveScrapedData, getRunDates } = require("../database");
const { loadAnnouncements, saveAnnouncements, announcementYears, loadPortMoller, savePortMoller } = require("../store");
const { fetchCatchUpdates } = require("../scrapers/portMoller");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sortKey = (d) => d.slice(6) + d.slice(0, 2) + d.slice(3, 5); // MM-DD-YYYY -> YYYYMMDD
const DELAY_MS = 1500; // be polite to the ADF&G server
const RECHECK_DAYS = 3; // ADF&G corrects recent days, so read them again

async function updateRunSummary() {
  console.log("📊 Run summary");
  const db = await initDatabase();
  try {
    const available = await listAvailableDates();
    if (available.length === 0) throw new Error("ADF&G date list is empty");
    const year = Math.max(...available.map((d) => +d.slice(6)));
    const seasonDates = available.filter((d) => +d.slice(6) === year).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    const known = (await getRunDates(db)).filter((r) => r.season === year).map((r) => r.run_date);
    const latestKnown = known.length ? known[known.length - 1] : null;

    // New days, plus the last few known days again.
    const recheck = known.slice(-RECHECK_DAYS);
    const todo = seasonDates.filter(
      (d) => recheck.includes(d) || !latestKnown || sortKey(d) > sortKey(latestKnown)
    );
    // Off season nothing changes: skip the re-check when the newest ADF&G day is old.
    const newestAgeDays = (Date.now() - new Date(+year, +seasonDates.at(-1).slice(0, 2) - 1, +seasonDates.at(-1).slice(3, 5))) / 864e5;
    const work = newestAgeDays > 21 ? todo.filter((d) => !known.includes(d)) : todo;

    let saved = 0, blank = 0;
    for (const dateStr of work) {
      try {
        const data = await scrapeHarvestData(dateStr);
        // Days with no catch and no escapement are blank. Do not fill the database with them.
        const active = (data.totalRun.catchDaily || 0) + (data.totalRun.escapementDaily || 0) > 0;
        if (!active && !known.includes(dateStr)) {
          blank++;
        } else {
          await saveScrapedData(db, data);
          saved++;
        }
      } catch (e) {
        console.error(`   ❌ ${dateStr}: ${e.message}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`   ✅ ${saved} days saved, ${blank} blank days skipped (season ${year})`);
  } finally {
    await new Promise((r) => db.close(r));
  }
}

async function updateAnnouncements() {
  console.log("📣 Announcements");
  const list = await listAnnouncements();
  if (list.length === 0) throw new Error("ADF&G announcement list is empty");

  const stores = {};
  const storeFor = (year) => (stores[year] ||= loadAnnouncements(year));
  const defaultYear = +(list[0].listedDate || `${new Date().getFullYear()}`).slice(0, 4);
  const knownIds = new Set(
    [...new Set(list.map((i) => +(i.listedDate || `${defaultYear}`).slice(0, 4)))]
      .flatMap((y) => storeFor(y).items.map((i) => i.id))
  );

  let added = 0;
  for (const meta of list.reverse()) { // oldest first
    if (knownIds.has(meta.id)) continue;
    try {
      const text = await fetchAnnouncementText(meta.url);
      const record = parseAnnouncement(text, meta);
      record.fetchedAt = new Date().toISOString();
      const year = +(record.issued || meta.listedDate || `${defaultYear}`).slice(0, 4);
      storeFor(year).items.push(record);
      added++;
      console.log(`   + ${meta.listedDate} ${meta.title} (${record.events.length} events)`);
    } catch (e) {
      console.error(`   ❌ ${meta.title}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  const now = new Date().toISOString();
  for (const [year, store] of Object.entries(stores)) {
    // checkedAt changes only when something was added, so quiet runs make no git commit.
    if (added > 0 || !store.checkedAt) {
      store.checkedAt = now;
      if (added > 0) store.updatedAt = now;
      saveAnnouncements(+year, store);
    }
  }
  console.log(`   ✅ ${added} new announcements`);
}

/** The test fishery runs about June 10 to July 15. Check only from June 5 to July 20 (Alaska date). */
function inPortMollerWindow(date = new Date()) {
  const ak = new Date(date.getTime() - 8 * 3600e3); // Alaska is UTC-8 in summer
  const md = (ak.getUTCMonth() + 1) * 100 + ak.getUTCDate();
  return md >= 605 && md <= 720;
}

async function updatePortMoller(years) {
  const currentYear = new Date().getFullYear();
  const list = years && years.length ? years : [currentYear];
  for (const year of list) {
    console.log(`🎣 Port Moller ${year}`);
    const store = loadPortMoller(year);
    const known = store.catchUpdates.map((u) => u.number);
    const { pageUrl, links, added } = await fetchCatchUpdates(year, known, { currentYear });
    store.source = pageUrl;
    if (added.length > 0 || !store.checkedAt) {
      const now = new Date().toISOString();
      store.checkedAt = now;
      if (added.length) store.updatedAt = now;
      store.catchUpdates.push(...added);
      savePortMoller(year, store);
    }
    console.log(`   ✅ ${links} links on the page, ${added.length} new catch updates`);
  }
}

/** Parse the saved text again with the current parser. No network. */
function reparseAnnouncements() {
  for (const year of announcementYears()) {
    const store = loadAnnouncements(year);
    store.items = store.items.map((old) => {
      const fresh = parseAnnouncement(old.text, old);
      return { ...fresh, text: old.text, fetchedAt: old.fetchedAt };
    });
    saveAnnouncements(year, store);
    console.log(`🔁 Re-parsed ${store.items.length} announcements for ${year}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--reparse")) return reparseAnnouncements();
  if (args.includes("--portmoller")) {
    const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
    return updatePortMoller(years).catch((e) => { process.exitCode = 1; console.error("❌ Port Moller failed:", e.message); });
  }
  let failed = false;
  if (!args.includes("--announcements-only")) {
    await updateRunSummary().catch((e) => { failed = true; console.error("❌ Run summary failed:", e.message); });
  }
  if (!args.includes("--summary-only")) {
    await updateAnnouncements().catch((e) => { failed = true; console.error("❌ Announcements failed:", e.message); });
  }
  if (!args.includes("--summary-only") && !args.includes("--announcements-only") && inPortMollerWindow()) {
    await updatePortMoller().catch((e) => { failed = true; console.error("❌ Port Moller failed:", e.message); });
  }
  if (failed) process.exitCode = 1;
}

main();
