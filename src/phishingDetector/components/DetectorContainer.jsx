import { useState, useEffect } from "react";
import StartScreen from "../screens/StartScreen";
import GmailListViewScreen from "../screens/GmailListViewScreen"; // NEW
import ScanningScreen from "../screens/ScanningScreen";
import PausedScreen from "../screens/PausedScreen";

export default function DetectorContainer({ onScreenChange }) {
  const [screen, setScreen] = useState("start");
  const [currentEmailId, setCurrentEmailId] = useState(null);

  useEffect(() => {
    console.log("📱 Screen changed to:", screen);
    if (onScreenChange) {
      onScreenChange(screen);
    }
  }, [screen, onScreenChange]);

  useEffect(() => {
    console.log("🔍 DetectorContainer mounted");
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['popupReason', 'scanningState', 'currentEmailId'], (result) => {
        console.log("📦 STORAGE:", result);
        
        setCurrentEmailId(result.currentEmailId);
        
        // STEP 1: Check if this was triggered by email open
        if (result.popupReason === 'email_open') {
          console.log("📧 Email opened - scanning");
          setScreen("scanning");
          chrome.storage.local.remove('popupReason');
          return;
        }
        
        // STEP 2: Check URL to determine where we are
        if (chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentUrl = tabs[0]?.url || '';
            const isOnGmail = currentUrl.includes('mail.google.com');
            
            console.log("🌐 URL:", currentUrl);
            
            // If not on Gmail, show original StartScreen
            if (!isOnGmail) {
              console.log("🏠 Not Gmail - original start screen");
              setScreen("start");
              return;
            }
            
            // Get the hash part of the URL (everything after #)
            const urlHash = currentUrl.split('#')[1] || '';
            
            // List views are when the hash is just the folder name (no email ID)
            const isListView = urlHash === 'inbox' || 
                              urlHash === 'starred' || 
                              urlHash === 'sent' ||
                              urlHash === 'drafts' ||
                              urlHash === 'spam' ||
                              urlHash === 'trash' ||
                              urlHash === 'category' ||
                              urlHash.startsWith('search/') ||
                              urlHash === '';
            
            if (isListView) {
              console.log("📬 In Gmail list view - showing Gmail List Screen");
              setScreen("gmailList"); // NEW screen type
              return;
            }
            
            // We're in an email - check paused state
            if (result.scanningState === 'paused') {
              console.log("⏸️ Paused email");
              setScreen("paused");
            } else {
              console.log("📧 Email open - scanning");
              setScreen("scanning");
            }
          });
        }
      });
    }
  }, []);

  const renderScreen = () => {
    console.log("🖥️ Rendering:", screen);
    switch (screen) {
      case "scanning":
        return <ScanningScreen setScreen={setScreen} emailId={currentEmailId} />;
      case "paused":
        return <PausedScreen setScreen={setScreen} emailId={currentEmailId} />;
      case "gmailList": // NEW case
        return <GmailListViewScreen setScreen={setScreen} />;
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