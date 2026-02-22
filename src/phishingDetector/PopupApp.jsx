import React from "react";
import "./styles/popup.css";

export default function PopupApp() {
  return (
    <div style={{ width: "100%", height: "100%", padding: 16, color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#0b2a55",
          }}
        />
        <div>
          <div style={{ fontWeight: 700 }}>FlagIt</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Phishing Detector</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 14,
          background: "#0b2a55",
        }}
      >
        Popup is rendering correctly ✅
      </div>
    </div>
  );
}