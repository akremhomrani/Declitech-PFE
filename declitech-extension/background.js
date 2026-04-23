const CONFIG = {
    ALERT_URL: "http://localhost:8081/api/alerts/publish",
    AGENT_URL: "http://127.0.0.1:8765",
};
const ALLOWED_SITES = [
    "https://app.decli.tech/",
    "https://learn.decli.tech/",
    "https://quiz.decli.tech/",
    "http://localhost:4200/"
];
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

let sessionValidationInterval = null;
let monitoringInterval = null;
let learnAnalysisInterval = null;
let quizSwitchTimeout = null;
let lastAiModuleData = null;

const LEARN_DURATION_MS = 75 * 60 * 1000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
        startSessionValidationCheck();
        quizSwitchTimeout = setTimeout(switchToQuiz, LEARN_DURATION_MS);
        sendResponse({ success: true });
    } else if (message.type === "SESSION_STOPPED") {
        fetch(`${CONFIG.AGENT_URL}/stop`, { method: "POST" }).catch(() => {});
        activeSessionCode = null;
        activeParticipantId = null;
        studentLoginIdentity = null;
        tabSwitchCount = 0;
        lastUrl = null;
        isCurrentlyOnWrongSite = false;
        mouseInactivityAlertSent = false;
        stopMonitoring();
        stopLearnAnalysis();
        stopMouseInactivityTracking();
        stopSessionValidationCheck();
        clearTimeout(quizSwitchTimeout);
        quizSwitchTimeout = null;
        logoutLearnPlatform();
        sendResponse({ success: true });
    } else if (message.type === "MOUSE_MOVED") {
        lastMouseMoveTime = Date.now();
        mouseInactivityAlertSent = false;
        sendResponse({ success: true });
    } else if (message.type === "LEARN_AI_DATA") {
        lastAiModuleData = message.data;
        sendResponse({ success: true });
    }
    return true;
});

function startSessionValidationCheck() {
    if (sessionValidationInterval) return;
    sessionValidationInterval = setInterval(async () => {
        if (!activeSessionCode) return;
        try {
            const res = await fetch(`${CONFIG.AGENT_URL}/validate/${activeSessionCode}`);
            if (!res.ok) return;
            const validation = await res.json().catch(() => null);
            if (!validation) return;
            if (!validation.valid) {
                const reason = validation.reason || "";
                if (reason === "inactive" || reason === "expired") {
                    await fetch(`${CONFIG.AGENT_URL}/stop`, { method: "POST" }).catch(() => {});
                    activeSessionCode = null;
                    activeParticipantId = null;
                    studentLoginIdentity = null;
                    tabSwitchCount = 0;
                    lastUrl = null;
                    isCurrentlyOnWrongSite = false;
                    mouseInactivityAlertSent = false;
                    stopMonitoring();
                    stopLearnAnalysis();
                    stopMouseInactivityTracking();
                    stopSessionValidationCheck();
                    clearTimeout(quizSwitchTimeout);
                    quizSwitchTimeout = null;
                    logoutLearnPlatform();
                }
            }
        } catch (e) {}
    }, 5000);
}

function stopSessionValidationCheck() {
    if (sessionValidationInterval) {
        clearInterval(sessionValidationInterval);
        sessionValidationInterval = null;
    }
}

async function switchToQuiz() {
    quizSwitchTimeout = null;
    chrome.tabs.create({ url: 'https://quiz.decli.tech/participant-login' });
}

async function logoutLearnPlatform() {
    const tabs = await chrome.tabs.query({ url: 'https://learn.decli.tech/*' });
    for (const tab of tabs) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: () => {
                ['firstName', 'lastName', 'username', 'role', 'token', 'accessToken'].forEach(
                    k => localStorage.removeItem(k)
                );
                window.location.replace('/login');
            }
        }).catch(() => {});
    }
}

function startMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);
    monitoringInterval = setInterval(checkActiveTab, CHECK_INTERVAL);
    startLearnAnalysis();
}

function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

async function checkActiveTab() {
    if (!activeSessionCode) return;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) return;
        const currentUrl = tab.url;
        const tabTitle = tab.title || '';
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            const urlIsAllowed = isUrlAllowed(currentUrl);
            if (!urlIsAllowed && !isCurrentlyOnWrongSite) {
                isCurrentlyOnWrongSite = true;
                await sendTabSwitchAlert(currentUrl, tabTitle);
            } else if (urlIsAllowed && isCurrentlyOnWrongSite) {
                isCurrentlyOnWrongSite = false;
                tabSwitchCount = 0;
                await sendAlertResolved(currentUrl);
            }
        }
    } catch (error) {}
}

function isUrlAllowed(url) {
    return ALLOWED_SITES.some(site => url.startsWith(site));
}

async function sendTabSwitchAlert(currentUrl, tabTitle) {
    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN) return;
    lastAlertTime = now;
    tabSwitchCount++;
    const alertType = tabSwitchCount >= 5 ? "MULTIPLE_SWITCHES" : "TAB_SWITCH";
    const severity = tabSwitchCount >= 5 ? "HIGH" : tabSwitchCount >= 3 ? "MEDIUM" : "LOW";
    let siteName = tabTitle || currentUrl;
    try {
        const hostname = new URL(currentUrl).hostname.replace(/^www\./, '');
        siteName = hostname;
    } catch (_) {}
    const alert = {
        participantId: activeParticipantId,
        sessionId: activeSessionCode,
        studentLoginIdentity: studentLoginIdentity,
        alertType,
        severity,
        message: `Student navigated to: ${siteName}`,
        timestamp: new Date().toISOString(),
        metadata: { switchCount: tabSwitchCount, currentUrl, tabTitle, siteName, allowedSites: ALLOWED_SITES }
    };
    try {
        await fetch(CONFIG.ALERT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alert)
        });
    } catch (error) {}
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
        metadata: { currentUrl, allowedSites: ALLOWED_SITES, resolved: true }
    };
    try {
        await fetch(CONFIG.ALERT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alert)
        });
    } catch (error) {}
}

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
    if (!activeSessionCode || mouseInactivityAlertSent) return;
    if (Date.now() - lastMouseMoveTime >= MOUSE_INACTIVITY_THRESHOLD) {
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
        message: `Enfant bloqué - Aucun mouvement de souris détecté pendant 30 secondes`,
        timestamp: new Date().toISOString(),
        metadata: {
            inactivityDurationMs: Date.now() - lastMouseMoveTime,
            lastMouseMoveTime: new Date(lastMouseMoveTime).toISOString()
        }
    };
    try {
        await fetch(CONFIG.ALERT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alert)
        });
    } catch (error) {}
}

const LEARN_ANALYSIS_INTERVAL = 30000;

function startLearnAnalysis() {
    if (learnAnalysisInterval) clearInterval(learnAnalysisInterval);
    setTimeout(() => analyzeLearnDom(), 3000);
    learnAnalysisInterval = setInterval(() => analyzeLearnDom(), LEARN_ANALYSIS_INTERVAL);
}

function stopLearnAnalysis() {
    if (learnAnalysisInterval) {
        clearInterval(learnAnalysisInterval);
        learnAnalysisInterval = null;
    }
}

async function analyzeLearnDom() {
    if (!activeSessionCode) return;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.startsWith('https://learn.decli.tech/')) return;
        let domData = null;
        try {
            const res = await chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_LEARN_DOM' });
            if (res?.success) domData = res.data;
        } catch (_) {
            try {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const titleEl = document.querySelector('h1, h2, .page-title, [class*="title"]');
                        const pageTitle = titleEl?.innerText?.trim()?.slice(0, 100) || document.title?.split('|')[0]?.trim() || '';
                        const exerciseEl = document.querySelector('[class*="exercise"], [class*="lesson"], [class*="activity"], [class*="module"], [class*="project"]');
                        const exerciseName = exerciseEl?.innerText?.trim()?.slice(0, 100) || pageTitle;
                        const progressBar = document.querySelector('[role="progressbar"]');
                        const progressText = progressBar?.getAttribute('aria-valuenow') || progressBar?.innerText?.trim() || document.querySelector('[class*="progress"]')?.innerText?.trim() || null;
                        const codeEl = document.querySelector('.ace_content, .CodeMirror-code, [class*="editor"] code, textarea[class*="code"]');
                        const studentCode = codeEl?.innerText?.trim()?.slice(0, 500) || null;
                        const completed = !!(document.querySelector('[class*="success"], [class*="complete"], [class*="congrats"], [class*="bravo"]') || /félicitations|bravo|completed|terminé/i.test(document.body.innerText || ''));
                        return { path: location.pathname, pageTitle, exerciseName, progress: progressText, studentCode, completed, url: location.href, timestamp: new Date().toISOString() };
                    }
                });
                if (result?.result) domData = result.result;
            } catch (_) {}
        }
        let screenshotBase64 = null;
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 70 });
            screenshotBase64 = dataUrl.split(',')[1] || null;
        } catch (_) {}
        const mergedDomData = lastAiModuleData
            ? { ...(domData || {}), categories: lastAiModuleData.categories, trainingState: lastAiModuleData.trainingState, predictions: lastAiModuleData.predictions, exerciseInfo: lastAiModuleData.exerciseInfo }
            : domData;

        await fetch(`${CONFIG.AGENT_URL}/analyze-screen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: activeSessionCode,
                participant_id: activeParticipantId,
                student_login_identity: studentLoginIdentity,
                timestamp: new Date().toISOString(),
                screenshot_base64: screenshotBase64,
                page_url: tab.url,
                dom_data: mergedDomData
            })
        }).catch(() => {});
    } catch (_) {}
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url?.startsWith('https://learn.decli.tech/')) return;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || activeTab.id !== tabId) return;
    setTimeout(() => analyzeLearnDom(), 1500);
});
