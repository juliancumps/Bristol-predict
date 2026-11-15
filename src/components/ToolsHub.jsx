import React from 'react';
import '../styles/ToolsHub.css';

export default function ToolsHub({
  onNavigateToCatchEfficiency,
  onNavigateToRunTracker,
  onNavigateToWeather,
  onNavigateToSoutheastMap,
  onNavigateToOpenings,
  onNavigateToEscapement,
  onNavigateToPortMoller,
  onNavigateToFleet,
  onNavigateToBriefing,

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
          {/* Daily Briefing Card (V4) - first */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M12 3v3M4.2 6.2l2.1 2.1M19.8 6.2l-2.1 2.1M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Daily Briefing</h3>
            <p>
              The morning check on one screen: openings, yesterday's catch, run against forecast, Port Moller.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToBriefing}
            >
              View
            </button>
          </div>

          {/* Openings & Announcements Card (V4) */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>Openings & Announcements</h3>
            <p>
              Which districts are open, when they close, and the next opening. Read from the ADF&G announcements, with boat counts.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToOpenings}
            >
              View
            </button>
          </div>

          {/* Escapement & Forecast Card (V4) */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="18" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="15" width="18" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M3 7h9M3 17h14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Escapement & Forecast</h3>
            <p>
              River escapement against the ADF&G goal ranges, and each district's run against the preseason forecast.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToEscapement}
            >
              View
            </button>
          </div>

          {/* Port Moller Card (V4) */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M5 12V6m4 6V9m4 3V4m4 8V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Port Moller</h3>
            <p>
              Test fishery catch index and stock composition, with the arrival window for each district.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToPortMoller}
            >
              View
            </button>
          </div>

          {/* Fleet Card (V4) */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 15h18l-3 4H6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 15V5l5 6h-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>Fleet</h3>
            <p>
              Drift boats in each district from the announcements, and an estimate of the catch per boat.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToFleet}
            >
              View
            </button>
          </div>

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

          {/* Southeast Alaska Region Card */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2zm8 12H5v-4h6v4zm0-6H5V7h6v4zm8 6h-6v-4h6v4zm0-6h-6V7h6v4z" fill="currentColor" />
              </svg>
            </div>
            <h3>More AK Salmon Harvest Data</h3>
            <p>
              Explore fishery data for all Alaska's regions.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={onNavigateToSoutheastMap}
            >
              View
            </button>
          </div>

          {/* ADF&G Link Card */}
          <div className="tool-card-hub">
            <div className="tool-icon-hub">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 13v6H6v-6M12 5v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>ADF&G Resources</h3>
            <p>
              Access ADF&G commercial fishing data/resources for other regions.
            </p>
            <button
              className="btn-tool-hub btn-primary-hub"
              onClick={() => window.open('https://www.adfg.alaska.gov/index.cfm?adfg=fishingcommercialbyarea.main', '_blank')}
            >
              Visit
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}