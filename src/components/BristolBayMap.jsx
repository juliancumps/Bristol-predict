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
import {
  LineChart_DayToDayComparison,
  BarChart_DistrictComparison,
  PieChart_CatchDistribution,
  LineChart_MultiDistrict,
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
import "../styles/BristolBayMap.css";

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
    center: [58.7, -157.1755],
    color: "#3b82f6",
    icon: "🐟",
  },
  egegik: {
    name: "Egegik",
    center: [58.222, -157.525],
    color: "#8b5cf6",
    icon: "🐠",
  },
  ugashik: {
    name: "Ugashik",
    center: [57.6, -157.75],
    color: "#ec4899",
    icon: "🎣",
  },
  nushagak: {
    name: "Nushagak",
    center: [58.72, -158.54],
    color: "#10b981",
    icon: "🐡",
  },
  togiak: {
    name: "Togiak",
    center: [58.83, -160.45],
    color: "#f59e0b",
    icon: "🦈",
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

export default function BristolBayMap() {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [districtData, setDistrictData] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  
  // NEW: Date range support
  const [dateRangeMode, setDateRangeMode] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [rangeData, setRangeData] = useState(null);
  
  // NEW: Historical data for charts
  const [historicalData, setHistoricalData] = useState([]);
  const [chartMode, setChartMode] = useState("single"); // "single" | "comparison" | "distribution" | "multitrend"

  // NEW: Rivers data
  const [riversData, setRiversData] = useState([]);

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

        const data = await getDateRangeData(
          selectedDateRange.startDate,
          selectedDateRange.endDate
        );

        const aggregated = aggregateDateRangeData(data);
        setRangeData(aggregated);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("❌ Error fetching range data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRangeData();
  }, [selectedDateRange, dateRangeMode]);

  // Fetch historical data for charts
  useEffect(() => {
    async function fetchHistorical() {
      try {
        const data = await getHistoricalData(30);
        setHistoricalData(data);
      } catch (err) {
        console.error("❌ Error fetching historical data:", err);
      }
    }

    fetchHistorical();
  }, []);

  const currentData = dateRangeMode ? rangeData : { districts: districtData, rivers: riversData, summary: summaryData };
  const totalCatch = currentData?.summary?.totalCatch || summaryData?.summary?.totalCatch || 0;
  const selectedDistrictData = selectedDistrict ? districtData[selectedDistrict] : null;

  return (
    <div className="bristol-bay-map-container">
      {/* Header */}
      <div className="header-section">
        <h1>Bristol Predict 🐟</h1>
        <p>Bristol Bay Sockeye Salmon Run Interactive Display</p>
        {lastUpdated && (
          <span className="last-updated">
            • Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={`toggle-btn ${!dateRangeMode ? "active" : ""}`}
            onClick={() => setDateRangeMode(false)}
          >
            📅 Single Date
          </button>
          <button
            className={`toggle-btn ${dateRangeMode ? "active" : ""}`}
            onClick={() => setDateRangeMode(true)}
          >
            📊 Date Range
          </button>
        </div>

        {/* DatePicker */}
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dateRangeMode={dateRangeMode}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={(start, end) =>
            setSelectedDateRange({ startDate: start, endDate: end })
          }
        />
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Map Container */}
        <div className="map-section">
          <MapContainer
            center={bristolBayCenter}
            zoom={8}
            style={{ width: "100%", height: "100%", borderRadius: "8px" }}
          >
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <GeoJSONLayers />

            {/* District Markers */}
            {Object.entries(DISTRICTS).map(([key, district]) => {
              const data = districtData[key];
              return (
                <Marker
                  key={key}
                  position={district.center}
                  icon={createCustomIcon(district.color, district.icon)}
                  eventHandlers={{ click: () => setSelectedDistrict(key) }}
                >
                  <Popup>
                    <div className="marker-popup">
                      <h3>{district.name}</h3>
                      {data ? (
                        <div className="popup-stats">
                          <div>
                            <strong>Daily Catch:</strong> {formatNumber(data.catchDaily)}
                          </div>
                          <div>
                            <strong>Percentage:</strong> {calculatePercentage(data.catchDaily, totalCatch)}
                          </div>
                          <div>
                            <strong>Cumulative:</strong> {formatNumber(data.catchCumulative)}
                          </div>
                          <div>
                            <strong>Escapement:</strong> {formatNumber(data.escapementDaily)}
                          </div>
                        </div>
                      ) : (
                        <p>Loading data...</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            <MapController selectedDistrict={selectedDistrict} />
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Summary Stats */}
          {summaryData && (
            <div className="summary-box">
              <h3>Daily Summary</h3>
              <div className="summary-grid">
                <div className="summary-stat">
                  <span className="summary-label">Total Daily Catch</span>
                  <span className="summary-value">
                    {formatNumber(totalCatch)}
                  </span>
                </div>
                <div className="summary-stat">
                  <span className="summary-label">Total Daily Escapement</span>
                  <span className="summary-value">
                    {formatNumber(summaryData.summary?.totalEscapement || 0)}
                  </span>
                </div>
                <div className="summary-stat">
                  <span className="summary-label">Total Run</span>
                  <span className="summary-value">
                    {formatNumber(summaryData.summary?.totalRun || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* District Details */}
          {selectedDistrict && selectedDistrictData && (
            <DistrictStats
              district={DISTRICTS[selectedDistrict]}
              districtData={selectedDistrictData}
              totalCatch={totalCatch}
              rivers={riversData}
              isDateRange={dateRangeMode}
            />
          )}

          {/* Chart Toggle */}
          <div className="chart-toggle">
            <h4>Chart Views</h4>
            <div className="chart-buttons">
              <button
                className={`chart-btn ${chartMode === "single" ? "active" : ""}`}
                onClick={() => setChartMode("single")}
              >
                📈 Trend
              </button>
              <button
                className={`chart-btn ${chartMode === "comparison" ? "active" : ""}`}
                onClick={() => setChartMode("comparison")}
              >
                📊 Compare
              </button>
              <button
                className={`chart-btn ${chartMode === "distribution" ? "active" : ""}`}
                onClick={() => setChartMode("distribution")}
              >
                🥧 Distribution
              </button>
              <button
                className={`chart-btn ${chartMode === "multitrend" ? "active" : ""}`}
                onClick={() => setChartMode("multitrend")}
              >
                📉 Multi
              </button>
            </div>
          </div>

          {/* District List */}
          <div className="districts-list">
            <h3>All Districts</h3>
            {Object.entries(DISTRICTS).map(([key, district]) => {
              const data = districtData[key];
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
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        {chartMode === "single" && (
          <LineChart_DayToDayComparison
            historicalData={historicalData}
            selectedDistrict={selectedDistrict}
          />
        )}
        {chartMode === "comparison" && (
          <BarChart_DistrictComparison data={districtData} districtNames={DISTRICTS} />
        )}
        {chartMode === "distribution" && (
          <PieChart_CatchDistribution districtData={districtData} districtNames={DISTRICTS} />
        )}
        {chartMode === "multitrend" && (
          <LineChart_MultiDistrict historicalData={historicalData} districts={DISTRICTS} />
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