/**
 * Port Moller Test Fishery (PMTF) data.
 *
 * Two sources:
 *  1. Stock composition: ADF&G PDFs. The announcements job already saves them
 *     (kind "portmoller"). parseStockComposition() reads the table from the
 *     saved text. No second download.
 *  2. Daily catch index: BBSRI "Catch Update #N" PDFs, listed on
 *     https://www.bbsri.org/inseason-data (archive: /<year>-inseason-data).
 *
 * BBSRI data is preliminary. The screen says so.
 */
const axios = require("axios");

const BBSRI_BASE = "https://www.bbsri.org";
const HTTP_OPTIONS = {
  timeout: 30000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; BristolPredict/4.0; personal fishing tool)" },
};
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reporting group -> district id. North Peninsula and Kuskokwim are not Bristol Bay districts. */
const GROUP_DISTRICT = {
  "North Peninsula": "other",
  Ugashik: "ugashik",
  Egegik: "egegik",
  Naknek: "naknek",
  Alagnak: "naknek",
  Kvichak: "naknek",
  Nushagak: "nushagak",
  Wood: "nushagak",
  Igushik: "nushagak",
  Togiak: "togiak",
  Kuskokwim: "other",
};

function monthIndex(name) {
  const i = MONTHS.indexOf(String(name).toLowerCase());
  return i < 0 ? null : i + 1;
}

/**
 * "July 2-3, 2026" | "June 30-July 1, 2026" | "July 8, 2026" -> { start, end } as YYYY-MM-DD.
 */
function parsePeriod(text) {
  const m = String(text).match(
    /([A-Z][a-z]+)\s+(\d{1,2})\s*(?:[-–]\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2}))?,\s*(\d{4})/
  );
  if (!m) return null;
  const [, m1, d1, m2, d2, year] = m;
  const mo1 = monthIndex(m1);
  const mo2 = m2 ? monthIndex(m2) : mo1;
  if (!mo1 || !mo2) return null;
  return {
    start: `${year}-${pad(mo1)}-${pad(d1)}`,
    end: `${year}-${pad(mo2)}-${pad(d2 || d1)}`,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Stock composition (ADF&G)                                        */
/* ------------------------------------------------------------------ */

const GROUP_NAMES = Object.keys(GROUP_DISTRICT);
const ROW_RE = new RegExp(
  `^\\s*(${GROUP_NAMES.join("|")})\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`,
  "gm"
);

/**
 * Read the stock composition tables. Returns the first complete table as the main
 * result and any more tables in `tables`. Dates come from the title, because the
 * PDF header text has broken spacing.
 */
function parseStockComposition(text, title = "") {
  const period = parsePeriod(title) || parsePeriod(String(text).replace(/\s+/g, " ").slice(0, 600));
  const tables = [];
  let current = [];
  for (const m of String(text).matchAll(ROW_RE)) {
    const row = { group: m[1], estimate: +m[2], lower: +m[3], upper: +m[4], district: GROUP_DISTRICT[m[1]] };
    // A group name seen again starts a new table.
    if (current.some((r) => r.group === row.group)) {
      tables.push(current);
      current = [];
    }
    current.push(row);
  }
  if (current.length) tables.push(current);

  const sampled = String(text).match(/total of\s+([\d,]+)\s+fish were sampled/i);
  const analyzed = String(text).match(/([\d,]+)\s+were analyzed/i);
  const groups = tables[0] || [];
  const sum = groups.reduce((s, g) => s + g.estimate, 0);
  return {
    periodStart: period ? period.start : null,
    periodEnd: period ? period.end : null,
    sampled: sampled ? +sampled[1].replace(/,/g, "") : null,
    analyzed: analyzed ? +analyzed[1].replace(/,/g, "") : null,
    groups,
    tables: tables.length > 1 ? tables.slice(1) : undefined,
    // Shares must add to about 100%. If not, the screen shows "Check source".
    complete: groups.length >= 8 && Math.abs(sum - 100) <= 2,
  };
}

/** Sum the group shares by district. */
function sharesByDistrict(groups) {
  const out = {};
  for (const g of groups || []) out[g.district] = Math.round(((out[g.district] || 0) + g.estimate) * 10) / 10;
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Catch updates (BBSRI)                                            */
/* ------------------------------------------------------------------ */

/** Find "Catch Update #N" links in the BBSRI page HTML. The date is in the next table cell. */
function listCatchUpdates(html) {
  const out = [];
  const seen = new Set();
  const re = /href="([^"]+?\.pdf)"[^>]*>(?:\s*<[^>]+>)*\s*Catch Update\s*#\s*(\d+)/gi;
  for (const m of String(html).matchAll(re)) {
    const number = +m[2];
    if (seen.has(number)) continue;
    seen.add(number);
    const after = String(html).slice(m.index + m[0].length, m.index + m[0].length + 800);
    const date = after.match(/>\s*((?:January|February|March|April|May|June|July|August|September)\s+\d{1,2},\s*\d{4})\s*</);
    const url = m[1].startsWith("http") ? m[1] : BBSRI_BASE + m[1];
    out.push({ number, url, dateText: date ? date[1] : null });
  }
  return out.sort((a, b) => a.number - b.number);
}

/** "S12-14" -> ["S12","S14"]; "S8-24" -> ["S8",...,"S24"]; "S6" -> ["S6"] */
function expandStations(from, to) {
  const a = +from;
  const b = to ? +to : a;
  const out = [];
  for (let s = a; s <= b; s += 2) out.push(`S${s}`);
  return out;
}

/**
 * Read one catch update PDF text.
 * Station values that are not numbers ("Not fished", "Will report tomorrow") become null,
 * and the words go to stationNotes.
 */
function parseCatchUpdate(text) {
  const t = String(text).replace(/\r/g, "");
  const head = t.match(/Catch Update\s*#\s*(\d+),?\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/);
  const period = head ? parsePeriod(head[2]) : null;

  const stations = {};
  const stationNotes = {};
  const stationRe = /^\s*S(\d{1,2})(?:\s*-\s*S?(\d{1,2}))?\s*:\s*(.*)$/gm;
  for (const m of t.matchAll(stationRe)) {
    const value = m[3].trim();
    const num = value.match(/^~?\s*(\d+(?:\.\d+)?)\b/);
    for (const s of expandStations(m[1], m[2])) {
      if (s in stations) continue;
      stations[s] = num ? +num[1] : null;
      if (!num && value) stationNotes[s] = value.slice(0, 80);
    }
  }

  let dailyIndex = null;
  let indexNote = null;
  let indexApprox = false;
  const idx = t.match(/Daily Catch Index\s*=\s*([^\n]*)/i);
  if (idx) {
    const v = idx[1].trim();
    const n = v.match(/^(~)?\s*(\d+(?:\.\d+)?)\b/);
    if (n) {
      dailyIndex = +n[2];
      indexApprox = !!n[1];
    } else if (v) {
      indexNote = v.slice(0, 120);
    }
  }

  return {
    number: head ? +head[1] : null,
    date: period ? period.start : null,
    stations,
    stationNotes: Object.keys(stationNotes).length ? stationNotes : undefined,
    dailyIndex,
    indexApprox: indexApprox || undefined,
    indexNote: indexNote || undefined,
  };
}

function seasonPageUrl(year, currentYear) {
  return year === currentYear ? `${BBSRI_BASE}/inseason-data` : `${BBSRI_BASE}/${year}-inseason-data`;
}

/**
 * Download the catch update PDFs that are not known yet.
 * Returns new records (with url and fetchedAt). Never throws for one bad PDF.
 */
async function fetchCatchUpdates(year, knownNumbers = [], { currentYear = new Date().getFullYear(), log = console.log } = {}) {
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const pageUrl = seasonPageUrl(year, currentYear);
  const { data: html } = await axios.get(pageUrl, HTTP_OPTIONS);
  const links = listCatchUpdates(html);
  const known = new Set(knownNumbers);
  const out = [];
  for (const link of links) {
    if (known.has(link.number)) continue;
    try {
      const res = await axios.get(link.url, { ...HTTP_OPTIONS, responseType: "arraybuffer" });
      const parsed = await pdfParse(Buffer.from(res.data));
      const rec = parseCatchUpdate(parsed.text || "");
      if (rec.number !== null && rec.number !== link.number) {
        log(`   ⚠️  Catch Update link #${link.number} has #${rec.number} inside; using the PDF number`);
      }
      // The current season page has only this season. Skip a PDF from another year.
      if (rec.date && +rec.date.slice(0, 4) !== year) {
        log(`   ⚠️  #${link.number} is dated ${rec.date}, not ${year}; skipped`);
      } else {
        out.push({
          ...rec,
          number: rec.number ?? link.number,
          date: rec.date || (link.dateText ? parsePeriod(link.dateText)?.start : null),
          url: link.url,
          fetchedAt: new Date().toISOString(),
        });
        log(`   + Catch Update #${link.number} ${rec.date || link.dateText || ""} index ${rec.dailyIndex ?? "-"}`);
      }
    } catch (e) {
      log(`   ❌ Catch Update #${link.number}: ${e.message}`);
    }
    await sleep(1500);
  }
  return { pageUrl, links: links.length, added: out };
}

/* ------------------------------------------------------------------ */
/* 3. Values for the API                                               */
/* ------------------------------------------------------------------ */

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Running total of the daily index (days with no index add 0). */
function cumulativeIndex(catchUpdates) {
  let sum = 0;
  return [...(catchUpdates || [])]
    .filter((u) => u.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((u) => {
      sum += u.dailyIndex || 0;
      return { date: u.date, number: u.number, dailyIndex: u.dailyIndex, cumulative: Math.round(sum * 10) / 10 };
    });
}

/** Fish at Port Moller reach the districts about 6 to 9 days later. */
const TRAVEL_DAYS = { from: 6, to: 9 };
function arrivalWindow(periodStart, periodEnd) {
  if (!periodStart) return null;
  return { from: addDays(periodStart, TRAVEL_DAYS.from), to: addDays(periodEnd || periodStart, TRAVEL_DAYS.to) };
}

module.exports = {
  parseStockComposition,
  parsePeriod,
  sharesByDistrict,
  listCatchUpdates,
  parseCatchUpdate,
  fetchCatchUpdates,
  cumulativeIndex,
  arrivalWindow,
  seasonPageUrl,
  GROUP_DISTRICT,
  TRAVEL_DAYS,
};
