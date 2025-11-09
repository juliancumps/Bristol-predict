import { useState } from "react";
import PixelBlast from './PixelBlast.jsx';
import "../styles/SplashScreen.css";

export default function SplashScreen({ onComplete }) {
  const [showSplash, setShowSplash] = useState(true);

  const handleContinue = () => {
    setShowSplash(false);
    onComplete();
  };

  if (!showSplash) return null;

  return (
    <>
      <div className="splash-banner">
        <img src="/icon-512.png" alt="Bristol Predict" className="splash-banner-icon" />
      </div>

      <div className="splash-screen">
        
        {/* Background */}
        <div
          className="splash-background"
          style={{
            backgroundImage: "url(/bristol-bay-splash.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Pixel Blast - clicks will work now */}
        <PixelBlast
          variant="diamond"
          pixelSize={2}
          color="#FF6666"
          patternScale={3}
          patternDensity={1.25}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid
          liquidStrength={0}
          liquidRadius={0}
          liquidWobbleSpeed={0}
          speed={2.6}
          edgeFade={0}
          transparent
          className="splash-pixel-overlay"
        />
        
        {/* Content */}
        <div className="splash-content">
          <div className="splash-title-group">
            <h1 className="splash-title">Bristol Predict</h1>
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