import { useState } from "react";
import ForecastPredictor from "./tools/ForecastPredictor";
import AdvancedCharts from "./tools/AdvancedCharts";
import EnvironmentalDashboard from "./EnvironmentalDashboard";
import "../styles/ToolsHub.css";

/**
 * ToolsHub Component
 * Main navigation hub for all advanced analytics and tools
 */
export default function ToolsHub({ onBack }) {
  const [activeView, setActiveView] = useState("hub"); // hub, forecast, charts, environmental,

  // Tool card data
  const tools = [
    {
      id: "forecast",
      title: "Forecast Predictor",
      icon: "🎯",
      description: "Predict peak catch dates using historical trend analysis",
      color: "#3b82f6",
    },
    {
      id: "charts",
      title: "Advanced Charts",
      icon: "📈",
      description: "Heatmaps, cumulative comparisons, and river breakdowns",
      color: "#8b5cf6",
    },
    {
      id: "environmental",
      title: "Environmental Factors",
      icon: "🌡️",
      description: "Water temperature, tides, and weather impact (Demo)",
      color: "#10b981",
    },
  ];

  const renderContent = () => {
    switch (activeView) {
      case "forecast":
        return <ForecastPredictor onBack={() => setActiveView("hub")} />;
      case "charts":
        return <AdvancedCharts onBack={() => setActiveView("hub")} />;
      case "environmental":
        return <EnvironmentalDashboard onBack={() => setActiveView("hub")} />;
      default:
        return (
          <div className="tools-hub-main">
            <div className="tools-hub-header">
              <button className="back-button" onClick={onBack}>
                ← Back to Map
              </button>
              <h1 className="tools-hub-title">
                <span className="title-icon">🛠️</span>
                Tools & Analytics Hub
              </h1>
              <p className="tools-hub-subtitle">
                Advanced features for analyzing Bristol Bay salmon runs
              </p>
            </div>

            <div className="tools-grid">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  className="tool-card"
                  onClick={() => setActiveView(tool.id)}
                  style={{
                    "--tool-color": tool.color,
                  }}
                >
                  <div className="tool-icon">{tool.icon}</div>
                  <h3 className="tool-title">{tool.title}</h3>
                  <p className="tool-description">{tool.description}</p>
                  <div className="tool-arrow">→</div>
                </button>
              ))}
            </div>

            <div className="tools-hub-footer">
              <p className="footer-note">
                💡 These tools provide deeper insights into salmon run patterns
                and fishing strategies
              </p>
            </div>
          </div>
        );
    }
  };

  return <div className="tools-hub-container">{renderContent()}</div>;
}