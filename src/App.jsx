import { useState, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import HtmlOverlay from "./components/HtmlOverlay";
import BristolBayMap from "./components/BristolBayMap";
import CatchEfficiencyScreen from "./components/CatchEfficiencyScreen";
import RunTimingTracker from "./components/RunTimingTracker";
import EnvironmentalDashboard from "./components/EnvironmentalDashboard";
import ToolsHub from "./components/ToolsHub";
import SoutheastMap from "./components/SoutheastMap";
import OpeningsBoard from "./components/OpeningsBoard";
import EscapementTracker from "./components/EscapementTracker";
import PortMoller from "./components/PortMoller";
import FleetTracker from "./components/FleetTracker";
import DailyBriefing from "./components/DailyBriefing";
import OfflineBanner from "./components/OfflineBanner";
import "./styles/BristolBayMap.css";
import "./App.css";

const VIEWS = [
  "map", "toolshub", "efficiency", "runtracker", "weather",
  "southeastmap", "openings", "escapement", "portmoller", "fleet", "briefing",
];

// A link like  https://bristol-predict.vercel.app/?view=openings  opens that
// tool directly and skips the splash screen (good for a phone home-screen icon).
function viewFromUrl() {
  const view = new URLSearchParams(window.location.search).get("view");
  if (VIEWS.includes(view)) return view;
  // Setting on the Daily Briefing screen: open the app on the briefing.
  if (!new URLSearchParams(window.location.search).get("view")) {
    try {
      if (window.localStorage.getItem("bp.startView") === "briefing") return "briefing";
    } catch {
      /* no storage */
    }
  }
  return null;
}

function App() {
  const startView = viewFromUrl();
  const [splashComplete, setSplashComplete] = useState(startView !== null);
  const [currentView, setCurrentViewState] = useState(startView || "map");
  const [htmlContent, setHtmlContent] = useState("");

  ////FOR DEV MODE (true skips the splash overlay)
  const SKIP_SPLASH_SCREEN = false;
  ////FOR DEV MODE

  // Keep the address bar in step with the view, so a reload or a shared
  // link returns to the same tool.
  const setCurrentView = (view) => {
    setCurrentViewState(view);
    window.history.replaceState(null, "", view === "map" ? "/?view=map" : `/?view=${view}`);
    window.scrollTo(0, 0);
  };

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
    window.history.replaceState(null, "", "/?view=map");
    window.scrollTo(0, 0);
  };

  const handleBackToSplash = () => {
    setSplashComplete(false);
    window.history.replaceState(null, "", "/");
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

  const toHub = () => setCurrentView("toolshub");

  // After splash complete, show map dashboard
  return (
    <>
      <OfflineBanner />
      {currentView === "map" && (
        <BristolBayMap
          onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
          onNavigateToWeather={() => setCurrentView("weather")}
          onNavigateToToolsHub={toHub}
          onBackToSplash={handleBackToSplash}
        />
      )}
      {currentView === "toolshub" && (
        <ToolsHub
          onNavigateToCatchEfficiency={() => setCurrentView("efficiency")}
          onNavigateToRunTracker={() => setCurrentView("runtracker")}
          onNavigateToWeather={() => setCurrentView("weather")}
          onNavigateToSoutheastMap={() => setCurrentView("southeastmap")}
          onNavigateToOpenings={() => setCurrentView("openings")}
          onNavigateToEscapement={() => setCurrentView("escapement")}
          onNavigateToPortMoller={() => setCurrentView("portmoller")}
          onNavigateToFleet={() => setCurrentView("fleet")}
          onNavigateToBriefing={() => setCurrentView("briefing")}
          onBackToBristolBayMap={() => setCurrentView("map")}
        />
      )}
      {currentView === "efficiency" && <CatchEfficiencyScreen onBack={toHub} />}
      {currentView === "runtracker" && <RunTimingTracker onBack={toHub} />}
      {currentView === "weather" && <EnvironmentalDashboard onBack={toHub} />}
      {currentView === "southeastmap" && <SoutheastMap onBackToToolsHub={toHub} />}
      {currentView === "openings" && <OpeningsBoard onBack={toHub} />}
      {currentView === "escapement" && <EscapementTracker onBack={toHub} />}
      {currentView === "portmoller" && <PortMoller onBack={toHub} />}
      {currentView === "fleet" && <FleetTracker onBack={toHub} />}
      {currentView === "briefing" && (
        <DailyBriefing
          onBack={toHub}
          onOpenOpenings={() => setCurrentView("openings")}
          onOpenPortMoller={() => setCurrentView("portmoller")}
          onOpenWeather={() => setCurrentView("weather")}
          onOpenEscapement={() => setCurrentView("escapement")}
        />
      )}
    </>
  );
}

export default App;
