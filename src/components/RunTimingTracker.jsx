import { useState, useEffect } from "react";
import { getHistoricalData, formatNumber } from "../services/api";
import "../styles/RunTimingTracker.css";


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
  const [selectedSeason, setSelectedSeason] = useState(new Date().getFullYear());
  const [availableSeasons, setAvailableSeasons] = useState([]);

  // Load historical data and analyze timing
  useEffect(() => {
    async function loadTimingData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch historical data for all available seasons
        const historicalData = await getHistoricalData(365);

        if (!historicalData || historicalData.length === 0) {
          setError("No historical data available");
          setLoading(false);
          return;
        }

        // Extract unique seasons from historical data
        const seasons = new Set();
        historicalData.forEach((day) => {
          if (day.runDate) {
            const year = new Date(day.runDate).getFullYear();
            seasons.add(year);
          }
        });

        const sortedSeasons = Array.from(seasons).sort((a, b) => b - a);
        setAvailableSeasons(sortedSeasons);

        // Analyze timing data
        const timingAnalysis = analyzeRunTiming(historicalData);
        setTimingData(timingAnalysis);
      } catch (err) {
        console.error("Error loading timing data:", err);
        setError("Failed to load timing data");
      } finally {
        setLoading(false);
      }
    }

    loadTimingData();
  }, []);

  const analyzeRunTiming = (historicalData) => {
    const timing = {};

    // Group data by district and date
    const districtDays = {
      naknek: [],
      egegik: [],
      ugashik: [],
      nushagak: [],
      togiak: [],
    };

    historicalData.forEach((day) => {
      if (!day.districts || !Array.isArray(day.districts)) return;

      day.districts.forEach((district) => {
        if (districtDays[district.id]) {
          districtDays[district.id].push({
            date: new Date(day.runDate),
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

      // Find first significant catch day (>100 fish)
      const firstSignificantDay = days.find((d) => d.catchDaily > 100);

      // Find peak catch day
      let peakDay = days[0];
      days.forEach((day) => {
        if (day.catchDaily > peakDay.catchDaily) {
          peakDay = day;
        }
      });

      // Calculate day of year for comparison
      const startOfYear = new Date(days[0].date.getFullYear(), 0, 1);
      const firstDayOfYear = Math.floor(
        (firstSignificantDay ? firstSignificantDay.date - startOfYear : days[0].date - startOfYear) /
          (1000 * 60 * 60 * 24)
      );
      const peakDayOfYear = Math.floor((peakDay.date - startOfYear) / (1000 * 60 * 60 * 24));

      timing[districtId] = {
        firstSignificantDay: firstSignificantDay ? firstSignificantDay.date : days[0].date,
        peakDay: peakDay.date,
        firstDayOfYear,
        peakDayOfYear,
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

  const getTimingDelta = (currentDate, historicalDate) => {
    if (!currentDate || !historicalDate) return 0;
    const diffTime = Math.abs(currentDate - historicalDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTimingStatus = (delta, direction) => {
    if (delta === 0) return "On Schedule";
    if (direction === "ahead") return `${delta} days ahead`;
    if (direction === "behind") return `${delta} days behind`;
    return "N/A";
  };

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
        ) : Object.keys(timingData).length > 0 ? (
          <>
            {/* Districts Timing Cards */}
            <div className="timing-grid">
              {Object.entries(DISTRICTS).map(([districtId, district]) => {
                const timing = timingData[districtId];

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
                          <div className="metric-label">First Significant Run</div>
                          <div className="metric-value">
                            {getDateString(timing.firstSignificantDay)}
                          </div>
                          <div className="metric-day-of-year">
                            Day {timing.firstDayOfYear} of season
                          </div>
                        </div>

                        <div className="timing-separator"></div>

                        <div className="timing-metric">
                          <div className="metric-label">Peak Catch Date</div>
                          <div className="metric-value">{getDateString(timing.peakDay)}</div>
                          <div className="metric-day-of-year">
                            Day {timing.peakDayOfYear} of season
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
                    <strong>First Significant Run:</strong> When salmon catches typically reach
                    meaningful levels (over 100 fish per day)
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
            <p>No historical timing data available</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="tracker-footer">
        <p className="footer-note">
          💡 <strong>Pro Tip:</strong> Compare these historical patterns with current season data to
          identify early or late runs. Use this to plan your fishing strategy.
        </p>
      </div>
    </div>
  );
}