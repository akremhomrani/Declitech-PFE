const KAFKA_ALERT_URL = "http://localhost:8081/api/alerts/publish";
const ALLOWED_URL_PREFIX = "https://app.decli.tech/";
const CHECK_INTERVAL = 2000; // Check every 2 seconds

let activeSessionCode = null;
let activeParticipantId = null;
let studentLoginIdentity = null;
let lastUrl = null;
let tabSwitchCount = 0;
let lastAlertTime = 0;
let isCurrentlyOnWrongSite = false; // Track if student is currently off-site
const ALERT_COOLDOWN = 5000; // 5 seconds between alerts

// Mouse inactivity tracking
let lastMouseMoveTime = Date.now();
let mouseInactivityCheckInterval = null;
let mouseInactivityAlertSent = false;
const MOUSE_INACTIVITY_THRESHOLD = 30 * 1000; // 30 seconds (TEST MODE - change back to 5 * 60 * 1000 for production)
const MOUSE_CHECK_INTERVAL = 5000; // Check every 5 seconds (TEST MODE - change back to 30000 for production)

// Listen for session start from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SESSION_STARTED") {
        activeSessionCode = message.sessionCode;
        activeParticipantId = message.participantId;
        studentLoginIdentity = message.studentLoginIdentity;
        tabSwitchCount = 0;
        lastUrl = null;
        isCurrentlyOnWrongSite = false;
        lastMouseMoveTime = Date.now();
        mouseInactivityAlertSent = false;
        console.log("📡 Background: Session started", { activeSessionCode, activeParticipantId, studentLoginIdentity });
        startMonitoring();
        startMouseInactivityTracking();
        sendResponse({ success: true });
    } else if (message.type === "SESSION_STOPPED") {
        activeSessionCode = null;
        activeParticipantId = null;
        studentLoginIdentity = null;
        tabSwitchCount = 0;
        lastUrl = null;
        isCurrentlyOnWrongSite = false;
        mouseInactivityAlertSent = false;
        stopMouseInactivityTracking();
        console.log("🛑 Background: Session stopped");
        sendResponse({ success: true });
    } else if (message.type === "MOUSE_MOVED") {
        lastMouseMoveTime = Date.now();
        mouseInactivityAlertSent = false; // Reset alert flag when mouse moves
        sendResponse({ success: true });
    }
    return true;
});

function startMonitoring() {
    setInterval(checkActiveTab, CHECK_INTERVAL);
}

async function checkActiveTab() {
    if (!activeSessionCode) return;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) return;

        const currentUrl = tab.url;

        // Check if URL has changed
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;

            const urlIsAllowed = isUrlAllowed(currentUrl);

            // Student navigated to unauthorized site
            if (!urlIsAllowed && !isCurrentlyOnWrongSite) {
                isCurrentlyOnWrongSite = true;
                await sendTabSwitchAlert(currentUrl);
            }
            // Student returned to authorized site
            else if (urlIsAllowed && isCurrentlyOnWrongSite) {
                isCurrentlyOnWrongSite = false;
                tabSwitchCount = 0; // Reset counter
                await sendAlertResolved(currentUrl);
            }
        }
    } catch (error) {
        console.error("Error checking active tab:", error);
    }
}

function isUrlAllowed(url) {
    // Allow any URL that starts with https://app.decli.tech/
    return url.startsWith(ALLOWED_URL_PREFIX);
}

async function sendTabSwitchAlert(currentUrl) {
    const now = Date.now();

    // Cooldown to prevent spam
    if (now - lastAlertTime < ALERT_COOLDOWN) {
        return;
    }

    lastAlertTime = now;
    tabSwitchCount++;

    const alertType = tabSwitchCount >= 5 ? "MULTIPLE_SWITCHES" : "TAB_SWITCH";
    const severity = tabSwitchCount >= 5 ? "HIGH" : tabSwitchCount >= 3 ? "MEDIUM" : "LOW";

    const alert = {
        participantId: activeParticipantId,
        sessionId: activeSessionCode,
        studentLoginIdentity: studentLoginIdentity,
        alertType: alertType,
        severity: severity,
        message: `Student navigated to: ${currentUrl}`,
        timestamp: new Date().toISOString(),
        metadata: {
            switchCount: tabSwitchCount,
            currentUrl: currentUrl,
            allowedUrlPrefix: ALLOWED_URL_PREFIX
        }
    };

    console.log("🚨 Sending tab switch alert:", alert);

    try {
        const response = await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(alert)
        });

        if (response.ok) {
            console.log("✅ Alert sent successfully");
        } else {
            console.error("❌ Failed to send alert:", response.status, await response.text());
        }
    } catch (error) {
        console.error("❌ Error sending alert:", error);
    }
}

async function sendAlertResolved(currentUrl) {
    const alert = {
        participantId: activeParticipantId,
        sessionId: activeSessionCode,
        studentLoginIdentity: studentLoginIdentity,
        alertType: "ALERT_RESOLVED",
        severity: "LOW",
        message: `Student returned to allowed site: ${currentUrl}`,
        timestamp: new Date().toISOString(),
        metadata: {
            currentUrl: currentUrl,
            allowedUrlPrefix: ALLOWED_URL_PREFIX,
            resolved: true
        }
    };

    console.log("✅ Sending alert resolution:", alert);

    try {
        const response = await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(alert)
        });

        if (response.ok) {
            console.log("✅ Alert resolution sent successfully");
        } else {
            console.error("❌ Failed to send resolution:", response.status, await response.text());
        }
    } catch (error) {
        console.error("❌ Error sending resolution:", error);
    }
}

// ----------------------------
// Mouse Inactivity Tracking
// ----------------------------
function startMouseInactivityTracking() {
    if (mouseInactivityCheckInterval) {
        clearInterval(mouseInactivityCheckInterval);
    }

    console.log("🖱️ Starting mouse inactivity tracking");
    mouseInactivityCheckInterval = setInterval(checkMouseInactivity, MOUSE_CHECK_INTERVAL);
}

function stopMouseInactivityTracking() {
    if (mouseInactivityCheckInterval) {
        clearInterval(mouseInactivityCheckInterval);
        mouseInactivityCheckInterval = null;
        console.log("🖱️ Stopped mouse inactivity tracking");
    }
}

async function checkMouseInactivity() {
    if (!activeSessionCode || mouseInactivityAlertSent) return;

    const now = Date.now();
    const timeSinceLastMove = now - lastMouseMoveTime;

    if (timeSinceLastMove >= MOUSE_INACTIVITY_THRESHOLD) {
        console.log(`⏰ Mouse inactivity detected: ${Math.floor(timeSinceLastMove / 1000 / 60)} minutes`);
        await sendMouseInactivityAlert();
    } else {
        const minutesRemaining = Math.floor((MOUSE_INACTIVITY_THRESHOLD - timeSinceLastMove) / 1000 / 60);
        console.log(`🖱️ Mouse activity OK - ${minutesRemaining} minutes until inactivity alert`);
    }
}

async function sendMouseInactivityAlert() {
    mouseInactivityAlertSent = true;

    const alert = {
        participantId: activeParticipantId,
        sessionId: activeSessionCode,
        studentLoginIdentity: studentLoginIdentity,
        alertType: "MOUSE_INACTIVITY",
        severity: "MEDIUM",
        message: `Enfant bloqué - Aucun mouvement de souris détecté pendant 5 minutes`,
        timestamp: new Date().toISOString(),
        metadata: {
            inactivityDurationMs: Date.now() - lastMouseMoveTime,
            lastMouseMoveTime: new Date(lastMouseMoveTime).toISOString()
        }
    };

    console.log("🚨 Sending mouse inactivity alert:", alert);

    try {
        const response = await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(alert)
        });

        if (response.ok) {
            console.log("✅ Mouse inactivity alert sent successfully");
        } else {
            console.error("❌ Failed to send mouse inactivity alert:", response.status, await response.text());
        }
    } catch (error) {
        console.error("❌ Error sending mouse inactivity alert:", error);
    }
}

console.log("🔧 DecliTech Background Service Worker loaded");
