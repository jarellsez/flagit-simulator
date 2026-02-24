// src/content/content.js
console.log("🚀 FlagIt content script loaded on:", window.location.hostname);

// Function to detect Gmail email opens
function detectGmailEmailOpen() {
  console.log("📧 Setting up Gmail click detection");
  
  document.addEventListener('click', (event) => {
    const emailRow = event.target.closest('.zA');
    
    if (!emailRow) return;
    
    // FILTER 1: Ignore checkbox clicks
    if (event.target.closest('[role="checkbox"]')) {
      console.log("⏭️ Checkbox clicked - ignoring");
      return;
    }
    
    // FILTER 2: Ignore archive button
    if (event.target.closest('[data-tooltip="Archive"]')) {
      console.log("⏭️ Archive button clicked - ignoring");
      return;
    }
    
    // FILTER 3: Ignore mark as unread button
    if (event.target.closest('[data-tooltip="Mark as unread"]')) {
      console.log("⏭️ Mark as unread clicked - ignoring");
      return;
    }
    
    // FILTER 4: Ignore mark as read button
    if (event.target.closest('[data-tooltip="Mark as read"]')) {
      console.log("⏭️ Mark as read clicked - ignoring");
      return;
    }
    
    // FILTER 5: Ignore delete button
    if (event.target.closest('[data-tooltip="Delete"]')) {
      console.log("⏭️ Delete clicked - ignoring");
      return;
    }
    
    // FILTER 6: Ignore snooze button
    if (event.target.closest('[data-tooltip="Snooze"]')) {
      console.log("⏭️ Snooze clicked - ignoring");
      return;
    }
    
    // FILTER 7: Ignore star button (handles both "Star" and "Not starred")
    if (event.target.closest('[data-tooltip="Starred"]') || 
        event.target.closest('[data-tooltip="Not starred"]')) {
      console.log("⏭️ Star clicked - ignoring");
      return;
    }
    
    // If we get here, trigger popup
    console.log("📧 Email row clicked - opening popup");
    
    setTimeout(() => {
      chrome.runtime.sendMessage({ 
        type: "EMAIL_OPENED",
        platform: "gmail"
      });
    }, 200);
  }, true);
}

// Run the detector
const hostname = window.location.hostname;

if (hostname.includes('mail.google.com')) {
  console.log("📧 Gmail platform detected - activating scanner");
  detectGmailEmailOpen();
}