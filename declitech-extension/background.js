// =========================================================
//  DecliTech Extension — Background Service Worker
//  Utilise chrome.storage.session pour persister l'état entre les
//  redémarrages du Service Worker (MV3)
// =========================================================

const KAFKA_ALERT_URL = "http://localhost:8081/api/alerts/publish";
const ALERT_COOLDOWN = 5000;
const MOUSE_INACTIVITY_THRESHOLD = 30 * 1000; // 30 secondes
const MOUSE_CHECK_INTERVAL = 5000;

// Sites autorisés — tous les autres déclenchent une alerte TAB_SWITCH
const ALLOWED_ORIGINS = [
    "https://app.decli.tech",
    "http://localhost:4200",
    "http://localhost:3000"
];

// Pages système Chrome — ignorées (pas d'alerte)
const SYSTEM_PREFIXES = [
    "chrome://", "chrome-extension://", "about:",
    "file://", "edge://", "moz-extension://"
];

// Variables en mémoire (perdues si SW dort — valeurs lues depuis storage)
let lastMouseMoveTime = Date.now();
let mouseInactivityCheckInterval = null;

// =========================================================
//  Helpers — stockage session persistant
// =========================================================

async function getState() {
    const data = await chrome.storage.session.get([
        'activeSessionCode', 'activeParticipantId', 'studentLoginIdentity',
        'lastUrl', 'tabSwitchCount', 'lastAlertTime', 'isCurrentlyOnWrongSite',
        'mouseInactivityAlertSent', 'lastMouseMoveTime'
    ]);
    return {
        activeSessionCode: data.activeSessionCode || null,
        activeParticipantId: data.activeParticipantId || null,
        studentLoginIdentity: data.studentLoginIdentity || null,
        lastUrl: data.lastUrl || null,
        tabSwitchCount: data.tabSwitchCount || 0,
        lastAlertTime: data.lastAlertTime || 0,
        isCurrentlyOnWrongSite: data.isCurrentlyOnWrongSite || false,
        mouseInactivityAlertSent: data.mouseInactivityAlertSent || false,
        lastMouseMoveTime: data.lastMouseMoveTime || Date.now()
    };
}

async function setState(patch) {
    await chrome.storage.session.set(patch);
}

// =========================================================
//  Messages depuis popup.js / content.js
// =========================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.type === "SESSION_STARTED") {
            await setState({
                activeSessionCode: message.sessionCode,
                activeParticipantId: message.participantId,
                studentLoginIdentity: message.studentLoginIdentity,
                lastUrl: null,
                tabSwitchCount: 0,
                lastAlertTime: 0,
                isCurrentlyOnWrongSite: false,
                mouseInactivityAlertSent: false,
                lastMouseMoveTime: Date.now()
            });
            lastMouseMoveTime = Date.now();
            startMouseInactivityTracking();
            // Vérification initiale
            await checkUrl();
            sendResponse({ success: true });

        } else if (message.type === "SESSION_STOPPED") {
            await setState({
                activeSessionCode: null,
                activeParticipantId: null,
                studentLoginIdentity: null,
                lastUrl: null,
                tabSwitchCount: 0,
                lastAlertTime: 0,
                isCurrentlyOnWrongSite: false,
                mouseInactivityAlertSent: false
            });
            stopMouseInactivityTracking();
            sendResponse({ success: true });

        } else if (message.type === "MOUSE_MOVED") {
            const state = await getState();
            const wasSentBefore = state.mouseInactivityAlertSent;
            lastMouseMoveTime = Date.now();
            await setState({ lastMouseMoveTime, mouseInactivityAlertSent: false });

            // Si une alerte d'inactivité était active → la résoudre (effacer badge BLOCKED)
            if (wasSentBefore && state.activeSessionCode) {
                await postAlert({
                    participantId: state.activeParticipantId,
                    sessionId: state.activeSessionCode,
                    studentLoginIdentity: state.studentLoginIdentity,
                    alertType: "ALERT_RESOLVED",
                    severity: "LOW",
                    message: "Activité souris détectée — alerte d'inactivité résolue",
                    timestamp: new Date().toISOString(),
                    metadata: { resolved: true, resolvedType: "MOUSE_INACTIVITY" }
                });
            }
            sendResponse({ success: true });
        }
    })();
    return true; // async response
});

// =========================================================
//  Détection changement d'onglet — événements natifs Chrome
// =========================================================

// Déclenché immédiatement quand l'utilisateur clique sur un autre onglet
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab || !tab.url) return;
        handleUrlChange(tab.url);
    });
});

// Déclenché quand la navigation est complète dans un onglet
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        handleUrlChange(tab.url);
    }
});

// Vérification initiale de tous les onglets actifs
async function checkUrl() {
    const state = await getState();
    if (!state.activeSessionCode) return;
    try {
        const tabs = await chrome.tabs.query({ active: true });
        for (const tab of tabs) {
            if (tab.url && !isUrlAllowed(tab.url)) {
                await handleUrlChange(tab.url);
                return;
            }
        }
    } catch (e) { }
}

// Logique centrale de décision alerte
async function handleUrlChange(url) {
    if (!url) return;

    // Pages système → ignorer
    if (SYSTEM_PREFIXES.some(p => url.startsWith(p))) return;

    const state = await getState();
    if (!state.activeSessionCode) return; // pas de session active
    if (url === state.lastUrl) return;    // même URL → ignorer

    await setState({ lastUrl: url });

    const allowed = isUrlAllowed(url);

    if (!allowed && !state.isCurrentlyOnWrongSite) {
        await setState({ isCurrentlyOnWrongSite: true });
        await sendTabSwitchAlert(url, state);

    } else if (allowed && state.isCurrentlyOnWrongSite) {
        await setState({ isCurrentlyOnWrongSite: false, tabSwitchCount: 0 });
        await sendAlertResolved(url, state);
    }
}

function isUrlAllowed(url) {
    if (!url) return true;
    if (SYSTEM_PREFIXES.some(p => url.startsWith(p))) return true;
    return ALLOWED_ORIGINS.some(origin => url.startsWith(origin));
}

// =========================================================
//  Envoi des alertes
// =========================================================

async function sendTabSwitchAlert(currentUrl, state) {
    const now = Date.now();
    if (now - state.lastAlertTime < ALERT_COOLDOWN) return;

    const newCount = (state.tabSwitchCount || 0) + 1;
    await setState({ lastAlertTime: now, tabSwitchCount: newCount });

    const alertType = newCount >= 5 ? "MULTIPLE_SWITCHES" : "TAB_SWITCH";
    const severity = newCount >= 5 ? "HIGH" : newCount >= 3 ? "MEDIUM" : "LOW";

    await postAlert({
        participantId: state.activeParticipantId,
        sessionId: state.activeSessionCode,
        studentLoginIdentity: state.studentLoginIdentity,
        alertType,
        severity,
        message: `Étudiant a navigué vers : ${currentUrl}`,
        timestamp: new Date().toISOString(),
        metadata: { switchCount: newCount, currentUrl, allowedOrigins: ALLOWED_ORIGINS }
    });
}

async function sendAlertResolved(currentUrl, state) {
    await postAlert({
        participantId: state.activeParticipantId,
        sessionId: state.activeSessionCode,
        studentLoginIdentity: state.studentLoginIdentity,
        alertType: "ALERT_RESOLVED",
        severity: "LOW",
        message: `Étudiant retourné sur le site autorisé : ${currentUrl}`,
        timestamp: new Date().toISOString(),
        metadata: { currentUrl, resolved: true }
    });
}

// =========================================================
//  Inactivité souris
// =========================================================

function startMouseInactivityTracking() {
    if (mouseInactivityCheckInterval) clearInterval(mouseInactivityCheckInterval);
    mouseInactivityCheckInterval = setInterval(checkMouseInactivity, MOUSE_CHECK_INTERVAL);
}

function stopMouseInactivityTracking() {
    if (mouseInactivityCheckInterval) {
        clearInterval(mouseInactivityCheckInterval);
        mouseInactivityCheckInterval = null;
    }
}

async function checkMouseInactivity() {
    const state = await getState();
    if (!state.activeSessionCode || state.mouseInactivityAlertSent) return;

    const storedLastMove = state.lastMouseMoveTime || lastMouseMoveTime;
    const timeSinceLastMove = Date.now() - storedLastMove;

    if (timeSinceLastMove >= MOUSE_INACTIVITY_THRESHOLD) {
        await setState({ mouseInactivityAlertSent: true });
        await postAlert({
            participantId: state.activeParticipantId,
            sessionId: state.activeSessionCode,
            studentLoginIdentity: state.studentLoginIdentity,
            alertType: "MOUSE_INACTIVITY",
            severity: "MEDIUM",
            message: `Aucun mouvement de souris depuis ${Math.round(timeSinceLastMove / 1000)}s`,
            timestamp: new Date().toISOString(),
            metadata: { inactivityDurationMs: timeSinceLastMove }
        });
    }
}

// =========================================================
//  Helper HTTP
// =========================================================

async function postAlert(alertPayload) {
    try {
        await fetch(KAFKA_ALERT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alertPayload)
        });
    } catch (e) {
        // Réseau indisponible — ignorer silencieusement
    }
}
