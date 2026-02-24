import { useState, useEffect } from "react";
import StartScreen from "../screens/StartScreen";
import ScanningScreen from "../screens/ScanningScreen";

export default function DetectorContainer({ onScreenChange }) {
  const [screen, setScreen] = useState("start");

  // Log when screen changes
  useEffect(() => {
    console.log("📱 Screen changed to:", screen);
    if (onScreenChange) {
      onScreenChange(screen);
    }
  }, [screen, onScreenChange]);

  useEffect(() => {
    console.log("🔍 DetectorContainer mounted");
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['popupReason'], (result) => {
        console.log("📦 Storage result:", result);
        if (result.popupReason === 'email_open') {
          console.log("🎯 Setting screen to scanning");
          setScreen("scanning");
          chrome.storage.local.remove('popupReason');
        }
      });
    }
  }, []);

  const renderScreen = () => {
    console.log("🖥️ Rendering screen:", screen);
    switch (screen) {
      case "scanning":
        return <ScanningScreen setScreen={setScreen} />;
      default:
        return <StartScreen setScreen={setScreen} />;
    }
  };

  return (
    <div className="detector-container">
      {renderScreen()}
    </div>
  );
}