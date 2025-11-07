import { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import BristolBayMap from "./components/BristolBayMap";
import "./styles/BristolBayMap.css";
import "./App.css";

function App() {
  const [splashComplete, setSplashComplete] = useState(false);

  return (
    <>
      <SplashScreen onComplete={() => setSplashComplete(true)} />
      {splashComplete && <BristolBayMap />}
    </>
  );
}

export default App;