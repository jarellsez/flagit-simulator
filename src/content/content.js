// src/content/content.js
console.log("🚀 FlagIt content script loaded on:", window.location.hostname);

// Function to generate a unique ID for each email
function generateEmailId(emailRow) {
  const threadId = emailRow.getAttribute('jslog');
  if (threadId) return `gmail_${threadId}`;
  
  const subjectElement = emailRow.querySelector('.y6');
  const subject = subjectElement ? subjectElement.textContent.slice(0, 20) : 'unknown';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  return `email_${timestamp}_${random}_${subject.replace(/[^a-zA-Z0-9]/g, '')}`;
}

// SIMPLE inbox detection
function detectInboxView() {
  console.log("📬 Setting up inbox detection");
  
  setInterval(() => {
    // Check if we're in list view and no email is open
    const openEmail = document.querySelector('.nH .nH .nH');
    
    if (!openEmail) {
      // We're in inbox/list view
      chrome.storage.local.set({ 
        currentEmailId: null
        // DON'T touch scanningState
      });
    }
  }, 1000);
}

// Function to detect Gmail email opens
function detectGmailEmailOpen() {
  console.log("📧 Setting up Gmail click detection");
  
  document.addEventListener('click', (event) => {
    const emailRow = event.target.closest('.zA');
    if (!emailRow) return;
    
    // FILTERS
    if (event.target.closest('[role="checkbox"]')) {
      console.log("⏭️ Checkbox clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Archive"]')) {
      console.log("⏭️ Archive clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Mark as unread"]')) {
      console.log("⏭️ Mark as unread clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Mark as read"]')) {
      console.log("⏭️ Mark as read clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Delete"]')) {
      console.log("⏭️ Delete clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Snooze"]')) {
      console.log("⏭️ Snooze clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Starred"]')) {
      console.log("⏭️ Star clicked - ignoring");
      return;
    }
    if (event.target.closest('[data-tooltip="Not starred"]')) {
      console.log("⏭️ Star clicked - ignoring");
      return;
    }
    
    console.log("📧 Email opened");
    
    const subjectElement = emailRow.querySelector('.y6');
    const subject = subjectElement ? subjectElement.textContent : 'Unknown';
    const emailId = generateEmailId(emailRow);
    
    chrome.runtime.sendMessage({ 
      type: "EMAIL_OPENED",
      platform: "gmail",
      subject: subject,
      emailId: emailId
    });
  }, true);
}

// Run
if (window.location.hostname.includes('mail.google.com')) {
  console.log("📧 Gmail detected");
  detectGmailEmailOpen();
  detectInboxView();
}