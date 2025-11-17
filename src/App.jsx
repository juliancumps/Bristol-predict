import { useState, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import HtmlOverlay from "./components/HtmlOverlay";
import BristolBayMap from "./components/BristolBayMap";
import CatchEfficiencyScreen from "./components/CatchEfficiencyScreen";
import RunTimingTracker from "./components/RunTimingTracker";
import EnvironmentalDashboard from "./components/EnvironmentalDashboard";
import ToolsHub from "./components/ToolsHub";
import SoutheastMap from "./components/SoutheastMap";
import "./styles/BristolBayMap.css";
import "./App.css";
import { Section } from "lucide-react";

function App() {
  const [splashComplete, setSplashComplete] = useState(false);
  const [currentView, setCurrentView] = useState("map");
  const [htmlContent, setHtmlContent] = useState("");

  ///FOR DEV MODE /// false for deployment. (true skips the splash overlay)
  const SKIP_SPLASH_SCREEN = false;
  ////FOR DEV MODE

  // Load HTML content on mount
  useEffect(() => {
    const loadHtml = async () => {
      try {
        const response = await fetch("/about.html");
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

  useEffect(() => {
  if (SKIP_SPLASH_SCREEN) {
    setSplashComplete(true);
  }
  }, []);

  // Only show splash screen OR app, never both
  if (!splashComplete) {
    return (
      <>
        <SplashScreen onComplete={() => setSplashComplete(true)} />
        <HtmlOverlay htmlContent={htmlContent} onNavigateToApp={handleNavigateToApp} />
      </>
    );
  }

  // After splash complete, show map dashboard
  return (
    <>
      {currentView === "map" && (
        <BristolBayMap
          onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
          onNavigateToWeather={() => setCurrentView("weather")}
          onNavigateToToolsHub={() => setCurrentView("toolshub")}
          onBackToSplash={handleBackToSplash}
        />
      )}
      {currentView === "toolshub" && (
        <ToolsHub
          onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
          onNavigateToRunTracker={() => setCurrentView("runtracker")}
          onNavigateToWeather={() => setCurrentView("weather")}
          onNavigateToSoutheastMap={() => setCurrentView("southeastmap")}
          onBackToBristolBayMap={() => setCurrentView("map")}
        />
      )}
      {currentView === "efficiency" && (
        <CatchEfficiencyScreen
          onBack={() => setCurrentView("toolshub")}
        />
      )}
      {currentView === "runtracker" && (
        <RunTimingTracker onBack={() => setCurrentView("toolshub")} />
      )}
      {currentView === "weather" && (
        <EnvironmentalDashboard onBack={() => setCurrentView("toolshub")} />
      )}
      {currentView === "southeastmap" && (
        <SoutheastMap onBackToToolsHub={() => setCurrentView("toolshub")}/>
      )}
    </>
  );
}

export default App;