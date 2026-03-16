import React, { useEffect } from 'react';
import './SafeScreen.css';

export default function SafeScreen({ setScreen }) {

  // Auto close popup after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.remove(["popupReason"]);
      }
      window.close();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="safe-screen-compact">
      <div className="safe-content-compact">

        {/* Left Side: Success Icon */}
        <div className="safe-icon-area">
          <div className="check-circle">
            <span className="check-mark">✓</span>
          </div>
        </div>

        {/* Center: Status Text */}
        <div className="safe-text-area">
          <h2>NO THREATS FOUND</h2>
        </div>

        {/* Right Side Placeholder: Maintains symmetry with ScanningScreen */}
        <div style={{ width: '36px' }}></div>

      </div>
    </div>
  );
}