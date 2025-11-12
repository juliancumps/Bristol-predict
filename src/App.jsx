import { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import BristolBayMap from "./components/BristolBayMap";
import CatchEfficiencyScreen from "./components/CatchEfficiencyScreen";
import RunTimingTracker from "./components/RunTimingTracker";
import EnvironmentalDashboard from "./components/EnvironmentalDashboard";
import "./styles/BristolBayMap.css";
import "./App.css";

function App() {
  const [splashComplete, setSplashComplete] = useState(false);
  const [currentView, setCurrentView] = useState("map"); // "map", "efficiency", "runtracker", "weather"

  return (
    <>
      <SplashScreen onComplete={() => setSplashComplete(true)} />
      {splashComplete && (
        <>
          {currentView === "map" && (
            <BristolBayMap
              onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
              onNavigateToWeather={() => setCurrentView("weather")}
            />
          )}
          {currentView === "efficiency" && (
            <CatchEfficiencyScreen
              onNavigateToRunTracker={() => setCurrentView("runtracker")}
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
      )}
    </>
  );
}

export default App;