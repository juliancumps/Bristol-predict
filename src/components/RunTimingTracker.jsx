import { useState, useEffect } from "react";
import axios from "axios";
import { getHistoricalData, formatNumber } from "../services/api";
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

  // Load historical data and analyze timing
  useEffect(() => {
    async function loadTimingData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch historical data
        const historicalData = await getHistoricalData(365);

        if (!historicalData || historicalData.length === 0) {
          setError("No historical data available");
          setLoading(false);
          return;
        }

        // Extract unique seasons from historical data
        const seasons = new Set();
        historicalData.forEach((day) => {
          if (day.season) {
            seasons.add(day.season);
          }
        });

        const sortedSeasons = Array.from(seasons).sort((a, b) => b - a);
        setAvailableSeasons(sortedSeasons);

        // Fetch actual season start dates for all seasons
        const startsMap = {};
        for (const season of sortedSeasons) {
          try {
            //const response = await axios.get(`http://localhost:3001/api/season/${season}/start`); //for local, defore railway deployment
            const response = await axios.get(`${API_BASE_URL}/season/${season}/start`);
            startsMap[season] = response.data.seasonStart;
          } catch (err) {
            console.warn(`Could not fetch start date for season ${season}:`, err);
            startsMap[season] = null;
          }
        }
        setSeasonStarts(startsMap);

        // Set default to most recent season
        if (sortedSeasons.length > 0) {
          setSelectedSeason(sortedSeasons[0]);
        }

        // Store all historical data so we can filter by season
        setTimingData({ allData: historicalData });
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
                <label>Select Season:</label>
                <div className="season-buttons">
                  {availableSeasons.map((season) => (
                    <button
                      key={season}
                      className={`season-btn ${selectedSeason === season ? 'active' : ''}`}
                      onClick={() => setSelectedSeason(season)}
                    >
                      {season}
                    </button>
                  ))}
                </div>
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

                {/* Information Section */}
                <div className="info-section">
                  <h3>📊 How to Use This Data</h3>
                  <div className="info-content">
                    <div className="info-item">
                      <span className="info-icon">🎣</span>
                      <p>
                        <strong>First Significant Fishing Day:</strong> When district-wide salmon catches typically reach
                        meaningful levels (over 20,00 fish per day)
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