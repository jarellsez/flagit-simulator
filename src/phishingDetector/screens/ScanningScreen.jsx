import React, { useEffect } from 'react';
import './ScanningScreen.css';

export default function ScanningScreen({ setScreen }) {
  
  // Auto-close after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handlePause = () => {
    setScreen("paused");
  };

  return (
    <div className="scanning-screen-compact">
      <div className="scanning-content-compact">
        
        {/* Left: Radar Animation */}
        <div className="radar-compact">
          <div className="radar-circle-compact"></div>
          <div className="radar-circle-compact inner"></div>
          <div className="radar-line-compact"></div>
        </div>

        {/* Middle: Text */}
        <div className="text-compact">
          <h2>FISHING FOR PHISHES...</h2>
        </div>

        {/* Right: Pause Button */}
        <button 
          className="pause-button-compact"
          onClick={handlePause}
        >
          ⏸️ Pause
        </button>

      </div>
    </div>
  );
}