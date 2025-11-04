const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic route to test server
app.get("/", (req, res) => {
  res.json({
    message: "Bristol Predict API Server",
    status: "running",
    version: "1.0.0",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Districts endpoint (placeholder for now)
app.get("/api/districts", (req, res) => {
  const districts = [
    { id: "naknek", name: "Naknek-Kvichak", status: "active" },
    { id: "egegik", name: "Egegik", status: "active" },
    { id: "ugashik", name: "Ugashik", status: "active" },
    { id: "nushagak", name: "Nushagak", status: "active" },
    { id: "togiak", name: "Togiak", status: "active" },
  ];
  res.json(districts);
});

// Daily data endpoint (placeholder)
app.get("/api/daily", (req, res) => {
  res.json({
    date: new Date().toISOString().split("T")[0],
    message: "Data scraping coming soon",
    districts: [],
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🐟 Bristol Predict API running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

module.exports = app;
