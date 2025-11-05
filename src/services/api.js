import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";

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
