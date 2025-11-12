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
 * Displays mock environmental data with district tabs and live Windy embed
 * Designed as a UI preview for future API integration with NOAA
 */

const DISTRICTS = [
  { id: "naknek", name: "Naknek-Kvichak", lat: 58.603, lon: -158.511 },
  { id: "egegik", name: "Egegik", lat: 58.177, lon: -157.398 },
  { id: "ugashik", name: "Ugashik", lat: 57.470, lon: -156.920 },
  { id: "nushagak", name: "Nushagak", lat: 59.035, lon: -161.033 },
  { id: "togiak", name: "Togiak", lat: 59.054, lon: -160.419 },
];

const WINDY_EMBED_URLS = {
  naknek: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=58.72&lon=-157.176&detailLat=58.65551339815602&detailLon=-157.27203369140628&marker=true&message=true",
  egegik: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=10&overlay=wind&product=ecmwf&level=surface&lat=58.226&lon=-157.449&detailLat=58.21196137079872&detailLon=-157.52059936523438&marker=true&message=true",
  ugashik: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=10&overlay=wind&product=ecmwf&level=surface&lat=57.564&lon=-157.721&detailLat=57.5909753067477&detailLon=-157.73071289062503&marker=true&message=true",
  nushagak: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=58.724&lon=-158.546&detailLat=58.63264633236806&detailLon=-158.55194091796878&marker=true&message=true",
  togiak: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=8&overlay=wind&product=ecmwf&level=surface&lat=58.834&lon=-160.411&detailLat=58.839&detailLon=-160.505&marker=true&message=true",
};

export default function EnvironmentalDashboard({ onBack }) {
  const [mockTempData, setMockTempData] = useState([]);
  const [mockTideData, setMockTideData] = useState([]);
  const [currentWeather, setCurrentWeather] = useState({
    condition: "Partly Cloudy",
    temp: 52,
    windSpeed: 12,
    humidity: 68,
  });
  const [activeDistrict, setActiveDistrict] = useState("naknek");

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

  const currentDistrictData = DISTRICTS.find(d => d.id === activeDistrict);

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
            Water temperature, tides, and weather impact analysis by district
          </p>
          <div className="demo-badge">
            ⚠️ DEMO MODE - Mock Data + Live Weather
          </div>
        </div>
      </div>

      <div className="env-content">
        {/* District Tabs */}
        <div className="district-tabs-container">
          <div className="district-tabs">
            {DISTRICTS.map((district) => (
              <button
                key={district.id}
                className={`district-tab ${activeDistrict === district.id ? "active" : ""}`}
                onClick={() => setActiveDistrict(district.id)}
              >
                {district.name}
              </button>
            ))}
          </div>
          <div className="active-district-label">
            Currently viewing: <strong>{currentDistrictData?.name}</strong>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="disclaimer-banner">
          <div className="disclaimer-icon">ℹ️</div>
          <div className="disclaimer-text">
            <strong>Important Notice:</strong> This dashboard displays demo data
            for UI preview purposes, with mock catch and temperature data. The Windy
            embed displays real-time weather and forecast data. Future versions
            will integrate full live data from NOAA and ADF&G APIs.
          </div>
        </div>

        {/* Live Weather Embed */}
        <div className="weather-card">
          <h3 className="card-title">
            <Cloud size={20} /> Live Weather & Forecast (Real-time)
          </h3>
          <p className="chart-description">
            Powered by Windy.com - Real-time wind, rain, and temperature data for {currentDistrictData?.name}
          </p>
          <div className="windy-embed-container">
            <iframe
              width="100%"
              height="500"
              src={WINDY_EMBED_URLS[activeDistrict]}
              frameBorder="0"
              title={`Windy.com map for ${currentDistrictData?.name}`}
              style={{ borderRadius: "8px" }}
            ></iframe>
          </div>
        </div>

        {/* Current Conditions Card */}
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
          <div className="coming-soon-badge">Coming Soon: NOAA real-time integration for all metrics</div>
        </div>

        {/* Water Temperature Chart */}
        <div className="chart-card">
          <h3 className="card-title">
            <Thermometer size={20} /> Water Temperature Trends (Mock)
          </h3>
          <p className="chart-description">
            Bristol Bay water and air temperature data for {currentDistrictData?.name} - June historical averages
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mockTempData}>
              <defs>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ background: "#1e293b", border: "1px solid #3b82f6" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Area type="monotone" dataKey="waterTemp" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWater)" name="Water Temp" />
              <Area type="monotone" dataKey="airTemp" stroke="#f59e0b" fillOpacity={1} fill="url(#colorAir)" name="Air Temp" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tide Pattern Chart */}
        <div className="chart-card">
          <h3 className="card-title">
            <Droplets size={20} /> Tidal Patterns (Mock)
          </h3>
          <p className="chart-description">
            48-hour tidal height forecast for {currentDistrictData?.name}
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mockTideData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ background: "#1e293b", border: "1px solid #3b82f6" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Line type="monotone" dataKey="height" stroke="#60a5fa" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Integration Guide */}
        <div className="integration-guide">
          <h3 className="guide-title">🔄 Planned NOAA API Integration</h3>
          <div className="integration-items">
            <div className="integration-item">
              <div className="item-status">Mock</div>
              <div className="item-content">
                <strong>Water Temperature</strong>
                <p>Will pull from NOAA buoy data and ADF&G temperature sensors</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status">Mock</div>
              <div className="item-content">
                <strong>Tidal Predictions</strong>
                <p>Will integrate NOAA CO-OPS tidal harmonic predictions</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status">Live</div>
              <div className="item-content">
                <strong>Weather Forecasts</strong>
                <p>Currently displaying real-time data via Windy.com embed</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status">Planned</div>
              <div className="item-content">
                <strong>District-Specific Summaries</strong>
                <p>Will fetch aggregated catch data from Bristol Predict database</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}