import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/SoutheastMap.css';

export default function SoutheastMap({ onBackToToolsHub }) {
  useEffect(() => {
    // Initialize map centered on Southeast Alaska
    const map = L.map('southeast-map').setView([56.5, -131.5], 6);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div className="southeast-map-container">
      {/* Background gradient */}
      <div className="southeast-map-background"></div>

      {/* Main Content */}
      <div className="southeast-map-content">
        {/* Header */}
        <div className="southeast-map-header">
          <button
            className="back-button-southeast"
            onClick={onBackToToolsHub}
            title="Back to Tools Hub"
          >
            ← Back
          </button>

          <div className="header-text-section">
            <h1 className="southeast-map-title">Southeast Alaska Region</h1>
            <p className="southeast-map-subtitle">
              Explore fishery data and conditions across Southeast Alaska districts.
            </p>
          </div>
        </div>

        {/* Map Container */}
        <div id="southeast-map" className="southeast-map"></div>
      </div>
    </div>
  );
}