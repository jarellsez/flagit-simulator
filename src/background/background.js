// src/background/background.js
console.log("🚀 FlagIt: Background script loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Background received:", request);
  
  if (request.type === "EMAIL_OPENED") {
    console.log(`📧 Email opened: "${request.subject}" with ID: ${request.emailId}`);
    
    // Store email info INCLUDING the email ID and reset scanning state
    chrome.storage.local.set({ 
      popupReason: 'email_open',
      platform: request.platform,
      subject: request.subject,
      emailId: request.emailId,
      currentEmailId: request.emailId,
      scanningState: 'scanning', // ← ADD THIS - Reset to scanning for new email
      timestamp: Date.now()
    }, () => {
      console.log("✅ Storage set complete. Email ID:", request.emailId, "State: scanning");
    });
    
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