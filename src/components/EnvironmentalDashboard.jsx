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
  ReferenceLine,
} from "recharts";
import { CloudRain, Cloud, Sun, Wind, Droplets, Thermometer, AlertCircle, Loader, Waves } from "lucide-react";
import "../styles/EnvironmentalDashboard.css";

/**
 * EnvironmentalDashboard Component
 * Displays NOAA real-time weather data with district tabs, live Windy embed, 
 * real tidal predictions from CO-OPS, and wave/sea height data from marine forecasts
 */

const DISTRICTS = [   //was tideStation 9465374 - snag pt dillingham
  { id: "naknek", name: "Naknek-Kvichak", lat: 58.745, lon: -157.040, marineZone: "PKZ761", tideStation: "9465203", stationName: "Naknek River Enterance" }, //9465203 - NaknekRiver enterance  
  { id: "egegik", name: "Egegik", lat: 58.177, lon: -157.398, marineZone: "PKZ761", tideStation: "9464874", stationName: "Egegik River" }, //9464881 - Egegik River ent. | 9464874 - Egegik river
  { id: "ugashik", name: "Ugashik", lat: 57.47, lon: -156.92, marineZone: "PKZ761", tideStation: "9464512", stationName: "Dago Creek Mouth, Ugashik Bay" }, //9464512 - Dago creek mouth
  { id: "nushagak", name: "Nushagak", lat: 59.035, lon: -161.033, marineZone: "PKZ760", tideStation: "9465261", stationName: "Clarks Pt, Nushagak Bay" }, //9465261 - clarks point Nush bay
  { id: "togiak", name: "Togiak", lat: 59.054, lon: -160.419, marineZone: "PKZ760", tideStation: "9465265", stationName: "Kulukak Pt, Kulukak Bay" }, //9465182 - black rock, walrus islands |   9465265 - kulukak point 
];

const WINDY_EMBED_URLS = {
  naknek: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=58.72&lon=-157.176&detailLat=58.65551339815602&detailLon=-157.27203369140628&marker=true&message=true",
  egegik: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=10&overlay=wind&product=ecmwf&level=surface&lat=58.226&lon=-157.449&detailLat=58.21196137079872&detailLon=-157.52059936523438&marker=true&message=true",
  ugashik: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=10&overlay=wind&product=ecmwf&level=surface&lat=57.564&lon=-157.721&detailLat=57.5909753067477&detailLon=-157.73071289062503&marker=true&message=true",
  nushagak: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=58.724&lon=-158.546&detailLat=58.63264633236806&detailLon=-158.55194091796878&marker=true&message=true",
  togiak: "https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=kt&zoom=8&overlay=wind&product=ecmwf&level=surface&lat=58.834&lon=-160.411&detailLat=58.839&detailLon=-160.505&marker=true&message=true",
};

export default function EnvironmentalDashboard({ onBack }) {
  const [tideData, setTideData] = useState([]);
  const [forecastData, setForecastData] = useState([]);
  const [currentWeather, setCurrentWeather] = useState({
    condition: "Loading...",
    temp: null,
    windSpeed: null,
    windDirection: null,
    waveHeight: null,
    marineWarnings: [],
    loading: true,
    error: null,
  });
  const [activeDistrict, setActiveDistrict] = useState("naknek");
  const [tidesLoading, setTidesLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  //fetch NOAA weather data when district changes
  useEffect(() => {
    fetchNOAAWeatherData();
    fetchTidalData();
  }, [activeDistrict]);

  //update current time every minute (for tidal chart)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());      
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchNOAAWeatherData = async () => {
    const currentDistrict = DISTRICTS.find(d => d.id === activeDistrict);
    
    if (!currentDistrict) return;

    try {
      setCurrentWeather(prev => ({ ...prev, loading: true, error: null }));

      console.log(`🌍 Fetching NOAA data for ${currentDistrict.name} (${currentDistrict.lat}, ${currentDistrict.lon})`);

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

      // get forecast using grid data
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

      //extract current conditions from first period
      const current = periods[0];
      
      //parse temperature (remove "F" if present)
      const tempStr = current.temperature?.toString().replace("F", "").trim();
      const temp = tempStr ? parseInt(tempStr) : null;
      
      //parse wind speed
      const windStr = current.windSpeed?.toString().replace(" mph", "").trim();
      const windSpeed = windStr ? parseInt(windStr) : null;

      //determine condition from short forecast text
      const condition = determineCondition(current.shortForecast);

      console.log("🌤️ Parsed weather:", { condition, temp, windSpeed, direction: current.windDirection });

      setCurrentWeather({
        condition,
        temp,
        windSpeed,
        windDirection: current.windDirection || null,
        waveHeight: null,
        marineWarnings: [],
        loading: false,
        error: null,
      });

      //build forecast chart data
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

  const fetchTidalData = async () => {
    const currentDistrict = DISTRICTS.find(d => d.id === activeDistrict);
    if (!currentDistrict) return;

    try {
      setTidesLoading(true);
      console.log(`🌊 Fetching tidal data for station ${currentDistrict.tideStation}`);

      //get today's date range for CO-OPS API
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const beginDate = today.toISOString().split('T')[0].replace(/-/g, '');
      const endDate = tomorrow.toISOString().split('T')[0].replace(/-/g, '');

      //fetch tidal predictions from NOAA CO-OPS API : 6-minute interval 
      const tideUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
        `station=${currentDistrict.tideStation}&` +
        `begin_date=${beginDate}&` +
        `end_date=${endDate}&` +
        `product=predictions&` +
        `datum=MLLW&` +
        `interval=6&` +
        `units=english&` +
        `time_zone=lst_ldt&` +
        `format=json&` +
        `application=BristolPredict`;
      console.log("🔗 Tide URL:", tideUrl);

      const tideResponse = await fetch(tideUrl);
      
      if (!tideResponse.ok) {
        throw new Error(`Tide API returned status ${tideResponse.status}`);
      }

      const tideJson = await tideResponse.json();
      const predictions = tideJson.predictions || [];
      console.log(`✅ Tidal predictions received: ${predictions.length} points`);

      if (predictions.length === 0) {
        throw new Error("No tidal predictions returned");
      }

      //transform predictions for chart (take every 6th point for hourly display)
      const chartData = predictions
        .filter((_, index) => index % 6 === 0) //every 6th point = hourly
        .map(prediction => {
          const time = new Date(prediction.t);
          const hour = time.getHours().toString().padStart(2, '0');
          const minute = time.getMinutes().toString().padStart(2, '0');
          
          return {
            time: `${hour}:${minute}`,
            date: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            height: parseFloat(prediction.v).toFixed(2),
            fullTime: time,
          };
        });

      setTideData(chartData);
      setTidesLoading(false);
      console.log("📊 Tide chart data ready:", chartData.length, "points");
    } catch (error) {
      console.error("❌ Error fetching tidal data:", error);
      setTideData([]);
      setTidesLoading(false);
    }
  };

  const buildForecastChart = async (forecastData) => {
    try {
      const hourlyUrl = forecastData.properties?.forecastHourly;
      
      if (!hourlyUrl) {
        console.warn("⚠️ No hourly forecast URL available, using period data");
        //fallback: use period data for chart
        const periods = forecastData.properties?.periods || [];
        const chartData = periods.slice(0, 8).map((period) => {
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
        //fallback to period data if hourly forecast not available
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

      const chartData = periods.slice(0, 24).map((period) => {
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
      //don't fail the component if hourly data fails
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

  //prep tide data with current time marker
  const getTideDataWithMarker = () => {
    if (!tideData || tideData.length === 0) return [];
    
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    let closestDifference = Infinity;
    let closestIndex = -1;

    //find closest data point for curr time
    tideData.forEach((item, index) => {
      const [hours, minutes] = item.time.split(':').map(Number);
      const itemTotalMinutes = hours * 60 + minutes;
      const difference = Math.abs(itemTotalMinutes - currentTotalMinutes);
      
      if (difference < closestDifference) {
        closestDifference = difference;
        closestIndex = index;
      }
    });

    // mark it orange
    return tideData.map((item, index) => ({
      ...item,
      isNow: index === closestIndex,
    }));
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
            <span className="title-icon">🌦️</span>
            Weather Dashboard
          </h2>
          <p className="env-subtitle">
            Real-time weather data by district, from multiple sources
          </p>
          <div className="demo-badge">
            ✅ LIVE DATA - Weather & Tides from NOAA and windy.com
          </div>
        </div>
      </div>

      <div className="env-content">
        {/* district tabs */}
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

        {/* disclaimer banner */}
        <div className="disclaimer-banner">
          <div className="disclaimer-icon">ℹ️</div>
          <div className="disclaimer-text">
            <strong>Data Status:</strong> Current conditions and forecasts are live from NOAA's National Weather Service API. 
            Tidal predictions and wave height data are live from NOAA CO-OPS and marine forecasts.  
            Next phase: integrate district-specific water temperature sensors.
          </div>
        </div>

        {/* Live Weather Embed */}
        <div className="weather-card">
          <h3 className="card-title">
            <Cloud size={20} /> Live Wind/Waves Forecast Map
          </h3>
          <p className="chart-description">
            Powered by Windy.com - Real-time wind, waves, rain, and temperature visualization for {currentDistrictData?.name}   |   
            Click wind icon in upper-right corner of map to view other layers
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

        {/*current conditions card - LIVE NOAA data */}
        <div className="weather-card">
          <h3 className="card-title">
            <Cloud size={20} /> Current Conditions (NOAA)
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
                    {currentWeather.waveHeight && (
                      <div className="metric">
                        <Waves size={20} />
                        <span className="metric-value">{currentWeather.waveHeight} ft</span>
                        <span className="metric-label">Sea Height</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* marine warnings section */}
              {currentWeather.marineWarnings && currentWeather.marineWarnings.length > 0 && (
                <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#fef3c7", borderRadius: "6px", borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#92400e", marginBottom: "8px" }}>
                    ⚠️ ACTIVE MARINE WARNINGS
                  </div>
                  <div style={{ fontSize: "13px", color: "#b45309" }}>
                    {currentWeather.marineWarnings.map((warning) => (
                      <div key={warning} style={{ marginBottom: "4px" }}>
                        • {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="data-source-badge">Data from NOAA National Weather Service & CO-OPS</div>
            </>
          )}
        </div>

        {/*tidal patterns chart :  NOAA CO-OPS DATA */}
        <div className="chart-card">
          <h3 className="card-title">
            <Droplets size={20} /> Tidal Predictions (NOAA CO-OPS)
          </h3>
          <p className="chart-description">
            Real-time 24-hour tidal predictions for {currentDistrictData?.name} (Station: {currentDistrictData?.stationName} - ID:{currentDistrictData?.tideStation})
          </p>
          <p style={{ fontSize: "12px", color: "#f59e0b", marginTop: "-12px", marginBottom: "16px" }}>
            🟠 = current time
          </p>
          {tidesLoading && (
            <div className="loading-state">
              <Loader size={20} className="spinner" />
              Loading tidal data from NOAA CO-OPS...
            </div>
          )}
          {tideData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getTideDataWithMarker()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" label={{ value: "Height (ft)", angle: -90, position: "insideLeft" }} domain={[-3, 25]} />
                <Tooltip 
                  contentStyle={{ background: "#1e293b", border: "1px solid #3b82f6" }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(value) => `${value} ft`}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ backgroundColor: "#0f172a", border: "1px solid #3b82f6", borderRadius: "6px", padding: "8px 12px" }}>
                          <p style={{ margin: "0 0 4px 0", color: "#60a5fa" }}>{data.date} @ {data.time}</p>
                          <p style={{ margin: "0", color: "#06b6d4" }}>Height: {data.height} ft</p>
                          {data.isNow && <p style={{ margin: "4px 0 0 0", color: "#f59e0b", fontSize: "12px" }}>← NOW</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="height" 
                  stroke="#06b6d4" 
                  dot={({ cx, cy, payload }) => {
                    if (payload.isNow) {
                      return (
                        <circle 
                          key={`dot-now-${payload.time}`}
                          cx={cx} 
                          cy={cy} 
                          r={5} 
                          fill="#f59e0b" 
                          stroke="#fbbf24" 
                          strokeWidth={2} 
                        />
                      );
                    }
                    return null;
                  }}
                  strokeWidth={2}
                  name="Water Level (ft MLLW)"
                />
                <ReferenceLine 
                  y={0} 
                  stroke="#64748b" 
                  strokeDasharray="5 5" 
                  label={{ value: "0", position: "insideLeft", dx: -28 , fill: "#94a3b8", offset: 10 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              {tidesLoading ? "Loading..." : "No tidal data available for this district."}
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "12px" }}>
            Data from NOAA CO-OPS • Heights in feet above Mean Lower Low Water (MLLW) • Predictions updated quarterly
          </div>
        </div>

        {/* 24-Hour forecast chart */}
        {forecastData.length > 0 && (
          <div className="chart-card">
            <h3 className="card-title">
              <Thermometer size={20} /> Daily Temperature Forecast
            </h3>
            <p className="chart-description">
              Forecast data from NOAA for {currentDistrictData?.name}
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

        {/* integration status */}
        <div className="integration-guide">
          <h3 className="guide-title">ℹ️ Data Integration Status:</h3>
          <div className="integration-items">
            <div className="integration-item">
              <div className="item-status live">Live</div>
              <div className="item-content">
                <strong>Current Weather Conditions</strong>
                <p>Temperature, wind speed, wind direction from NOAA NWS API</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status planned">Planned</div>
              <div className="item-content">
                <strong>Wave Height & Sea State</strong>
                <p>Soon will implement sea height and marine warnings from NWS coastal forecasts</p>
              </div>
            </div>
            <div className="integration-item">
              <div className="item-status live">Live</div>
              <div className="item-content">
                <strong>Tidal Predictions</strong>
                <p>Real-time 24-hour tidal predictions from NOAA CO-OPS (6-minute intervals)</p>
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
                <p>Interactive Windy.com embed showing wind/wave patterns and forecasts</p>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}