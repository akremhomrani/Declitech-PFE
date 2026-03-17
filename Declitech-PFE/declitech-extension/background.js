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


// =========================================================
//  Suivi Pédagogique — Injection active dans les onglets
//  Détection toutes les 30s + immédiat sur changement de niveau
// =========================================================

const PEDAGOGY_SCAN_INTERVAL = 30000; // 30 secondes
const PEDAGOGY_SITES = ['codecombat.com', 'code.org', 'studio.code.org'];

// Scan immédiat quand une page pédago finit de charger (nouveau niveau)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url || !PEDAGOGY_SITES.some(s => tab.url.includes(s))) return;
    setTimeout(() => scanSingleTab(tab, true), 1500);
});

// Scan périodique toutes les 30s
setInterval(scanPedagogyTabs, PEDAGOGY_SCAN_INTERVAL);

async function scanPedagogyTabs() {
    try {
        const allTabs = await chrome.tabs.query({});
        for (const tab of allTabs) {
            if (!tab.url) continue;
            if (!PEDAGOGY_SITES.some(s => tab.url.includes(s))) continue;
            await scanSingleTab(tab, false);
        }
    } catch (_) { }
}

// ─── Clé de stockage pour l'état précédent par tab ───────────────────────────
function prevStateKey(tabId) { return `pedago_prev_${tabId}`; }

// ─── Détecter la phase d'avancement ──────────────────────────────────────────
function detectPhase(current, prev) {
    if (!prev) return 'STARTED';
    if (current.levelSlug !== prev.levelSlug) return 'NEW_LEVEL';
    if (current.completed && !prev.completed) return 'LEVEL_COMPLETE';
    const blocksNow = current.blocksCount || 0;
    const blocksBefore = prev.blocksCount || 0;
    if (blocksNow > blocksBefore) return 'IN_PROGRESS';
    if (blocksNow === blocksBefore && blocksNow > 0) return 'STALLED';
    return 'IN_PROGRESS';
}

async function scanSingleTab(tab, immediate = false) {
    if (!activeSessionCode) return;
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPedagogyData
        });
        const data = results?.[0]?.result;
        if (!data) return;

        // Compter les blocs (proxy: longueur du code / 15 chars par commande)
        const blocksCount = data.studentWork
            ? Math.max(1, Math.round(data.studentWork.split('\n').filter(l => l.trim()).length))
            : 0;
        data.blocksCount = blocksCount;

        // Lire état précédent
        const prevKey = prevStateKey(tab.id);
        const stored = await chrome.storage.session.get([prevKey]);
        const prev = stored[prevKey] || null;

        // Déterminer la phase
        const phase = detectPhase(data, prev);

        // Éviter d'envoyer si rien n'a changé (phase STALLED + non-immédiat)
        if (phase === 'STALLED' && !immediate) {
            // On envoie quand même toutes les 60s pour garder la trace (2 cycles)
            const lastSent = prev?._lastSentAt || 0;
            if (Date.now() - lastSent < 58000) return;
        }

        // Sauvegarder l'état actuel
        data._lastSentAt = Date.now();
        await chrome.storage.session.set({ [prevKey]: { ...data, blocksCount } });

        // Envoyer au agent avec la phase
        await fetch("http://localhost:8765/pedagogy/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...data,
                blocksCount,
                phase,
                sessionId:            activeSessionCode,
                participantId:        activeParticipantId,
                studentLoginIdentity: studentLoginIdentity
            })
        }).catch(() => { });

    } catch (_) { }
}


// =========================================================
//  Fonction injectée dans la page pour extraire les données
//  (s'exécute dans le contexte de la page web)
// =========================================================
function extractPedagogyData() {
    try {
        const host = location.hostname;
        const path = location.pathname;

        // ---- CodeCombat ----
        if (host.includes('codecombat.com')) {
            // Cas 1 : à l'intérieur d'un niveau (/play/level/...)
            const levelMatch = path.match(/\/play\/level\/([^/?]+)/);
            if (levelMatch) {
                const slug = levelMatch[1];

                // Titre du niveau — ordre de priorité
                const titleSelectors = [
                    '.level-name',
                    '[data-i18n="play.level_title"]',
                    '.game-menu-title',
                    'h1.level-title',
                    '#level-name',
                    'h1'
                ];
                let levelName = '';
                for (const sel of titleSelectors) {
                    const el = document.querySelector(sel);
                    const txt = el?.innerText?.trim();
                    if (txt && txt.length > 1 && txt.length < 80) { levelName = txt; break; }
                }
                // Fallback : extraire depuis document.title  (ex: "Garde de l'Ombre | CodeCombat")
                if (!levelName && document.title) {
                    levelName = document.title.split('|')[0].split('-')[0].trim();
                }
                levelName = levelName || slug;

                // Complétion — sélecteurs larges + détection texte
                const victorySelectors = [
                    '.modal.victory', '#victory', '.level-complete',
                    '[data-i18n="victory.level_complete"]',
                    '.level-victory', '.victory-container', '.victory-modal'
                ];
                let victory = victorySelectors.some(s => !!document.querySelector(s));
                if (!victory) {
                    const pt = document.body.innerText || '';
                    victory = /LEVEL COMPLETE|JOLIS COUPS|Félicitations|Congratulations/i.test(pt);
                }

                // Code de l'élève
                const codeEl = document.querySelector('.ace_content, .CodeMirror-code, #code-area');
                let studentWork = codeEl?.innerText?.trim()?.slice(0, 500) || '';
                if (victory && !studentWork) studentWork = '[Niveau complété avec succès]';

                // Score
                let score = 20;
                if (victory) score = 100;
                else if (studentWork.length > 200) score = 70;
                else if (studentWork.length > 80) score = 50;
                else if (studentWork.length > 20) score = 35;

                return {
                    type: 'LEVEL_PROGRESS', site: 'codecombat.com',
                    levelSlug: slug, levelName,
                    completed: victory, score,
                    studentWork, url: location.href, timestamp: new Date().toISOString()
                };
            }

            // Cas 2 : page d'accueil "Mes Classes"
            const bodyText = document.body.innerText || '';
            const levelMatch2 = bodyText.match(/(?:Dernier Niveau|Last Level)[:\s]+([^\n]{3,60})/i);
            const lastLevel = levelMatch2 ? levelMatch2[1].trim() : '';

            // Progression (barre de progression verte)
            let maxProg = 0;
            document.querySelectorAll('[style*="width"]').forEach(el => {
                const w = parseFloat(el.style.width || '0');
                if (w > 0 && w <= 100) maxProg = Math.max(maxProg, w);
            });
            // Fallback : chercher "11.6%" dans le texte
            if (maxProg === 0) {
                const pctMatch = bodyText.match(/(\d{1,3}(?:\.\d)?)\s*%/);
                if (pctMatch) maxProg = parseFloat(pctMatch[1]);
            }

            if (maxProg === 0 && !lastLevel) return null;

            return {
                type: 'LEVEL_PROGRESS', site: 'codecombat.com',
                levelSlug: 'overview',
                levelName: lastLevel || `Progression: ${Math.round(maxProg)}%`,
                completed: maxProg >= 100, score: Math.round(maxProg),
                studentWork: `Progression: ${Math.round(maxProg)}%${lastLevel ? ' | ' + lastLevel : ''}`,
                url: location.href, timestamp: new Date().toISOString()
            };
        }

        // ---- Code.org ----
        if (host.includes('code.org')) {
            const lessonMatch = path.match(/\/s\/([^/]+)\/lessons\/(\d+)\/levels\/(\d+)/);
            if (!lessonMatch) return null;
            const titleEl = document.querySelector('h1, .instructions-title');
            const title = titleEl?.innerText?.trim() || `code.org niveau ${lessonMatch[3]}`;
            const done = !!document.querySelector('#finish-puzzle, .congrats-dialog');
            const stars = document.querySelectorAll('.fa-star.active, img[src*="star_full"]').length;
            const codeEl = document.querySelector('.ace_content, .CodeMirror-code');
            const work = codeEl?.innerText?.trim()?.slice(0, 400) || '';
            return {
                type: 'LEVEL_PROGRESS', site: 'code.org',
                courseName: lessonMatch[1], lessonNumber: +lessonMatch[2], levelNumber: +lessonMatch[3],
                levelName: title, activityTitle: title,
                completed: done, score: stars ? Math.round(stars / 3 * 100) : (done ? 100 : 30),
                stars, studentWork: work,
                url: location.href, timestamp: new Date().toISOString()
            };
        }
        return null;
    } catch (e) { return null; }
}
