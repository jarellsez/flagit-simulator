// src/content/content.js
// This script will run on Gmail/Telegram/Teams pages

console.log("🚀 FlagIt content script loaded");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_EMAIL_CONTENT") {
    // For now, just return a simple message
    sendResponse({ status: "Content script is ready" });
  }
  return true;
});