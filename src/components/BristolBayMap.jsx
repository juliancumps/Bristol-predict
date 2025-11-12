import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DatePicker from "./DatePicker";
import DistrictStats from "./DistrictStats"; 

import "../styles/BristolBayMap.css";
import {
  LineChart_DayToDayComparison,
  BarChart_DistrictComparison,
  PieChart_CatchDistribution,
  LineChart_MultiDistrict,
  LineChart_MultiDistrict_SockeyePerDelivery,
  LineChart_DateRange,
} from "./Charts";
import {
  getDistricts,
  getDailySummary,
  getDistrict,
  formatNumber,
  calculatePercentage,
  getDateRangeData,
  getHistoricalData,
  aggregateDateRangeData,
  formatDateForAPI,
  subtractDays,
  getDistrictRivers,
  getRiverDistrict,
  RIVER_DISTRICT_MAP,
} from "../services/api";


// Fix for default marker icons in React-Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Bristol Bay fishing districts
const DISTRICTS = {
  naknek: {
    name: "Naknek-Kvichak",
    center: [58.74, -157.2955],
    color: "#3b82f6",
    icon: "🅝🅚",
  },
  egegik: {
    name: "Egegik",
    center: [58.222, -157.525],
    color: "#8b5cf6",
    icon: "🅔",
  },
  ugashik: {
    name: "Ugashik",
    center: [57.6, -157.75],
    color: "#ec4899",
    icon: "🅤",
  },
  nushagak: {
    name: "Nushagak",
    center: [58.72, -158.54],
    color: "#10b981",
    icon: "🅝",
  },
  togiak: {
    name: "Togiak",
    center: [58.83, -160.45],
    color: "#f59e0b",
    icon: "🅣",
  },
};

const districtStyle = (feature) => ({
  fillColor: "transparent",
  weight: 3,
  opacity: 1,
  color: "#fbbf24",
  dashArray: "10, 10",
  fillOpacity: 0.1,
});

const sectionStyle = (feature) => ({
  fillColor: "transparent",
  weight: 1,
  opacity: 0.6,
  color: "#60a5fa",
  dashArray: "5, 5",
  fillOpacity: 0.05,
});

const createCustomIcon = (color, emoji) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: ${color};
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

function MapController({ selectedDistrict }) {
  const map = useMap();
  if (selectedDistrict) {
    const district = DISTRICTS[selectedDistrict];
    map.flyTo(district.center, 10, { duration: 1.5 });
  }
  return null;
}

function GeoJSONLayers() {
  const [districts, setDistricts] = useState(null);
  const [sections, setSections] = useState(null);

  useEffect(() => {
    fetch("/geojson/Commercial_Fisheries_Bristol_Bay_Salmon_Districts.geojson")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setDistricts(data))
      .catch((err) => console.log("Districts GeoJSON not found (optional):", err.message));

    fetch("/geojson/Commercial_Fisheries_Bristol_Bay_Salmon_Sections.geojson")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setSections(data))
      .catch((err) => console.log("Sections GeoJSON not found (optional):", err.message));
      
  }, []);

  if (!sections && !districts) return null;

  return (
    <>
      {sections && (
        <GeoJSON
          data={sections}
          style={sectionStyle}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.name) {
              layer.bindTooltip(feature.properties.name, {
                permanent: false,
                direction: "center",
                className: "section-label",
              });
            }
          }}
        />
      )}
      {districts && (
        <GeoJSON
          data={districts}
          style={districtStyle}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.name) {
              layer.bindPopup(`<strong>${feature.properties.name}</strong>`);
            }
          }}
        />
      )}
    </>
  );
}

// Helper function to check if a value is effectively zero
  const isZeroOrMissing = (value) => {
    return value === 0 || value === "0" || !value || value === null || value === undefined;
  };

export default function BristolBayMap({ onNavigateToCatchEfficiency}) {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [districtData, setDistrictData] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const [selectedSeason, setSelectedSeason] = useState(null);

  
  // Date range support
  const [dateRangeMode, setDateRangeMode] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [rangeData, setRangeData] = useState(null);
  const [rangeDataRaw, setRangeDataRaw] = useState(null);
  
  // Historical data for charts
  const [historicalData, setHistoricalData] = useState([]);
  const [chartMode, setChartMode] = useState("single");

  // Rivers data
  const [riversData, setRiversData] = useState([]);
  
  // Sidebar popup state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bristolBayCenter = [58.5, -157.5];

  // Fetch single date data
  useEffect(() => {
    if (!selectedDate || dateRangeMode) {
      console.log("⏳ Waiting for single date to be selected...");
      return;
    }

    console.log(`📅 Fetching data for date: ${selectedDate}`);

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [districts, summary] = await Promise.all([
          getDistricts(selectedDate),
          getDailySummary(selectedDate),
        ]);

        console.log("✅ Districts received:", districts);
        console.log("✅ Summary received:", summary);

        const districtMap = {};
        if (Array.isArray(districts)) {
          districts.forEach((d) => {
            districtMap[d.id] = d;
          });
        }

        setDistrictData(districtMap);
        setSummaryData(summary);
        setLastUpdated(new Date());
        
        // Extract rivers from summary
        if (summary.rivers) {
          const mappedRivers = summary.rivers.map((river) => ({
            ...river,
            district: getRiverDistrict(river.name),
          }));
          setRiversData(mappedRivers);
        }
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedDate, dateRangeMode]);

  // Fetch date range data
  useEffect(() => {
    if (!dateRangeMode || !selectedDateRange) return;

    console.log(`📅 Fetching range data: ${selectedDateRange.startDate} to ${selectedDateRange.endDate}`);

    async function fetchRangeData() {
  try {
    setLoading(true);
    setError(null);

    console.log("FETCH START - dates:", selectedDateRange);
    
    const data = await getDateRangeData(
      selectedDateRange.startDate,
      selectedDateRange.endDate
    );

    console.log("API RESPONSE:", data);
    console.log("Is array?:", Array.isArray(data));
    console.log("Length:", data?.length);

    setRangeDataRaw(data);
    const aggregated = aggregateDateRangeData(data);
    setRangeData(aggregated);
    setLastUpdated(new Date());
  } catch (err) {
    console.error("❌ FETCH ERROR:", err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

    fetchRangeData();
  }, [selectedDateRange, dateRangeMode]);

// Fetch historical data for charts - refetch when season changes
useEffect(() => {
  async function fetchHistorical() {
    try {
      // If a season is selected, fetch data for entire season
      // Otherwise fetch last 90 days
      let data;
      
      if (selectedSeason) {
        // Fetch from API with season parameter
        const response = await fetch(
          `http://localhost:3001/api/historical?season=${selectedSeason}`
        );
        data = await response.json();
      } else {
        // Fallback to last 90 days if no season selected
        data = await getHistoricalData(90);
      }
      
      setHistoricalData(data);
    } catch (err) {
      console.error("❌ Error fetching historical data:", err);
    }
  }

  fetchHistorical();
}, [selectedSeason]); // Re-fetch when season changes

// Fetch specific district data when selected
useEffect(() => {
  if (!selectedDistrict || dateRangeMode) return;

  async function fetchDistrictData() {
    try {
      const data = await getDistrict(selectedDistrict, selectedDate);
      setDistrictData(prev => ({
        ...prev,
        [selectedDistrict]: data
      }));
    } catch (err) {
      console.error("Error fetching district:", err);
    }
  }

  fetchDistrictData();
}, [selectedDistrict, selectedDate, dateRangeMode]);



  const currentData = dateRangeMode ? rangeData : { districts: districtData, rivers: riversData, summary: summaryData };
  const totalCatch = currentData?.summary?.totalCatch || summaryData?.summary?.totalCatch || 0;
  const selectedDistrictData = selectedDistrict ? districtData[selectedDistrict] : null;

  return (
    <div className="bristol-bay-map-container">
      {/* Compact Header */}
      <div className="header-compact">
        <div className="header-left">
          <h1>Bristol Predict 🐟 beta.v2.2</h1>
        </div>
        
        <div className="header-center">
          <DatePicker
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedSeason={selectedSeason}
            onSeasonChange={setSelectedSeason}
            dateRangeMode={dateRangeMode}
            selectedDateRange={selectedDateRange}
            onDateRangeChange={(start, end) =>
              setSelectedDateRange({ startDate: start, endDate: end })
            }
          />
        </div>

        <div className="header-right">
          <button
            className={`toggle-btn ${!dateRangeMode ? "active" : ""}`}
            onClick={() => setDateRangeMode(false)}
            title="Single Date Mode"
          >
            📅 Single Date Mode
          </button>
          <button
            className={`toggle-btn ${dateRangeMode ? "active" : ""}`}
            onClick={() => setDateRangeMode(true)}
            title="Date Range Mode"
          >
            🗓️ Date Range Mode
          </button>

          <button
            className="toggle-btn"
            onClick={() => onNavigateToCatchEfficiency && onNavigateToCatchEfficiency()}
            title="Catch Efficiency Analyzer"
          >
            🎣 More Tools...
          </button>

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Main Content - Map takes full space */}
      <div className="main-content">
        <div className="map-section">
          <MapContainer
            center={bristolBayCenter}
            zoom={8}
            style={{ width: "100%", height: "100%", borderRadius: "0" }}
          >
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <GeoJSONLayers />


            {/* District Markers */}
            {Object.entries(DISTRICTS).map(([key, district]) => {
              const data = dateRangeMode 
                ? rangeData?.districts?.[key] 
                : districtData[key];

              return (
                <Marker
                  key={key}
                  position={district.center}
                  icon={createCustomIcon(district.color, district.icon)}
                  eventHandlers={{ click: () => setSelectedDistrict(key) }}
                >
                  <Popup>
  {data ? (
    <div className="popup-stats">
      {dateRangeMode ? (
        // DATE RANGE MODE: Simplified stats
        <>
          <div>
            <strong>Total Catch Over Selected Dates:</strong> {formatNumber(data.catchDaily)}
          </div>
          <div>
            <strong>Percentage of Baywide Catch Over Selected Dates:</strong> {data.percentage?.toFixed(1)}%
          </div>
          <div>
            <strong>Total Escapement Over Selected Dates:</strong> {formatNumber(data.escapementDaily)}
          </div>
          
        </>
      ) : (
        // SINGLE DATE MODE: Full stats
        <>
          <div>
            <strong>Daily Catch:</strong> {formatNumber(data.catchDaily)}
          </div>
          <div>
            <strong>Percentage:</strong> {calculatePercentage(data.catchDaily, totalCatch)}
          </div>
          <div>
            <strong>Sockeye Per Delivery:</strong> {formatNumber(data.sockeyePerDelivery)}
          </div>
          <div>
            <strong>Cumulative:</strong> {formatNumber(data.catchCumulative)}
          </div>
          <div>
            <strong>Escapement:</strong> {formatNumber(data.escapementDaily)}
          </div>
        </>
      )}
    </div>
  ) : (
    <p>Loading data...</p>
  )}
</Popup>
                </Marker>
              );
            })}

            <MapController selectedDistrict={selectedDistrict} />
          </MapContainer>
        </div>
      </div>

      {/* Popup Sidebar - Full Height */}
      {sidebarOpen && (
        <div className="sidebar-popup">
          <div className="sidebar-header">
            <h3>📊 Data Panel</h3>
            <button
              className="close-btn"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="sidebar-content">
            {/* Summary Stats */}
            {!dateRangeMode && summaryData && (
              <div className="summary-box">
                <h4>Daily Summary</h4>
                <div className="summary-grid">
                  <div className="summary-stat">
                    <span className="summary-label">Total Daily Catch</span>
                    <span className="summary-value">
                      {formatNumber(totalCatch)}
                    </span>
                    {isZeroOrMissing(totalCatch) && (
                      <span className="summary-note">&nbsp;&nbsp;&nbsp;**ADF&G did not collect this data on &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;selected date</span>
                    )}
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Daily Escapement</span>
                    <span className="summary-value">
                      {formatNumber(summaryData.summary?.totalEscapement || 0)}
                    </span>
                    {isZeroOrMissing(totalCatch) && (
                      <span className="summary-note">&nbsp;&nbsp;&nbsp;**ADF&G did not collect this data on &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;selected date</span>
                    )}
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Total Run</span>
                    <span className="summary-value">
                      {formatNumber(summaryData.summary?.totalRun || 0)}
                    </span>
                    {isZeroOrMissing(totalCatch) && (
                      <span className="summary-note">&nbsp;&nbsp;&nbsp;**ADF&G did not collect this data on &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;selected date</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* District Details */}
            {selectedDistrict && selectedDistrictData && !dateRangeMode && (
              <DistrictStats
                district={DISTRICTS[selectedDistrict]}
                districtData={selectedDistrictData}
                totalCatch={totalCatch}
                rivers={riversData}
                isDateRange={dateRangeMode}
              />
            )}

            

            {/* District List */}
            {/* Districts List - Hidden in date range mode, shown in single date mode */}
{!dateRangeMode && sidebarOpen && (
  <div className="districts-list">
    <h4>Districts</h4>
    <div className="district-items">
      {Object.entries(DISTRICTS).map(([key, district]) => {
        const data = dateRangeMode 
          ? rangeData?.districts?.[key] 
          : districtData[key];
        return (
          <div
            key={key}
            className={`district-item ${selectedDistrict === key ? "selected" : ""}`}
            onClick={() => setSelectedDistrict(key)}
          >
            <span className="district-emoji">{district.icon}</span>
            <div className="district-name-info">
              <div className="district-name">{district.name}</div>
              {data && (
                <div className="district-catch">
                  {formatNumber(data.catchDaily)} 
                  <span className="catch-percentage">
                    {calculatePercentage(data.catchDaily, totalCatch)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

{/* DATE RANGE MODE: Simplified Districts List - Sorted by catch */}
{dateRangeMode && rangeData && sidebarOpen && (
  <div className="districts-list">
    <h3>📊 Districts:</h3>
    <h4>Data Aggregated over Selected Dates</h4>
    <h5># of sockeye caught over date interval, and percentage of total</h5>
    <div className="district-items">
      {rangeData.districtsSorted?.map((district) => (
        <div
          key={district.id}
          className={`district-item ${selectedDistrict === district.id ? "selected" : ""}`}
          onClick={() => setSelectedDistrict(district.id)}
        >
          <span className="district-emoji">{district.icon}</span>
          <div className="district-name-info">
            <div className="district-name">{district.name}</div>
            <div className="district-catch">
              {formatNumber(district.catchDaily)} 
              <span className="catch-percentage">
                {district.percentage?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
          </div>
        </div>
      )}

      {/* Charts Section - Scrolls, shifts when sidebar open */}
      {/* Charts Section - Shows appropriate chart based on mode */}
<div className="charts-section">
  {dateRangeMode && rangeData ? (
    // DATE RANGE MODE: Show ONLY the date range line chart
    <>
    {console.log("DEBUG - rangeDataRaw:", rangeDataRaw)}
    {console.log("DEBUG - is array?:", Array.isArray(rangeDataRaw))}
    {console.log("DEBUG - length:", rangeDataRaw?.length)}
    <LineChart_DateRange rangeData={rangeDataRaw} districts={DISTRICTS} />
  </>
  ) : (
    // SINGLE DATE MODE: Show chart toggle buttons and selected chart
    <>
      {/* Chart Toggle Buttons */}
      <div className="chart-toggle">
        
        <div className="chart-buttons">
          <button
            className={`chart-btn ${chartMode === "single" ? "active" : ""}`}
            onClick={() => setChartMode("single")}
            title="Day-to-Day Comparison"
          >
            Bay-Wide Daily Catch Trend
          </button>
          <button
            className={`chart-btn ${chartMode === "comparison" ? "active" : ""}`}
            onClick={() => setChartMode("comparison")}
            title="District Comparison"
          >
            District Comparison for Selected Date
          </button>
          <button
            className={`chart-btn ${chartMode === "distribution" ? "active" : ""}`}
            onClick={() => setChartMode("distribution")}
            title="Catch Distribution"
          >
            Daily Catch Distribution by District
          </button>
          <button
            className={`chart-btn ${chartMode === "multitrend" ? "active" : ""}`}
            onClick={() => setChartMode("multitrend")}
            title="Multi-District Trends"
          >
            Daily Catch Trends for all Districts
          </button>
          <button
            className={`chart-btn ${chartMode === "sockeyetrend" ? "active" : ""}`}
            onClick={() => setChartMode("sockeyetrend")}
            title="Sockeye Per Delivery"
          >
            Sockeye Per Delivery Trend
          </button>
        </div>
      </div>

      {chartMode === "single" && (
        <LineChart_DayToDayComparison
          historicalData={historicalData}
          selectedDistrict={selectedDistrict}
          selectedSeason={selectedSeason}
        />
      )}
      {chartMode === "comparison" && (
        <BarChart_DistrictComparison data={districtData} districtNames={DISTRICTS} />
      )}
      {chartMode === "distribution" && (
        <PieChart_CatchDistribution districtData={districtData} districtNames={DISTRICTS} />
      )}
      {chartMode === "multitrend" && (
        <LineChart_MultiDistrict historicalData={historicalData} districts={DISTRICTS} selectedSeason={selectedSeason}/>
      )}
      {chartMode === "sockeyetrend" && (
        <LineChart_MultiDistrict_SockeyePerDelivery historicalData={historicalData} districts={DISTRICTS} selectedSeason={selectedSeason}/>
      )}
    </>
  )}
</div>

      {/* Error Message */}
      {error && (
        <div className="error-box">
          ❌ {error}
        </div>
      )}
    </div>
  );
}