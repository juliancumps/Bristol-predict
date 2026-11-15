# Bristol Predict V4 - plan for the remaining features

This file is for the implementer (Claude Opus). Part 1 of V4 is in the working tree. This plan covers the features that are not done.

## 0. Rules for all work

- **No cost.** Free data sources only. No paid API, no paid hosting, no new paid service.
- **Do not send false information.** Each number on the screen shows its source and its time. If a parser is not sure, show the original text and a "Check source" tag. Do not guess.
- **No push notifications.** The owner does not want them.
- **Style.** New screens follow `public/about.html`: midnight blue, Crimson Text titles, Inter body text, blue / gold / coral accents. Use the classes in `src/styles/V4Tools.css` (`v4-card`, `v4-grid`, `v4-pill`, `v4-chip`, `v4-notice`, `v4-section-title`, `v4-goalbar`). Wrap each screen in `tools-hub-container` + `tools-hub-background` + `tools-hub-content v4-content`, as `OpeningsBoard.jsx` does.
- **Phone first.** Write CSS for a 390 px screen first, then add `@media (min-width: 700px)`. Tap targets are 44 px high. Form fields use 16 px text (smaller text makes iPhone Safari zoom).
- **Ask the owner all questions before you change code.** Do not write more than one summary `.md` file.
- **Keep the old screens.** Add new tools as cards in `src/components/ToolsHub.jsx` and as views in `src/App.jsx` (`VIEWS` array + one render line).
- **Revert point.** The git tag `v3-before-v4` is the version before V4.

## 1. What exists now (read this before you start)

### Backend (`backend/`, Node + Express + SQLite, CommonJS)

| File | Purpose |
|---|---|
| `src/scrapers/harvestScraper.js` | ADF&G run summary. One HTTP POST (`dateDropdown=MM-DD-YYYY`). `parseHarvestHtml(html)` is pure. Returns `{runDate, season, totalRun, districts[], rivers[], sockeyePerDelivery{}, registrations}`. `registrations` is the raw in-season table `{headers, rows}` or `null`. |
| `src/scrapers/announcements.js` | Reads `ul#newsList` on the ADF&G salmon page, downloads each PDF (`pdf-parse`), and `parseAnnouncement(text, meta)` returns `{id, title, url, kind, issued, number, emergencyOrders, events[], registrations[], text}`. `kind` is `eastside`, `westside`, `portmoller`, `forecast`, `outlook`, `summary` or `other`. |
| `src/openingsStatus.js` | `computeStatus(items, asOf)` for the status board. `registrationSeries(items)` for boat counts. `alaskaNow()`. |
| `src/store.js` | JSON files: `data/announcements/<year>.json`, `data/reference/<name>.json`. |
| `src/jobs/update.js` | The scheduled job. `updateRunSummary()` and `updateAnnouncements()`. Add new data steps here. |
| `src/backfill.js` | `npm run backfill`, `npm run backfill:rivers`. |
| `src/database.js` | SQLite tables `daily_summaries`, `district_data`, `river_data`, `sockeye_per_delivery`. **`run_date` is `MM-DD-YYYY` text. Always sort with the exported `DATE_SORT` expression.** |
| `src/server.js` | API. V4 endpoints: `/api/openings?asOf=`, `/api/announcements?year=&kind=&full=`, `/api/announcements/:id`, `/api/registrations?year=`, `/api/escapement?season=`, `/api/forecasts`. `requireAdmin` protects `/api/refresh`. |
| `test/parsers.test.js` | `npm test`. No network. Fixtures are real 2026 ADF&G text. Add a test for each new parser. |
| `data/reference/escapement_goals.json`, `forecasts.json` | Goals; forecasts for 2025, 2026, 2027. |

### Frontend (`src/`, React + Vite, ES modules)

- `src/services/api.js`: all API calls. Alaska-time helpers `formatAkTime()` and `durationBetween()`. The backend sends Alaska time as `YYYY-MM-DDTHH:MM` with no zone; the helpers read and print it as UTC so the phone's zone does not change it.
- `src/components/OpeningsBoard.jsx`, `EscapementTracker.jsx`: the two V4 screens. Use them as the pattern.
- `src/App.jsx`: `?view=<name>` opens a view directly and skips the splash.

### Scheduling and hosting

- `.github/workflows/update-data.yml` runs `npm run update` on GitHub Actions and commits `backend/data/bristol_bay.db` and `backend/data/announcements`. Railway redeploys the backend on each push. Vercel hosts the frontend (`vercel.json` skips builds for data-only commits).
- **If you add a new data folder or file, add it to the `git add` line in the workflow.**
- The workflow file is a protected path for remote tools. If you change it, give the owner the new file to copy.

### Network limits in the Claude workspace

The workspace shell cannot reach `adfg.alaska.gov` or `bbsri.org`. The owner's built-in browser can. To look at a source page or PDF, use the browser pane (`fetch` in the page; for PDF text, import pdf.js from cdnjs in the page). To run the scrapers for real, ask the owner to run the command, or use the GitHub workflow.

### Check these first (not confirmed at the time of writing)

1. The owner ran `npm run backfill` and `npm run update` without errors. If not, fix that first.
2. `backend/data/announcements/2026.json` exists and has about 95 items.
3. `river_data` has rows (`SELECT COUNT(*) FROM river_data`).
4. Railway redeploys on push, and the live API returns `/api/escapement` with rivers.

---

## 2. Feature A - Port Moller tab

**Goal:** see what is coming 6 to 9 days before the fish arrive in the districts.

### Sources (both checked on 2026-11-15)

**A1. Stock composition - ADF&G PDFs. Already downloaded.**
The announcements job saves them with `kind: "portmoller"`. Title example: `Port Moller Sockeye Salmon Stock Composition Summary July 2-3, 2026 – All Stations`. The text has one table:

```
A total of 214 fish were sampled and 190 were analyzed (188 had adequate data ...
Reporting Group Estimate Lower Upper
North Peninsula 3.9% 0.2% 9.8%
Ugashik 1.3% 0.0% 7.7%
Egegik 31.3% 23.3% 39.1%
Naknek 13.7% 7.6% 20.5%
Alagnak 3.2% 0.0% 10.6%
Kvichak 22.3% 15.7% 29.8%
Nushagak 8.4% 2.9% 14.4%
Wood 11.7% 6.3% 17.2%
Igushik 1.7% 0.0% 6.2%
Togiak 0.3% 0.0% 2.0%
Kuskokwim 2.2% 0.0% 5.9%
```

Warnings:
- The header text of these PDFs has broken spacing (`Ju ly 4 , 20 2 6`). Do not read the sample dates from the header. Read them from the list **title** (`July 2-3, 2026`, also `June 30-July 1, 2026`).
- `announcements.js` cuts the saved text of non-fishery kinds at 4,000 characters and starts it at "This is the Alaska Department". The table is inside that range. Confirm this on a saved item.
- Some PDFs can have more than one table (for example by station group). Parse all tables; keep the "All Stations" one as the main one.

**A2. Daily catch index - BBSRI PDFs.**
Page: `https://www.bbsri.org/inseason-data` (current season; archived seasons at `/2025-inseason-data`). The server HTML contains the links (plain `axios.get` works; the page is about 1.2 MB). Links have the text `Catch Update #25` and an `href` like `/_files/ugd/bc10d6_<hash>.pdf`. The date (`July 4, 2026`) is page text near the link, and it is also the second line of the PDF. PDF text:

```
Port Moller Test Fish Catch Update
Catch Update #25, July 4, 2026
...
Index by Station
S2: Not fished
S4: 11
S6: 333
...
S24: 0
Daily Catch Index = 39
```

- The same page lists the stock composition files by BBSRI (`July 2-3, 2026`), and a `PMTF Preseason Update`. Use A1 for stock composition, not these.
- Each catch update PDF has three links at the top: `1—PMTF Catch Update Table`, `2—PMTF Raw Data`, `3—C+E by District and Day for 2011-2026`. **Find where link 3 goes** (read the PDF link annotations, or open the PDF in the browser). If it is a public spreadsheet of catch and escapement by district and day for 2011-2026, it is a much easier history source than Feature C. Tell the owner what you find before you build Feature C.
- BBSRI says the data is preliminary and that the website can be late. Show that on the screen.

### Backend

1. New file `src/scrapers/portMoller.js`:
   - `parseStockComposition(text, title)` -> `{ periodStart, periodEnd, sampled, analyzed, groups: [{ group, estimate, lower, upper }] }` (percent as numbers). Pure function.
   - `listCatchUpdates(html)` -> `[{ number, url, dateText }]`. Pure function.
   - `parseCatchUpdate(text)` -> `{ number, date: "YYYY-MM-DD", stations: { S2: null, S4: 11, ... }, dailyIndex }`. `"Not fished"` -> `null`. Pure function.
   - `fetchCatchUpdates(knownNumbers)` downloads only new PDFs, with a 1.5 s delay between requests.
2. Storage: `data/portmoller/<year>.json`: `{ year, checkedAt, updatedAt, catchUpdates: [...], stockComposition: [...] }`. Add helpers in `store.js`. Stock composition comes from the saved announcements (no second download): map `items.filter(kind === "portmoller")` through `parseStockComposition`.
3. `jobs/update.js`: add `updatePortMoller()`. Run it only from June 5 to July 20 (the test fishery runs about June 10 to July 15). Add `data/portmoller` to the workflow `git add` line.
4. `server.js`: `GET /api/portmoller?year=` returns the file plus two computed fields:
   - `cumulativeIndex` per day.
   - `arrival`: for each sample period, `{ from: periodStart + 6 days, to: periodEnd + 9 days }`.
5. Map reporting groups to districts: Naknek + Alagnak + Kvichak -> `naknek`; Egegik -> `egegik`; Ugashik -> `ugashik`; Nushagak + Wood + Igushik -> `nushagak`; Togiak -> `togiak`; North Peninsula and Kuskokwim -> `other`.
6. Tests: add the two text samples above as fixtures.

### Frontend - `src/components/PortMoller.jsx` (`?view=portmoller`)

- Top: latest daily index, its date, and "data as of". A notice: "Preliminary data from BBSRI and ADF&G."
- Chart 1 (Recharts `ComposedChart`): bars = daily index, line = cumulative index. A season selector as chips.
- Chart 2: stock composition for the selected sample period, summed by district, as horizontal bars in the district colors, with the 90% interval as text. Chips to choose the period; default = latest.
- "Arrival window" card for each district: "Fish sampled July 2-3 arrive about July 8-12. Egegik share 31%."
- Link to each source PDF.
- Do not make a number that claims to predict catch. Show the index and the shares only.

### Done when

- `npm test` passes with the new fixtures.
- After `npm run update` in season (or after a manual run against 2026), `/api/portmoller?year=2026` returns about 32 catch updates and about 12 stock compositions.
- The screen works at 390 px.

---

## 3. Feature B - Catch log

**Goal:** save each delivery, and compare it with the district average. The owner is not sure that he will use it, so keep it small.

**Privacy decision (owner agreed to "what is easier, but private"):** the data stays in the browser on the owner's device. It is never sent to the server. This is free, needs no login, and no person can read the numbers on the internet.

### Design

1. `src/services/catchLog.js`:
   - Storage: `localStorage` key `bp.catchLog.v1` = JSON array. Wrap reads and writes in `try/catch`.
   - Entry: `{ id, date: "MM-DD-YYYY", district, pounds, avgWeight, pricePerLb, sets, tide, notes, createdAt }`. `sockeye = Math.round(pounds / avgWeight)`.
   - Functions: `listEntries()`, `addEntry()`, `updateEntry()`, `deleteEntry()`, `exportJson()`, `importJson(text)` (merge by `id`), `exportCsv()`.
2. Extend `CatchEfficiencyScreen.jsx` (do not make a new screen): 
   - Add a district selector and optional fields (price, sets, tide, notes) below the existing inputs.
   - Add a "Save to my log" button next to the result.
   - Add a "My log" section: season totals (pounds, fish, value, deliveries), then a list of entries, newest first. Each row shows the fish count and the difference from the district `sockeyePerDelivery` for that date (from `getDailySummary(date)`), with edit and delete.
   - Add "Export backup" and "Import backup" buttons, and this note: "The log is saved only in this browser. Export a backup before you clear the browser data or change phones."
3. iPhone note for the owner: a home-screen app and Safari have separate storage. Use one of them, always the same one.
4. Optional later step (only if the owner asks): sync between devices with a password. Do not build it now.

### Done when

- Add, edit, delete, export and import work on a phone-size screen.
- A page reload keeps the entries.
- No network request contains log data (check the Network tab).

---

## 4. Feature C - History before 2023 (daily catch, escapement, boats)

**Goal:** more seasons for comparisons ("what a normal July 3 looks like") and for boat counts by day.

**First do the check in Feature A2** (link 3 in the BBSRI catch update: "C+E by District and Day for 2011-2026"). If that is a usable public table, load it and skip most of the PDF work below; you then need the PDFs only for boat registration.

### Source - ADF&G Annual Management Reports (AMR)

Links are on the ADF&G Bristol Bay salmon page, for 2012 to 2025, in the form `https://www.adfg.alaska.gov/FedAidPDFs/FMR24-11.pdf`:

| Season | File | Season | File |
|---|---|---|---|
| 2025 | FMR26-08 | 2018 | FMR19-12 |
| 2024 | FMR25-17 | 2017 | FMR18-11 |
| 2023 | FMR24-11 | 2016 | FMR17-27 |
| 2022 | FMR23-08 | 2015 | FMR16-13 |
| 2021 | FMR22-14 | 2014 | FMR15-24 |
| 2020 | FMR21-16 | 2013 | FMR14-23 |
| 2019 | FMR21-04 | 2012 | FMR13-20 |

The PDFs have a text layer (no OCR is necessary). Checked in the 2023 report (97 pages):

```
Table 9.–Commercial salmon catch by date and species, in numbers of fish, Naknek-Kvichak District, Bristol Bay, 2023.
 Hours fished  Deliveries
 Date  Drift  Set  Drift  Set  Sockeye  Chinook  Chum  Pink  Coho  Total
 6/19  15  15  13  11  2,557  3  17  0  0  2,577
 6/25  0  0  –  –  –  –  –  –  –  –
 6/16 a 9 9 1 0 – – – – – –          <- a footnote letter can stand after the date
Table 9.–Page 2 of 2.

Table 10.–Daily district registration of drift gillnet permit holders and dual vessel registration, by district, Bristol Bay, 2023.
 Naknek-Kvichak  Egegik  Ugashik  Nushagak  Togiak a  Total b
 Date  total  dual  total  dual  total  dual  total  dual  total
 6/2  3  0  8  1  0  0  1  0  0  12
```

Other tables in the same report: Table 7 (Nushagak sonar daily passage), Table 8 (daily tower counts by river, eastside), Table 12 and later (catch by date for Egegik, Ugashik, Nushagak, Togiak), Table 1 (escapement goals), Table 3 (forecast).

**Table numbers change from year to year. Find tables by their title text, not by number:**
- `/Commercial salmon catch by date and species.*?(Naknek-Kvichak|Egegik|Ugashik|Nushagak|Togiak) District/`
- `/Daily district registration of drift gillnet permit holders/`
- `/Daily sockeye salmon escapement tower counts/`

### Method

1. This is a one-time job on the owner's computer (the workspace cannot reach ADF&G). Write `backend/src/history/importAmr.js` in Node with `pdf-parse` (already installed; require `pdf-parse/lib/pdf-parse.js`). Use the `pagerender` option to get the text page by page.
2. Command: `node src/history/importAmr.js 2023` downloads the PDF to `backend/data/history/pdf/` (add this folder to `.gitignore`), parses it, and writes `backend/data/history/<year>.json`:
   ```json
   { "year": 2023, "source": "https://www.adfg.alaska.gov/FedAidPDFs/FMR24-11.pdf",
     "catch": { "naknek": [ { "date": "06-19-2023", "hoursDrift": 15, "hoursSet": 15,
        "deliveriesDrift": 13, "deliveriesSet": 11, "sockeye": 2557, "chinook": 3, "total": 2577 } ] },
     "registration": [ { "date": "06-02-2023", "naknek": 3, "naknekDual": 0, "egegik": 8, "egegikDual": 1,
        "ugashik": 0, "ugashikDual": 0, "nushagak": 1, "nushagakDual": 0, "togiak": 0, "total": 12 } ],
     "escapement": { "Kvichak River": [ { "date": "06-25-2023", "daily": 1234 } ] } }
   ```
   `–` means "no data": save `null`, not `0`.
3. Row parser: split a line on spaces, drop a single footnote letter after the date, remove commas, then check the count of numbers against the header. If a row does not fit, write it to a `rejected` list with the page number. Do not guess.
4. **Check step (required).** For 2023, 2024 and 2025 the database has ADF&G in-season numbers. Compare the AMR daily sockeye sum per district with `district_data.catch_daily`. They do not match exactly (the AMR is the final count), but they must be near (within about 10% for the season total). Print a report. Also check that each season total is near the total in the report text. Show the report to the owner before you load more years.
5. Start with 2023 only. Then 2019-2022. Then 2012-2018. Old reports can have a different layout; stop and report if a year fails.
6. Keep history in the JSON files. Do **not** put it into `daily_summaries`: the existing screens assume the ADF&G in-season format, and mixed sources there will confuse the charts.
7. `server.js`: `GET /api/history/:year` returns the file; `GET /api/history` returns the list of years.
8. What history does not have: sockeye per delivery by district as ADF&G gives it in season. You can compute `sockeye / (deliveriesDrift + deliveriesSet)`, but this mixes drift and set, so label it "fish per delivery (all gear)" and do not compare it directly with the in-season drift number.

### Done when

- 2023 passes the check step.
- The owner approved the report.
- At least 2019-2025 are loaded and committed (`data/history/*.json`, small text files).

---

## 5. Feature D - Boat counts and catch per boat

**Sources**

1. In season, from announcements (works now): `registrationSeries()` and `/api/registrations?year=`. Westside gives vessels and permits for Nushagak. Eastside gives vessels and "in 48 hours" for one district per announcement. These are not daily.
2. In season, daily: the ADF&G run summary page has a "Registrations" section in season (off season it says "Registrations are no longer required for 2026"). The scraper saves the raw table in `data.registrations`. **In June 2027, look at the first saved table**, then write a parser that turns it into `{ district, permits, vessels, dBoats, in48h }`, and add a SQLite table `registrations(run_date, district_id, permits, vessels, d_boats, vessels_48h)`. Registration ends about July 17 each year.
3. History: Feature C `registration` (permit registrations per district per day, with dual counts). Note that AMR "total" counts permit holders and "dual" counts dual registrations; vessels are about `total - dual / 2`. Label the unit on the chart.

**Screen:** add a "Fleet" section to `OpeningsBoard.jsx`, or a new `FleetTracker.jsx` if it grows:
- Line chart, one line per district, boats by date, season selector.
- Table for the latest day: boats, share of the fleet, change from the day before, the 48-hour number.
- "Catch per boat" = district `catchDaily` / boats on that date. Show it as a bar chart by district for the selected date, and as a line by date. Label it "estimate": not all registered boats fish each day, and catch includes set net fish. Where the drift share is known (announcements say "73.6% drift"), you can use it; if not, say so.

---

## 6. Feature E - Daily briefing screen

**Goal:** one phone screen for the morning check. It replaces push alerts.

Build this after A and D. `src/components/DailyBriefing.jsx` (`?view=briefing`), first card in ToolsHub. One backend endpoint keeps it fast on a weak signal:

`GET /api/briefing?asOf=` returns
```json
{ "asOf": "...", "status": { ...computeStatus districts, drift only... },
  "latestRun": { "runDate": "...", "districts": [...], "totalRun": {...} },
  "forecast": { ...this season... },
  "escapementAlerts": [ { "river": "...", "state": "below|within|above", "cumulative": 0 } ],
  "portMoller": { "date": "...", "dailyIndex": 0, "cumulativeIndex": 0 },
  "fleet": [ ... latest count per district ... ],
  "freshness": { "runSummary": "...", "announcements": "...", "portMoller": "..." } }
```

Screen order, top to bottom:
1. Freshness line: "Run summary: Jul 3 · Announcements read 14 min ago". If a source is older than expected in season (run summary > 36 h, announcements > 2 h), show it in the warning color.
2. District status strip: five rows, drift only: OPEN until / CLOSED, next opening. Tap opens the Openings screen.
3. Yesterday by district: catch, sockeye per delivery, boats, catch per boat. Sort by sockeye per delivery. Mark the owner's home district (Nushagak) first.
4. Run against forecast: one bar for the bay, small bars for districts.
5. Port Moller: latest index and the arrival window.
6. Weather and tide: link to the existing Weather Dashboard (do not copy its code).

Add a setting (saved in `localStorage`) to open the app on the briefing screen. Suggest to the owner that the phone home-screen icon uses `/?view=briefing`.

---

## 7. Feature F - Offline mode (installable PWA)

**Goal:** the app opens with the last data when the signal is weak.

1. Use `vite-plugin-pwa` (free, dev dependency). In `vite.config.js` add `VitePWA({ registerType: "autoUpdate", manifest: false, workbox: { ... } })`. Keep the existing `public/manifest.json`; fix it: add a 512 px icon (ask the owner for the image or scale `icon-192.png`), set `theme_color` and `background_color` to `#0a1428`, set `start_url` to `/?view=map` (or the briefing).
2. Workbox runtime caching:
   - App files: precache (default).
   - `GET <API>/api/*`: `NetworkFirst`, `networkTimeoutSeconds: 4`, cache name `api`, max 200 entries, max age 14 days. So the last answer shows when the network fails.
   - Google Fonts: `StaleWhileRevalidate`.
   - Map tiles (`server.arcgisonline.com`): `CacheFirst`, max 500 entries, 30 days.
   - Do not cache POST requests. Do not cache `windy.com` embeds.
3. The API is on another origin (Railway). Cached cross-origin answers work only with CORS answers, which the backend already sends. Test this on the deployed site, not only on localhost.
4. Offline banner: a small component in `App.jsx` that listens to `online` / `offline` events and shows "Offline - showing saved data". Each V4 screen already shows its data time; add the same to the map screen ("Data for Jul 3, saved ...").
5. iPhone: the owner installs with Safari > Share > Add to Home Screen. `index.html` already has the Apple meta tags.
6. Risk: a service worker can serve an old app version. `registerType: "autoUpdate"` plus `workbox.cleanupOutdatedCaches: true` handles this. Tell the owner: if the app looks old, close it fully and open it again.

### Done when

- Lighthouse (Chrome DevTools) reports the app as installable.
- With the network off in DevTools, a reload shows the last map data and the last openings board, with the offline banner.

---

## 8. Smaller items (do after A-F, or when the owner asks)

- **"What you should be catching":** needs Feature C. For a date and district, show the median and the range of fish per delivery on the same day-of-season in past years. Statistics only; no machine learning.
- **Run progress:** needs Feature C. Percent of the run complete by date from the mean cumulative curve of past seasons, with the range (early / late years).
- **Season summary page:** parse the ADF&G season summary PDF (`kind: "summary"`, already downloaded) for the total run, harvest and price; one card per year.
- **Forecasts for 2023 and 2024:** PDFs `1443765652.pdf` and `1547483758.pdf` under `https://www.adfg.alaska.gov/static/applications/dcfnewsrelease/`. Table 2 has the same layout as the years in `forecasts.json`. Add them by hand.
- **Expert feed:** links to UW FRI in-season reports. Find the source page first; none is confirmed.
- **Cleanup:** remove the debug `console.log` calls in the render of `BristolBayMap.jsx`; delete the unused `backend/.puppeteerrc.cjs`, `backend/src/scrapers/cleanNovemberData.js` and `backend/src/db/schema.sql` (ask the owner first).

## 9. Suggested order

1. Checks in section 1.
2. Feature A (Port Moller) - also answers the history question in A2.
3. Feature D with the data that exists now (announcement boat counts).
4. Feature E (briefing).
5. Feature F (offline).
6. Feature B (catch log).
7. Feature C (history), then the items in section 8 that need it.
8. June 2027, first week of the season: check the live run summary "Registrations" table, the first 2027 announcements against the status board, and that the scheduled job commits data.
