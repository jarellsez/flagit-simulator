// src/background/background.js
console.log("%c🚀 FlagIt: Background Script Loaded & Active", "color: #f59e0b; font-weight: bold;");

const REMINDER_TIMER_MS = 3 * 60 * 60 * 1000; // 3 hours

// --- 1. INIT STORAGE ---
chrome.runtime.onInstalled.addListener(() => {
  console.log("[BG DEBUG] Extension Installed. Initializing storage...");
  chrome.storage.local.set({
    scannerStates: {},
    offTimestamps: {},
    lastPlatform: null
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ lastPlatform: null });
});

// --- 2. HELPER: PLATFORM DETECTION ---
function detectPlatformFromUrl(url) {
  if (!url) return null;
  if (url.includes("mail.google.com")) return "gmail";
  if (url.includes("telegram.org")) return "telegram";
  if (url.includes("teams.microsoft.com") || url.includes("teams.live.com")) return "teams";
  if (url.includes("outlook.live.com") || url.includes("outlook.office.com") || url.includes("outlook.com")) return "outlook";
  return null;
}

function updateLastActivePlatform(tabId, url) {
  const platform = detectPlatformFromUrl(url);
  if (platform) {
    chrome.storage.local.set({ lastPlatform: platform }, () => {
      chrome.runtime.sendMessage({ type: "PLATFORM_DETECTED", platform })
        .catch(() => { /* Popup closed, ignore */ });
    });
  }
}

// --- NEW HELPER: Clears state for the specific website ---
function clearTabState(tabId, tabUrl) {
  if (tabUrl && tabUrl.startsWith('http')) {
    try {
      const hostname = new URL(tabUrl).hostname;
      const stateKey = `scanningState_${hostname}`; // Matches content.js exactly!

      chrome.storage.local.remove([stateKey, 'scanResult', 'chatReport', 'scanningState', 'popupReason', 'currentEmailId'], () => {
        updateLastActivePlatform(tabId, tabUrl);
      });
    } catch (e) { console.error("URL parsing error", e); }
  }
}

// 🚨 MODIFIED: Catches tab switching - ONLY update platform, DO NOT wipe memory!
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab?.url) {
      updateLastActivePlatform(tabId, tab.url);
    }
  });
});

// 🚨 MODIFIED: Catches SPA URL changes without a full page reload
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateLastActivePlatform(tabId, changeInfo.url);
  }
});

// --- 3. MESSAGE HANDLER (Traffic Controller) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // A. Handle Scanner States
  if (request.type === "CHECK_SCANNER_STATE") {
    chrome.storage.local.get(['scannerStates', 'offTimestamps'], (data) => {
      const platform = request.platform;
      const state = data.scannerStates?.[platform] || 'UNINITIALIZED';
      const lastOff = data.offTimestamps?.[platform];
      let shouldPrompt = state === 'UNINITIALIZED' ||
        (state === 'OFF' && lastOff && (Date.now() - lastOff > REMINDER_TIMER_MS));
      sendResponse({ state, shouldPrompt });
    });
    return true;
  }

  if (request.type === "SET_SCANNER_STATE") {
    console.log(`[BG DEBUG] Setting ${request.platform} scanner to: ${request.state}`);
    chrome.storage.local.get(['scannerStates', 'offTimestamps'], (data) => {
      const states = data.scannerStates || {};
      const timestamps = data.offTimestamps || {};
      states[request.platform] = request.state;
      timestamps[request.platform] = request.state === 'OFF' ? Date.now() : null;
      chrome.storage.local.set({ scannerStates: states, offTimestamps: timestamps }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  // B. Handle UI Popups (Threats only)
  if (request.type === "REQUEST_OPEN_POPUP") {
    console.log("%c[BG DEBUG] 🚨 Threat detected signal received. Opening popup...", "color: #ef4444; font-weight: bold;");

    // Tiny delay to ensure window focus and handle the "Could not find active window" error
    setTimeout(() => {
      chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (window) => {
        if (window) {
          chrome.action.openPopup().catch((err) => {
            console.warn("[BG DEBUG] Auto-popup note: Browser may require a user gesture or specific flags enabled. Error:", err.message);
          });
        } else {
          console.error("[BG DEBUG] Failed: No active browser window found to anchor popup.");
        }
      });
    }, 150);

    sendResponse({ success: true });
  }

  // C. Pass-through for UI Updates & Progress
  if (["SCANNING_STARTED", "SCAN_COMPLETED", "SHOW_THREAT_WARNING"].includes(request.type)) {

    if (request.type === "SCANNING_STARTED") {
      console.log("%c[BG DEBUG] ⏳ Progress: Scanning started...", "color: #38bdf8;");
    }

    if (request.type === "SCAN_COMPLETED") {
      console.log("%c[BG DEBUG] ✨ Progress: Scan finished (Safe). Storage updated.", "color: #22c55e;");
    }

    // Relay to Popup (if open)
    chrome.runtime.sendMessage(request).catch(() => {
      // Silent catch: popup is likely closed. 
    });
  }

  // D. PROXY FETCH TO BYPASS CORS (NEW)
  if (request.type === "PROXY_FETCH") {
    fetch(`http://127.0.0.1:8000${request.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ data: data }))
      .catch(error => {
        console.error("[BG DEBUG] Proxy Fetch Error:", error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for the async fetch
  }

  // --- F. HANDLE USER REPORTS (FALSE POSITIVES/MISSED THREATS) ---
  if (request.type === "SEND_REPORT") {
    console.log("%c[BG DEBUG] 📝 Sending user report to backend...", "color: #eab308; font-weight: bold;");

    fetch("http://127.0.0.1:8000/report/phishing", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log("%c[BG DEBUG] ✅ Report successfully saved to MongoDB!", "color: #22c55e;");
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error("[BG DEBUG] ❌ Report Fetch Error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for the async fetch
  }

  // E. TRIGGER THE ANONYMIZER (UPDATED FOR OFFSCREEN)
  if (request.type === "PROCESS_THREAT_DATA") {
    console.log("%c[BG DEBUG] 🚨 Threat confirmed. Waking up hidden Offscreen Engine...", "color: #a855f7; font-weight: bold;");

    setupOffscreenDocument('offscreen.html').then(() => {
      chrome.runtime.sendMessage({
        type: 'RUN_ANONYMIZER',
        text: request.text
      });
    });

    sendResponse({ status: "routing_to_offscreen" });
    return true;
  }
});

// =====================================================================
// --- 4. FLAGIT ZERO-TRUST ROUTER (Offscreen Manager) ---
// =====================================================================

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['WORKERS'],
    justification: 'Run heavy ONNX WebAssembly model for PII Anonymization'
  });
}