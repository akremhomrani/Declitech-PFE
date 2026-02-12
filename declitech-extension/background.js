const KAFKA_ALERT_URL = "http://localhost:8081/api/alerts/publish";
const ALLOWED_URL = "https://app.decli.tech/classroom/login.php?p=login-container";
const CHECK_INTERVAL = 2000; // Check every 2 seconds

let activeSessionCode = null;
let activeParticipantId = null;
let studentLoginIdentity = null;
let lastUrl = null;
let tabSwitchCount = 0;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 5000; // 5 seconds between alerts

// Listen for session start from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SESSION_STARTED") {
        activeSessionCode = message.sessionCode;
        activeParticipantId = message.participantId;
        studentLoginIdentity = message.studentLoginIdentity;
        tabSwitchCount = 0;
        lastUrl = null;
        console.log("📡 Background: Session started", { activeSessionCode, activeParticipantId, studentLoginIdentity });
        startMonitoring();
        sendResponse({ success: true });
    } else if (message.type === "SESSION_STOPPED") {
        activeSessionCode = null;
        activeParticipantId = null;
        studentLoginIdentity = null;
        tabSwitchCount = 0;
        lastUrl = null;
        console.log("🛑 Background: Session stopped");
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

            // Check if current URL is NOT the allowed URL
            if (!isUrlAllowed(currentUrl)) {
                await sendTabSwitchAlert(currentUrl);
            }
        }
    } catch (error) {
        console.error("Error checking active tab:", error);
    }
}

function isUrlAllowed(url) {
    // Allow the exact URL or any URL starting with the allowed URL
    return url === ALLOWED_URL || url.startsWith(ALLOWED_URL);
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
            allowedUrl: ALLOWED_URL
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

console.log("🔧 DecliTech Background Service Worker loaded");
