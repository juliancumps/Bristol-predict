/**
 * Personal catch log. Saved ONLY in this browser (localStorage).
 * Nothing here is sent to the server.
 *
 * Entry: { id, date: "MM-DD-YYYY", district, pounds, avgWeight, sockeye,
 *          pricePerLb, sets, tide, notes, createdAt, updatedAt }
 */
const KEY = "bp.catchLog.v1";

const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);

function read() {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // private mode or storage full
  }
}

/** "MM-DD-YYYY" -> "YYYYMMDD" for sorting */
const sortKey = (d) => (d ? d.slice(6) + d.slice(0, 2) + d.slice(3, 5) : "");

function clean(input) {
  const pounds = num(input.pounds);
  const avgWeight = num(input.avgWeight);
  return {
    date: String(input.date || ""),
    district: String(input.district || ""),
    pounds,
    avgWeight,
    sockeye: pounds && avgWeight ? Math.round(pounds / avgWeight) : null,
    pricePerLb: num(input.pricePerLb),
    sets: num(input.sets),
    tide: String(input.tide || "").slice(0, 40),
    notes: String(input.notes || "").slice(0, 500),
  };
}

export function listEntries() {
  return read().sort((a, b) => sortKey(b.date).localeCompare(sortKey(a.date)) || (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function addEntry(input) {
  const now = new Date().toISOString();
  const id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = { id, ...clean(input), createdAt: now, updatedAt: now };
  const ok = write([...read(), entry]);
  return ok ? entry : null;
}

export function updateEntry(id, input) {
  const list = read();
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...clean({ ...list[i], ...input }), updatedAt: new Date().toISOString() };
  return write(list) ? list[i] : null;
}

export function deleteEntry(id) {
  return write(read().filter((e) => e.id !== id));
}

export function exportJson() {
  return JSON.stringify({ app: "Bristol Predict", kind: "catch-log", version: 1, exportedAt: new Date().toISOString(), entries: read() }, null, 1);
}

/** Merge a backup by id. The newer copy of an entry wins. Returns the count of added or changed entries. */
export function importJson(text) {
  const data = JSON.parse(text);
  const incoming = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(incoming)) throw new Error("This file is not a catch log backup.");
  const list = read();
  const byId = new Map(list.map((e) => [e.id, e]));
  let changed = 0;
  for (const raw of incoming) {
    if (!raw || !raw.id || !/^\d{2}-\d{2}-\d{4}$/.test(raw.date || "")) continue;
    const entry = { ...clean(raw), id: String(raw.id), createdAt: raw.createdAt || null, updatedAt: raw.updatedAt || raw.createdAt || null };
    const old = byId.get(entry.id);
    if (!old || (entry.updatedAt || "") > (old.updatedAt || "")) {
      byId.set(entry.id, entry);
      changed++;
    }
  }
  if (!write([...byId.values()])) throw new Error("The browser did not save the data.");
  return changed;
}

export function exportCsv() {
  const cols = ["date", "district", "pounds", "avgWeight", "sockeye", "pricePerLb", "sets", "tide", "notes"];
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...listEntries().map((e) => cols.map((c) => esc(e[c])).join(","))].join("\n");
}

/** Save text as a file on the device. */
export function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
