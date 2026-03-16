// src/content/content.js
console.log("%c🚀 FlagIt: Unified Content Script Active", "color: #22d3ee; font-weight: bold; font-size: 12px;");

const SERVER_BASE = "http://127.0.0.1:8000";
const ENDPOINTS = {
  email: "/predict/email",
  chat: "/predict/chat",
  universal: "/predict/universal"
};

const hostname = window.location.hostname;
const STATE_KEY = `scanningState_${hostname}`;
const RESULT_KEY = `scanResult_${hostname}`;
const scannedTextCache = new Map();

let currentPlatform = null;
if (hostname.includes('mail.google.com')) currentPlatform = 'gmail';
else if (hostname.includes('outlook')) currentPlatform = 'outlook';
else if (hostname.includes('telegram.org')) currentPlatform = 'telegram';
else if (hostname.includes('teams')) currentPlatform = 'teams';

let currentBatchId = null;
let lastScanTriggerTime = 0;

let isScannerActive = false;
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.scannerStates && currentPlatform) {
    const states = changes.scannerStates.newValue || {};
    isScannerActive = (states[currentPlatform] === 'ON');
    console.log(`%c[DEBUG] Scanner live-toggled: ${isScannerActive ? 'ON' : 'OFF'}`, "color: #f59e0b;");
  }
});

const batchState = new Map();

// --- 1. CSS HIGHLIGHTING ---
const style = document.createElement('style');
style.textContent = `
  .flagit-phishing-bubble {
    border: 2px solid #ef4444 !important;
    background-color: rgba(239, 68, 68, 0.12) !important;
    border-radius: 12px !important;
    padding: 8px !important;
    position: relative !important;
    transition: all 0.3s ease !important;
  }
  .flagit-warning-label {
    color: #ef4444 !important;
    font-size: 10px !important;
    font-weight: bold !important;
    display: block !important;
    margin-bottom: 4px !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .flagit-dimmed {
    border: 2px solid #64748b !important;
    background-color: rgba(100, 116, 139, 0.1) !important;
    opacity: 0.5 !important;
  }
  .flagit-active {
    border: 2px solid #ef4444 !important;
    background-color: rgba(239, 68, 68, 0.2) !important;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.4) !important;
    opacity: 1 !important;
  }
`;
document.head.appendChild(style);

// --- 2. UTILITY & MESSAGE PASSING ---
function safeSendMessage(message, callback) {
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime?.lastError) { /* Silent */ }
        if (callback) callback(response);
      });
    }
  } catch (error) { console.log("🔄 FlagIt: Context invalidated.", error); }
}

function extractUrls(text) {
  const urlPattern = /((?:https?:\/\/|www\.|t\.me\/)[^\s\^!<>"]+)/gi;
  const matches = text.match(urlPattern) || [];
  return matches.map(url => {
    let cleanUrl = url.replace(/[.,!?;:]+$/, '');
    if (cleanUrl.toLowerCase().startsWith('www.')) cleanUrl = 'http://' + cleanUrl;
    return cleanUrl;
  });
}

// --- 3. CORE AI DETECTION WORKFLOW ---
async function sendToServerForDetection(platform, subject, body, incomingTraceId, foundUrls = [], targetNode = null, associatedBatchId = null) {
  const textKey = body.trim();
  const cacheKey = textKey.substring(0, 500);

  if (!textKey) {
    const batch = batchState.get(associatedBatchId);
    if (batch) {
      batch.activeScans = Math.max(0, batch.activeScans - 1);
      checkIfAllScansFinished(incomingTraceId, platform, associatedBatchId);
    }
    return;
  }

  const traceId = (targetNode && targetNode.getAttribute('data-flagit-threat-id'))
    ? targetNode.getAttribute('data-flagit-threat-id')
    : incomingTraceId;

  console.log(`%c[DEBUG] 🛰️ SCAN IN PROGRESS | ID: ${traceId} | Platform: ${platform}`, "color: #38bdf8; font-weight: bold;");

  try {
    let result;

    if (scannedTextCache.has(cacheKey)) {
      result = scannedTextCache.get(cacheKey);
      console.log(`%c[DEBUG] ⚡ Cache Hit for ID: ${traceId}`, "color: #a3e635;");
    } else {
      await new Promise(resolve => setTimeout(resolve, 800));

      if (associatedBatchId !== currentBatchId) return;

      let endpoint = (platform === "gmail" || platform === "outlook") ? ENDPOINTS.email : ENDPOINTS.chat;
      const urlToSend = foundUrls.length > 0 ? foundUrls[0] : null;

      let payload = (platform === "gmail" || platform === "outlook")
        ? { raw_content: `${subject}\n\n${body}` }
        : { platform, text: body, sender: subject || "", url: urlToSend };

      result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: "PROXY_FETCH",
          endpoint: endpoint,
          payload: payload
        }, (response) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          if (response && response.error) return reject(new Error(response.error));
          resolve(response.data);
        });
      });

      scannedTextCache.set(cacheKey, result);
    }

    if (associatedBatchId !== currentBatchId) return;

    if (result.is_phishing || result.score > 0.4) {
      safeSendMessage({ type: "PROCESS_THREAT_DATA", text: body });

      if (targetNode && !targetNode.hasAttribute('data-flagit-verified')) {
        targetNode.setAttribute('data-flagit-verified', 'true');
        targetNode.classList.add('flagit-phishing-bubble');
        targetNode.setAttribute('data-flagit-threat-id', traceId);

        if (!targetNode.querySelector('.flagit-warning-label')) {
          const label = document.createElement('span');
          label.className = 'flagit-warning-label';
          label.innerText = '⚠️ FLAGIT: SUSPECTED PHISHING';
          targetNode.prepend(label);
        }
      }

      const batch = batchState.get(associatedBatchId);
      if (batch) {
        batch.threats.push({ ...result, platform, sender: subject || "Contact", threatId: traceId });
      }
    }
  } catch (err) {
    if (associatedBatchId === currentBatchId) {
      chrome.storage.local.set({ [STATE_KEY]: 'error' });
    }
  } finally {
    const batch = batchState.get(associatedBatchId);
    if (batch) {
      batch.activeScans = Math.max(0, batch.activeScans - 1);
      checkIfAllScansFinished(traceId, platform, associatedBatchId);
    }
  }
}

function checkIfAllScansFinished(traceId, platform, batchId) {
  const batch = batchState.get(batchId);
  if (!batch || batchId !== currentBatchId) return;

  if (batch.activeScans === 0) {
    if (batch.threats.length > 0) {
      chrome.storage.local.set({
        [STATE_KEY]: 'threat_found',
        [RESULT_KEY]: { detectedPhishing: batch.threats, platform, is_phishing: true }
      }, () => {
        safeSendMessage({ type: "SHOW_THREAT_WARNING", subject: batch.threats[0].sender });
        safeSendMessage({ type: "REQUEST_OPEN_POPUP" });
      });

    } else {
      chrome.storage.local.set({
        [STATE_KEY]: 'safe',
        [RESULT_KEY]: { platform, is_phishing: false }
      }, () => {
        safeSendMessage({ type: "SCAN_COMPLETED", emailId: traceId, scanResult: { platform, is_phishing: false } });
        safeSendMessage({ type: "REQUEST_OPEN_POPUP" });
      });
    }
    batchState.delete(batchId);
  }
}

// --- 4. PLATFORM DETECTORS ---
function detectGmailEmailOpen() {
  document.addEventListener('click', (event) => {
    if (!isScannerActive) return;
    const emailRow = event.target.closest('.zA');
    if (!emailRow || event.target.closest('[role="checkbox"], [data-tooltip]')) return;

    lastScanTriggerTime = Date.now();
    const batchId = Date.now().toString();
    currentBatchId = batchId;

    // 🚨 FIX: Clear old results immediately using ISOLATED keys
    chrome.storage.local.remove([STATE_KEY, RESULT_KEY], () => {
      chrome.storage.local.set({ [STATE_KEY]: 'scanning' });
      safeSendMessage({ type: "REQUEST_OPEN_POPUP" });
    });

    const subject = emailRow.querySelector('.y6')?.textContent || 'Unknown';
    setTimeout(() => {
      if (currentBatchId !== batchId) return;

      const bodyNode = document.querySelector('.a3s');
      const body = bodyNode?.innerText || "";
      if (body.length > 5) {
        batchState.set(batchId, { activeScans: 1, threats: [] });
        sendToServerForDetection("gmail", subject, body, `gmail_${Date.now()}`, extractUrls(body), bodyNode, batchId);
      } else {
        chrome.storage.local.set({ [STATE_KEY]: 'idle' });
      }
    }, 1200);
  }, true);
}

function detectOutlookEmailOpen() {
  document.addEventListener('click', (event) => {
    if (!isScannerActive) return;
    const emailRow = event.target.closest('[role="row"], [role="option"]');
    if (!emailRow || event.target.closest('button, [role="checkbox"]')) return;

    lastScanTriggerTime = Date.now();
    const batchId = Date.now().toString();
    currentBatchId = batchId;

    // 🚨 FIX: Clear old results immediately using ISOLATED keys
    chrome.storage.local.remove([STATE_KEY, RESULT_KEY], () => {
      chrome.storage.local.set({ [STATE_KEY]: 'scanning' });
      safeSendMessage({ type: "REQUEST_OPEN_POPUP" });
    });

    setTimeout(() => {
      if (currentBatchId !== batchId) return;

      const subjectNode = document.querySelector('div[role="main"] [title], #ItemHeaderTitle, [data-testid="onboarding-test-id"] [title], .j_P6_ [title]');
      const bodyNode = document.querySelector('[aria-label="Message body"], .x_S158_, .wide-content-host, .rps_ce92, [data-testid="readingPaneBody"]');

      let subject = subjectNode?.innerText || subjectNode?.title || "";
      if (subject === "Navigation pane") subject = "Outlook Email";

      const body = bodyNode?.innerText.trim() || "";

      if (body.length > 10) {
        batchState.set(batchId, { activeScans: 1, threats: [] });
        sendToServerForDetection("outlook", subject, body, `outlook_${Date.now()}`, extractUrls(body), bodyNode, batchId);
      } else {
        chrome.storage.local.set({ [STATE_KEY]: 'idle' });
      }
    }, 2000);
  }, true);
}

function detectTelegramChatOpen() {
  document.addEventListener('click', (event) => {
    if (!isScannerActive) return;
    const chatRow = event.target.closest('.ListItem, .chatlist-chat, [data-peer-id]');
    if (!chatRow) return;

    lastScanTriggerTime = Date.now();
    const batchId = Date.now().toString();
    currentBatchId = batchId;

    // 🚨 FIX: Clear old results immediately using ISOLATED keys
    chrome.storage.local.remove([STATE_KEY, RESULT_KEY], () => {
      chrome.storage.local.set({ [STATE_KEY]: 'scanning' });
      safeSendMessage({ type: "REQUEST_OPEN_POPUP" });
    });

    setTimeout(() => {
      if (currentBatchId !== batchId) return;

      const messages = Array.from(document.querySelectorAll('.message, .Message')).slice(-3);
      const validNodes = messages.filter(node => node.innerText.trim().length >= 5);

      if (validNodes.length === 0) {
        chrome.storage.local.set({ [STATE_KEY]: 'idle' });
        return;
      }

      batchState.set(batchId, { activeScans: validNodes.length, threats: [] });

      validNodes.forEach((node, i) => {
        const text = node.innerText.trim();
        const isOut = node.classList.contains('message-out') || node.closest('.own');
        const traceId = `tg_${Date.now()}_${i}`;
        sendToServerForDetection("telegram", isOut ? "Me" : "Contact", text, traceId, extractUrls(text), node, batchId);
      });
    }, 1500);
  }, true);
}

function detectTeamsChatOpen() {
  document.addEventListener('mousedown', (e) => {
    if (!isScannerActive) return;
    const chatItem = e.target.closest('[data-tid="chat-list-item"], .fui-ChatListItem, [role="treeitem"]');

    lastScanTriggerTime = Date.now();

    if (chatItem) {
      const batchId = Date.now().toString();
      currentBatchId = batchId;

      // 🚨 FIX: Clear old results immediately using ISOLATED keys
      chrome.storage.local.remove([STATE_KEY, RESULT_KEY], () => {
        chrome.storage.local.set({ [STATE_KEY]: 'scanning' });
        safeSendMessage({ type: "REQUEST_OPEN_POPUP" });
      });

      setTimeout(() => {
        if (currentBatchId !== batchId) return;

        const messageNodes = document.querySelectorAll('[data-tid="chat-pane-message-text"], .fui-ChatMessage__body, [id^="content-"]');
        const lastMessages = Array.from(messageNodes).slice(-3);

        const validNodes = lastMessages.filter(node => node.innerText.trim().length >= 5);

        if (validNodes.length === 0) {
          chrome.storage.local.set({ [STATE_KEY]: 'idle' });
          return;
        }

        batchState.set(batchId, { activeScans: validNodes.length, threats: [] });

        validNodes.forEach((node, i) => {
          const text = node.innerText.trim();
          const isOut = node.closest('.fui-ChatEntity__isSelf, [data-tid="chat-pane-message-out"]');
          sendToServerForDetection("teams", isOut ? "Me" : "Contact", text, `teams_${Date.now()}_${i}`, extractUrls(text), node, batchId);
        });
      }, 2500);
    }
  }, true);
}

// --- 5. INITIALIZATION & NAVIGATION ---
if (currentPlatform) {
  chrome.runtime.sendMessage({ type: "CHECK_SCANNER_STATE", platform: currentPlatform }, (response) => {

    // 1. Set the initial kill switch state
    isScannerActive = (response?.state === 'ON');

    // 2. ALWAYS attach the listeners so they can be toggled live
    if (currentPlatform === 'gmail') detectGmailEmailOpen();
    if (currentPlatform === 'telegram') detectTelegramChatOpen();
    if (currentPlatform === 'outlook') detectOutlookEmailOpen();
    if (currentPlatform === 'teams') detectTeamsChatOpen();

    // 3. Prompt user if uninitialized
    if (response?.shouldPrompt) {
      showGatekeeperPrompt(currentPlatform);
    }
  });
}

let lastUrl = location.href;
const navObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;

    if (Date.now() - lastScanTriggerTime < 2000) {
      console.log("🔄 FlagIt: URL changed, but ignoring because scan just started.");
      return;
    }

    console.log("🔄 FlagIt: URL changed. Resetting UI state.");

    // 🚨 FIX: Strictly clear only the isolated keys
    if (chrome.runtime?.id) {
      chrome.storage.local.remove([STATE_KEY, RESULT_KEY]);
    }
  }
});
navObserver.observe(document, { subtree: true, childList: true });

function showGatekeeperPrompt(platform) {
  if (document.getElementById('flagit-gatekeeper')) return;
  const overlay = document.createElement('div');
  overlay.id = 'flagit-gatekeeper';
  overlay.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 999999; background: #0a1a2f; color: white; padding: 20px; border-radius: 12px; border: 1px solid rgba(34, 211, 238, 0.4); width: 300px; text-align: center; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5);`;
  overlay.innerHTML = `
    <h2 style="color: #22D3EE; margin-top: 0;">FlagIt Security</h2>
    <p style="font-size: 14px;">Enable background phishing scanning for ${platform}?</p>
    <div style="display: flex; gap: 10px;">
      <button id="flagit-btn-on" style="background: #F97316; color: white; border: none; flex: 1; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold;">Turn ON</button>
      <button id="flagit-btn-off" style="background: transparent; color: white; border: 1px solid #444; flex: 1; padding: 10px; border-radius: 8px; cursor: pointer;">Leave OFF</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('flagit-btn-on').onclick = () => {
    chrome.runtime.sendMessage({ type: "SET_SCANNER_STATE", platform, state: "ON" });
    overlay.remove();
    location.reload();
  };
  document.getElementById('flagit-btn-off').onclick = () => {
    chrome.runtime.sendMessage({ type: "SET_SCANNER_STATE", platform, state: "OFF" });
    overlay.remove();
  };
}

// --- 6. POPUP SYNC LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SET_ACTIVE_THREAT") {
    const targetId = request.threatId;

    document.querySelectorAll('[data-flagit-threat-id]').forEach(node => {
      node.classList.add('flagit-dimmed');
      node.classList.remove('flagit-active');
    });

    const activeNode = document.querySelector(`[data-flagit-threat-id="${targetId}"]`);
    if (activeNode) {
      activeNode.classList.remove('flagit-dimmed');
      activeNode.classList.add('flagit-active');
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    sendResponse({ success: true });
  }
});