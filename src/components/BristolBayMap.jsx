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
import {
  getDistricts,
  getDailySummary,
  getDistrict,
  formatNumber,
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

// Bristol Bay fishing districts with approximate boundaries
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

// GeoJSON style functions
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

// Create custom markers for each district
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
    map.flyTo(district.center, 10, {
      duration: 1.5,
    });
  }

  return null;
}

function GeoJSONLayers() {
  const [districts, setDistricts] = useState(null);
  const [sections, setSections] = useState(null);

  useEffect(() => {
    // Load district boundaries
    fetch("/geojson/Commercial_Fisheries_Bristol_Bay_Salmon_Districts.geojson")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Districts GeoJSON loaded:", data);
        setDistricts(data);
      })
      .catch((err) => {
        console.log("Districts GeoJSON not found (optional):", err.message);
      });

    // Load section boundaries
    fetch("/geojson/Commercial_Fisheries_Bristol_Bay_Salmon_Sections.geojson")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Sections GeoJSON loaded:", data);
        setSections(data);
      })
      .catch((err) => {
        console.log("Sections GeoJSON not found (optional):", err.message);
      });
  }, []);

  // Return null if there's nothing to render yet
  if (!sections && !districts) {
    return null;
  }

  return (
    <>
      {sections && (
        <GeoJSON
          data={sections}
          style={sectionStyle}
          onEachFeature={(feature, layer) => {
            if (feature.properties && feature.properties.name) {
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
            if (feature.properties && feature.properties.name) {
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

  // NEW: State for date selection
  const [selectedDate, setSelectedDate] = useState(null);

  // Bristol Bay center point
  const bristolBayCenter = [58.5, -157.5];

  // UPDATED: Fetch all district data when date changes
  useEffect(() => {
    // Don't fetch if no date selected yet
    if (!selectedDate) {
      console.log("⏳ Waiting for date to be selected...");
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

        // Convert array to object keyed by district id
        const dataMap = {};
        districts.forEach((d) => {
          dataMap[d.id] = d;
        });

        setDistrictData(dataMap);
        setSummaryData(summary);
        setLastUpdated(new Date(summary.scrapedAt));
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        console.error("Error details:", err.response?.data || err.message);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedDate]); // Changed dependency to selectedDate

  // Fetch detailed data when district is selected
  useEffect(() => {
    if (selectedDistrict && selectedDate) {
      getDistrict(selectedDistrict, selectedDate)
        .then((data) => {
          setDistrictData((prev) => ({
            ...prev,
            [selectedDistrict]: { ...prev[selectedDistrict], ...data },
          }));
        })
        .catch((err) => console.error("Error fetching district details:", err));
    }
  }, [selectedDistrict, selectedDate]);

  const selectedData = selectedDistrict ? districtData[selectedDistrict] : null;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0f172a",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(to right, #1e3a8a, #1e40af)",
          padding: "24px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          zIndex: 1000,
        }}
      >
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "bold",
            color: "white",
            margin: "0 0 8px 0",
          }}
        >
          Bristol Predict 🐟
        </h1>
        <p style={{ color: "#bfdbfe", margin: "0 0 16px 0" }}>
          Bristol Bay Sockeye Salmon Run Interactive Display
          {lastUpdated && (
            <span
              style={{ marginLeft: "10px", fontSize: "12px", opacity: 0.8 }}
            >
              • Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </p>

        {/* NEW: DatePicker Component */}
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {/* Map Container */}
        <div style={{ flex: 1, padding: "16px" }}>
          <MapContainer
            center={bristolBayCenter}
            zoom={8}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "8px",
              zIndex: 1,
            }}
          >
            {/* Satellite Tile Layer */}
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />

            {/* GeoJSON Boundaries */}
            <GeoJSONLayers />

            {/* District Markers */}
            {Object.entries(DISTRICTS).map(([key, district]) => {
              const data = districtData[key];
              return (
                <Marker
                  key={key}
                  position={district.center}
                  icon={createCustomIcon(district.color, district.icon)}
                  eventHandlers={{
                    click: () => setSelectedDistrict(key),
                  }}
                >
                  <Popup>
                    <div style={{ padding: "8px", minWidth: "200px" }}>
                      <h3 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>
                        {district.name}
                      </h3>
                      {data ? (
                        <>
                          <div style={{ fontSize: "12px", lineHeight: "1.6" }}>
                            <div>
                              <strong>Cumulative Catch:</strong>{" "}
                              {formatNumber(data.catchCumulative)}
                            </div>
                            <div>
                              <strong>Daily Catch:</strong>{" "}
                              {formatNumber(data.catchDaily)}
                            </div>
                            <div>
                              <strong>Escapement:</strong>{" "}
                              {formatNumber(data.escapementCumulative)}
                            </div>
                            <div>
                              <strong>Total Run:</strong>{" "}
                              {formatNumber(data.totalRun)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        >
                          Loading data...
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Map Controller for animations */}
            <MapController selectedDistrict={selectedDistrict} />
          </MapContainer>

          {/* Info Box */}
          <div
            style={{
              position: "absolute",
              top: "32px",
              right: "352px",
              backgroundColor: "rgba(30, 41, 59, 0.95)",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #3b82f6",
              maxWidth: "280px",
              zIndex: 1000,
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
            }}
          >
            <h3
              style={{
                color: "#60a5fa",
                margin: "0 0 12px 0",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              🗺️ Map Legend
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontSize: "12px",
                color: "#cbd5e1",
                lineHeight: "1.6",
              }}
            >
              <li>
                <span style={{ color: "#fbbf24" }}>━━</span> District Boundaries
              </li>
              <li>
                <span style={{ color: "#60a5fa" }}>- - -</span> Section Lines
              </li>
              <li>🐟 District Markers (click for data)</li>
              <li>Historical data from ADF&G</li>
            </ul>
            {error && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "8px",
                  backgroundColor: "#7f1d1d",
                  borderRadius: "4px",
                  fontSize: "11px",
                  color: "#fca5a5",
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            width: "320px",
            backgroundColor: "#1e293b",
            padding: "24px",
            overflowY: "auto",
            borderLeft: "1px solid #334155",
            zIndex: 100,
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "white",
              marginBottom: "16px",
            }}
          >
            {loading ? "Loading..." : "District Info"}
          </h2>

          {selectedData ? (
            <div style={{ color: "white" }}>
              <div
                style={{
                  backgroundColor: "#334155",
                  padding: "16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                  {DISTRICTS[selectedDistrict].icon}
                </div>
                <h3
                  style={{
                    fontSize: "18px",
                    color: "#60a5fa",
                    marginBottom: "12px",
                  }}
                >
                  {DISTRICTS[selectedDistrict].name}
                </h3>
                <div style={{ fontSize: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Today's Catch:</span>
                    <span style={{ fontWeight: "bold" }}>
                      {formatNumber(selectedData.catchDaily)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Season Total:</span>
                    <span style={{ fontWeight: "bold" }}>
                      {formatNumber(selectedData.catchCumulative)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Escapement:</span>
                    <span style={{ fontWeight: "bold" }}>
                      {formatNumber(selectedData.escapementCumulative)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Status:</span>
                    <span
                      style={{
                        color:
                          selectedData.catchDaily > 0 ? "#10b981" : "#f59e0b",
                      }}
                    >
                      {selectedData.catchDaily > 0 ? "Active" : "Closed"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedData.rivers && selectedData.rivers.length > 0 && (
                <div
                  style={{
                    backgroundColor: "#334155",
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "14px",
                      color: "#94a3b8",
                      marginBottom: "12px",
                    }}
                  >
                    Rivers in District
                  </h4>
                  {selectedData.rivers.map((river, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "12px",
                        marginBottom: "6px",
                        paddingBottom: "6px",
                        borderBottom:
                          i < selectedData.rivers.length - 1
                            ? "1px solid #1e293b"
                            : "none",
                      }}
                    >
                      <div style={{ fontWeight: "bold", color: "#e2e8f0" }}>
                        {river.name}
                      </div>
                      <div style={{ color: "#94a3b8" }}>
                        Escapement: {formatNumber(river.escapementCumulative)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "14px",
                  marginBottom: "16px",
                }}
              >
                Click on a district marker to view details.
              </p>
              <div
                style={{
                  backgroundColor: "#334155",
                  padding: "16px",
                  borderRadius: "8px",
                }}
              >
                <h4
                  style={{
                    color: "white",
                    marginBottom: "8px",
                    fontSize: "16px",
                  }}
                >
                  {selectedDate ? "Data for Selected Date" : "Season Overview"}
                </h4>
                {summaryData ? (
                  <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                    <div style={{ marginBottom: "8px" }}>
                      <strong>Total Catch:</strong>{" "}
                      {formatNumber(summaryData.summary.totalCatch)}
                    </div>
                    <div style={{ marginBottom: "8px" }}>
                      <strong>Total Escapement:</strong>{" "}
                      {formatNumber(summaryData.summary.totalEscapement)}
                    </div>
                    <div>
                      <strong>Total Run:</strong>{" "}
                      {formatNumber(summaryData.summary.totalRun)}
                    </div>
                    {summaryData.summary.totalRun === 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "8px",
                          backgroundColor: "#1e293b",
                          borderRadius: "4px",
                          fontSize: "11px",
                          color: "#fbbf24",
                        }}
                      >
                        ℹ️ No fishing activity on this date
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                    {selectedDate
                      ? "Loading data..."
                      : "Select a date to view data"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* District List */}
          <div
            style={{
              marginTop: "24px",
              paddingTop: "24px",
              borderTop: "1px solid #334155",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                marginBottom: "12px",
                fontWeight: 600,
              }}
            >
              ALL DISTRICTS
            </h3>
            {Object.entries(DISTRICTS).map(([key, district]) => {
              const data = districtData[key];
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDistrict(key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px",
                    marginBottom: "4px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    backgroundColor:
                      selectedDistrict === key ? "#334155" : "transparent",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDistrict !== key) {
                      e.currentTarget.style.backgroundColor = "#1e293b";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDistrict !== key) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <span style={{ fontSize: "20px", marginRight: "12px" }}>
                    {district.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: "white",
                        fontSize: "14px",
                        fontWeight:
                          selectedDistrict === key ? "bold" : "normal",
                      }}
                    >
                      {district.name}
                    </div>
                    {data && (
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {formatNumber(data.catchCumulative)} fish
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: district.color,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#1e293b",
          borderTop: "1px solid #334155",
          padding: "12px 24px",
          fontSize: "14px",
          color: "#94a3b8",
          zIndex: 1000,
        }}
      >
        <span
          style={{
            display: "inline-block",
            backgroundColor: "#1e3a8a",
            color: "#bfdbfe",
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "12px",
            marginRight: "12px",
          }}
        >
          Phase 3: Historical Data
        </span>
        ADF&G historical data • Date selection • SQLite database • 2025 season
      </div>
    </div>
  );
}
