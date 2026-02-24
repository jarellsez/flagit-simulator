// src/background/background.js
console.log("🚀 FlagIt: Background script loaded");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Background received:", request);
  
  if (request.type === "EMAIL_OPENED") {
    console.log(`📧 Email opened: "${request.subject}"`);
    
    // Store that this popup should show scanning screen
    chrome.storage.local.set({ 
      popupReason: 'email_open',
      platform: request.platform,
      subject: request.subject,
      timestamp: Date.now()
    }, () => {
      console.log("✅ Storage set complete");
    });
    
    // Try to open popup and log result
    console.log("🔍 Attempting to open popup...");
    
    try {
      chrome.action.openPopup(() => {
        if (chrome.runtime.lastError) {
          console.log("❌ openPopup error:", chrome.runtime.lastError.message);
        } else {
          console.log("✅ openPopup succeeded");
        }
      });
    } catch (err) {
      console.log("❌ openPopup exception:", err);
    }
  }
  
  return true;
});