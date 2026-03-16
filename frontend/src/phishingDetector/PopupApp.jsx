import React, { useState, useEffect } from "react";
import DetectorContainer from "./components/DetectorContainer";
import "./styles/popup.css";

export default function PopupApp() {
  const [currentScreen, setCurrentScreen] = useState("start");

  const getPopupSize = () => {
    switch (currentScreen) {
      case "scanning":
      case "paused":
      case "safe": // 👈 Moved this here to match scanning size
        return { width: "360px", height: "70px" };

      case "threat":
        return { width: "360px", height: "600px" };

      case "platformList":
      case "start":
      default:
        return { width: "360px", height: "460px" };
    }
  };

  const size = getPopupSize();

  useEffect(() => {
    // Apply dynamic dimensions to the browser's actual popup window
    document.documentElement.style.width = size.width;
    document.documentElement.style.height = size.height;
    document.body.style.width = size.width;
    document.body.style.height = size.height;

    // Standard resets
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }, [size]);

  const handleScreenChange = (screen) => {
    console.log("📢 PopupApp screen change:", screen);
    setCurrentScreen(screen);
  };

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: "#0a1a2f",
      overflow: "hidden",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      transition: "height 0.2s ease-in-out" // Added a tiny smooth transition
    }}>
      <DetectorContainer onScreenChange={handleScreenChange} />
    </div>
  );
}