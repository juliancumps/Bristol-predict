import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";

/**
 * Fetch all districts with current data
 */
export async function getDistricts() {
  try {
    const response = await axios.get(`${API_BASE_URL}/districts`);
    return response.data;
  } catch (error) {
    console.error("Error fetching districts:", error);
    throw error;
  }
}

/**
 * Fetch daily harvest summary
 */
export async function getDailySummary() {
  try {
    const response = await axios.get(`${API_BASE_URL}/daily`);
    return response.data;
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    throw error;
  }
}

/**
 * Fetch specific district data
 */
export async function getDistrict(districtId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/districts/${districtId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching district ${districtId}:`, error);
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
