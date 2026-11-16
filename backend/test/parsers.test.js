/**
 * Parser tests. No network. Run with:  npm test   (in the backend folder)
 * The fixtures are real ADF&G text from the 2026 season.
 */
const assert = require("assert");
const { parseHarvestHtml } = require("../src/scrapers/harvestScraper");
const { parseAnnouncement, parseAnnouncementList } = require("../src/scrapers/announcements");
const { computeStatus } = require("../src/openingsStatus");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    process.exitCode = 1;
  }
}

/* ---------- run summary page ---------- */
const td = (cells) => `<tr>${cells.map((c, i) => `<td${i ? ' style="text-align:right;"' : ""}>${c}</td>`).join("")}</tr>`;
const HARVEST_HTML = `
<form><select id="dateDropdown" name="dateDropdown">
<option value="07-02-2026">07-02-2026</option><option value="07-01-2026" selected>07-01-2026</option></select></form>
<table id="sortTable"><tbody><tr><th>District</th><th>Catch Daily</th><th>Catch Cumulative</th><th>Escapement Daily</th><th>Escapement Cumulative</th><th>In-River Estimate</th><th>Total Run</th></tr>
${td(["Ugashik", "361,966", "2,142,595", "20,484", "39,630", "100,000", "2,282,225"])}
${td(["Egegik", "478,293", "3,197,566", "196,644", "836,310", "150,000", "4,183,876"])}
${td(["Naknek-Kvichak", "0", "750,221", "367,860", "1,066,416", "300,000", "2,116,637"])}
${td(["Nushagak", "929,434", "3,826,368", "238,028", "4,682,105", "0", "8,508,473"])}
${td(["Togiak", "5,939", "14,076", "0", "0", "0", "14,076"])}
${td(["Totals:", "1,775,632", "9,930,826", "823,016", "6,624,461", "550,000", "17,105,287"])}
</tbody></table>
<table id="sortTable"><tbody><tr><th>District</th><th>Escapement Daily</th><th>Escapement Cumulative</th><th>In-River Estimate</th></tr>
${td(["Ugashik River", "20,484", "39,630", "100,000"])}
${td(["Kvichak River", "236,310", "626,970", "300,000"])}
${td(["Wood River", "123,498", "1,884,756", "0"])}
</tbody></table>
<h2>Sockeye per Drift Delivery for: 07-01-2026</h2>
<table id="sortTable"><tbody><tr><th>District</th><th>Sockeye per Delivery</th></tr>
${td(["Ugashik", "2,155"])}${td(["Naknek-Kvichak", "0"])}${td(["Nushagak", "766"])}
</tbody></table>`;

console.log("Run summary parser");
test("reads date, districts, totals", () => {
  const d = parseHarvestHtml(HARVEST_HTML);
  assert.strictEqual(d.runDate, "07-01-2026");
  assert.strictEqual(d.season, 2026);
  assert.strictEqual(d.districts.length, 5);
  assert.strictEqual(d.districts.find((x) => x.id === "naknek").escapementCumulative, 1066416);
  assert.strictEqual(d.totalRun.totalRun, 17105287);
});
test("reads the river table (was always empty before V4)", () => {
  const d = parseHarvestHtml(HARVEST_HTML);
  assert.strictEqual(d.rivers.length, 3);
  assert.deepStrictEqual(d.rivers[1], {
    name: "Kvichak River", escapementDaily: 236310, escapementCumulative: 626970, inRiverEstimate: 300000,
  });
});
test("reads sockeye per delivery", () => {
  const d = parseHarvestHtml(HARVEST_HTML);
  assert.strictEqual(d.sockeyePerDelivery.ugashik, 2155);
  assert.strictEqual(d.sockeyePerDelivery.nushagak, 766);
});

/* ---------- announcement list ---------- */
console.log("Announcement list parser");
test("reads id, title, url, date", () => {
  const items = parseAnnouncementList(`<ul id="newsList">
    <li> <a href="/static/applications/dcfnewsrelease/1821441567.pdf">Kulukak Closure</a> (<span class="pdf">PDF 167 kB</span>) - 8/6/26 </li>
    <li style="display: none;"> <a href="/static/applications/dcfnewsrelease/1796240085.pdf">Bristol Bay Eastside Salmon Announcement #20</a> (<span class="pdf">PDF 167 kB</span>) - 7/2/26 </li></ul>`);
  assert.strictEqual(items.length, 2);
  assert.deepStrictEqual(items[0], {
    id: "1821441567", title: "Kulukak Closure",
    url: "https://www.adfg.alaska.gov/static/applications/dcfnewsrelease/1821441567.pdf", listedDate: "2026-08-06",
  });
});

/* ---------- announcement text ---------- */
const WEST_16 = `Advisory Announcement
Date Issued: June 30, 2026
Time Issued: 12:00 p.m.
Westside Salmon Announcement 16
Emergency Order 16
This is the Alaska Department of Fish and Game in Dillingham with an announcement regarding
commercial fishing in the Nushagak District. This is Westside Salmon Announcement number
16 issued Tuesday, June 30 at 12:00 noon.
The Nushagak River king salmon escapement was 1,287 yesterday, for a cumulative of 18,437. The
Wood River sockeye salmon daily escapement was 410,000 yesterday, and 34,000 through 6:00 a.m. today
for cumulative of 1.7 million.
The Nushagak District harvest was 631,000 sockeye salmon yesterday for a cumulative harvest of
2.5 million. The cumulative harvest percentages are 73.6% drift, 26.3% set. There are 500 vessels
and 708 permits registered to fish in the Nushagak District.
Commercial fishing with set gillnets will open in the Nushagak section of the Nushagak District
from 2:00 a.m. until 11:30 a.m. Wednesday, July 1, a 9.5-hour opening, and again from 2:00 p.m.
until 11:00 p.m. Wednesday, July 1 a 9-hour opening. Commercial fishing with drift gillnets will
open in the Nushagak District from 5:30 a.m. until 11:30 a.m. Wednesday, July 1, a 6-hour opening
and again from 4:30 p.m. until 11:00 p.m. Wednesday, July 1 a 6.5-hour opening.
Commercial fishing with set gillnets in the Igushik Section of the Nushagak District is extended
until further notice.
Commercial fishing in the Wood River Special Harvest Area is currently open for set gillnets
until 3:00 p.m. Wednesday, July 1. We will reevaluate harvest percentages tomorrow morning to
determine which gear type will fish in the Wood River after the scheduled closure.
This has been the Alaska Department of Fish and Game in Dillingham.
EO 2F-T-16-26`;

const WEST_23 = `Date Issued: July 6, 2026
Time Issued: 12:00 p.m.
Westside Salmon Announcement 23
Emergency Order 22
This is the Alaska Department of Fish and Game in Dillingham with an announcement regarding
commercial fishing in the Nushagak District. This is Westside Salmon Announcement number
23 issued Monday, July 6, at 12:00 noon.
6.3 million. There are 366 vessels and 502 permits registered to fish in the Nushagak District.
As previously announced, commercial fishing with drift gillnets in the Nushagak District will close
at 4:00 p.m. Monday, July 6. Commercial fishing with drift gillnets in the Nushagak District will
open from 7:30 p.m. Monday, July 6, until 4:30 a.m. Tuesday, July 7, a 9-hour opening and again
from 8:00 a.m. until 5:00 p.m. Tuesday, July 7 a 9-hour opening.
The cumulative harvest percentages are currently 75% drift, 25% set. Commercial fishing with set
gillnets in the Wood River Special Harvest Area is extended until 10:00 p.m. Tuesday, July 7.
This has been the Alaska Department of Fish and Game in Dillingham.`;

const WEST_18 = `Date Issued: July 2, 2026
Time Issued: 9:00 a.m.
Westside Salmon Announcement 18
Emergency Order: None
This is the Alaska Department of Fish and Game in Dillingham with an update regarding
commercial fishing in the Togiak District. This is Westside Salmon Announcement number 18
issued Thursday, July 2 at 9:00 a.m.
This is just a reminder that the commercial fishing in the Togiak Bay Section is on the expanded
weekly schedule and will close at 9:00 p.m. Saturday, July 4. The Matogak, Osviak, and Cape
Peirce Sections close as scheduled at 9:00 a.m. Saturday, July 4. All sections of the Togiak
District will reopen at 9:00 a.m. Monday, July 6.
This has been the Alaska Department of Fish and Game in Dillingham.`;

const EAST_20 = `Advisory Announcement CONTACT:
For Immediate Release: July 2, 2026 Stacy Vega, Egegik/Ugashik Area Biologist
Time: 8:00 p.m. (907) 246-3341
Bristol Bay Eastside Salmon Announcement #20
Emergency Order 28
This is the Alaska Department of Fish & Game in King Salmon with an announcement for permit holders in
the Naknek-Kvichak District. The time is 8:00 p.m. and the date is Thursday, July 2.
Naknek-Kvichak District
The Naknek River total escapement is 300,000, the Alagnak River total escapement is 235,000, the Kvichak
River total escapement is 830,000, and the Kvichak inriver estimate is 300,000 fish.
The Kvichak Section will open to drift gillnet gear and the Naknek-Kvichak District will open to set gillnet
gear for 5.5-hours from 3:30 p.m. until 9:00 p.m. Friday, July 3.
Permit holders in the Naknek-Kvichak District should stand by at 3:00 p.m. Friday, July 3, for the next
possible announcement.
This has been the Alaska Department of Fish and Game in King Salmon.
Connected EO's: 2F-T-28-26`;

const EAST_38 = `For Immediate Release: July 15, 2026 Stacy Vega, Egegik/Ugashik Area Biologist
Time: 3:00 p.m. (907) 246-3341
Bristol Bay Eastside Salmon Announcement #38
Emergency Orders 65, 66, 67
This is the Alaska Department of Fish & Game in King Salmon with an announcement for permit holders in the
Naknek-Kvichak, Egegik, and Ugashik districts. The time is 3:00 p.m. and the date is Wednesday, July 15.
Naknek-Kvichak District
Total escapement through July 14 was 871,000 fish in the Naknek River; 1.2 million in the Alagnak River; and 2.9
million in the Kvichak River. There are 487 vessels registered to fish in the district and there will be 518 in 48 hours.
The Naknek-Kvichak District will open to drift gillnet gear for an 8-hour period from 2:00 a.m. until 10:00 a.m.
Thursday, July 16; and for a 6-hour period from 2:00 p.m. until 8:00 p.m. Thursday, July 16; and again from 3:00
a.m. Friday, July 17 until 9:00 a.m. Sunday, July 19. The current set gillnet fishing period in the Naknek-Kvichak
District is extended until 9:00 a.m. Sunday, July 19. The fall fishing schedule of 9:00 a.m. Monday until 9:00 a.m.
Sunday will begin 9:00 a.m. Monday, July 20.
Egegik District
Egegik River total escapement is 1.9 million. The harvest on July 14 was 71,000 for a season total of 8.2 million.
The Egegik District will open to commercial fishing with drift and set gillnet gear for 8 hours from 12:30 a.m. to 8:30
a.m. Thursday July 16, again for 8 hours from 12:45 p.m. to 8:45 p.m. Thursday, July 16, and again at 1:15 a.m.
Friday, July 17, until 9:00 a.m. Sunday, July 19. The fall fishing schedule of 9:00 a.m. Monday to 9:00 a.m. Sunday
will begin 9:00 a.m. Monday, July 20.
Ugashik District
Ugashik River total escapement is 1.5 million and the inriver estimate is 125,000 fish.
The Ugashik District will open to drift and set gillnet gear from 11:00 a.m. Thursday, July 16 until 9:00 a.m. Sunday,
July 19. The fall fishing schedule of 9:00 a.m. Monday until 9:00 a.m. Sunday will begin 9:00 a.m. Monday, July 20.
This has been the Alaska Department of Fish and Game in King Salmon.`;

const meta = (id, title) => ({ id, title, url: `https://x/${id}.pdf`, listedDate: "2026-07-01" });
const spans = (rec, filter) =>
  rec.events.filter(filter).map((e) => `${e.type}:${e.start || ""}>${e.end || ""}`);

console.log("Announcement parser");
test("Westside 16: header, boat count", () => {
  const r = parseAnnouncement(WEST_16, meta("1", "Nushagak Openings WRSHA and Igushik Extensions"));
  assert.strictEqual(r.kind, "westside");
  assert.strictEqual(r.issued, "2026-06-30T12:00");
  assert.strictEqual(r.number, 16);
  assert.deepStrictEqual(r.registrations, [{ district: "nushagak", vessels: 500, permits: 708, vesselsIn48h: null }]);
});
test("Westside 16: drift and set openings, extension, WRSHA", () => {
  const r = parseAnnouncement(WEST_16, meta("1", "Nushagak Openings"));
  assert.deepStrictEqual(spans(r, (e) => e.gear === "drift"), [
    "open:2026-07-01T05:30>2026-07-01T11:30",
    "open:2026-07-01T16:30>2026-07-01T23:00",
  ]);
  assert.deepStrictEqual(spans(r, (e) => e.gear === "set" && /Nushagak Section/.test(e.area)), [
    "open:2026-07-01T02:00>2026-07-01T11:30",
    "open:2026-07-01T14:00>2026-07-01T23:00",
  ]);
  const igushik = r.events.find((e) => /Igushik/.test(e.area || ""));
  assert.strictEqual(igushik.type, "extend");
  assert.strictEqual(igushik.untilFurtherNotice, true);
  const wrsha = r.events.find((e) => /Wood River/.test(e.area || ""));
  assert.strictEqual(`${wrsha.type}:${wrsha.end}`, "until:2026-07-01T15:00");
  // escapement sentences ("through 6:00 a.m. today") must not make events
  assert.ok(r.events.every((e) => !/escapement/.test(e.sentence)));
});
test("Westside 23: close, overnight opening, extension", () => {
  const r = parseAnnouncement(WEST_23, meta("2", "Nushagak and WRSHA Openings"));
  assert.deepStrictEqual(spans(r, (e) => e.gear === "drift"), [
    "close:>2026-07-06T16:00",
    "open:2026-07-06T19:30>2026-07-07T04:30",
    "open:2026-07-07T08:00>2026-07-07T17:00",
  ]);
  assert.deepStrictEqual(spans(r, (e) => e.gear === "set"), ["extend:>2026-07-07T22:00"]);
});
test("Westside 18 (Togiak): schedule sentence is not guessed, reopen is read", () => {
  const r = parseAnnouncement(WEST_18, meta("3", "Togiak Update"));
  assert.ok(r.events.every((e) => e.district === "togiak"));
  assert.ok(r.events.some((e) => e.type === "schedule" && !e.confident));
  assert.ok(spans(r, () => true).includes("close:>2026-07-04T09:00"));
  assert.ok(spans(r, () => true).includes("open:2026-07-06T09:00>"));
});
test("Eastside 20: mixed-area sentence is flagged not confident", () => {
  const r = parseAnnouncement(EAST_20, meta("4", "Bristol Bay Eastside Salmon Announcement #20"));
  assert.strictEqual(r.kind, "eastside");
  assert.strictEqual(r.issued, "2026-07-02T20:00");
  assert.strictEqual(r.emergencyOrders, "28");
  assert.strictEqual(r.events.length, 1);
  const e = r.events[0];
  assert.strictEqual(`${e.start}>${e.end}`, "2026-07-03T15:30>2026-07-03T21:00");
  assert.strictEqual(e.district, "naknek");
  assert.strictEqual(e.gear, "both");
  assert.strictEqual(e.confident, false);
});
test("Eastside 38: three districts by heading, boat count, fall schedule not guessed", () => {
  const r = parseAnnouncement(EAST_38, meta("5", "Bristol Bay Eastside Salmon Announcement #38"));
  assert.deepStrictEqual(r.registrations, [{ district: "naknek", vessels: 487, permits: null, vesselsIn48h: 518 }]);
  assert.deepStrictEqual(spans(r, (e) => e.district === "naknek" && e.gear === "drift"), [
    "open:2026-07-16T02:00>2026-07-16T10:00",
    "open:2026-07-16T14:00>2026-07-16T20:00",
    "open:2026-07-17T03:00>2026-07-19T09:00",
  ]);
  assert.deepStrictEqual(spans(r, (e) => e.district === "naknek" && e.gear === "set"), ["extend:>2026-07-19T09:00"]);
  assert.deepStrictEqual(spans(r, (e) => e.district === "egegik" && e.type === "open"), [
    "open:2026-07-16T00:30>2026-07-16T08:30",
    "open:2026-07-16T12:45>2026-07-16T20:45",
    "open:2026-07-17T01:15>2026-07-19T09:00",
  ]);
  assert.deepStrictEqual(spans(r, (e) => e.district === "ugashik" && e.type === "open"), [
    "open:2026-07-16T11:00>2026-07-19T09:00",
  ]);
  assert.strictEqual(r.events.filter((e) => e.type === "schedule").length, 3);
});

/* ---------- status board ---------- */
console.log("Status board");
test("Nushagak drift: open now, then closed with next opening", () => {
  const items = [
    parseAnnouncement(WEST_16, meta("1", "Nushagak Openings")),
    parseAnnouncement(WEST_23, meta("2", "Nushagak and WRSHA Openings")),
  ];
  let s = computeStatus(items, "2026-07-01T08:00").districts.nushagak.drift;
  assert.strictEqual(s.state, "open");
  assert.strictEqual(s.until, "2026-07-01T11:30");
  assert.strictEqual(s.next.start, "2026-07-01T16:30");

  s = computeStatus(items, "2026-07-01T12:00").districts.nushagak.drift;
  assert.strictEqual(s.state, "closed");
  assert.strictEqual(s.next.start, "2026-07-01T16:30");

  s = computeStatus(items, "2026-07-06T15:00").districts.nushagak.drift;
  assert.strictEqual(s.state, "open");
  assert.strictEqual(s.until, "2026-07-06T16:00");
  assert.strictEqual(s.next.start, "2026-07-06T19:30");
});
test("Off season: no recent announcements means 'none'", () => {
  const items = [parseAnnouncement(WEST_23, meta("2", "Nushagak"))];
  const s = computeStatus(items, "2026-11-15T10:00");
  assert.strictEqual(s.districts.nushagak.drift.state, "none");
  assert.strictEqual(s.inSeason, false);
});


/* ---------- Port Moller ---------- */
const {
  parseStockComposition, listCatchUpdates, parseCatchUpdate, sharesByDistrict, cumulativeIndex, arrivalWindow,
} = require("../src/scrapers/portMoller");

// ADF&G stock composition, text as pdf-parse saves it (July 8-9, 2026)
const PM_STOCK = `This is the Alaska Department of Fish and Game with an update regarding genetic stock 
composition estimates for sockeye salmon from the Port Moller Test Fishery for July 8-9, 2026. 
 
A total of 180 fish were sampled and 180 were analyzed (180 had adequate data to include in the 
analysis). 
 
  Stock 90% 
 
Composition Confidence Intervals 
Reporting Group Estimate Lower Upper 
North Peninsula 0.6% 0.0% 2.9% 
Ugashik 13.8% 0.0% 25.2% 
Egegik 11.2% 3.0% 24.7% 
Naknek 11.7% 5.9% 18.3% 
Alagnak 12.3% 3.9% 20.7% 
Kvichak 20.5% 13.5% 28.4% 
Nushagak 9.9% 0.0% 17.9% 
Wood 2.5% 0.0% 8.2% 
Igushik 8.3% 2.4% 14.6% 
Togiak 8.5% 4.5% 13.0% 
Kuskokwim 0.7% 0.0% 3.7%`;

// BBSRI catch updates (2026 #25, 2026 #32, 2026 #3, 2025 #25)
const PM_CU25 = `Port Moller Test Fish Catch Update
Catch Update #25, July 4, 2026
1—PMTF Catch Update Table
3—C+E by District and Day for 2011-2026
Index by Station
S2: Not fished
S4: 11
S6: 333
S8: 28
S10: 26
S12: 21
S14: 13
S16: 7
S18: 4
S20: 0
S22: 0
S24: 0
Daily Catch Index = 39
Jordan and Scott`;
const PM_CU32 = `Catch Update #32, July 11, 2026
S2: Not fished
S4: 75
S6: 71
S8: 35
S10: 0
S12-14: Not fished
Daily Catch Index = 18`;
const PM_CU3 = `Catch Update #3, June 12, 2026
S2: Skipped
S4: Skipped
S6: 0
S8: 12
S10: 72
S14:0
Daily Catch Index = ~7`;
const PM_CU25_2025 = `Catch Update #25, July 4, 2025
S2: 0
S4: 15
S6: 118
S8-24: Not fished
Daily Catch Index = Will update tomorrow`;
const PM_PAGE = `<tr><td><a data-testid="linkElement" href="https://www.bbsri.org/_files/ugd/bc10d6_f9ab.pdf" target="_blank"><div class="g0q0vK">Catch Update #32</div></a></td><td><div><div class="g0q0vK">July 11, 2026</div></div></td></tr>
<tr><td><a href="/_files/ugd/bc10d6_9913.pdf"><div>Catch Update #25</div></a></td><td><div><div>July 4, 2026</div></div></td></tr>
<tr><td><a href="https://www.bbsri.org/_files/ugd/x.pdf"><div>July 8-9, 2026</div></a></td></tr>`;

console.log("Port Moller");
test("stock composition table, dates from the title", () => {
  const sc = parseStockComposition(PM_STOCK, "Port Moller Sockeye Salmon Stock Composition Summary June 30-July 1, 2026 – All Stations");
  assert.strictEqual(sc.periodStart, "2026-06-30");
  assert.strictEqual(sc.periodEnd, "2026-07-01");
  assert.strictEqual(sc.sampled, 180);
  assert.strictEqual(sc.groups.length, 11);
  assert.deepStrictEqual(sc.groups[5], { group: "Kvichak", estimate: 20.5, lower: 13.5, upper: 28.4, district: "naknek" });
  assert.strictEqual(sc.complete, true);
  const by = sharesByDistrict(sc.groups);
  assert.strictEqual(by.naknek, 44.5);
  assert.strictEqual(by.nushagak, 20.7);
  assert.deepStrictEqual(arrivalWindow(sc.periodStart, sc.periodEnd), { from: "2026-07-06", to: "2026-07-10" });
});
test("catch update: stations, 'Not fished' is null, index", () => {
  const u = parseCatchUpdate(PM_CU25);
  assert.strictEqual(u.number, 25);
  assert.strictEqual(u.date, "2026-07-04");
  assert.strictEqual(u.stations.S2, null);
  assert.strictEqual(u.stations.S6, 333);
  assert.strictEqual(Object.keys(u.stations).length, 12);
  assert.strictEqual(u.dailyIndex, 39);
});
test("catch update: station ranges, '~7', missing index", () => {
  const a = parseCatchUpdate(PM_CU32);
  assert.strictEqual(a.stations.S12, null);
  assert.strictEqual(a.stations.S14, null);
  assert.strictEqual(a.dailyIndex, 18);
  const b = parseCatchUpdate(PM_CU3);
  assert.strictEqual(b.dailyIndex, 7);
  assert.strictEqual(b.indexApprox, true);
  assert.strictEqual(b.stations.S14, 0);
  assert.strictEqual(b.stationNotes.S2, "Skipped");
  const c = parseCatchUpdate(PM_CU25_2025);
  assert.strictEqual(c.dailyIndex, null);
  assert.strictEqual(c.indexNote, "Will update tomorrow");
  assert.strictEqual(c.stations.S24, null);
  assert.strictEqual(Object.keys(c.stations).length, 12);
});
test("BBSRI page links and running total", () => {
  const links = listCatchUpdates(PM_PAGE);
  assert.strictEqual(links.length, 2);
  assert.deepStrictEqual(links[0], { number: 25, url: "https://www.bbsri.org/_files/ugd/bc10d6_9913.pdf", dateText: "July 4, 2026" });
  const cum = cumulativeIndex([parseCatchUpdate(PM_CU32), parseCatchUpdate(PM_CU25), parseCatchUpdate(PM_CU3)]);
  assert.deepStrictEqual(cum.map((c) => c.cumulative), [7, 46, 64]);
});

/* ---------- ADF&G Annual Management Report tables ---------- */
const { parseAmrPages } = require("../src/history/amrParser");
console.log("Annual Management Report");
test("catch, registration and tower tables (2023 text)", () => {
  const pages = [
    [
      "Table 9.–Commercial salmon catch by date and species, in numbers of fish, Naknek-Kvichak District,",
      "Bristol Bay, 2023.",
      "Hours fished Deliveries",
      "Date Drift Set Drift Set Sockeye Chinook Chum Pink Coho Total",
      "a",
      "6/16 9 9 1 0 – – – – – –",
      "6/19 15 15 13 11 2,557 3 17 0 0 2,577",
      "6/27 8.5 8.5 179 177 182,288 19 1,418 0 0 183,670",
      "-continued-",
    ],
    [
      "Table 9.–Page 2 of 2.",
      "Date Drift Set Drift Set Sockeye Chinook Chum Pink Coho Total",
      "7/3 18.5 24 596 687 1,485,067 72 2,141 0 0 1,487,280",
      "Total 12,946 8,719 1,669,912 94 3,576 0 0 1,673,527",
      "Table 10.–Daily district registration of drift gillnet permit holders and dual vessel registration, by",
      "district, Bristol Bay, 2023.",
      "Date total dual total dual total dual total dual total",
      "6/2 3 0 8 1 0 0 1 0 0 12",
      "Average 370 80 371 90 93 23 374 100 18 1,226",
    ],
    [
      "Table 17.–Daily sockeye salmon escapement tower counts by river system, Bristol Bay westside, 2023.",
      "Wood River Igushik River Togiak River",
      "Date Daily Cum. Daily Cum. Daily Cum.",
      "6/17 930 930 – – – –",
      "6/18 2,484 3,414 ND ND – –",
    ],
    [
      "Table 18.–Commercial salmon catch by date and species, in numbers of fish, Nushagak District, Bristol",
      "Bay, 2023.",
      "Date Nushagak Igushik Drift Set Sockeye Chinook Chum Pink Coho Total",
      "6/1 0/0 0/13.5 – 0 – – – – – –",
    ],
  ];
  const r = parseAmrPages(pages, 2023);
  assert.strictEqual(r.catch.naknek.length, 4);
  assert.deepStrictEqual(r.catch.naknek[0], {
    date: "06-16-2023", hours: ["9", "9"], deliveriesDrift: 1, deliveriesSet: 0,
    sockeye: null, chinook: null, chum: null, pink: null, coho: null, total: null,
  });
  assert.strictEqual(r.catch.naknek[3].sockeye, 1485067);
  assert.strictEqual(r.catch.naknek[2].sumOk, false); // 182,288 + ... is not 183,670 in the source
  assert.strictEqual(r.checks.naknek.percentOfTotal, 100);
  assert.deepStrictEqual(r.catch.nushagak[0].hours, ["0/0", "0/13.5"]);
  assert.strictEqual(r.registration.length, 1);
  assert.strictEqual(r.registration[0].egegikDual, 1);
  assert.deepStrictEqual(r.escapement["Wood River"][1], { date: "06-18-2023", daily: 2484, cumulative: 3414 });
  assert.strictEqual(r.escapement["Igushik River"], undefined);
  assert.strictEqual(r.rejected.length, 0);
});
test("blank cells are placed by column position, not guessed", () => {
  const cell = (s, x, w = 10) => ({ s, x, w });
  const header = ["Drift", "Set", "Drift", "Set", "Sockeye", "Chinook", "Chum", "Pink", "Coho", "Total"].map((s, i) => cell(s, 100 + i * 40, 20));
  const pages = [[
    "Table 12.–Commercial salmon catch by species, in numbers of fish, Egegik District, Bristol Bay, 2023.",
    { text: "Date ...", cells: [cell("Date", 60), ...header] },
    { text: "6/12 24 24 2", cells: [cell("6/12", 60), cell("24", 105), cell("24", 145), cell("2", 185, 5)] },
    { text: "6/13 24 99", cells: [cell("6/13", 60), cell("24", 105), cell("99", 107)] },
  ]];
  const r = parseAmrPages(pages, 2023);
  assert.strictEqual(r.catch.egegik.length, 1);
  assert.strictEqual(r.catch.egegik[0].deliveriesDrift, 2);
  assert.strictEqual(r.catch.egegik[0].sockeye, null);
  assert.strictEqual(r.rejected.length, 1); // two values in one column
});

test("forecast table (old and new layout) and Nushagak sonar", () => {
  const r = parseAmrPages([
    [
      "Table 1.–Comparison of inshore sockeye salmon forecast versus actual run, escapement goals versus actual escapements,",
      "and projected versus actual commercial catch, by river system and district, in thousands of fish, Bristol Bay, 2017.",
      "Kvichak River 7,470 6,524 -13 2,000-10,000 3,163 3,470 3,361 -3",
      "Total 15,478 15,361 -1 3,120-12,320 7,105 8,293 8,256 0",
      "Egegik District 10,257 14,581 42 800-2,000 2,601 8,559 11,980 40",
      "26 Wood River 5,292 11,009 108 700-1,800 4,274 3,767 6,735 79",
      "Nushagak-Mulchatna 1,802 7,700 327 370-900 2,852 1,299 4,848 273",
      "Kulukak, Osviak, Matogak and Slug River systems in Togiak District.",
      "Total Bristol Bay 39,929 57,572 44 5,760-19,090 18,792 27,474 38,780 41",
    ],
    [
      "Table 7. –Daily and cumulative passage estimates by salmon species, Nushagak River sonar project,",
      "Bristol Bay, 2017.",
      "Sockeye Chinook Chum",
      "Date Daily Cumulative Daily Cumulative Daily Cumulative",
      "6/6 163 163 81 81 70 70",
    ],
  ], 2017);
  assert.deepStrictEqual(Object.keys(r.forecast.rivers), ["Kvichak River", "Egegik River", "Wood River", "Nushagak River"]);
  assert.strictEqual(r.forecast.rivers["Egegik River"].actual, 14581000);
  assert.strictEqual(r.forecast.total.forecast, 39929000);
  assert.deepStrictEqual(r.escapement["Nushagak River"], [{ date: "06-06-2017", daily: 163, cumulative: 163 }]);
  assert.strictEqual(r.rejected.length, 0);
});

console.log(`\n${passed} tests passed${process.exitCode ? ", SOME FAILED" : ""}`);
