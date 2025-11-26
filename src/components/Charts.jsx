import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatNumber } from "../services/api";
import "../styles/Charts.css";

const DISTRICT_COLORS = {
  naknek: "#3b82f6",
  egegik: "#8b5cf6",
  ugashik: "#ec4899",
  nushagak: "#10b981",
  togiak: "#f59e0b",
};

const CHART_NOTES = {
  "07-18-2025": "ADF&G did not collect data on this date :(",
  "07-19-2025": "ADF&G did not collect data on this date :(",
  "07-21-2025": "ADF&G did not collect data on this date :(",
  "07-23-2025": "ADF&G did not collect data on this date :(",

  "07-20-2024": "ADF&G did not collect data on this date :(",
  "07-19-2024": "ADF&G did not collect data on this date :(",
  "07-26-2024": "ADF&G did not collect data on/after this date :(",

  "07-21-2023": "ADF&G did not collect data on/after this date :(",
};

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];

//tooltip component for charts with notes
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #3b82f6",
          borderRadius: "6px",
          padding: "8px 12px",
          color: "#e2e8f0",
        }}
      >
        <p style={{ margin: "0 0 4px 0", color: "#60a5fa" }}>{data.date}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: "2px 0", color: entry.color }}>
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
        {data.note && (
          <p style={{ margin: "4px 0 0 0", color: "#fbbf24", fontSize: "12px", fontStyle: "italic" }}>
            📝 {data.note}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function LineChart_DayToDayComparison({ historicalData, selectedDistrict, selectedSeason }) {
  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No historical data available for chart</p>
      </div>
    );
  }

  //filter data by selected season
  const filteredData = selectedSeason
    ? historicalData.filter((day) => day.season === selectedSeason)
    : historicalData;

  if (filteredData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No data available for {selectedSeason} season</p>
      </div>
    );
  }

  //reverse data so oldest dates are first (left side of chart)
  const reversedData = [...filteredData].reverse();

  //prep data for line chart
  const chartData = reversedData.map((day) => {
    const dataPoint = {
      date: day.runDate,
    };

    dataPoint.totalCatch = day.totalRun?.catchDaily;


    //NOTES
    if (CHART_NOTES[day.runDate]) {
      dataPoint.note = CHART_NOTES[day.runDate];
    }


    return dataPoint;
  });

  const interval = Math.max(0, Math.floor(chartData.length / 20));

  return (
    <div className="chart-container">
      <h3 className="chart-title">Bay-Wide Catch Per Day</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            type="category"
            domain={[0,filteredData.length - 1]}
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={interval}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }}
            label={{ value: "# of Sockeye", angle: -90, position: "outsideRight", offset: -5, dx: -44 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          
            <Line
              type="monotone"
              dataKey="totalCatch"
              stroke="#60a5fa"
              dot={false}
              strokeWidth={2}
              name="Total Daily Catch"
            />
          
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart_DistrictComparison({ data, districtNames }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No data available for comparison</p>
      </div>
    );
  }

  const chartData = Object.entries(data).map(([districtId, districtData]) => ({
    name: districtNames[districtId]?.name || districtId,
    catchDaily: districtData.catchDaily,
    escapementDaily: districtData.escapementDaily,
  }));

  return (
    <div className="chart-container">
      <h3 className="chart-title">District Comparison (Daily)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: -5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }}
            label={{ value: "# of Sockeye", angle: -90, position: "outsideRight", offset: 10, dx: -34.5 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #3b82f6",
              borderRadius: "6px",
              color: "#e2e8f0",
            }}
            formatter={(value) => formatNumber(value)}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          <Bar dataKey="catchDaily" fill="#3b82f6" name="Daily Catch" />
          <Bar dataKey="escapementDaily" fill="#10b981" name="Daily Escapement" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieChart_CatchDistribution({ districtData, districtNames }) {
  if (!districtData || Object.keys(districtData).length === 0) {
    return (
      <div className="chart-placeholder">
        <p>🥧 No data available for distribution</p>
      </div>
    );
  }

  const chartData = Object.entries(districtData)
    .map(([districtId, data], index) => ({
      name: districtNames[districtId]?.name || districtId,
      value: data.catchDaily,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>🥧 No catch data available</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Catch Distribution by District</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value, percent }) =>
              `${name}: ${formatNumber(value)} (${(percent * 100).toFixed(1)}%)`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #3b82f6",
              borderRadius: "6px",
              color: "#e2e8f0",
            }}
            formatter={(value) => formatNumber(value)}
            labelStyle={{ color: "#94a3b8" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart_MultiDistrict({ historicalData, districts, selectedSeason }) {
  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No historical data available</p>
      </div>
    );
  }

  // Filter data by selected season
  const filteredData = selectedSeason
    ? historicalData.filter((day) => day.season === selectedSeason)
    : historicalData;

  if (filteredData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No data available for {selectedSeason} season</p>
      </div>
    );
  }

  // Reverse data so oldest dates are first (left side of chart)
  const reversedData = [...filteredData].reverse();

  const chartData = reversedData.map((day) => {
    const dataPoint = {
      date: day.runDate,
    };

    day.districts?.forEach((district) => {
      dataPoint[district.id] = district.catchDaily;
    });

    return dataPoint;
  });

  // Calculate interval to show reasonable number of ticks (roughly 15-20 labels)
  const interval = Math.max(0, Math.floor(chartData.length / 20));

  return (
    <div className="chart-container">
      <h3 className="chart-title">Daily Catch Trend Per District</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 12, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            type="category"
            domain={[0,filteredData.length - 1]}
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={interval}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }}
            label={{ value: "# of Sockeye", angle: -90, position: "outsideRight", offset: 10, dx: -36 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          {Object.entries(districts).map(([districtId, district]) => (
            <Line
              key={districtId}
              type="monotone"
              dataKey={districtId}
              stroke={DISTRICT_COLORS[districtId] || "#3b82f6"}
              dot={false}
              strokeWidth={2}
              name={district.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart_MultiDistrict_SockeyePerDelivery({ historicalData, districts, selectedSeason }) {
  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No historical data available</p>
      </div>
    );
  }

  // Filter data by selected season
  const filteredData = selectedSeason
    ? historicalData.filter((day) => day.season === selectedSeason)
    : historicalData;

  if (filteredData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No data available for {selectedSeason} season</p>
      </div>
    );
  }

  // Reverse data so oldest dates are first (left side of chart)
  const reversedData = [...filteredData].reverse();

  const chartData = reversedData.map((day) => {
    const dataPoint = {
      date: day.runDate,
    };

    // Get sockeye per delivery for each district
    if (day.sockeyePerDelivery && typeof day.sockeyePerDelivery === "object") {
      Object.entries(day.sockeyePerDelivery).forEach(([districtId, sockeyeValue]) => {
        dataPoint[districtId] = sockeyeValue;
      });
    }

    return dataPoint;
  });

  // Calculate interval to show reasonable number of ticks (roughly 15-20 labels)
  const interval = Math.max(0, Math.floor(chartData.length / 30));

  return (
    <div className="chart-container">
      <h3 className="chart-title">🐟 Sockeye Per Delivery Trends</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            type="category"
            domain={[0,filteredData.length - 1]}
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={interval}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }}
            label={{ value: "# of Sockeye", angle: -90, position: "outsideRight", offset: 10, dx: -20 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          {Object.entries(districts).map(([districtId, district]) => (
            <Line
              key={districtId}
              type="monotone"
              dataKey={districtId}
              stroke={DISTRICT_COLORS[districtId] || "#3b82f6"}
              dot={false}
              strokeWidth={2}
              name={`${district.name}`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * NEW: Line Chart for Date Range Mode
 * Shows daily catch trends for all 5 districts across the selected date range
 */
export function LineChart_DateRange({ rangeData, districts }) {
  if (!rangeData || !Array.isArray(rangeData) || rangeData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No data available for selected date range</p>
      </div>
    );
  }

  // Build chart data from the array of daily data
  const chartData = rangeData.map((dayData) => {
    const dataPoint = {
      date: dayData.runDate,
    };

    // Add daily catch for each district
    if (Array.isArray(dayData.districts)) {
      dayData.districts.forEach((district) => {
        dataPoint[district.id] = district.catchDaily || 0;
      });
    }

    return dataPoint;
  });

  if (chartData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No data available for chart</p>
      </div>
    );
  }

  // Calculate interval to show reasonable number of date ticks
  const interval = Math.max(0, Math.floor(chartData.length / 15));

  return (
    <div className="chart-container">
      <h3 className="chart-title">Daily Catch by District Over Selected Date Range</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 12, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={interval}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }}
            label={{ value: "# of Sockeye", angle: -90, position: "outsideRight", offset: 10, dx: -35 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          {Object.entries(districts).map(([districtId, district]) => (
            <Line
              key={districtId}
              type="monotone"
              dataKey={districtId}
              stroke={DISTRICT_COLORS[districtId] || "#3b82f6"}
              dot={false}
              strokeWidth={2.5}
              name={district.name}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}