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
import { CloudRain, Cloud, Sun, Wind, Droplets, Thermometer, AlertCircle, Loader } from "lucide-react";
import "../styles/EnvironmentalDashboard.css";

/**
 * EnvironmentalDashboard Component
 * Displays NOAA real-time weather data with district tabs and live Windy embed
 */

const DISTRICTS = [
  { id: "naknek", name: "Naknek-Kvichak", lat: 58.745, lon: -157.040 },
  { id: "egegik", name: "Egegik", lat: 58.177, lon: -157.398 },
  { id: "ugashik", name: "Ugashik", lat: 57.47, lon: -156.92 },
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
  const [forecastData, setForecastData] = useState([]);
  const [currentWeather, setCurrentWeather] = useState({
    condition: "Loading...",
    temp: null,
    windSpeed: null,
    humidity: null,
    windDirection: null,
    relativeHumidity: null,
    loading: true,
    error: null,
  });
  const [activeDistrict, setActiveDistrict] = useState("naknek");

  useEffect(() => {
    generateMockData();
  }, []);

  // Fetch NOAA weather data when district changes
  useEffect(() => {
    fetchNOAAWeatherData();
  }, [activeDistrict]);

  const fetchNOAAWeatherData = async () => {
    const currentDistrict = DISTRICTS.find(d => d.id === activeDistrict);
    
    if (!currentDistrict) return;

    try {
      setCurrentWeather(prev => ({ ...prev, loading: true, error: null }));

      console.log(`🌍 Fetching NOAA data for ${currentDistrict.name} (${currentDistrict.lat}, ${currentDistrict.lon})`);

      // Step 1: Get grid point data using lat/lon
      const pointsUrl = `https://api.weather.gov/points/${currentDistrict.lat},${currentDistrict.lon}`;
      console.log("📍 Points URL:", pointsUrl);

      const pointsResponse = await fetch(pointsUrl, {
        headers: {
          "User-Agent": "BristolPredict (bristol-predict.com, contact@bristol-predict.com)"
        }
      });

      if (!pointsResponse.ok) {
        const errorText = await pointsResponse.text();
        console.error("❌ Points response error:", pointsResponse.status, errorText);
        throw new Error(`Grid lookup failed (${pointsResponse.status}). Coordinates may be outside coverage area.`);
      }

      const pointsData = await pointsResponse.json();
      console.log("✅ Points data received:", pointsData.properties);

      const forecastUrl = pointsData.properties?.forecast;

      if (!forecastUrl) {
        throw new Error("No forecast URL returned from NOAA grid lookup");
      }

      console.log("🔗 Forecast URL:", forecastUrl);

      // Step 2: Get forecast using grid data
      const forecastResponse = await fetch(forecastUrl, {
        headers: {
          "User-Agent": "BristolPredict (bristol-predict.com, contact@bristol-predict.com)"
        }
      });

      if (!forecastResponse.ok) {
        const errorText = await forecastResponse.text();
        console.error("❌ Forecast response error:", forecastResponse.status, errorText);
        throw new Error(`Forecast fetch failed (${forecastResponse.status}). Check console for details.`);
      }

      const forecastData = await forecastResponse.json();
      const periods = forecastData.properties?.periods;

      console.log("✅ Forecast data received:", periods?.length || 0, "periods");

      if (!periods || periods.length === 0) {
        throw new Error("No forecast periods in NOAA response");
      }

      // Extract current conditions from first period
      const current = periods[0];
      
      // Parse temperature (remove "F" if present)
      const tempStr = current.temperature?.toString().replace("F", "").trim();
      const temp = tempStr ? parseInt(tempStr) : null;
      
      // Parse wind speed
      const windStr = current.windSpeed?.toString().replace(" mph", "").trim();
      const windSpeed = windStr ? parseInt(windStr) : null;

      // Determine condition from short forecast text
      const condition = determineCondition(current.shortForecast);

      console.log("🌤️ Parsed weather:", { condition, temp, windSpeed, direction: current.windDirection });

      setCurrentWeather({
        condition,
        temp,
        windSpeed,
        humidity: null,
        windDirection: current.windDirection || null,
        relativeHumidity: null,
        loading: false,
        error: null,
      });

      // Build forecast chart data
      buildForecastChart(forecastData);
    } catch (error) {
      console.error("❌ Error fetching NOAA data:", error);
      setCurrentWeather(prev => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to fetch weather data from NOAA",
      }));
    }
  };

  const buildForecastChart = async (forecastData) => {
    try {
      const hourlyUrl = forecastData.properties?.forecastHourly;
      
      if (!hourlyUrl) {
        console.warn("⚠️ No hourly forecast URL available, using period data");
        // Fallback: use period data for chart
        const periods = forecastData.properties?.periods || [];
        const chartData = periods.slice(0, 8).map((period, index) => {
          const tempStr = period.temperature?.toString().replace("F", "").trim();
          const temp = tempStr ? parseInt(tempStr) : null;
          
          return {
            date: period.name,
            temp: temp,
          };
        });
        setForecastData(chartData);
        return;
      }

      const hourlyResponse = await fetch(hourlyUrl, {
        headers: {
          "User-Agent": "BristolPredict (bristol-predict.com, contact@bristol-predict.com)"
        }
      });

      if (!hourlyResponse.ok) {
        console.warn("⚠️ Hourly forecast failed, using period data instead");
        // Fallback to period data
        const periods = forecastData.properties?.periods || [];
        const chartData = periods.slice(0, 8).map((period) => {
          const tempStr = period.temperature?.toString().replace("F", "").trim();
          const temp = tempStr ? parseInt(tempStr) : null;
          return { date: period.name, temp };
        });
        setForecastData(chartData);
        return;
      }

      const hourlyData = await hourlyResponse.json();
      const periods = hourlyData.properties?.periods || [];

      console.log("📊 Hourly periods received:", periods.length);

      const chartData = periods.slice(0, 24).map((period, index) => {
        const tempStr = period.temperature?.toString().replace("F", "").trim();
        const temp = tempStr ? parseInt(tempStr) : null;
        
        const startTime = new Date(period.startTime);
        const hour = startTime.getHours();

        return {
          date: `${hour.toString().padStart(2, '0')}:00`,
          temp: temp,
        };
      });

      setForecastData(chartData);
    } catch (error) {
      console.warn("⚠️ Error building forecast chart:", error);
      // Don't fail the component if hourly data fails
    }
  };

  const determineCondition = (shortForecast) => {
    if (!shortForecast) return "Partly Cloudy";
    
    const forecast = shortForecast.toLowerCase();
    
    if (forecast.includes("sunny") || forecast.includes("clear")) {
      return "Sunny";
    } else if (forecast.includes("rain") || forecast.includes("precipitation")) {
      return "Rainy";
    } else if (forecast.includes("cloud") && !forecast.includes("overcast")) {
      return "Partly Cloudy";
    } else if (forecast.includes("overcast")) {
      return "Overcast";
    } else if (forecast.includes("wind")) {
      return "Windy";
    }
    return "Partly Cloudy";
  };

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
  };

  const currentDistrictData = DISTRICTS.find(d => d.id === activeDistrict);

  const getWeatherIcon = () => {
    switch (currentWeather.condition) {
      case "Sunny":
        return <Sun size={64} color="#f59e0b" />;
      case "Rainy":
        return <CloudRain size={64} color="#3b82f6" />;
      case "Overcast":
        return <Cloud size={64} color="#64748b" />;
      case "Windy":
        return <Wind size={64} color="#8b5cf6" />;
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
            Real-time weather, tides, and water temperature data by district
          </p>
          <div className="demo-badge">
            ✅ LIVE NOAA DATA - Real Weather Forecasts
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
            <strong>Data Status:</strong> Current conditions and forecasts are live from NOAA's National Weather Service API (free, no API key required).
            Tide predictions and water temperature data are currently mock. Next phase: integrate district-specific NOAA weather stations and CO-OPS tidal data.
          </div>
        </div>

        {/* Live Weather Embed */}
        <div className="weather-card">
          <h3 className="card-title">
            <Cloud size={20} /> Live Weather & Forecast Map (Real-time)
          </h3>
          <p className="chart-description">
            Powered by Windy.com - Real-time wind, rain, and temperature visualization for {currentDistrictData?.name}
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

        {/* Current Conditions Card - LIVE NOAA DATA */}
        <div className="weather-card">
          <h3 className="card-title">
            <Cloud size={20} /> Current Conditions (Live - NOAA API)
          </h3>
          {currentWeather.loading && (
            <div className="loading-state">
              <Loader size={20} className="spinner" />
              Loading live weather data from NOAA...
            </div>
          )}
          {currentWeather.error && (
            <div className="error-state">
              <AlertCircle size={20} />
              <div>
                <strong>Error:</strong> {currentWeather.error}
                <div style={{ fontSize: "11px", marginTop: "6px", opacity: 0.8 }}>
                  Check browser console (F12) for debugging info
                </div>
              </div>
            </div>
          )}
          {!currentWeather.loading && !currentWeather.error && (
            <>
              <div className="weather-display">
                <div className="weather-icon-display">
                  {getWeatherIcon()}
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
                      <span className="metric-value">{currentWeather.windSpeed || "N/A"} mph</span>
                      <span className="metric-label">Wind Speed</span>
                    </div>
                    {currentWeather.windDirection && (
                      <div className="metric">
                        <Wind size={20} />
                        <span className="metric-value">{currentWeather.windDirection}</span>
                        <span className="metric-label">Direction</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="data-source-badge">Data from NOAA National Weather Service • Real-time • Free API</div>
            </>
          )}
        </div>

        {/* 24-Hour Forecast Chart */}
        {forecastData.length > 0 && (
          <div className="chart-card">
            <h3 className="card-title">
              <Thermometer size={20} /> Temperature Forecast (Real-time)
            </h3>
            <p className="chart-description">
              Live forecast data from NOAA for {currentDistrictData?.name}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip 
                  contentStyle={{ background: "#1e293b", border: "1px solid #3b82f6" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="temp" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                  name="Temperature (°F)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Water Temperature Chart - MOCK */}
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

        {/* Tide Pattern Chart - MOCK */}
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
          <h3 className="guide-title">🔄 Real-Time Data Integration Status</h3>
          <div className="integration-items">
            <div className="integration-item">
              <div className="item-status live">Live</div>
              <div className="item-content">
                <strong>Current Weather Conditions</strong>
                <p>Temperature, wind speed, wind direction from NOAA NWS API (no API key required)</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status live">Live</div>
              <div className="item-content">
                <strong>Temperature Forecast</strong>
                <p>Hourly or period forecasts from NOAA National Weather Service</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status live">Live</div>
              <div className="item-content">
                <strong>Weather Map Visualization</strong>
                <p>Interactive Windy.com embed showing wind patterns and forecasts</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status">Mock</div>
              <div className="item-content">
                <strong>Water Temperature & Tides</strong>
                <p>Coming soon: District-specific NOAA weather stations and CO-OPS tidal predictions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}