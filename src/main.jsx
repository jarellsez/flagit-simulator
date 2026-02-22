import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Your existing global styles (keep these)
import "./styles/theme.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

import App from "./App.jsx";
import PopupApp from "./phishingDetector/PopupApp.jsx";

// If popup.html sets <body data-context="popup">, this becomes true
const isPopup = document.body?.dataset?.context === "popup";

createRoot(document.getElementById("root")).render(
  <StrictMode>{isPopup ? <PopupApp /> : <App />}</StrictMode>
);