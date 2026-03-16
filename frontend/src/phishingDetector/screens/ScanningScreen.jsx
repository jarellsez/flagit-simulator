// src/screens/ScanningScreen.jsx
import React from 'react';
import './ScanningScreen.css';

export default function ScanningScreen() {
  // NOTE: Transitions (switching away from this screen) are handled automatically 
  // by DetectorContainer.jsx when it receives messages like SCAN_COMPLETED 
  // or SCANNING_FINISHED from the background/content script.

  return (
    <div className="scanning-screen-compact">
      <div className="scanning-content-compact">
        {/* Left Side: Radar Animation */}
        <div className="radar-compact">
          <div className="radar-circle-compact"></div>
          <div className="radar-circle-compact inner"></div>
          <div className="radar-line-compact"></div>
        </div>

        {/* Center: Status Text */}
        <div className="text-compact">
          <h2>FISHING FOR PHISHES...</h2>
        </div>

        {/* Right Side Placeholder: 
            Maintains symmetry now that the pause button is gone */}
        <div style={{ width: '36px' }}></div>
      </div>
    </div>
  );
}