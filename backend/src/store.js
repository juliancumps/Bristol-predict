/**
 * Small JSON file store for data that is not in SQLite:
 *   data/announcements/<year>.json   - parsed ADF&G announcements
 *   data/reference/*.json            - escapement goals, forecasts
 * JSON files are easy to read and give clean git history.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ANNOUNCEMENTS_DIR = path.join(DATA_DIR, "announcements");
const REFERENCE_DIR = path.join(DATA_DIR, "reference");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function announcementFile(year) {
  return path.join(ANNOUNCEMENTS_DIR, `${year}.json`);
}

function loadAnnouncements(year) {
  return readJson(announcementFile(year), { year, updatedAt: null, checkedAt: null, items: [] });
}

function saveAnnouncements(year, store) {
  fs.mkdirSync(ANNOUNCEMENTS_DIR, { recursive: true });
  store.items.sort((a, b) => ((a.issued || "") < (b.issued || "") ? 1 : -1)); // newest first
  fs.writeFileSync(announcementFile(year), JSON.stringify(store, null, 1) + "\n");
}

function announcementYears() {
  if (!fs.existsSync(ANNOUNCEMENTS_DIR)) return [];
  return fs
    .readdirSync(ANNOUNCEMENTS_DIR)
    .map((f) => parseInt(f))
    .filter(Boolean)
    .sort((a, b) => b - a);
}

function loadReference(name) {
  return readJson(path.join(REFERENCE_DIR, `${name}.json`), null);
}

module.exports = {
  loadAnnouncements,
  saveAnnouncements,
  announcementYears,
  loadReference,
  DATA_DIR,
};
