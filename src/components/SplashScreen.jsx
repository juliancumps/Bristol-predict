import { useState, useEffect } from "react";
import MetallicPaint, { parseLogoImage } from "./MetallicPaint";
import "../styles/SplashScreen.css";

// SVG string for "Bristol Predict" title - black text for metallic mask
const BRISTOL_PREDICT_SVG = `
<svg viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg" width="1200" height="300">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap');
    </style>
  </defs>
  <text 
    x="600" 
    y="200" 
    font-family="Inter, sans-serif" 
    font-size="180" 
    font-weight="800" 
    text-anchor="middle" 
    fill="black" 
    letter-spacing="-5"
  >
    Bristol Predict
  </text>
</svg>
`;

function MetallicTitle() {
  const [imageData, setImageData] = useState(null);

  useEffect(() => {
    async function loadTitleImage() {
      try {
        // Convert SVG string to blob and parse it
        const blob = new Blob([BRISTOL_PREDICT_SVG], { type: "image/svg+xml" });
        const file = new File([blob], "bristol-predict.svg", { type: blob.type });
        const parsedData = await parseLogoImage(file);
        setImageData(parsedData?.imageData ?? null);
      } catch (err) {
        console.error("Error loading title image:", err);
      }
    }

    loadTitleImage();
  }, []);

  if (!imageData) {
    // Fallback while loading
    return (
      <h1 className="splash-title">Bristol Predict</h1>
    );
  }

  return (
    <div className="metallic-title-container">
      <MetallicPaint 
        imageData={imageData}
        params={{ 
          edge: 2, 
          patternBlur: 0.005, 
          patternScale: 2.5, 
          refraction: 0.015, 
          speed: 0.35, 
          liquid: 0.08 
        }} 
      />
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

        {/* Dark overlay */}
        <div className="splash-overlay" />

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