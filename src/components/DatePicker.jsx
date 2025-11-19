import { useState, useEffect } from "react";
import "../styles/DatePicker.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api"; //for railway deployment

export default function DatePicker({
  selectedDate,
  onDateChange,
  selectedSeason,
  onSeasonChange,
  dateRangeMode = false,
  selectedDateRange,
  onDateRangeChange,
}) {
  const [availableDates, setAvailableDates] = useState([]);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);

  useEffect(() => {
    console.log("📅 DatePicker: Fetching available dates...");

    //fetch("http://localhost:3001/api/dates") //before railway
    fetch(`${API_BASE_URL}/dates`)
      .then((res) => res.json())
      .then((data) => {
        console.log("📅 DatePicker: Received dates:", data);
        
        // Set available seasons
        if (data.seasons && data.seasons.length > 0) {
          setAvailableSeasons(data.seasons);
          console.log("📅 Available seasons:", data.seasons);
          
          if (!selectedSeason) {
            onSeasonChange(data.seasons[data.seasons.length - 1]);
          }
        }

        setAvailableDates(data.dates || []);
        setLoading(false);

        if (!selectedDate && data.dates && data.dates.length > 0) {
          console.log(`📅 DatePicker: Auto-selecting most recent date: ${data.dates[0]}`);
          onDateChange(data.dates[0]);
        }

        if (dateRangeMode && !rangeEnd && data.dates && data.dates.length > 0) {
          setRangeEnd(data.dates[0]);
        }
      })
      .catch((err) => {
        console.error("❌ DatePicker: Error fetching dates:", err);
        setLoading(false);
      });
  }, []);

  // Fetch dates when season changes
  useEffect(() => {
    if (!selectedSeason) return;

    console.log(`📅 DatePicker: Fetching dates for season ${selectedSeason}...`);

    //fetch(`http://localhost:3001/api/dates?season=${selectedSeason}`) //before railway deployment
    fetch(`${API_BASE_URL}/dates?season=${selectedSeason}`)
      .then((res) => res.json())
      .then((data) => {
        console.log(`📅 DatePicker: Retrieved ${data.dates.length} dates for season ${selectedSeason}`);
        setAvailableDates(data.dates || []);
        
        if (data.dates && data.dates.length > 0) {
          onDateChange(data.dates[data.dates.length - 1]);
          setRangeStart(data.dates[data.dates.length - 1]);
          setRangeEnd(null);
        }
      })
      .catch((err) => {
        console.error("❌ DatePicker: Error fetching season dates:", err);
      });
  }, [selectedSeason]);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const [month, day, year] = dateStr.split("-");
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleRangeStartChange = (e) => {
    const newStart = e.target.value;
    setRangeStart(newStart);
    if (rangeEnd && newStart <= rangeEnd) {
      onDateRangeChange(newStart, rangeEnd);
    }
  };

  const handleRangeEndChange = (e) => {
    const newEnd = e.target.value;
    setRangeEnd(newEnd);
    if (rangeStart && rangeStart <= newEnd) {
      onDateRangeChange(rangeStart, newEnd);
    } else if (!rangeStart) {
      setRangeStart(newEnd);
      onDateRangeChange(newEnd, newEnd);
    }
  };

  const getDateIndex = (dateStr) => availableDates.indexOf(dateStr);

  const getDaysBetween = () => {
    if (!rangeStart || !rangeEnd) return 0;
    return Math.abs(getDateIndex(rangeStart) - getDateIndex(rangeEnd)) + 1;
  };

  if (loading) {
    return (
      <div className="datepicker-container">
        <div className="datepicker-loading">
          ⏳ Loading dates...
        </div>
      </div>
    );
  }

  if (availableDates.length === 0) {
    return (
      <div className="datepicker-container">
        <div className="datepicker-warning">
          ⚠️ No historical data available. Run the backfill script first.
        </div>
      </div>
    );
  }

  return (
    <div className="datepicker-container">
      {/* Season Selector */}
      {availableSeasons.length > 0 && (
        <div className="season-selector">
          <label>Season:</label>
          <div className="season-buttons">
            {availableSeasons.map((season) => (
              <button
                key={season}
                className={`season-btn ${selectedSeason === season ? "active" : ""}`}
                onClick={() => onSeasonChange(season)}
              >
                {season}
              </button>
            ))}
          </div>
        </div>
      )}

      {!dateRangeMode ? (
        // Single Date Mode
        <div className="datepicker-single">
          <label>Select Date:</label>
          <select
            value={selectedDate || ""}
            onChange={(e) => onDateChange(e.target.value)}
            className="date-select"
          >
            <option value="">-- Choose a date --</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDisplayDate(date)}
              </option>
            ))}
          </select>
          {selectedDate && (
            <span className="selected-date-display">
              {formatDisplayDate(selectedDate)}
            </span>
          )}
        </div>
      ) : (
        // Date Range Mode
        <div className="datepicker-range">
          <label>Select Date Range:</label>
          <div className="range-inputs">
            <div className="range-field">
              <label className="range-label">From:</label>
              <select
                value={rangeStart || ""}
                onChange={handleRangeStartChange}
                className="date-select"
              >
                <option value="">-- Start date --</option>
                {availableDates.map((date) => (
                  <option key={`start-${date}`} value={date}>
                    {formatDisplayDate(date)}
                  </option>
                ))}
              </select>
            </div>

            <div className="range-field">
              <label className="range-label">To:</label>
              <select
                value={rangeEnd || ""}
                onChange={handleRangeEndChange}
                className="date-select"
              >
                <option value="">-- End date --</option>
                {availableDates.map((date) => (
                  <option key={`end-${date}`} value={date}>
                    {formatDisplayDate(date)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rangeStart && rangeEnd && (
            <div className="range-summary">
              <span className="range-dates">
                📅 {formatDisplayDate(rangeStart)} → {formatDisplayDate(rangeEnd)}
              </span>
              <span className="range-days">
                ({getDaysBetween()} day{getDaysBetween() !== 1 ? "s" : ""})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}