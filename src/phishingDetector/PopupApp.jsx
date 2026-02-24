import React, { useState, useEffect } from "react";
import DetectorContainer from "./components/DetectorContainer";
import "./styles/popup.css";

export default function PopupApp() {
  const [currentScreen, setCurrentScreen] = useState("start");

  // Force body to resize with popup
  useEffect(() => {
    const size = getPopupSize();
    document.body.style.width = size.width;
    document.body.style.height = size.height;
    document.documentElement.style.width = size.width;
    document.documentElement.style.height = size.height;
  }, [currentScreen]);

  const handleScreenChange = (screen) => {
    console.log("📢 PopupApp received screen change:", screen);
    setCurrentScreen(screen);
  };

  const getPopupSize = () => {
    switch (currentScreen) {
      case "scanning":
        return { width: "380px", height: "70px" };
      case "start":
      default:
        return { width: "400px", height: "540px" }; // Increased from 500px to 540px
    }
  };

  const size = getPopupSize();

  return (
    <div style={{ 
      width: "100%",
      height: "100%",
      backgroundColor: "#0a1a2f",
    }}>
      <DetectorContainer onScreenChange={handleScreenChange} />
    </div>
  );
}