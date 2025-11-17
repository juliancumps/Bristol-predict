import React from 'react';
import '../styles/ToolsHub.css';

export default function ToolsHub({
  onNavigateToCatchEfficiency,
  onNavigateToRunTracker,
  onNavigateToWeather,
  onBackToBristolBayMap,
}) {
  return (
    <div className="tools-hub-container">
      {/* Background gradient */}
      <div className="tools-hub-background"></div>

      {/* Main Content */}
      <div className="tools-hub-content">
        {/* Header */}
        <div className="tools-hub-header">
          <button
            className="back-button-hub"
            onClick={onBackToBristolBayMap}
            title="Back to Bristol Bay Map"
          >
            ← Back
          </button>

          <div className="header-text-section">
            <h1 className="tools-hub-title">Other Tools</h1>
            <p className="tools-hub-subtitle">
              Choose a tool to dive deeper into fishery analysis, catch tracking, and real-time conditions.
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="tools-hub-grid">
          {/* Catch Efficiency Card */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </div>
            <h3>Catch Efficiency Analyzer</h3>
            <p>
              Enter your delivery data and compare against district averages.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToCatchEfficiency}
            >
              View
            </button>
          </div>

          {/* Run Timing Tracker Card */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="3 12 9 16 15 10 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="3 20 9 16 15 18 21 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h3>Run Timing Tracker</h3>
            <p>
              Track salmon run timing and migration patterns across Bristol Bay districts.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToRunTracker}
            >
              View
            </button>
          </div>

          {/* Live Weather Dashboard Card */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a7 7 0 0 0 0-14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>Live Weather Dashboard</h3>
            <p>
              Current weather conditions, tides, and wind/wave forecasts from NOAA and Windy.com.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToWeather}
            >
              View
            </button>
          </div>

          {/* Placeholder Card */}
          <div className="tool-card-hub tool-card-placeholder">
            <div className="tool-icon-hub placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M9 9h6M9 15h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Placeholder</h3>
            <p>
              A new tool is coming soon. Stay tuned for additional analysis features designed to enhance your fishing experience.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub disabled-hub"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}