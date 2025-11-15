import { useState, useEffect } from "react";
import PixelBlast from './PixelBlast.jsx';
import "../styles/SplashScreen.css";

export default function SplashScreen({ onComplete }) {
  const [showSplash, setShowSplash] = useState(true);
  const [splashOpacity, setSplashOpacity] = useState(1);

  const handleContinue = () => {
    setShowSplash(false);
    onComplete();
  };

  useEffect(() => {
    const handleScroll = () => {
      // Calculate opacity based on scroll position
      const scrolled = window.scrollY;
      const maxScroll = 400; // pixels to scroll before fully faded
      
      // Opacity goes from 1 to 0 as you scroll
      const opacity = Math.max(0, 1 - scrolled / maxScroll);
      setSplashOpacity(opacity);

      // Hide splash screen completely when scrolled past
      if (scrolled > maxScroll) {
        setShowSplash(false);
      } else {
        setShowSplash(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!showSplash) return null;

  return (
    <div className="splash-screen" style={{ opacity: splashOpacity, pointerEvents: splashOpacity === 0 ? 'none' : 'auto' }}>
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

        <img src="/icon-192.png" alt="Bristol Predict Icon" className="splash-icon" />

        <div className="scroll-hint">
          <p>Scroll to explore more</p>
          <div className="scroll-arrow">↓</div>
        </div>
      </div>
    </div>
  );
}