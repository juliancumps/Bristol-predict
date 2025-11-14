import { useState, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import HtmlOverlay from "./components/HtmlOverlay";
import BristolBayMap from "./components/BristolBayMap";
import CatchEfficiencyScreen from "./components/CatchEfficiencyScreen";
import RunTimingTracker from "./components/RunTimingTracker";
import EnvironmentalDashboard from "./components/EnvironmentalDashboard";
import "./styles/BristolBayMap.css";
import "./App.css";

function App() {
  const [splashComplete, setSplashComplete] = useState(false);
  const [currentView, setCurrentView] = useState("map");
  const [htmlContent, setHtmlContent] = useState("");

  // Load HTML content on mount
  useEffect(() => {
    const loadHtml = async () => {
      try {
        const response = await fetch("/newStyle-2.html");
        const html = await response.text();
        setHtmlContent(html);
      } catch (error) {
        console.error("Failed to load HTML content:", error);
      }
    };

    loadHtml();
  }, []);

  const handleNavigateToApp = () => {
    setSplashComplete(true);
  };

  const handleBackToSplash = () => {
    setSplashComplete(false);
    window.scrollTo(0, 0);
  };

  // Only show splash screen OR app, never both
  if (!splashComplete) {
    return (
      <>
        <SplashScreen onComplete={() => setSplashComplete(true)} />
        <HtmlOverlay htmlContent={htmlContent} onNavigateToApp={handleNavigateToApp} />
      </>
    );
  }

  // After splash complete, show only the app (no HTML overlay, no scrolling)
  return (
    <>
      {currentView === "map" && (
        <BristolBayMap
          onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
          onNavigateToWeather={() => setCurrentView("weather")}
          onBackToSplash={handleBackToSplash}
        />
      )}
      {currentView === "efficiency" && (
        <CatchEfficiencyScreen
          onNavigateToRunTracker={() => setCurrentView("runtracker")}
          onNavigateToWeather={() => setCurrentView("weather")}
          onBack={() => setCurrentView("map")}
        />
      )}
      {currentView === "runtracker" && (
        <RunTimingTracker onBack={() => setCurrentView("efficiency")} />
      )}
      {currentView === "weather" && (
        <EnvironmentalDashboard onBack={() => setCurrentView("efficiency")} />
      )}
    </>
  );
}

export default App;