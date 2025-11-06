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

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];

export function LineChart_DayToDayComparison({ historicalData, selectedDistrict }) {
  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No historical data available for chart</p>
      </div>
    );
  }

  // Reverse data so oldest dates are first (left side of chart)
  const reversedData = [...historicalData].reverse();

  // Prepare data for line chart
  const chartData = reversedData.map((day) => {
    const dataPoint = {
      date: day.runDate,
    };

    if (selectedDistrict) {
      const district = day.districts?.find((d) => d.id === selectedDistrict);
      if (district) {
        dataPoint.catchDaily = district.catchDaily;
      }
    } else {
      dataPoint.totalCatch = day.totalRun?.catchDaily;
    }

    return dataPoint;
  });

  return (
    <div className="chart-container">
      <h3 className="chart-title">📈 Daily Catch Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            interval={2}
          />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
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
          {selectedDistrict ? (
            <Line
              type="monotone"
              dataKey="catchDaily"
              stroke={DISTRICT_COLORS[selectedDistrict] || "#3b82f6"}
              dot={false}
              strokeWidth={2}
              name="Daily Catch"
            />
          ) : (
            <Line
              type="monotone"
              dataKey="totalCatch"
              stroke="#60a5fa"
              dot={false}
              strokeWidth={2}
              name="Total Daily Catch"
            />
          )}
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
      <h3 className="chart-title">📊 District Comparison (Daily)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
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
      <h3 className="chart-title">🥧 Catch Distribution by District</h3>
      <ResponsiveContainer width="100%" height={300}>
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

export function LineChart_MultiDistrict_SockeyePerDelivery({ historicalData, districts }) {
  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No historical data available</p>
      </div>
    );
  }

  // Reverse data so oldest dates are first (left side of chart)
  const reversedData = [...historicalData].reverse();

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

  return (
    <div className="chart-container">
      <h3 className="chart-title">🐟 Sockeye Per Delivery Trend</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            interval={2}
          />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
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
          {Object.entries(districts).map(([districtId, district]) => (
            <Line
              key={districtId}
              type="monotone"
              dataKey={districtId}
              stroke={DISTRICT_COLORS[districtId] || "#3b82f6"}
              dot={false}
              strokeWidth={2}
              name={`${district.name} (Sockeye/Delivery)`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart_MultiDistrict({ historicalData, districts }) {
  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 No historical data available</p>
      </div>
    );
  }

  // Reverse data so oldest dates are first (left side of chart)
  const reversedData = [...historicalData].reverse();

  const chartData = reversedData.map((day) => {
    const dataPoint = {
      date: day.runDate,
    };

    day.districts?.forEach((district) => {
      dataPoint[district.id] = district.catchDaily;
    });

    return dataPoint;
  });

  return (
    <div className="chart-container">
      <h3 className="chart-title">📈 Multi-District Trend</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            interval={2}
          />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
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