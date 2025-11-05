import { useState, useEffect } from "react";

export default function DatePicker({ selectedDate, onDateChange }) {
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("📅 DatePicker: Fetching available dates...");

    // Fetch available dates from API
    fetch("http://localhost:3001/api/dates")
      .then((res) => res.json())
      .then((data) => {
        console.log("📅 DatePicker: Received dates:", data);
        setAvailableDates(data.dates || []);
        setLoading(false);

        // If no date selected yet, select the most recent
        if (!selectedDate && data.dates && data.dates.length > 0) {
          console.log(
            `📅 DatePicker: Auto-selecting most recent date: ${data.dates[0]}`
          );
          onDateChange(data.dates[0]);
        }
      })
      .catch((err) => {
        console.error("❌ DatePicker: Error fetching dates:", err);
        setLoading(false);
      });
  }, []);

  const formatDisplayDate = (dateStr) => {
    const [month, day, year] = dateStr.split("-");
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #3b82f6",
          color: "#94a3b8",
          fontSize: "14px",
        }}
      >
        ⏳ Loading dates...
      </div>
    );
  }

  if (availableDates.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #f59e0b",
          color: "#fbbf24",
          fontSize: "14px",
        }}
      >
        ⚠️ No historical data available. Run the backfill script first.
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid #3b82f6",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <label
        style={{
          color: "#60a5fa",
          fontSize: "14px",
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}
      >
        📅 Select Date:
      </label>
      <select
        value={selectedDate || ""}
        onChange={(e) => onDateChange(e.target.value)}
        style={{
          flex: 1,
          backgroundColor: "#1e293b",
          color: "white",
          border: "1px solid #475569",
          borderRadius: "4px",
          padding: "8px 12px",
          fontSize: "14px",
          cursor: "pointer",
          minWidth: "250px",
        }}
      >
        {availableDates.map((date) => (
          <option key={date} value={date}>
            {formatDisplayDate(date)}
          </option>
        ))}
      </select>
      <div
        style={{
          fontSize: "12px",
          color: "#94a3b8",
          whiteSpace: "nowrap",
        }}
      >
        {availableDates.length} days available
      </div>
    </div>
  );
}
