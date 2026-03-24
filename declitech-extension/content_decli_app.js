// =========================================================
//  DecliTech Extension — Decli.Tech App Activity Detector
//  Monitors https://app.decli.tech/ for session joins & activities
//  Auto-notifies background.js like CodeCombat detection
//  Creates JSON files via /pedagogy/progress endpoint
// =========================================================

(function () {
  "use strict";

  const CHECK_INTERVAL = 10000; // Check every 10 seconds (like CodeCombat)
  let lastSessionCode = null;
  let lastStudentIdentity = null;
  let lastSentData = null;

  // -------------------------------------------------------
  //  Extract session code from page
  // -------------------------------------------------------
  function extractSessionCode() {
    // Strategy 1: Look for the displayed session code
    // Typically shown in large format like: "8 1 Y M H A"
    const codeBoxes = document.querySelectorAll('[class*="code-box"], [class*="student-code"], .session-code');
    for (const box of codeBoxes) {
      const text = box.textContent.trim().toUpperCase();
      if (/[A-Z0-9]{6}/.test(text.replace(/\s/g, ''))) {
        return text.replace(/\s/g, '').substring(0, 6);
      }
    }

    // Strategy 2: Look in main page text for "Student Access Code" or similar
    const pageText = document.body.innerText || '';
    const codeMatch = pageText.match(/(?:Student|Access)\s+(?:Code|code)[:\s]*([A-Z0-9]{6})/i);
    if (codeMatch) return codeMatch[1];

    // Strategy 3: Check URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) return params.get('code').toUpperCase();
    if (params.has('session')) return params.get('session').toUpperCase();

    return null;
  }

  // -------------------------------------------------------
  //  Extract student identity
  // -------------------------------------------------------
  function extractStudentIdentity() {
    // Look for student name/email in the page
    const studentElements = document.querySelectorAll('[class*="student"], [class*="user"], [class*="identity"]');
    
    for (const el of studentElements) {
      const text = el.textContent?.trim();
      if (text && text.length > 1 && text.length < 100 && !text.includes('Loading')) {
        return text;
      }
    }

    // Check for visible user/student info in headers or sidebars
    const headers = document.querySelectorAll('header, nav, [role="banner"]');
    for (const header of headers) {
      const text = header.innerText || '';
      // Look for patterns like "Student: John" or just a name
      const match = text.match(/(?:Student|User|Name)[:\s]+([^\n]+)/i);
      if (match) return match[1].trim();
    }

    return null;
  }

  // -------------------------------------------------------
  //  Detect Decli App Activities (like CodeCombat detection)
  // -------------------------------------------------------
  function detectDecliActivity() {
    try {
      const sessionCode = extractSessionCode();
      if (!sessionCode) return null;

      const studentIdentity = extractStudentIdentity();

      // Detect if we're in the activities panel
      const activityCards = document.querySelectorAll('[class*="activity"], [class*="card"], button[class*="activity"]');
      const activitiesVisible = activityCards.length > 0;
      
      if (!activitiesVisible) return null;

      // Extract activity/exercise name
      const titleEl = document.querySelector('h1, h2, [class*="title"], .activity-name');
      const activityName = titleEl?.innerText?.trim() || 'Decli Activity';

      // Check if any activity is active (opened/in progress)
      let currentActivity = null;
      let activeActivityName = null;
      const activeCard = document.querySelector('[class*="active"], [class*="selected"], [class*="current"]');
      if (activeCard) {
        activeActivityName = activeCard.innerText?.trim() || activityName;
        currentActivity = activeActivityName;
      }

      // Construct pedagogical progress object (like CodeCombat)
      return {
        type: 'LEVEL_PROGRESS',
        site: 'decli.tech',
        levelSlug: 'decli-activity',
        levelName: currentActivity || activityName,
        completed: false, // Assume false unless explicitly marked
        score: 50, // Default mid-range score
        studentWork: `Activity: ${currentActivity || activityName}`,
        url: location.href,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('[DecliTech] Error detecting Decli activity:', e);
      return null;
    }
  }

  // -------------------------------------------------------
  //  Send PEDAGOGY_UPDATE to background (like CodeCombat)
  // -------------------------------------------------------
  function sendPedagogyUpdate() {
    const sessionCode = extractSessionCode();
    if (!sessionCode) return;

    const data = detectDecliActivity();
    if (!data) return;

    // Avoid sending same data in loop (like CodeCombat detection)
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSentData) return;
    lastSentData = dataStr;

    try {
      chrome.runtime.sendMessage({
        type: "PEDAGOGY_UPDATE",
        data: data
      }, (response) => {
        console.log(`[DecliTech Extension] PEDAGOGY_UPDATE sent for: ${data.levelName}`);
      });
    } catch (e) {
      // Silent error
    }
  }

  // -------------------------------------------------------
  //  Notify background script of session START
  // -------------------------------------------------------
  function notifySessionStart() {
    const code = extractSessionCode();
    const identity = extractStudentIdentity();

    // Only send if we have a code and it's different from last time
    if (!code) return;

    if (code === lastSessionCode && identity === lastStudentIdentity) {
      return; // No change
    }

    lastSessionCode = code;
    lastStudentIdentity = identity;

    try {
      chrome.runtime.sendMessage({
        type: "SESSION_STARTED",
        sessionCode: code,
        participantId: `PARTICIPANT-${code}`,
        studentLoginIdentity: identity || ""
      }, (response) => {
        console.log(`[DecliTech Extension] SESSION_STARTED - Code: ${code}, Identity: ${identity}`);
      });
    } catch (e) {
      // Extension might not be available
    }
  }

  // -------------------------------------------------------
  //  Notify background script of session STOP
  // -------------------------------------------------------
  function notifySessionStop() {
    if (!lastSessionCode) return;

    try {
      chrome.runtime.sendMessage({
        type: "SESSION_STOPPED"
      }, () => {
        console.log(`[DecliTech Extension] SESSION_STOPPED`);
      });
    } catch (e) {
      // Extension might not be available
    }

    lastSessionCode = null;
    lastStudentIdentity = null;
    lastSentData = null;
  }

  // -------------------------------------------------------
  //  Periodic check (both session START and activity updates)
  // -------------------------------------------------------
  let checkInterval = setInterval(() => {
    try {
      // Check if we're still on the Decli app
      if (!window.location.href.includes("decli.tech")) {
        clearInterval(checkInterval);
        notifySessionStop();
        return;
      }

      // Check if session is still active
      notifySessionStart();
      
      // Send pedagogy updates (activity detection)
      sendPedagogyUpdate();
    } catch (e) {
      // Silent error
    }
  }, CHECK_INTERVAL);

  // -------------------------------------------------------
  //  Listen for visibility changes
  // -------------------------------------------------------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      notifySessionStop();
    } else {
      // Page became visible again, re-check
      notifySessionStart();
      lastSentData = null; // Reset to resend pedagogy update
      sendPedagogyUpdate();
    }
  });

  // -------------------------------------------------------
  //  Stop monitoring on page unload
  // -------------------------------------------------------
  window.addEventListener("beforeunload", () => {
    clearInterval(checkInterval);
    notifySessionStop();
  });

  // -------------------------------------------------------
  //  Listen for SPA navigation (like CodeCombat)
  // -------------------------------------------------------
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSentData = null; // Reset for new page
      setTimeout(() => {
        notifySessionStart();
        sendPedagogyUpdate();
      }, 500);
    }
  }).observe(document.documentElement, { subtree: true, childList: true });

  // Initial checks
  setTimeout(() => {
    notifySessionStart();
    sendPedagogyUpdate();
  }, 1000);

  console.log("[DecliTech Extension] Decli.Tech activity detector initialized");
})();
