import { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import BristolBayMap from "./components/BristolBayMap";
import CatchEfficiencyScreen from "./components/CatchEfficiencyScreen";
import RunTimingTracker from "./components/RunTimingTracker";
import "./styles/BristolBayMap.css";
import "./App.css";

function App() {
  const [splashComplete, setSplashComplete] = useState(false);
  const [currentView, setCurrentView] = useState("map"); // "map", "efficiency", "runtracker"

  return (
    <>
      <SplashScreen onComplete={() => setSplashComplete(true)} />
      {splashComplete && (
        <>
          {currentView === "map" && (
            <BristolBayMap
              onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
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
        </>
      )}
    </>
  );
}

export default App;