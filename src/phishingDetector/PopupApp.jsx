import React from "react";
import DetectorContainer from "./components/DetectorContainer";
import "./styles/popup.css";

export default function PopupApp() {
  return (
    <div style={{ 
      width: "400px", 
      minHeight: "500px",
      backgroundColor: "#0a1a2f",  // This is your dark blue
    }}>
      <DetectorContainer />
    </div>
  );
}