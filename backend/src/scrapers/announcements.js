/**
 * ADF&G Bristol Bay fishery announcements.
 *
 * Source: the "Announcements" tab of
 *   https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.salmon
 * It is a list (<ul id="newsList">) of links to PDF files. There is no API.
 * We read the list, download each new PDF, and read the text.
 *
 * SAFETY RULE: the parsed times are a convenience only. Every parsed event
 * keeps the original sentence, and every announcement keeps its full text and
 * the link to the PDF. The app must always show these with the parsed times.
 */
const axios = require("axios");
const cheerio = require("cheerio");

const LIST_URL =
  "https://www.adfg.alaska.gov/index.cfm?adfg=commercialbyareabristolbay.salmon";
const BASE_URL = "https://www.adfg.alaska.gov";

const HTTP_OPTIONS = {
  timeout: 45000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; BristolPredict/4.0; personal fishery dashboard)",
  },
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_RE = "January|February|March|April|May|June|July|August|September|October|November|December";
const WEEKDAY_RE = "(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day";

const pad = (n) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ */
/* 1. The list of announcements                                        */
/* ------------------------------------------------------------------ */

/** Parse the announcement list out of the salmon page HTML. Pure function. */
function parseAnnouncementList(html) {
  const $ = cheerio.load(html);
  const items = [];
  $("#newsList li").each((_, li) => {
    const $a = $(li).find("a").first();
    const href = $a.attr("href") || "";
    const idMatch = href.match(/dcfnewsrelease\/(\d+)\.pdf/);
    if (!idMatch) return;
    // The list text ends with " - M/D/YY"
    const dateMatch = $(li).text().match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*$/);
    let listedDate = null;
    if (dateMatch) {
      const year = dateMatch[3].length === 2 ? 2000 + +dateMatch[3] : +dateMatch[3];
      listedDate = `${year}-${pad(dateMatch[1])}-${pad(dateMatch[2])}`;
    }
    items.push({
      id: idMatch[1],
      title: $a.text().trim().replace(/\s+/g, " "),
      url: href.startsWith("http") ? href : BASE_URL + href,
      listedDate,
    });
  });
  return items;
}

async function listAnnouncements() {
  const response = await axios.get(LIST_URL, HTTP_OPTIONS);
  return parseAnnouncementList(response.data);
}

/** Download one PDF and return its text. */
async function fetchAnnouncementText(url) {
  // Require the inner file: the package index runs a debug test when loaded first.
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const response = await axios.get(url, { ...HTTP_OPTIONS, responseType: "arraybuffer" });
  const parsed = await pdfParse(Buffer.from(response.data));
  return parsed.text || "";
}

/* ------------------------------------------------------------------ */
/* 2. Reading one announcement                                         */
/* ------------------------------------------------------------------ */

function classify(title, text) {
  const t = `${title} ${text.slice(0, 1500)}`;
  if (/Port Moller/i.test(title)) return "portmoller";
  if (/forecast/i.test(title)) return "forecast";
  if (/outlook/i.test(title)) return "outlook";
  if (/season summary/i.test(title)) return "summary";
  if (/Eastside Salmon (Announcement|Update)/i.test(t)) return "eastside";
  if (/Westside Salmon Announcement/i.test(t)) return "westside";
  if (/Dillingham Area Office/i.test(t)) return "westside";
  if (/King Salmon Office/i.test(t)) return "eastside";
  return "other";
}

/** "June 30, 2026" + "12:00 p.m." -> "2026-06-30T12:00" (Alaska local time) */
function parseIssued(text, fallbackDate) {
  const dateMatch = text.match(
    new RegExp(`(?:Date Issued|For Immediate Release):\\s*(${MONTH_RE})\\s+(\\d{1,2}),\\s*(\\d{4})`, "i")
  );
  const timeMatch = text.match(/Time(?: Issued)?:\s*(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i);
  let date = fallbackDate;
  if (dateMatch) {
    date = `${dateMatch[3]}-${pad(MONTHS.indexOf(dateMatch[1].toLowerCase()) + 1)}-${pad(dateMatch[2])}`;
  }
  if (!date) return null;
  let time = "12:00";
  if (timeMatch) time = to24h(+timeMatch[1], +timeMatch[2], timeMatch[3]);
  return `${date}T${time}`;
}

function to24h(h, m, ampm) {
  const a = String(ampm).toLowerCase()[0];
  if (a === "n") return "12:00"; // noon
  if (a === "m") return "00:00"; // midnight
  let hour = h % 12;
  if (a === "p") hour += 12;
  return `${pad(hour)}:${pad(m)}`;
}

const AREAS = [
  // [regex, district id, label]
  [/Wood River Special Harvest Area|WRSHA/i, "nushagak", "Wood River Special Harvest Area"],
  [/Igushik Section/i, "nushagak", "Igushik Section"],
  [/Nushagak Section/i, "nushagak", "Nushagak Section"],
  [/Nushagak District/i, "nushagak", "Nushagak District"],
  [/Kvichak Section/i, "naknek", "Kvichak Section"],
  [/Naknek Section/i, "naknek", "Naknek Section"],
  [/Naknek River Special Harvest Area|NRSHA/i, "naknek", "Naknek River Special Harvest Area"],
  [/Naknek-Kvichak District/i, "naknek", "Naknek-Kvichak District"],
  [/Egegik (District|River Special Harvest Area)/i, "egegik", "Egegik District"],
  [/Ugashik District/i, "ugashik", "Ugashik District"],
  [/Kulukak/i, "togiak", "Kulukak Section"],
  [/Togiak (Bay|River) Section/i, "togiak", "Togiak Bay Section"],
  [/Matogak|Osviak|Cape Peirce/i, "togiak", "Matogak, Osviak and Cape Peirce Sections"],
  [/Togiak District/i, "togiak", "Togiak District"],
];

const HEADER_DISTRICTS = {
  "naknek-kvichak district": "naknek",
  "egegik district": "egegik",
  "ugashik district": "ugashik",
  "nushagak district": "nushagak",
  "togiak district": "togiak",
};

/**
 * Split the body into sentences, and remember which district heading each
 * sentence is under (Eastside announcements use "Egegik District" headings).
 */
function toSentences(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let joined = "";
  for (const line of lines) {
    const header = HEADER_DISTRICTS[line.toLowerCase()];
    joined += header ? ` §${header}§ ` : ` ${line}`;
  }
  joined = joined
    .replace(/\s+/g, " ")
    // "a.m." / "p.m." hide the end of a sentence. Normalize, then put the
    // sentence break back when a new sentence clearly starts.
    .replace(/\ba\.\s?m\.?/gi, "AM")
    .replace(/\bp\.\s?m\.?/gi, "PM")
    .replace(
      new RegExp(`\\b(AM|PM)\\s+(?=[A-Z])(?!${WEEKDAY_RE}|${MONTH_RE})`, "g"),
      "$1. "
    );

  const out = [];
  let context = null;
  for (const chunk of joined.split(/§/)) {
    if (Object.values(HEADER_DISTRICTS).includes(chunk)) {
      context = chunk;
      continue;
    }
    chunk
      .split(/(?<=[a-z0-9)%]\.|AM\.|PM\.)\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((sentence) => out.push({ sentence, context }));
  }
  return out;
}

const TIME_TOKEN = new RegExp(
  `(?:(\\d{1,2}):(\\d{2})\\s*(AM|PM|noon|midnight)|\\b(noon|midnight)\\b)` +
    `(?:\\s*,?\\s*(?:on\\s+)?(?:${WEEKDAY_RE},?\\s+)?(${MONTH_RE})\\s+(\\d{1,2}))?`,
  "gi"
);

/** Find every clock time in a sentence, with its date when the text gives one. */
function findTimes(sentence) {
  const tokens = [];
  let m;
  TIME_TOKEN.lastIndex = 0;
  while ((m = TIME_TOKEN.exec(sentence))) {
    const word = (m[3] || m[4] || "").toLowerCase();
    const time = m[1] ? to24h(+m[1], +m[2], word) : to24h(12, 0, word);
    tokens.push({
      time,
      month: m[5] ? MONTHS.indexOf(m[5].toLowerCase()) + 1 : null,
      day: m[6] ? +m[6] : null,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  // A time with no date uses the date of the next time that has one
  // ("from 5:30 a.m. until 11:30 a.m. Wednesday, July 1").
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!tokens[i].month && tokens[i + 1]?.month) {
      tokens[i].month = tokens[i + 1].month;
      tokens[i].day = tokens[i + 1].day;
    }
  }
  for (let i = 1; i < tokens.length; i++) {
    if (!tokens[i].month && tokens[i - 1].month) {
      tokens[i].month = tokens[i - 1].month;
      tokens[i].day = tokens[i - 1].day;
    }
  }
  return tokens;
}

/**
 * Read the opening / closing events out of one sentence.
 * @returns {Array} events: { type, start, end, untilFurtherNotice, confident }
 *   type: "open" (start and end), "open" with end null (opens, no end given),
 *         "until" (open now, ends at `end`), "extend", "close"
 */
function parseSentenceEvents(sentence, year, issued) {
  const events = [];
  const isExtend = /\bextend(ed|s)?\b/i.test(sentence);

  if (/until further notice/i.test(sentence)) {
    events.push({
      type: isExtend ? "extend" : /\bclos/i.test(sentence) ? "close" : "open",
      start: null,
      end: null,
      untilFurtherNotice: true,
      confident: true,
    });
  }

  // Weekly-schedule sentences name weekdays with no dates. Do not guess.
  if (/\bschedule\b/i.test(sentence)) {
    if (events.length === 0) {
      events.push({ type: "schedule", start: null, end: null, confident: false });
    }
    return events;
  }

  const tokens = findTimes(sentence);
  const iso = (t) => {
    if (!t.month) return null;
    return `${year}-${pad(t.month)}-${pad(t.day)}T${t.time}`;
  };

  let pendingStart = null;
  const flushStart = () => {
    if (pendingStart) {
      events.push({ type: "open", start: pendingStart.iso, end: null, confident: pendingStart.confident });
      pendingStart = null;
    }
  };

  tokens.forEach((t, i) => {
    const leadFrom = i === 0 ? 0 : tokens[i - 1].end;
    const lead = sentence.slice(leadFrom, t.start);
    const before = sentence.slice(0, t.start);
    let when = iso(t);
    let confident = true;
    if (!when) {
      // No date anywhere in the sentence: assume the day it was issued.
      when = issued ? `${issued.slice(0, 10)}T${t.time}` : null;
      confident = false;
    }
    if (!when) return;

    if (/\b(until|to|through)\s*$/i.test(lead)) {
      if (pendingStart) {
        events.push({
          type: "open",
          start: pendingStart.iso,
          end: when,
          confident: confident && pendingStart.confident && when > pendingStart.iso,
        });
        pendingStart = null;
      } else {
        events.push({ type: isExtend ? "extend" : "until", start: null, end: when, confident });
      }
      return;
    }

    if (/\b(from|at|begin(ning)?|start(ing)?)\s*$/i.test(lead)) {
      // "close at 4:00 p.m." is a closing; "again at 1:15 a.m." is an opening.
      const lastClose = before.search(/\bclos(e|es|ed|ure)\b(?![\s\S]*\b(open|reopen|again)\b)/i);
      flushStart();
      if (lastClose !== -1) {
        events.push({ type: "close", start: null, end: when, confident });
      } else {
        pendingStart = { iso: when, confident };
      }
      return;
    }
    // Any other time (for example "through 6:00 a.m. today") is not an event.
  });
  flushStart();
  return events;
}

/**
 * Turn the text of one PDF into a structured record.
 * @param {string} rawText - text of the PDF
 * @param {object} meta - { id, title, url, listedDate } from the list
 */
function parseAnnouncement(rawText, meta) {
  const text = (rawText || "").replace(/ /g, " ").replace(/[’‘]/g, "'");
  const kind = classify(meta.title, text);
  const issued = parseIssued(text, meta.listedDate);
  const year = issued ? +issued.slice(0, 4) : new Date().getFullYear();

  const numberMatch = text.match(/Salmon (?:Announcement|Update)\s*(?:number\s*)?#?\s*(\d+)/i);
  const eoMatch = text.match(/Emergency Orders?:?\s*([^\n]+)/i);

  const record = {
    id: meta.id,
    title: meta.title,
    url: meta.url,
    kind,
    issued, // Alaska local time, "YYYY-MM-DDTHH:MM"
    listedDate: meta.listedDate,
    number: numberMatch ? +numberMatch[1] : null,
    emergencyOrders: eoMatch ? eoMatch[1].trim() : null,
    events: [],
    registrations: [],
    text: "",
  };

  const isFisheryNotice = kind === "eastside" || kind === "westside" || kind === "other";

  // Body = after the letterhead, before the sign-off.
  let body = text;
  const startIdx = body.search(/This is the Alaska Department of Fish/i);
  if (startIdx !== -1) body = body.slice(startIdx);
  const endIdx = body.search(/This has been the Alaska Department of Fish/i);
  if (endIdx !== -1) body = body.slice(0, endIdx);
  record.text = body.trim().slice(0, isFisheryNotice ? 12000 : 4000);

  if (!isFisheryNotice) return record;

  // District named in the first sentence ("...regarding commercial fishing in the Togiak District")
  const intro = body.slice(0, 400);
  let introDistrict = null;
  for (const [re, district] of AREAS) {
    if (re.test(intro)) { introDistrict = district; break; }
  }

  for (const { sentence, context } of toSentences(body)) {
    // Boat counts
    const west = sentence.match(
      /There are ([\d,]+) vessels and ([\d,]+) permits registered to fish in the ([A-Za-z-]+) District/i
    );
    const east = sentence.match(
      /There are ([\d,]+) vessels registered to fish in the district(?: and there will be ([\d,]+) in 48 hours)?/i
    );
    if (west) {
      const d = HEADER_DISTRICTS[`${west[3].toLowerCase()} district`];
      if (d) record.registrations.push({
        district: d,
        vessels: +west[1].replace(/,/g, ""),
        permits: +west[2].replace(/,/g, ""),
        vesselsIn48h: null,
      });
    } else if (east && context) {
      record.registrations.push({
        district: context,
        vessels: +east[1].replace(/,/g, ""),
        permits: null,
        vesselsIn48h: east[2] ? +east[2].replace(/,/g, "") : null,
      });
    }

    // Openings and closings
    if (!/\b(open|opens|opened|reopen|reopens|extend|extended|extends|close|closes|closed|closure|schedule)\b/i.test(sentence)) continue;
    if (/stand by|\bissued\b|The time is/i.test(sentence)) continue;
    if (/subsistence/i.test(sentence) && !/commercial/i.test(sentence)) continue;

    let areas = AREAS.filter(([re]) => re.test(sentence));
    // "the Nushagak Section of the Nushagak District" is one area: keep the section.
    if (/section of the [\w-]+ district/i.test(sentence)) {
      areas = areas.filter(
        (a) => !(/District$/.test(a[2]) && areas.some((o) => o !== a && o[1] === a[1]))
      );
    }
    const districts = [...new Set(areas.map((a) => a[1]))];
    const district = districts[0] || context || introDistrict || null;
    const hasDrift = /\bdrift\b/i.test(sentence);
    const hasSet = /\bset\s?(gill)?nets?\b|\bset gillnet\b|\band set\b/i.test(sentence);
    const gear = hasDrift && hasSet ? "both" : hasDrift ? "drift" : hasSet ? "set" : "all";

    const display = sentence.replace(/\bAM\b/g, "a.m.").replace(/\bPM\b/g, "p.m.");
    for (const ev of parseSentenceEvents(sentence, year, issued)) {
      record.events.push({
        ...ev,
        district,
        area: areas.map((a) => a[2]).join(" + ") || null,
        gear,
        // More than one area or district in one sentence: the times may not
        // apply to every area. The app must show the sentence.
        confident: ev.confident && districts.length <= 1 && areas.length <= 1 && !!district,
        sentence: display,
      });
    }
  }
  return record;
}

module.exports = {
  listAnnouncements,
  parseAnnouncementList,
  fetchAnnouncementText,
  parseAnnouncement,
  parseSentenceEvents,
  toSentences,
  LIST_URL,
};
