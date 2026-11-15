/**
 * District status board logic.
 *
 * Input: parsed announcements (see scrapers/announcements.js) and a moment in
 * Alaska local time ("YYYY-MM-DDTHH:MM"). Output: for each district and gear,
 * is it open, until when, and when is the next opening.
 *
 * All times are Alaska local time strings, so plain string comparison works.
 * The result always carries the source announcement and the original sentence.
 */
const DISTRICTS = ["naknek", "egegik", "ugashik", "nushagak", "togiak"];
const FISHERY_KINDS = ["eastside", "westside", "other"];
const WINDOW_DAYS = 10; // announcements older than this do not set the status

function shift(isoLocal, hours) {
  const d = new Date(`${isoLocal}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 16);
}

/** Current Alaska local time as "YYYY-MM-DDTHH:MM" */
function alaskaNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Anchorage",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const gearMatches = (eventGear, gear) =>
  eventGear === gear || eventGear === "both" || eventGear === "all";

function sourceOf(item) {
  return { id: item.id, title: item.title, url: item.url, issued: item.issued, number: item.number };
}

function computeStatus(items, asOf = alaskaNow()) {
  const windowStart = shift(asOf, -24 * WINDOW_DAYS);
  const fishery = items
    .filter((i) => FISHERY_KINDS.includes(i.kind) && i.issued && i.issued <= asOf)
    .sort((a, b) => (a.issued < b.issued ? 1 : -1)); // newest first
  const recent = fishery.filter((i) => i.issued >= windowStart);

  // Flatten to events, newest announcement first.
  const events = [];
  for (const item of recent) {
    for (const ev of item.events || []) {
      if (!ev.district) continue;
      events.push({ ...ev, issued: item.issued, source: sourceOf(item) });
    }
  }

  // A newer announcement replaces an older one for the same area and time.
  const live = [];
  for (const ev of events) {
    const replaced = live.some(
      (k) =>
        k.issued > ev.issued &&
        k.district === ev.district &&
        k.area === ev.area &&
        (k.gear === ev.gear || k.gear === "both" || ev.gear === "both") &&
        k.type === "open" && ev.type === "open" &&
        k.start && ev.start &&
        k.start < (ev.end || "9999") && ev.start < (k.end || "9999")
    );
    if (!replaced) live.push(ev);
  }

  const result = {
    asOf,
    inSeason: recent.length > 0,
    latestAnnouncement: fishery[0] ? sourceOf(fishery[0]) : null,
    districts: {},
  };

  for (const district of DISTRICTS) {
    const dEvents = live.filter((e) => e.district === district);
    const entry = { periods: [], registration: null };

    for (const gear of ["drift", "set"]) {
      const gEvents = dEvents.filter((e) => gearMatches(e.gear, gear));
      const closedBetween = (from) =>
        gEvents.some((e) => e.type === "close" && e.end > from && e.end <= asOf);

      const openNow = gEvents.filter((e) => {
        if (e.type === "schedule") return false;
        if (e.untilFurtherNotice) {
          return e.type !== "close" && e.issued >= shift(asOf, -96) && !closedBetween(e.issued);
        }
        if (e.type === "open") {
          if (!e.start || e.start > asOf) return false;
          if (e.end) return e.end > asOf;
          return e.start >= shift(asOf, -24 * 7) && !closedBetween(e.start);
        }
        // until / extend / close: fishing is open now and ends at `end`
        return e.end && e.end > asOf;
      });
      // Newest announcement wins; then the one with a known end time.
      openNow.sort((a, b) =>
        a.issued !== b.issued ? (a.issued < b.issued ? 1 : -1) : (b.end ? 1 : 0) - (a.end ? 1 : 0)
      );

      const upcoming = gEvents
        .filter((e) => e.type === "open" && e.start && e.start > asOf)
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.issued < b.issued ? 1 : -1));

      const pick = (e) =>
        e && {
          start: e.start, end: e.end, area: e.area, gear: e.gear,
          confident: e.confident, sentence: e.sentence, source: e.source,
        };

      const current = openNow[0];
      entry[gear] = {
        state: current ? "open" : gEvents.length > 0 ? "closed" : "none",
        until: current ? current.end : null,
        untilFurtherNotice: current ? !!current.untilFurtherNotice : false,
        current: pick(current) || null,
        next: pick(upcoming[0]) || null,
      };
    }

    // Timeline for the district: everything still relevant, oldest first.
    const cutoff = shift(asOf, -12);
    entry.periods = dEvents
      .filter((e) => e.untilFurtherNotice || e.type === "schedule" || (e.end || e.start || "") >= cutoff)
      .map((e) => ({
        type: e.type, start: e.start, end: e.end, area: e.area, gear: e.gear,
        untilFurtherNotice: !!e.untilFurtherNotice, confident: e.confident,
        sentence: e.sentence, source: e.source,
      }))
      .sort((a, b) => ((a.start || a.end || "") < (b.start || b.end || "") ? -1 : 1));

    // Latest boat count (any announcement of the list, not only recent ones).
    for (const item of fishery) {
      const reg = (item.registrations || []).find((r) => r.district === district);
      if (reg) {
        entry.registration = { ...reg, issued: item.issued, source: sourceOf(item) };
        break;
      }
    }
    result.districts[district] = entry;
  }
  return result;
}

/** Every boat count in the announcements, oldest first (for charts). */
function registrationSeries(items) {
  const rows = [];
  for (const item of items) {
    for (const reg of item.registrations || []) {
      rows.push({ ...reg, issued: item.issued, sourceId: item.id, sourceUrl: item.url, sourceTitle: item.title });
    }
  }
  return rows.sort((a, b) => (a.issued < b.issued ? -1 : 1));
}

/** The newest boat count for each district (for the daily briefing). */
function latestRegistrations(items) {
  const out = {};
  for (const row of registrationSeries(items)) out[row.district] = row;
  return out;
}

module.exports = { computeStatus, registrationSeries, latestRegistrations, alaskaNow, DISTRICTS };
