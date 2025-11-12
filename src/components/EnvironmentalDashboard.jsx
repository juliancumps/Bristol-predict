import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { CloudRain, Cloud, Sun, Wind, Droplets, Thermometer } from "lucide-react";
import "../styles/EnvironmentalDashboard.css";

/**
 * EnvironmentalDashboard Component
 * Displays mock environmental data with clear disclaimers
 * Designed as a UI preview for future API integration
 */
export default function EnvironmentalDashboard({ onBack }) {
  const [mockTempData, setMockTempData] = useState([]);
  const [mockTideData, setMockTideData] = useState([]);
  const [currentWeather, setCurrentWeather] = useState({
    condition: "Partly Cloudy",
    temp: 52,
    windSpeed: 12,
    humidity: 68,
  });

  useEffect(() => {
    generateMockData();
  }, []);

  const generateMockData = () => {
    // Generate realistic Bristol Bay water temperatures (45-58°F range)
    const tempData = [];
    const baseTemp = 51;
    
    for (let i = 0; i < 30; i++) {
      const variance = Math.sin(i / 5) * 4 + (Math.random() - 0.5) * 2;
      tempData.push({
        date: `Jun ${i + 1}`,
        waterTemp: Math.round((baseTemp + variance) * 10) / 10,
        airTemp: Math.round((baseTemp + variance + 8) * 10) / 10,
      });
    }
    setMockTempData(tempData);

    // Generate sinusoidal tide pattern
    const tideData = [];
    for (let i = 0; i < 48; i++) {
      const hour = i % 24;
      const tideHeight = 8 + 6 * Math.sin((i * Math.PI) / 6);
      tideData.push({
        hour: `${hour}:00`,
        height: Math.round(tideHeight * 10) / 10,
      });
    }
    setMockTideData(tideData);

    // Cycle through weather conditions every 5 seconds for demo
    const weatherConditions = [
      { condition: "Sunny", temp: 58, windSpeed: 8, humidity: 55, icon: Sun },
      { condition: "Partly Cloudy", temp: 52, windSpeed: 12, humidity: 68, icon: Cloud },
      { condition: "Cloudy", temp: 48, windSpeed: 15, humidity: 75, icon: Cloud },
      { condition: "Rainy", temp: 45, windSpeed: 20, humidity: 85, icon: CloudRain },
    ];

    let weatherIndex = 0;
    const weatherInterval = setInterval(() => {
      weatherIndex = (weatherIndex + 1) % weatherConditions.length;
      setCurrentWeather(weatherConditions[weatherIndex]);
    }, 5000);

    return () => clearInterval(weatherInterval);
  };

  const WeatherIcon = () => {
    switch (currentWeather.condition) {
      case "Sunny":
        return <Sun size={64} color="#f59e0b" />;
      case "Rainy":
        return <CloudRain size={64} color="#3b82f6" />;
      default:
        return <Cloud size={64} color="#94a3b8" />;
    }
  };

  return (
    <div className="environmental-dashboard">
      <div className="env-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="env-title-section">
          <h2 className="env-title">
            <span className="title-icon">🌡️</span>
            Environmental Factors Dashboard
          </h2>
          <p className="env-subtitle">
            Water temperature, tides, and weather impact analysis
          </p>
          <div className="demo-badge">
            ⚠️ DEMO MODE - Mock Data Only
          </div>
        </div>
      </div>

      <div className="env-content">
        {/* Disclaimer Banner */}
        <div className="disclaimer-banner">
          <div className="disclaimer-icon">ℹ️</div>
          <div className="disclaimer-text">
            <strong>Important Notice:</strong> This dashboard displays demo data
            for UI preview purposes. The data shown is not connected to live
            sensors or real environmental monitoring systems. Future versions
            will integrate with NOAA, ADF&G, and other authoritative data
            sources.
          </div>
        </div>

        {/* Current Weather Card */}
        <div className="weather-card">
          <h3 className="card-title">
            <Cloud size={20} /> Current Conditions (Mock)
          </h3>
          <div className="weather-display">
            <div className="weather-icon-display">
              <WeatherIcon />
            </div>
            <div className="weather-details">
              <div className="weather-condition">{currentWeather.condition}</div>
              <div className="weather-metrics">
                <div className="metric">
                  <Thermometer size={20} />
                  <span className="metric-value">{currentWeather.temp}°F</span>
                  <span className="metric-label">Air Temp</span>
                </div>
                <div className="metric">
                  <Wind size={20} />
                  <span className="metric-value">{currentWeather.windSpeed} mph</span>
                  <span className="metric-label">Wind</span>
                </div>
                <div className="metric">
                  <Droplets size={20} />
                  <span className="metric-value">{currentWeather.humidity}%</span>
                  <span className="metric-label">Humidity</span>
                </div>
              </div>
            </div>
          </div>
          <div className="coming-soon-badge">Coming Soon: Real-time NOAA integration</div>
        </div>

        {/* Water Temperature Chart */}
        <div className="chart-card">
          <h3 className="card-title">
            <Thermometer size={20} /> Water Temperature Trends (Mock)
          </h3>
          <p className="chart-description">
            Bristol Bay water temperature typically ranges 45-58°F during fishing season
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={mockTempData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="waterTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="airTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "11px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} unit="°F" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #3b82f6",
                  borderRadius: "6px",
                  color: "#e2e8f0",
                }}
              />
              <Area
                type="monotone"
                dataKey="waterTemp"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#waterTemp)"
                name="Water Temp"
              />
              <Area
                type="monotone"
                dataKey="airTemp"
                stroke="#f59e0b"
                fillOpacity={1}
                fill="url(#airTemp)"
                name="Air Temp"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="coming-soon-badge">Coming Soon: Live sensor data from monitoring stations</div>
        </div>

        {/* Tide Prediction Chart */}
        <div className="chart-card">
          <h3 className="card-title">
            <Droplets size={20} /> Tide Predictions (Mock Pattern)
          </h3>
          <p className="chart-description">
            48-hour tide forecast showing high and low tide cycles
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={mockTideData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="hour"
                stroke="#94a3b8"
                style={{ fontSize: "11px" }}
                interval={5}
              />
              <YAxis
                stroke="#94a3b8"
                style={{ fontSize: "12px" }}
                unit="ft"
                domain={[0, 16]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #10b981",
                  borderRadius: "6px",
                  color: "#e2e8f0",
                }}
              />
              <Line
                type="monotone"
                dataKey="height"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Tide Height"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="external-link-box">
            <span>📍 For real tide data, visit:</span>
            <a
              href="https://tidesandcurrents.noaa.gov/tide_predictions.html"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              NOAA Tides & Currents →
            </a>
          </div>
        </div>

        {/* Integration Guide */}
        <div className="integration-guide">
          <h3 className="guide-title">🔧 Future Integration Plan</h3>
          <div className="integration-items">
            <div className="integration-item">
              <div className="item-status">📋 Planned</div>
              <div className="item-content">
                <strong>NOAA API Integration</strong>
                <p>Real-time water temperature, wave height, and weather data</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status">📋 Planned</div>
              <div className="item-content">
                <strong>ADF&G Environmental Data</strong>
                <p>Official Alaska Department of Fish & Game environmental monitoring</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status">📋 Planned</div>
              <div className="item-content">
                <strong>Historical Correlation Analysis</strong>
                <p>Machine learning models to correlate environmental factors with catch patterns</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}