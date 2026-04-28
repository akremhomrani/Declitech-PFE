(function () {
  "use strict";

  const CHECK_INTERVAL = 10000;
  let lastSessionCode = null;
  let lastStudentIdentity = null;
  let lastSentData = null;
  let checkInterval = null;

  function extractSessionCode() {
    const codeBoxes = document.querySelectorAll('[class*="code-box"], [class*="student-code"], .session-code');
    for (const box of codeBoxes) {
      const text = box.textContent.trim().toUpperCase();
      if (/[A-Z0-9]{6}/.test(text.replace(/\s/g, ""))) {
        return text.replace(/\s/g, "").substring(0, 6);
      }
    }
    const pageText = document.body.innerText || "";
    const codeMatch = pageText.match(/(?:Student|Access)\s+(?:Code|code)[:\s]*([A-Z0-9]{6})/i);
    if (codeMatch) return codeMatch[1];

    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) return params.get("code").toUpperCase();
    if (params.has("session")) return params.get("session").toUpperCase();
    return null;
  }

  function extractStudentIdentity() {
    const studentElements = document.querySelectorAll('[class*="student"], [class*="user"], [class*="identity"]');
    for (const el of studentElements) {
      const text = el.textContent?.trim();
      if (text && text.length > 1 && text.length < 100 && !text.includes("Loading")) {
        return text;
      }
    }
    const headers = document.querySelectorAll('header, nav, [role="banner"]');
    for (const header of headers) {
      const text = header.innerText || "";
      const match = text.match(/(?:Student|User|Name)[:\s]+([^\n]+)/i);
      if (match) return match[1].trim();
    }
    return null;
  }

  function detectDecliActivity() {
    try {
      const sessionCode = extractSessionCode();
      if (!sessionCode) return null;

      const activityCards = document.querySelectorAll('[class*="activity"], [class*="card"], button[class*="activity"]');
      if (activityCards.length === 0) return null;

      const titleEl = document.querySelector('h1, h2, [class*="title"], .activity-name');
      const activityName = titleEl?.innerText?.trim() || "Decli Activity";

      let currentActivity = null;
      const activeCard = document.querySelector('[class*="active"], [class*="selected"], [class*="current"]');
      if (activeCard) currentActivity = activeCard.innerText?.trim() || activityName;

      return {
        type: "LEVEL_PROGRESS",
        site: "decli.tech",
        levelSlug: "decli-activity",
        levelName: currentActivity || activityName,
        completed: false,
        score: 50,
        studentWork: `Activity: ${currentActivity || activityName}`,
        url: location.href,
        timestamp: new Date().toISOString(),
      };
    } catch { return null; }
  }

  function sendPedagogyUpdate() {
    const sessionCode = extractSessionCode();
    if (!sessionCode) return;
    const data = detectDecliActivity();
    if (!data) return;
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSentData) return;
    lastSentData = dataStr;
    try {
      chrome.runtime.sendMessage({ type: "PEDAGOGY_UPDATE", data });
    } catch {}
  }

  function notifySessionStart() {
    const code = extractSessionCode();
    const identity = extractStudentIdentity();
    if (!code) return;
    if (code === lastSessionCode && identity === lastStudentIdentity) return;
    lastSessionCode = code;
    lastStudentIdentity = identity;
    try {
      chrome.runtime.sendMessage({
        type: "SESSION_STARTED",
        sessionCode: code,
        participantId: `PARTICIPANT-${code}`,
        studentLoginIdentity: identity || "",
      });
    } catch {}
  }

  function notifySessionStop() {
    if (!lastSessionCode) return;
    try { chrome.runtime.sendMessage({ type: "SESSION_STOPPED" }); } catch {}
    lastSessionCode = null;
    lastStudentIdentity = null;
    lastSentData = null;
  }

  checkInterval = setInterval(() => {
    try {
      if (!window.location.href.includes("decli.tech")) {
        clearInterval(checkInterval);
        notifySessionStop();
        return;
      }
      notifySessionStart();
      sendPedagogyUpdate();
    } catch {}
  }, CHECK_INTERVAL);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      notifySessionStop();
    } else {
      notifySessionStart();
      lastSentData = null;
      sendPedagogyUpdate();
    }
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(checkInterval);
    notifySessionStop();
  });

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSentData = null;
      setTimeout(() => {
        notifySessionStart();
        sendPedagogyUpdate();
      }, 500);
    }
  }).observe(document.documentElement, { subtree: true, childList: true });

  setTimeout(() => {
    notifySessionStart();
    sendPedagogyUpdate();
  }, 1000);
})();
