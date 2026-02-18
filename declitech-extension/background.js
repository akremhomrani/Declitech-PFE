const KAFKA_ALERT_URL = "http://localhost:8083/api/alerts/publish";
const ALLOWED_URL_PREFIX = "https://app.decli.tech/";
const CHECK_INTERVAL = 2000;

let activeSessionCode = null;
let activeParticipantId = null;
let studentLoginIdentity = null;
let lastUrl = null;
let tabSwitchCount = 0;
let lastAlertTime = 0;
let isCurrentlyOnWrongSite = false;
const ALERT_COOLDOWN = 5000;

let lastMouseMoveTime = Date.now();
let mouseInactivityCheckInterval = null;
let mouseInactivityAlertSent = false;
const MOUSE_INACTIVITY_THRESHOLD = 30 * 1000;
const MOUSE_CHECK_INTERVAL = 5000;

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
        sendResponse({ success: true });
    } else if (message.type === "MOUSE_MOVED") {
        lastMouseMoveTime = Date.now();
        mouseInactivityAlertSent = false;
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

        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;

            const urlIsAllowed = isUrlAllowed(currentUrl);

            if (!urlIsAllowed && !isCurrentlyOnWrongSite) {
                isCurrentlyOnWrongSite = true;
                await sendTabSwitchAlert(currentUrl);
            }
            else if (urlIsAllowed && isCurrentlyOnWrongSite) {
                isCurrentlyOnWrongSite = false;
                tabSwitchCount = 0;
                await sendAlertResolved(currentUrl);
            }
        }
    } catch (error) {
        
    }
}

function isUrlAllowed(url) {
    return url.startsWith(ALLOWED_URL_PREFIX);
}

async function sendTabSwitchAlert(currentUrl) {
    const now = Date.now();

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

    try {
        const response = await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(alert)
        });

        if (response.ok) {
            
        } else {
            
        }
    } catch (error) {
        
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

    try {
        const response = await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(alert)
        });

        if (response.ok) {
            
        } else {
            
        }
    } catch (error) {
        
    }
}

function startMouseInactivityTracking() {
    if (mouseInactivityCheckInterval) {
        clearInterval(mouseInactivityCheckInterval);
    }

    mouseInactivityCheckInterval = setInterval(checkMouseInactivity, MOUSE_CHECK_INTERVAL);
}

function stopMouseInactivityTracking() {
    if (mouseInactivityCheckInterval) {
        clearInterval(mouseInactivityCheckInterval);
        mouseInactivityCheckInterval = null;
    }
}

async function checkMouseInactivity() {
    if (!activeSessionCode || mouseInactivityAlertSent) return;

    const now = Date.now();
    const timeSinceLastMove = now - lastMouseMoveTime;

    if (timeSinceLastMove >= MOUSE_INACTIVITY_THRESHOLD) {
        await sendMouseInactivityAlert();
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

    try {
        const response = await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(alert)
        });

        if (response.ok) {
            
        } else {
            
        }
    } catch (error) {
        
    }
}
