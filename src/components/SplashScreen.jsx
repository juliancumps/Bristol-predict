import { useState } from "react";
import "../styles/SplashScreen.css";

//DEV TOGGLE: Set to true to skip splash screen entirely
const SKIP_SPLASH_SCREEN = false;

export default function SplashScreen({ onComplete }) {
  const [showSplash, setShowSplash] = useState(!SKIP_SPLASH_SCREEN);

  const handleContinue = () => {
    setShowSplash(false);
    onComplete();
  };

  if (!showSplash) return null;

  return (
    <>
      {/* Top Banner Bar */}
      <div className="splash-banner">
        <img src="/icon.png" alt="Bristol Predict" className="splash-banner-icon" />
      </div>

      <div className="splash-screen">
      {/* Background with Bristol Bay image */}
      <div
        className="splash-background"
        style={{
          backgroundImage: "url(/bristol-bay-splash.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Dark overlay */}
      <div className="splash-overlay" />

      {/* Content container */}
      <div className="splash-content">
        <div className="splash-title-group">
          <h1 className="splash-title">Bristol Predict</h1>
          <p className="splash-subtitle">Alaska Salmon Forecast</p>
        </div>

        <img src="/icon.png" alt="Bristol Predict Icon" className="splash-icon" />

        <button className="splash-continue-btn" onClick={handleContinue}>
          Continue
        </button>
      </div>
      </div>
    </>
  );
}