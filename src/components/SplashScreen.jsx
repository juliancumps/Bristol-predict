import { useState, useEffect } from "react";
import MetallicPaint, { parseLogoImage } from "./MetallicPaint"
import "../styles/SplashScreen.css";
import bristolPredictLogo from "../assets/bristol-predict-title.svg";

function MetallicTitle() {
  console.log("🎭 MetallicTitle rendered");
  const [imageData, setImageData] = useState(null);
  
  useEffect(() => {
    async function loadTitleImage() {
      try {
        console.log("📌 useEffect running - starting fetch");
        const response = await fetch(bristolPredictLogo);
        console.log("✅ Fetch complete, got blob");
        const blob = await response.blob();
        const file = new File([blob], "bristol-predict.svg", { type: blob.type });
        
        console.log("🔄 Calling parseLogoImage...");
        const parsedData = await parseLogoImage(file);
        console.log("✅ parseLogoImage returned:", parsedData);
        
        setImageData(parsedData?.imageData ?? null);
        console.log("📊 setImageData called");
      } catch (err) {
        console.error("❌ Error:", err);
      }
    }
    loadTitleImage();
  }, []);

  console.log("🖼️ Current imageData state:", imageData);

  if (!imageData) {
    console.log("📝 Showing fallback SVG (no imageData yet)");
    return (
      <div className="metallic-title-container">
        <img src={bristolPredictLogo} alt="Bristol Predict" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  console.log("🎨 Rendering MetallicPaint with imageData");
  return (
    <div className="metallic-title-container">
      <MetallicPaint 
        imageData={imageData}
        params={{ 
        patternScale: 10,
        refraction: 0.0015,
        edge: 0.8,
        patternBlur: 0.005,
        liquid: 0.07,  
        speed: 0.3 
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