/**
 * Small JSON file store for data that is not in SQLite:
 *   data/announcements/<year>.json   - parsed ADF&G announcements
 *   data/reference/*.json            - escapement goals, forecasts
 *   data/portmoller/<year>.json      - BBSRI Port Moller catch updates
 * JSON files are easy to read and give clean git history.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ANNOUNCEMENTS_DIR = path.join(DATA_DIR, "announcements");
const REFERENCE_DIR = path.join(DATA_DIR, "reference");
const PORTMOLLER_DIR = path.join(DATA_DIR, "portmoller");
const HISTORY_DIR = path.join(DATA_DIR, "history");

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

function yearsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => parseInt(f))
    .filter(Boolean)
    .sort((a, b) => b - a);
}

function portMollerFile(year) {
  return path.join(PORTMOLLER_DIR, `${year}.json`);
}

function loadPortMoller(year) {
  return readJson(portMollerFile(year), { year, source: null, checkedAt: null, updatedAt: null, catchUpdates: [] });
}

function savePortMoller(year, store) {
  fs.mkdirSync(PORTMOLLER_DIR, { recursive: true });
  store.catchUpdates.sort((a, b) => a.number - b.number);
  fs.writeFileSync(portMollerFile(year), JSON.stringify(store, null, 1) + "\n");
}

const portMollerYears = () => yearsIn(PORTMOLLER_DIR);

/** ADF&G Annual Management Report data (data/history/<year>.json), made by src/history/importAmr.js */
const historyYears = () => yearsIn(HISTORY_DIR);
const loadHistory = (year) => readJson(path.join(HISTORY_DIR, `${year}.json`), null);

module.exports = {
  loadPortMoller,
  historyYears,
  loadHistory,
  savePortMoller,
  portMollerYears,
  yearsIn,
  loadAnnouncements,
  saveAnnouncements,
  announcementYears,
  loadReference,
  DATA_DIR,
};
