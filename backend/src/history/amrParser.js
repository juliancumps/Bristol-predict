/**
 * Parser for the ADF&G Bristol Bay Annual Management Report (AMR) tables.
 * Pure functions: input = the lines of each page, output = JSON. No network.
 *
 * Tables are found by their TITLE TEXT, not by number (numbers change by year):
 *   - Commercial (salmon) catch by (date and) species ... <District> District -> catch[district]
 *   - Daily district registration of drift gillnet permit holders              -> registration
 *   - Daily sockeye salmon escapement tower counts                              -> escapement[river]
 *   - Nushagak River sonar project (sockeye columns)                            -> escapement["Nushagak River"]
 *   - Comparison of inshore sockeye salmon forecast versus actual run           -> forecast
 *
 * Empty cells: the PDF leaves some cells blank. Each value is put in the column whose
 * header is nearest to it on the page (x position). A row that still does not fit is
 * not guessed: it goes to `rejected` with its page.
 * "–", "ND" and blank cells are saved as null, not 0.
 */

const DISTRICT_IDS = {
  "naknek-kvichak": "naknek",
  egegik: "egegik",
  ugashik: "ugashik",
  nushagak: "nushagak",
  togiak: "togiak",
};
const SPECIES = ["sockeye", "chinook", "chum", "pink", "coho", "total"];
const REG_KEYS = ["naknek", "naknekDual", "egegik", "egegikDual", "ugashik", "ugashikDual", "nushagak", "nushagakDual", "togiak", "total"];

const EMPTY = /^([–—-]|ND|NA)$/;
const NUM = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/;
const FOOTNOTE = /^[a-z]$/;

const FORECAST_ROW = /^(Kvichak River|Alagnak River|Naknek River|Egegik (?:River|District)|Ugashik (?:River|District)|Wood River|Igushik River|Nushagak River|Nushagak-Mulchatna|Togiak (?:River|District)|Total Bristol Bay)\s+(\d.*)$/i;

/** "EGEGIK DISTRICT" -> "Egegik River"; "Nushagak-Mulchatna" -> "Nushagak River"; total row -> null */
function canonicalRiver(name) {
  const n = name.toLowerCase();
  if (n.startsWith("total")) return null;
  if (n.startsWith("nushagak")) return "Nushagak River";
  const first = n.split(/[\s-]/)[0];
  return `${first[0].toUpperCase()}${first.slice(1)} River`;
}

/** "1,485,067" -> 1485067; "–" or "ND" -> null; anything else -> undefined (not a value) */
function value(token) {
  if (token === null || token === undefined) return null;
  if (EMPTY.test(token)) return null;
  if (NUM.test(token)) return +token.replace(/,/g, "");
  return undefined;
}

/** "6/16" -> "06-16-2023" */
function dateOf(token, year) {
  const m = String(token).match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${year}`;
}

/** A line is a string, or { text, cells: [{ s, x, w }] } with page positions. */
function cellsOf(line) {
  if (typeof line === "string") return line.trim().split(/\s+/).filter(Boolean).map((s) => ({ s }));
  return line.cells;
}
const textOf = (line) => (typeof line === "string" ? line : line.text);

function titleType(text) {
  const m = text.match(/Commercial (?:salmon )?catch by (?:date and )?species.*?\b(Naknek-Kvichak|Egegik|Ugashik|Nushagak|Togiak) District/i);
  if (m) return { type: "catch", district: DISTRICT_IDS[m[1].toLowerCase()] };
  if (/Daily district registration of drift gillnet permit holders/i.test(text)) return { type: "registration" };
  if (/Daily sockeye salmon escapement tower counts/i.test(text)) return { type: "tower" };
  if (/Nushagak River sonar project/i.test(text) && /daily/i.test(text)) return { type: "sonar" };
  if (/Comparison of inshore sockeye salmon forecast versus actual run/i.test(text)) {
    return { type: "forecast", unit: /in millions/i.test(text) ? 1e6 : /in thousands/i.test(text) ? 1e3 : null };
  }
  return { type: "other" };
}

/**
 * Put the value cells of a row into the header columns.
 * Returns an array with one token (or null) per column, or null if it does not fit.
 */
function placeCells(valueCells, header) {
  const n = header.length;
  if (valueCells.length === n) return valueCells.map((c) => c.s);
  const positioned = valueCells.every((c) => c.x !== undefined) && header.every((h) => h.x !== undefined);
  if (!positioned || valueCells.length > n) return null;
  const out = new Array(n).fill(null);
  for (const c of valueCells) {
    const center = c.x + (c.w || 0) / 2;
    let best = -1;
    let bestDist = Infinity;
    header.forEach((h, k) => {
      const d = Math.abs(center - (h.x + (h.w || 0) / 2));
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    });
    if (out[best] !== null) return null; // two values in one column: do not guess
    out[best] = c.s;
  }
  return out;
}

/**
 * pages: array of pages, each an array of lines (top to bottom).
 * Returns { catch, registration, escapement, totals, checks, rejected, tables }.
 */
function parseAmrPages(pages, year) {
  const out = { catch: {}, registration: [], escapement: {}, totals: {}, forecast: null, rejected: [], tables: [] };
  const tableInfo = {}; // table number -> { type, district, header, rivers }

  pages.forEach((lines, pageIndex) => {
    const page = pageIndex + 1;
    let current = null;
    for (let i = 0; i < lines.length; i++) {
      const text = textOf(lines[i]);

      const t = text.match(/^Table (\d+)\.?\s*[–—-]\s*(.*)$/);
      if (t) {
        const num = +t[1];
        if (/^Page \d+ of \d+/i.test(t[2])) {
          current = tableInfo[num] || null;
        } else {
          const kind = titleType(`${t[2]} ${textOf(lines[i + 1] || "")} ${textOf(lines[i + 2] || "")}`);
          current = tableInfo[num] = { num, ...kind };
          if (kind.type !== "other") out.tables.push({ num, page, ...kind, title: t[2].slice(0, 120) });
        }
        continue;
      }
      if (!current || current.type === "other") continue;

      const cells = cellsOf(lines[i]).filter((c) => !FOOTNOTE.test(c.s));
      if (!cells.length) continue;

      // Header row (on every page of the table). Found by its words, because "Date" can
      // stand on the line above it when the header has two lines.
      const words = cells.map((c) => c.s);
      if (
        (current.type === "catch" && words.includes("Sockeye") && words.includes("Total")) ||
        ((current.type === "tower" || current.type === "sonar") && words.includes("Daily") && words.some((w) => /^Cum/.test(w)))
      ) {
        current.header = cells.filter((c) => c.s !== "Date");
        continue;
      }
      if (cells[0].s === "Date") continue;
      // River names above the tower header
      if (current.type === "tower" && /River/.test(text) && !/^\d/.test(text)) {
        current.rivers = text.match(/[A-Z][a-z]+(?: [A-Z][a-z]+)? River/g) || current.rivers;
        continue;
      }

      // Forecast against actual run, by river (one row per river, one total row).
      // Older reports have one row for a one-river district ("Egegik District") and
      // call the Nushagak River "Nushagak-Mulchatna".
      if (current.type === "forecast") {
        // A page number can stand at the start of a row (same height on the page): "26 Wood River ..."
        const m = text.replace(/^\d{1,3}\s+(?=[A-Z])/, "").match(FORECAST_ROW);
        if (m && current.unit) {
          const tk = m[2].split(/\s+/);
          const n = (t) => {
            const v = value(t);
            return v == null ? null : Math.round(v * current.unit);
          };
          const row = { forecast: n(tk[0]), actual: n(tk[1]), escapement: n(tk.at(-4)), projectedHarvest: n(tk.at(-3)), harvest: n(tk.at(-2)) };
          if ([row.forecast, row.actual].some((v) => v === null || v === undefined || Number.isNaN(v))) {
            out.rejected.push({ page, table: current.num, line: text, reason: "forecast row" });
          } else {
            out.forecast ||= { rivers: {}, total: null };
            const name = canonicalRiver(m[1]);
            if (name) out.forecast.rivers[name] = row;
            else out.forecast.total = row;
          }
        }
        continue;
      }

      // Season totals row of a catch table
      if (current.type === "catch" && /^Totals?$/.test(cells[0].s)) {
        const species = cells.slice(-6).map((c) => value(c.s));
        if (species.length === 6 && species.every((v) => v !== undefined)) {
          out.totals[current.district] = Object.fromEntries(SPECIES.map((s, k) => [s, species[k]]));
        }
        continue;
      }

      const date = dateOf(cells[0].s, year);
      if (!date) continue;
      const reject = (reason) => out.rejected.push({ page, table: current.num, line: text, reason });
      // Registration rows are always complete: no blank cells to place.
      if (current.type === "registration") current.header = current.header || new Array(10).fill({});
      if (!current.header) {
        reject("no header row");
        continue;
      }
      const placed =
        current.type === "registration"
          ? cells.length === 11 ? cells.slice(1).map((c) => c.s) : null
          : placeCells(cells.slice(1), current.header);
      if (!placed) {
        reject(`${cells.length - 1} values for ${current.header.length} columns`);
        continue;
      }

      if (current.type === "catch") {
        if (placed.length < 8) {
          reject(`only ${placed.length} columns`);
          continue;
        }
        const species = placed.slice(-6).map(value);
        const deliveries = placed.slice(-8, -6).map(value);
        if (species.some((v) => v === undefined) || deliveries.some((v) => v === undefined)) {
          reject("not a number");
          continue;
        }
        const row = {
          date,
          hours: placed.slice(0, -8),
          deliveriesDrift: deliveries[0],
          deliveriesSet: deliveries[1],
          ...Object.fromEntries(SPECIES.map((s, k) => [s, species[k]])),
        };
        // The species must add up to the total. If not, keep the row and mark it (the source has the error).
        if (species.slice(0, 5).every((v) => v !== null) && row.total !== null) {
          const sum = species.slice(0, 5).reduce((a, b) => a + b, 0);
          if (Math.abs(sum - row.total) > 1) row.sumOk = false;
        }
        (out.catch[current.district] ||= []).push(row);
      } else if (current.type === "registration") {
        if (placed.length !== 10) {
          reject(`${placed.length} columns`);
          continue;
        }
        const nums = placed.map(value);
        if (nums.some((v) => v === undefined)) {
          reject("not a number");
          continue;
        }
        const row = { date, ...Object.fromEntries(REG_KEYS.map((k, j) => [k, nums[j]])) };
        const sum = row.naknek + row.egegik + row.ugashik + row.nushagak + row.togiak;
        if (nums.every((v) => v !== null) && sum !== row.total) row.sumOk = false;
        out.registration.push(row);
      } else if (current.type === "sonar") {
        // The first two columns are sockeye: daily and cumulative
        const daily = value(placed[0]);
        const cumulative = value(placed[1]);
        if (daily === undefined || cumulative === undefined) {
          reject("not a number");
          continue;
        }
        if (daily !== null || cumulative !== null) (out.escapement["Nushagak River"] ||= []).push({ date, daily, cumulative });
      } else if (current.type === "tower") {
        const rivers = current.rivers || [];
        if (placed.length !== rivers.length * 2) {
          reject(`${placed.length} columns for ${rivers.length} rivers`);
          continue;
        }
        const nums = placed.map(value);
        if (nums.some((v) => v === undefined)) {
          reject("not a number");
          continue;
        }
        rivers.forEach((river, k) => {
          const daily = nums[2 * k];
          const cumulative = nums[2 * k + 1];
          if (daily === null && cumulative === null) return;
          (out.escapement[river] ||= []).push({ date, daily, cumulative });
        });
      }
    }
  });

  // Checks
  out.checks = {};
  for (const [district, rows] of Object.entries(out.catch)) {
    const sum = rows.reduce((s, r) => s + (r.sockeye || 0), 0);
    const printed = out.totals[district]?.sockeye ?? null;
    out.checks[district] = {
      rows: rows.length,
      sockeyeSum: sum,
      printedTotal: printed,
      // Days with fewer than 3 permit holders are confidential ("–") but are in the printed total.
      percentOfTotal: printed ? Math.round((sum / printed) * 1000) / 10 : null,
      rowsWithSumError: rows.filter((r) => r.sumOk === false).length,
    };
  }
  for (const [river, rows] of Object.entries(out.escapement)) {
    let bad = 0;
    for (let k = 1; k < rows.length; k++) {
      const a = rows[k - 1];
      const b = rows[k];
      if (a.cumulative !== null && b.cumulative !== null && b.daily !== null && Math.abs(a.cumulative + b.daily - b.cumulative) > 1) bad++;
    }
    out.checks[river] = { rows: rows.length, cumulativeErrors: bad, last: rows.at(-1)?.cumulative ?? null };
  }
  out.checks.registration = { rows: out.registration.length, rowsWithSumError: out.registration.filter((r) => r.sumOk === false).length };
  return out;
}

/**
 * Turn the text items of one PDF page into lines (top to bottom, left to right).
 * items: [{ str, transform: [a,b,c,d,x,y], width }] (pdf.js text content).
 * Items close together are joined without a space, so a number split in two items stays one.
 * Returns [{ text, cells: [{ s, x, w }] }].
 */
function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) rows.push((row = { y, items: [] }));
    row.items.push({ x: it.transform[4], w: it.width || 0, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    const cells = [];
    let cur = null;
    for (const it of r.items) {
      // x of each word inside the item, by its share of the characters
      const perChar = it.s.length ? it.w / it.s.length : 0;
      let offset = 0;
      for (const p of it.s.split(/(\s+)/)) {
        const px = it.x + offset * perChar;
        offset += p.length;
        if (!p) continue;
        if (/^\s+$/.test(p)) {
          cur = null;
          continue;
        }
        const pw = p.length * perChar;
        if (cur && px - (cur.x + cur.w) <= 1) {
          cur.s += p;
          cur.w = px + pw - cur.x;
        } else {
          cur = { s: p, x: px, w: pw };
          cells.push(cur);
        }
      }
      if (/\s$/.test(it.s)) cur = null;
    }
    // "19.5 /24" -> "19.5/24" (hours drift/set can be split in two items)
    for (let k = cells.length - 1; k > 0; k--) {
      if (cells[k].s.startsWith("/") || cells[k - 1].s.endsWith("/")) {
        cells[k - 1].s += cells[k].s;
        cells[k - 1].w = cells[k].x + cells[k].w - cells[k - 1].x;
        cells.splice(k, 1);
      }
    }
    return { text: cells.map((c) => c.s).join(" "), cells };
  });
}

module.exports = { parseAmrPages, itemsToLines, placeCells, titleType, value, dateOf };
