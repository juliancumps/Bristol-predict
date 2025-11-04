import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
    center: [58.7, -156.5],
    color: "#3b82f6",
    icon: "🐟",
  },
  egegik: {
    name: "Egegik",
    center: [58.2, -157.4],
    color: "#8b5cf6",
    icon: "🐠",
  },
  ugashik: {
    name: "Ugashik",
    center: [57.5, -157.75],
    color: "#ec4899",
    icon: "🎣",
  },
  nushagak: {
    name: "Nushagak",
    center: [58.9, -158.5],
    color: "#10b981",
    icon: "🐡",
  },
  togiak: {
    name: "Togiak",
    center: [59.0, -160.4],
    color: "#f59e0b",
    icon: "🦈",
  },
};

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

export default function BristolBayMap() {
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  // Bristol Bay center point
  const bristolBayCenter = [58.5, -157.5];

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
        <p style={{ color: "#bfdbfe", margin: 0 }}>
          Bristol Bay Sockeye Salmon Run Interactive Display
        </p>
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
            {/* Tile Layer - OpenStreetMap (free!) */}
            {/*<TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />*/}

            {/* Alternative: Satellite-ish view using ESRI */}
            {/* Uncomment this and comment out the one above to use satellite imagery */}
            {
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            }

            {/* District Markers */}
            {Object.entries(DISTRICTS).map(([key, district]) => (
              <Marker
                key={key}
                position={district.center}
                icon={createCustomIcon(district.color, district.icon)}
                eventHandlers={{
                  click: () => setSelectedDistrict(key),
                }}
              >
                <Popup>
                  <div style={{ padding: "8px" }}>
                    <h3 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>
                      {district.name}
                    </h3>
                    <p
                      style={{ margin: 0, fontSize: "12px", color: "#64748b" }}
                    >
                      Click for details →
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

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
              🗺️ Map Info
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
              <li>Free OpenStreetMap tiles (no API key!)</li>
              <li>Click markers to view district info</li>
              <li>Zoom and pan to explore</li>
              <li>Data integration coming soon</li>
            </ul>
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid #334155",
                fontSize: "11px",
                color: "#94a3b8",
              }}
            >
              💡 To switch to satellite view, uncomment the ESRI tile layer in
              the code
            </div>
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
            District Info
          </h2>

          {selectedDistrict ? (
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
                    <span style={{ fontWeight: "bold" }}>---</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Season Total:</span>
                    <span style={{ fontWeight: "bold" }}>---</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Status:</span>
                    <span style={{ color: "#10b981" }}>Awaiting Data</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#334155",
                  padding: "16px",
                  borderRadius: "8px",
                }}
              >
                <h4
                  style={{
                    fontSize: "14px",
                    color: "#94a3b8",
                    marginBottom: "12px",
                  }}
                >
                  Recent Trend
                </h4>
                <div
                  style={{
                    height: "80px",
                    backgroundColor: "#1e293b",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-around",
                    padding: "8px",
                  }}
                >
                  {[40, 65, 55, 80, 70].map((height, i) => (
                    <div
                      key={i}
                      style={{
                        width: "16%",
                        height: `${height}%`,
                        backgroundColor: DISTRICTS[selectedDistrict].color,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginTop: "8px",
                    marginBottom: 0,
                  }}
                >
                  Last 5 days (placeholder data)
                </p>
              </div>
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
                  Season Overview
                </h4>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    margin: 0,
                  }}
                >
                  Data integration coming soon. This will show real-time updates
                  from ADF&G daily reports.
                </p>
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
            {Object.entries(DISTRICTS).map(([key, district]) => (
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
                      fontWeight: selectedDistrict === key ? "bold" : "normal",
                    }}
                  >
                    {district.name}
                  </div>
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
            ))}
          </div>

          {/* Quick Stats */}
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
              QUICK STATS
            </h3>
            <div style={{ fontSize: "14px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span style={{ color: "#94a3b8" }}>Total Season:</span>
                <span style={{ color: "white" }}>--- million</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "#94a3b8" }}>Last Updated:</span>
                <span style={{ color: "white" }}>Pending</span>
              </div>
            </div>
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
          Phase 1: MVP
        </span>
        Interactive Leaflet map • 100% free • No API keys needed • Data
        integration next
      </div>
    </div>
  );
}
