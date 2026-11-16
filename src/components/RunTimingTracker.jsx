import { useState, useEffect } from "react";
import axios from "axios";
import { getAvailableDates, getSeasonDays, getHistoryCatch } from "../services/api";
import "../styles/RunTimingTracker.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api"; //for railway backend deployment

const DISTRICTS = {
  naknek: { name: "Naknek-Kvichak", color: "#3b82f6", icon: "🅝🅚" },
  egegik: { name: "Egegik", color: "#8b5cf6", icon: "🅔" },
  ugashik: { name: "Ugashik", color: "#ec4899", icon: "🅤" },
  nushagak: { name: "Nushagak", color: "#10b981", icon: "🅝" },
  togiak: { name: "Togiak", color: "#f59e0b", icon: "🅣" },
};

export default function RunTimingTracker({ onBack }) {
  const [timingData, setTimingData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [seasonStarts, setSeasonStarts] = useState({});
  // season -> "in-season" (ADF&G daily run summary) or "final" (ADF&G annual report)
  const [seasonSource, setSeasonSource] = useState({});
  const [historyUrls, setHistoryUrls] = useState({});

  // Load every season: in-season days from the database, older seasons from the annual reports.
  // Each season comes from one source only.
  useEffect(() => {
    async function loadTimingData() {
      try {
        setLoading(true);
        setError(null);

        const [datesInfo, history] = await Promise.all([
          getAvailableDates().catch(() => ({ seasons: [] })),
          getHistoryCatch().catch(() => ({ years: {} })),
        ]);
        const dbSeasons = (datesInfo.seasons || []).map(Number);
        const historySeasons = Object.keys(history.years || {}).map(Number).filter((y) => !dbSeasons.includes(y));

        const allData = [];
        const startsMap = {};
        const sources = {};
        const urls = {};

        // In-season seasons: one request per season (the server gives up to 90 days per season)
        const perSeason = await Promise.all(dbSeasons.map((season) => getSeasonDays(season).catch(() => [])));
        for (let i = 0; i < dbSeasons.length; i++) {
          const season = dbSeasons[i];
          sources[season] = "in-season";
          allData.push(...(perSeason[i] || []).map((d) => ({ ...d, season: d.season || season })));
          try {
            const response = await axios.get(`${API_BASE_URL}/season/${season}/start`);
            startsMap[season] = response.data.seasonStart;
          } catch {
            startsMap[season] = null;
          }
        }

        // Annual report seasons: rebuild the same day shape from the daily catch table
        for (const season of historySeasons) {
          const y = history.years[season];
          sources[season] = "final";
          urls[season] = y.source;
          const byDate = {};
          for (const id of Object.keys(DISTRICTS)) {
            for (const [md, sockeye] of y[id] || []) {
              const runDate = `${md}-${season}`;
              (byDate[runDate] ||= { runDate, season, districts: [] }).districts.push({ id, catchDaily: sockeye });
            }
          }
          const days = Object.values(byDate);
          allData.push(...days);
          const first = days.map((d) => d.runDate).sort()[0];
          startsMap[season] = first || null;
        }

        if (allData.length === 0) {
          setError("No historical data available");
          return;
        }

        const sortedSeasons = [...dbSeasons, ...historySeasons].sort((a, b) => b - a);
        setAvailableSeasons(sortedSeasons);
        setSeasonStarts(startsMap);
        setSeasonSource(sources);
        setHistoryUrls(urls);
        if (sortedSeasons.length > 0) setSelectedSeason(sortedSeasons[0]);
        setTimingData({ allData });
      } catch (err) {
        console.error("Error loading timing data:", err);
        setError("Failed to load timing data");
      } finally {
        setLoading(false);
      }
    }

    loadTimingData();
  }, []);

  const analyzeRunTiming = (historicalData, season, actualSeasonStart) => {
    const timing = {};

    // Parse the season start date if it's a string (MM-DD-YYYY format)
    let seasonStartDate = null;
    if (actualSeasonStart) {
      if (typeof actualSeasonStart === 'string') {
        const [month, day, year] = actualSeasonStart.split('-');
        seasonStartDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        seasonStartDate = new Date(actualSeasonStart);
      }
    }

    // Filter data for selected season only
    const seasonData = historicalData.filter((day) => day.season === season);

    // Group data by district and date
    const districtDays = {
      naknek: [],
      egegik: [],
      ugashik: [],
      nushagak: [],
      togiak: [],
    };

    seasonData.forEach((day) => {
      if (!day.districts || !Array.isArray(day.districts)) return;

      // Parse MM-DD-YYYY format
      const [month, dayStr, year] = day.runDate.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(dayStr));

      day.districts.forEach((district) => {
        if (districtDays[district.id]) {
          districtDays[district.id].push({
            date: dateObj,
            catchDaily: district.catchDaily || 0,
          });
        }
      });
    });

    // Calculate timing metrics for each district
    Object.entries(districtDays).forEach(([districtId, days]) => {
      if (days.length === 0) {
        timing[districtId] = null;
        return;
      }

      // Sort by date
      days.sort((a, b) => a.date - b.date);

      // Find first significant catch day (>20000 fish)
      const firstSignificantDay = days.find((d) => d.catchDaily > 20000);

      // Find peak catch day
      let peakDay = days[0];
      days.forEach((day) => {
        if (day.catchDaily > peakDay.catchDaily) {
          peakDay = day;
        }
      });

      // Calculate day of season from ACTUAL season start date
      let firstDayOfSeason = 0;
      let peakDayOfSeason = 0;
      
      if (seasonStartDate) {
        firstDayOfSeason = Math.floor(
          (firstSignificantDay ? firstSignificantDay.date - seasonStartDate : 0) /
              (1000 * 60 * 60 * 24)
        );
        peakDayOfSeason = Math.floor((peakDay.date - seasonStartDate) / (1000 * 60 * 60 * 24));
      } else {
        // Fallback: use first data point if season start is unavailable
        const fallbackStart = days[0].date;
        firstDayOfSeason = Math.floor(
          (firstSignificantDay ? firstSignificantDay.date - fallbackStart : 0) /
              (1000 * 60 * 60 * 24)
        );
        peakDayOfSeason = Math.floor((peakDay.date - fallbackStart) / (1000 * 60 * 60 * 24));
      }

      timing[districtId] = {
        firstSignificantDay: firstSignificantDay ? firstSignificantDay.date : days[0].date,
        peakDay: peakDay.date,
        firstDayOfSeason,
        peakDayOfSeason,
        totalDays: days.length,
      };
    });

    return timing;
  };

  const getDateString = (date) => {
    if (!date) return "N/A";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Get timing data for selected season
  const currentTimingData = selectedSeason && timingData.allData 
    ? analyzeRunTiming(timingData.allData, selectedSeason, seasonStarts[selectedSeason]) 
    : {};

  // Peak catch date of every season, for each district
  const allSeasonPeaks = timingData.allData
    ? availableSeasons.map((season) => ({
        season,
        source: seasonSource[season],
        timing: analyzeRunTiming(timingData.allData, season, seasonStarts[season]),
      }))
    : [];
  // Typical peak = the median day of the year over all seasons
  const dayOfYear = (date) => Math.round((Date.UTC(2001, date.getMonth(), date.getDate()) - Date.UTC(2001, 0, 1)) / 864e5);
  const typicalPeak = {};
  Object.keys(DISTRICTS).forEach((id) => {
    const days = allSeasonPeaks
      .map((r) => r.timing[id]?.peakDay)
      .filter(Boolean)
      .map(dayOfYear)
      .sort((a, b) => a - b);
    if (!days.length) return;
    const mid = Math.floor(days.length / 2);
    const median = days.length % 2 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);
    typicalPeak[id] = { date: new Date(2001, 0, 1 + median), count: days.length, early: days[0], late: days.at(-1) };
  });
  const doyLabel = (doy) => getDateString(new Date(2001, 0, 1 + doy));

  return (
    <div className="run-timing-tracker">
      {/* Header */}
      <div className="tracker-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack} title="Back to Catch Efficiency">
            ← Back
          </button>
          <h1>📈 Run Timing Tracker</h1>
        </div>
        <div className="header-info">
          <p>Historical vs. Current Season Timing</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="tracker-content">
        {error && <div className="error-message">⚠️ {error}</div>}

        {loading ? (
          <div className="loading-state">
            <p>Loading historical timing data...</p>
          </div>
        ) : (
          <>
            {/* Season Selector */}
            {availableSeasons.length > 0 && (
              <div className="season-selector">
                <label htmlFor="timing-season">Select Season:</label>
                <select
                  id="timing-season"
                  className="season-select"
                  value={selectedSeason ?? ""}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                >
                  {availableSeasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                      {seasonSource[season] === "final" ? " · annual report" : ""}
                    </option>
                  ))}
                </select>
                <span className="season-source">
                  {seasonSource[selectedSeason] === "final" ? (
                    <>
                      Final numbers ·{" "}
                      <a href={historyUrls[selectedSeason]} target="_blank" rel="noreferrer">ADF&G annual report ↗</a>
                    </>
                  ) : (
                    "ADF&G daily run summary"
                  )}
                </span>
              </div>
            )}

            {Object.keys(currentTimingData).length > 0 ? (
              <>
                {/* Districts Timing Cards */}
                <div className="timing-grid">
                  {Object.entries(DISTRICTS).map(([districtId, district]) => {
                    const timing = currentTimingData[districtId];

                    return (
                      <div
                        key={districtId}
                        className="timing-card"
                        style={{ borderLeftColor: district.color }}
                      >
                        <div className="card-header">
                          <span className="district-icon">{district.icon}</span>
                          <span className="district-name">{district.name}</span>
                        </div>

                        {timing ? (
                          <div className="card-content">
                            <div className="timing-metric">
                              <div className="metric-label">First Significant Fishing Day</div>
                              <div className="metric-value">
                                {getDateString(timing.firstSignificantDay)}
                              </div>
                              <div className="metric-day-of-year">
                                Day {timing.firstDayOfSeason} of season
                              </div>
                            </div>

                            <div className="timing-separator"></div>

                            <div className="timing-metric">
                              <div className="metric-label">Peak Catch Date</div>
                              <div className="metric-value">{getDateString(timing.peakDay)}</div>
                              <div className="metric-day-of-year">
                                Day {timing.peakDayOfSeason} of season
                              </div>
                            </div>

                            <div className="timing-separator"></div>

                            <div className="timing-metric">
                              <div className="metric-label">Run Duration</div>
                              <div className="metric-value">{timing.totalDays} days</div>
                              <div className="metric-day-of-year">
                                Historical average span
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="card-placeholder">
                            <p>No timing data available</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Peak date in every season */}
                {allSeasonPeaks.length > 1 && (
                  <div className="peak-history">
                    <h3>📅 Peak catch date in each season</h3>
                    <div className="peak-table-wrap">
                      <table className="peak-table">
                        <thead>
                          <tr>
                            <th>Season</th>
                            {Object.entries(DISTRICTS).map(([id, d]) => (
                              <th key={id} style={{ borderBottomColor: d.color }}>{d.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="peak-typical">
                            <td>Typical</td>
                            {Object.keys(DISTRICTS).map((id) => (
                              <td key={id}>
                                {typicalPeak[id] ? (
                                  <>
                                    <strong>{getDateString(typicalPeak[id].date)}</strong>
                                    <div className="peak-range">
                                      {doyLabel(typicalPeak[id].early)}–{doyLabel(typicalPeak[id].late)}
                                    </div>
                                  </>
                                ) : (
                                  "–"
                                )}
                              </td>
                            ))}
                          </tr>
                          {allSeasonPeaks.map((row) => (
                            <tr key={row.season} className={row.season === selectedSeason ? "active" : ""}>
                              <td>
                                {row.season}
                                {row.source === "final" && <span className="peak-src"> report</span>}
                              </td>
                              {Object.keys(DISTRICTS).map((id) => (
                                <td key={id}>{row.timing[id] ? getDateString(row.timing[id].peakDay) : "–"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="peak-note">
                      Typical = the middle peak date of all {allSeasonPeaks.length} seasons; below it, the earliest and
                      latest peak. Seasons marked "report" use the final ADF&G annual report; the others use the ADF&G
                      daily run summary.
                    </p>
                  </div>
                )}

                {/* Information Section */}
                <div className="info-section">
                  <h3>📊 How to Use This Data</h3>
                  <div className="info-content">
                    <div className="info-item">
                      <span className="info-icon">🎣</span>
                      <p>
                        <strong>First Significant Fishing Day:</strong> When district-wide salmon catches typically reach
                        meaningful levels (over 20,000 fish per day)
                      </p>
                    </div>
                    <div className="info-item">
                      <span className="info-icon">📈</span>
                      <p>
                        <strong>Peak Catch Date:</strong> The typical date when each district sees its
                        highest daily catch volumes
                      </p>
                    </div>
                    <div className="info-item">
                      <span className="info-icon">⏱️</span>
                      <p>
                        <strong>Run Duration:</strong> How many days the fishing season typically lasts
                        in each district
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No timing data available for selected season</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="tracker-footer">
        <p className="footer-note">
          💡 <strong>Tip:</strong> Compare these historical patterns with current season data to
          identify early or late runs.
        </p>
      </div>
    </div>
  );
}