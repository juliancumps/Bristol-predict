import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";
//const API_BASE_URL = import.meta.env.REACT_APP_API_URL || "http://localhost:3001/api";

/**
 * Fetch all districts with current data
 * @param {string} date - Optional date in MM-DD-YYYY format
 */
export async function getDistricts(date = null) {
  try {
    const url = date
      ? `${API_BASE_URL}/districts?date=${date}`
      : `${API_BASE_URL}/districts`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching districts:", error);
    throw error;
  }
}

/**
 * Fetch daily harvest summary
 * @param {string} date - Optional date in MM-DD-YYYY format
 */
export async function getDailySummary(date = null) {
  try {
    const url = date
      ? `${API_BASE_URL}/daily?date=${date}`
      : `${API_BASE_URL}/daily`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    throw error;
  }
}

/**
 * Fetch specific district data
 * @param {string} districtId - District ID (e.g., 'naknek')
 * @param {string} date - Optional date in MM-DD-YYYY format
 */
export async function getDistrict(districtId, date = null) {
  try {
    const url = date
      ? `${API_BASE_URL}/districts/${districtId}?date=${date}`
      : `${API_BASE_URL}/districts/${districtId}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching district ${districtId}:`, error);
    throw error;
  }
}

/**
 * Get all available dates in the database
 */
export async function getAvailableDates() {
  try {
    const response = await axios.get(`${API_BASE_URL}/dates`);
    return response.data;
  } catch (error) {
    console.error("Error fetching available dates:", error);
    throw error;
  }
}

/**
 * NEW: Fetch data for a date range
 * @param {string} startDate - Start date in MM-DD-YYYY format
 * @param {string} endDate - End date in MM-DD-YYYY format
 */
export async function getDateRangeData(startDate, endDate) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/range?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching date range data:", error);
    throw error;
  }
}

/**
 * NEW: Get historical data for charting (e.g., last 30 days)
 * @param {number} days - Number of days to retrieve
 */
export async function getHistoricalData(days = 30) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/historical?days=${days}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching historical data:", error);
    throw error;
  }
}

/**
 * Force refresh data from ADF&G
 */
export async function refreshData() {
  try {
    const response = await axios.post(`${API_BASE_URL}/refresh`);
    return response.data;
  } catch (error) {
    console.error("Error refreshing data:", error);
    throw error;
  }
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num) {
  if (!num) return "0";
  return num.toLocaleString();
}

/**
 * Format date for display
 */
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const [month, day, year] = dateStr.split("-");
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * NEW: Calculate percentage of total catch
 * @param {number} catchAmount - Catch for specific district/river
 * @param {number} totalCatch - Total catch across all districts
 * @returns {string} Formatted percentage
 */
export function calculatePercentage(catchAmount, totalCatch) {
  if (!totalCatch || totalCatch === 0) return "0.0%";
  const percentage = (catchAmount / totalCatch) * 100;
  return percentage.toFixed(1) + "%";
}

/**
 * NEW: Format date for API queries (MM-DD-YYYY)
 */
export function formatDateForAPI(date) {
  if (!date) return null;
  if (typeof date === "string") return date;
  
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

/**
 * NEW: Subtract days from a date
 */
export function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * NEW: District to river mapping
 */
export const RIVER_DISTRICT_MAP = {
  // Naknek-Kvichak district rivers
  "Naknek River": "naknek",
  "Kvichak River": "naknek",
  "Alagnak River": "naknek",
  
  // Nushagak district rivers
  "Wood River": "nushagak",
  "Nushagak River": "nushagak",
  "Igushik River": "nushagak",
  
  // Single-river districts
  "Ugashik River": "ugashik",
  "Egegik River": "egegik",
  "Togiak River": "togiak",
};

/**
 * NEW: Map river name to its district
 */
export function getRiverDistrict(riverName) {
  return RIVER_DISTRICT_MAP[riverName] || null;
}

/**
 * Calculate catch per delivery (efficiency metric)
 * @param {number} catchDaily - Total daily catch
 * @param {number} sockeyePerDelivery - Sockeye per delivery
 * @returns {string} Formatted catch efficiency
 */
export function calculateCatchEfficiency(catchDaily, sockeyePerDelivery) {
  if (!sockeyePerDelivery || sockeyePerDelivery === 0) return "N/A";
  const efficiency = catchDaily / sockeyePerDelivery;
  return efficiency.toFixed(2);
}


/**
 * NEW: Get all rivers for a district
 */
export function getDistrictRivers(districtId) {
  const riversByDistrict = {
    naknek: ["Naknek River", "Kvichak River", "Alagnak River"],
    nushagak: ["Wood River", "Nushagak River", "Igushik River"],
    ugashik: ["Ugashik River"],
    egegik: ["Egegik River"],
    togiak: ["Togiak River"],
  };
  return riversByDistrict[districtId] || [];
}

/**
 * NEW: Aggregate data for date range
 */
export function aggregateDateRangeData(dataArray) {
  if (!dataArray || dataArray.length === 0) return null;

  const aggregated = {
    startDate: dataArray[0]?.runDate,
    endDate: dataArray[dataArray.length - 1]?.runDate,
    daysInRange: dataArray.length,
    districts: {},
    rivers: {},
    summary: {
      totalCatch: 0,
      totalEscapement: 0,
      totalRun: 0,
    },
  };

  // Aggregate across all days
  dataArray.forEach((dayData) => {
    if (dayData.districts) {
      dayData.districts.forEach((district) => {
        if (!aggregated.districts[district.id]) {
          aggregated.districts[district.id] = {
            id: district.id,
            name: district.name,
            catchDaily: 0,
            catchCumulative: district.catchCumulative,
            escapementDaily: 0,
            escapementCumulative: district.escapementCumulative,
            inRiverEstimate: district.inRiverEstimate,
            totalRun: district.totalRun,
          };
        }
        aggregated.districts[district.id].catchDaily +=
          district.catchDaily || 0;
        aggregated.districts[district.id].escapementDaily +=
          district.escapementDaily || 0;
      });
    }

    if (dayData.rivers) {
      dayData.rivers.forEach((river) => {
        if (!aggregated.rivers[river.name]) {
          aggregated.rivers[river.name] = {
            name: river.name,
            district: getRiverDistrict(river.name),
            escapementDaily: 0,
            escapementCumulative: river.escapementCumulative,
            inRiverEstimate: river.inRiverEstimate,
          };
        }
        aggregated.rivers[river.name].escapementDaily +=
          river.escapementDaily || 0;
      });
    }

    aggregated.summary.totalCatch += dayData.totalRun?.catchDaily || 0;
    aggregated.summary.totalEscapement += dayData.totalRun?.escapementDaily || 0;
    aggregated.summary.totalRun += dayData.totalRun?.totalRun || 0;
  });

  return aggregated;
}