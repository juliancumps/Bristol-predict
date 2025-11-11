import { useState, useEffect } from "react";
import { getDailySummary, formatNumber, formatDateForAPI, subtractDays } from "../services/api";
import "../styles/CatchEfficiencyScreen.css";

const DISTRICTS = {
  naknek: { name: "Naknek-Kvichak", color: "#3b82f6", icon: "🅝🅚" },
  egegik: { name: "Egegik", color: "#8b5cf6", icon: "🅔" },
  ugashik: { name: "Ugashik", color: "#ec4899", icon: "🅤" },
  nushagak: { name: "Nushagak", color: "#10b981", icon: "🅝" },
  togiak: { name: "Togiak", color: "#f59e0b", icon: "🅣" },
};

export default function CatchEfficiencyScreen({ onNavigateToRunTracker, onBack }) {
  const [pounds, setPounds] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [districtData, setDistrictData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Calculate user's sockeye count
  const userSockeyeCount =
    pounds && avgWeight ? Math.round(parseFloat(pounds) / parseFloat(avgWeight)) : null;

  // Load available dates on mount
useEffect(() => {
  async function loadAvailableDates() {
    try {
      const response = await fetch("http://localhost:3001/api/dates");
      const data = await response.json();

      // Sort dates: convert MM-DD-YYYY to sortable format, then sort descending (newest first)
const sortedDates = (data.dates || []).sort((a, b) => {
  const [monthA, dayA, yearA] = a.split('-').map(Number);
  const [monthB, dayB, yearB] = b.split('-').map(Number);
  
  const dateA = new Date(yearA, monthA - 1, dayA);
  const dateB = new Date(yearB, monthB - 1, dayB);
  
  return dateB - dateA; // Descending (newest first)
});

setAvailableDates(sortedDates);
      
      // Set default to LATEST date (first in array, since they're sorted descending)
      if (data.dates && data.dates.length > 0) {
        
        setSelectedDate(data.dates[0]);
      }
    } catch (err) {
      console.error("Error loading dates:", err);
    }
  }
  loadAvailableDates();
}, []);

  // Fetch district data when date changes
  useEffect(() => {
    async function fetchDistrictData() {
      try {
        setLoading(true);
        setError(null);

        const summary = await getDailySummary(selectedDate);
        console.log("Full summary:", summary);
        console.log("Districts:", summary.districts);
        
        if (!summary || !summary.districts) {
          setError("No data available for this date");
          setDistrictData({});
          return;
        }

        // Build district data with sockeye per delivery
        const districtMap = {};
        if (Array.isArray(summary.districts)) {
          summary.districts.forEach((district) => {
            districtMap[district.id] = {
              ...district,
              sockeyePerDelivery: summary.sockeyePerDelivery?.[district.id] || 0,
            };
          });
        }

        setDistrictData(districtMap);
      } catch (err) {
        console.error("Error fetching district data:", err);
        setError("Failed to load district data");
      } finally {
        setLoading(false);
      }
    }

    if (selectedDate) {
      fetchDistrictData();
    }
  }, [selectedDate]);

  const calculateComparison = () => {
    if (!userSockeyeCount) return null;

    const comparisons = [];
    let totalDistrictSockeye = 0;
    let districtCount = 0;

    Object.entries(districtData).forEach(([districtId, data]) => {
      const districtSockeye = data.sockeyePerDelivery || 0;
      if (districtSockeye > 0) {
        totalDistrictSockeye += districtSockeye;
        districtCount += 1;

        const difference = userSockeyeCount - districtSockeye;
        const percentDiff = ((difference / districtSockeye) * 100).toFixed(1);

        comparisons.push({
          districtId,
          districtName: DISTRICTS[districtId].name,
          districtColor: DISTRICTS[districtId].color,
          districtIcon: DISTRICTS[districtId].icon,
          districtSockeye,
          difference,
          percentDiff,
        });
      }
    });

    // Calculate bay average
    const bayAverage = districtCount > 0 ? (totalDistrictSockeye / districtCount).toFixed(1) : 0;

    // Sort by best performance vs your catch
    comparisons.sort((a, b) => b.difference - a.difference);

    return {
      bayAverage,
      comparisons,
    };
  };

  const comparison = calculateComparison();

  return (
    <div className="catch-efficiency-screen">
      {/* Header */}
      <div className="efficiency-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack} title="Back to Main View">
            ← Back
          </button>
          <h1>🎣 Catch Efficiency Analyzer</h1>
        </div>
        <div className="header-right">
          <button
            className="run-tracker-btn"
            onClick={onNavigateToRunTracker}
            title="View Run Timing Tracker"
          >
            📈 Run Timing Tracker
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="efficiency-content">
        {/* Left Panel - Input Form */}
        <div className="input-panel">
          <div className="input-section">
            <h3>📊 Your Delivery Data</h3>
            <p className="section-description">
              Enter your catch data to compare against bay-wide sockeye per delivery averages
            </p>

            <div className="form-group">
              <label htmlFor="pounds">Pounds Landed</label>
              <input
                id="pounds"
                type="number"
                placeholder="e.g., 5000"
                value={pounds}
                onChange={(e) => setPounds(e.target.value)}
                className="input-field"
              />
              <span className="input-unit">lbs</span>
            </div>

            <div className="form-group">
              <label htmlFor="avgWeight">Average Sockeye Weight</label>
              <input
                id="avgWeight"
                type="number"
                placeholder="e.g., 4.5"
                value={avgWeight}
                onChange={(e) => setAvgWeight(e.target.value)}
                step="0.1"
                className="input-field"
              />
              <span className="input-unit">lbs per fish</span>
            </div>

            <div className="form-group">
              <label htmlFor="selectedDate">Compare Against Date</label>
              <select
                id="selectedDate"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              >
                {availableDates.length > 0 ? (
  availableDates.map((date) => {
    // Parse MM-DD-YYYY format
    const [month, day, year] = date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return (
      <option key={date} value={date}>
        {dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </option>
    );
  })
                ) : (
                  <option>Loading dates...</option>
                )}
              </select>
            </div>

            {/* Display Calculated Sockeye Count */}
            {userSockeyeCount && (
              <div className="calculation-display">
                <div className="calc-label">Your Sockeye Per Delivery</div>
                <div className="calc-value">{userSockeyeCount}</div>
                <div className="calc-formula">
                  ({formatNumber(parseInt(pounds))} lbs ÷ {avgWeight} lbs/fish)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Comparisons */}
        <div className="comparison-panel">
          {error && <div className="error-message">⚠️ {error}</div>}

          {loading ? (
            <div className="loading-state">
              <p>Loading district data...</p>
            </div>
          ) : comparison ? (
            <>
              {/* Bay Average Card */}
              <div className="bay-average-card">
                <h3>🌊 Bay Average</h3>
                <div className="average-value">{comparison.bayAverage}</div>
                <div className="average-label">sockeye per delivery</div>
                {userSockeyeCount && (
                  <div className="average-vs-you">
                    {userSockeyeCount > comparison.bayAverage ? (
                      <span className="better">
                        ✅ You're {((userSockeyeCount - comparison.bayAverage) / comparison.bayAverage * 100).toFixed(0)}% above average
                      </span>
                    ) : (
                      <span className="worse">
                        ⚠️ You're {((comparison.bayAverage - userSockeyeCount) / comparison.bayAverage * 100).toFixed(0)}% below average
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* District Comparisons */}
              <div className="districts-comparison">
                <h3>📍 District Comparison</h3>
                <div className="comparison-list">
                  {comparison.comparisons.map((comp) => (
                    <div key={comp.districtId} className="comparison-item">
                      <div className="comparison-header">
                        <span className="district-icon">{comp.districtIcon}</span>
                        <span className="district-name">{comp.districtName}</span>
                        <span
                          className="district-badge"
                          style={{ backgroundColor: comp.districtColor }}
                        >
                          {comp.districtSockeye}
                        </span>
                      </div>

                      {userSockeyeCount && (
                        <div className="comparison-detail">
                          {comp.difference > 0 ? (
                            <span className="better-badge">
                              ✅ {comp.difference.toFixed(0)} better (+{comp.percentDiff}%)
                            </span>
                          ) : comp.difference < 0 ? (
                            <span className="worse-badge">
                              ⚠️ {Math.abs(comp.difference).toFixed(0)} worse ({comp.percentDiff}%)
                            </span>
                          ) : (
                            <span className="equal-badge">= Same as district avg</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>👈 Enter your catch data to see comparisons</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="efficiency-footer">
        <p className="footer-note">
          💡 <strong>Tip:</strong> Save your historical data to track your performance over the season.
          Login features coming soon!
        </p>
      </div>
    </div>
  );
}