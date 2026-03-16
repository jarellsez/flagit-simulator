import { useState, useEffect } from "react";
import StartScreen from "../screens/StartScreen";
import PlatformListViewScreen from "../screens/PlatformListViewScreen";
import ScanningScreen from "../screens/ScanningScreen";
import PausedScreen from "../screens/PausedScreen";
import ThreatScreen from "../screens/ThreatScreen";
import SafeScreen from "../screens/SafeScreen";

export default function DetectorContainer({ onScreenChange }) {
  const [screen, setScreen] = useState("start");
  const [platform, setPlatform] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // NEW: Store the isolated keys for this specific tab
  const [keys, setKeys] = useState({ stateKey: null, resultKey: null });

  useEffect(() => {
    if (onScreenChange) onScreenChange(screen);
  }, [screen, onScreenChange]);

  // --- 1. INITIALIZATION: Restore state securely per tab ---
  useEffect(() => {
    const initializePopup = async () => {
      if (typeof chrome === "undefined" || !chrome.tabs) return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        setScreen("start");
        setIsInitializing(false);
        return;
      }

      const url = tab.url;
      let detected = null;
      if (url.includes("mail.google.com")) detected = "gmail";
      else if (url.includes("outlook")) detected = "outlook";
      else if (url.includes("telegram.org")) detected = "telegram";
      else if (url.includes("teams.microsoft.com") || url.includes("teams.live.com")) detected = "teams";
      setPlatform(detected);

      // 🚨 ISOLATED STORAGE KEYS (The Fix)
      const domain = new URL(url).hostname;
      const STATE_KEY = `scanningState_${domain}`;
      const RESULT_KEY = `scanResult_${domain}`;
      setKeys({ stateKey: STATE_KEY, resultKey: RESULT_KEY });

      chrome.storage.local.get([STATE_KEY, RESULT_KEY], (data) => {
        const domainState = data[STATE_KEY];
        const result = data[RESULT_KEY];

        setScanResult(result);

        if (domainState === 'scanning') {
          setScreen("scanning");
        } else if (domainState === 'threat_found' || (result && (result.detectedPhishing?.length > 0 || result.is_phishing))) {
          setScreen("threat");
        } else if (domainState === 'safe' && result && !result.is_phishing) {
          setScreen("safe");
        } else if (domainState === 'paused') {
          setScreen("paused");
        } else if (detected) {
          setScreen("platformList");
        } else {
          setScreen("start");
        }
        setIsInitializing(false);
      });
    };

    initializePopup();
  }, []);

  // --- 2. REAL-TIME UPDATES (Messages) ---
  useEffect(() => {
    const listener = (message) => {
      if (message.type === "SCANNING_STARTED") setScreen("scanning");
      if (message.type === "SCAN_COMPLETED") {
        const result = message.scanResult;
        setScanResult(result);
        if (result.is_phishing || result.score > 0.4) {
          setScreen("threat");
        } else {
          setScreen("safe");
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // --- 3. STORAGE LISTENER: Strictly listen to isolated keys ---
  useEffect(() => {
    if (!keys.stateKey) return;

    const handleStorageChange = (changes, area) => {
      if (area === 'local') {
        if (changes[keys.stateKey]) {
          if (changes[keys.stateKey].newValue === 'scanning') setScreen("scanning");
        }
        if (changes[keys.resultKey] && changes[keys.resultKey].newValue) {
          const result = changes[keys.resultKey].newValue;
          setScanResult(result);
          if (result.is_phishing || result.score > 0.4) {
            setScreen("threat");
          } else {
            setScreen("safe");
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [keys]);

  if (isInitializing) return <div style={{ height: "450px", background: "#0a1a2f" }}></div>;

  const screens = {
    scanning: <ScanningScreen setScreen={setScreen} />,
    paused: <PausedScreen setScreen={setScreen} />,
    threat: <ThreatScreen setScreen={setScreen} scanResult={scanResult} />,
    safe: <SafeScreen setScreen={setScreen} scanResult={scanResult} />,
    platformList: <PlatformListViewScreen setScreen={setScreen} platform={platform} />,
    start: <StartScreen setScreen={setScreen} />
  };

  return (
    <div className="detector-container" style={{ minHeight: "450px" }}>
      {screens[screen] || screens.start}
    </div>
  );
}