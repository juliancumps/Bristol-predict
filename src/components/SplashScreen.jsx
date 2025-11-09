import { useState } from "react";
import "../styles/SplashScreen.css";

function MetallicTitle() {
  return (
    <div className="metallic-title-container">
      <h1 className="splash-title">Bristol Predict</h1>
    </div>
  );
}

export default function SplashScreen({ onComplete }) {
  const [showSplash, setShowSplash] = useState(true);

  const handleContinue = () => {
    setShowSplash(false);
    onComplete();
  };

  if (!showSplash) return null;

  return (
    <>
      {/* Top Banner Bar */}
      <div className="splash-banner">
        <img src="/icon-512.png" alt="Bristol Predict" className="splash-banner-icon" />
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

        {/* Content container */}
        <div className="splash-content">
          <div className="splash-title-group">
            <MetallicTitle />
            <p className="splash-subtitle">Alaska Salmon Forecast</p>
          </div>

          <img src="/icon-512.png" alt="Bristol Predict Icon" className="splash-icon" />

          <button className="splash-continue-btn" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    </>
  );
}