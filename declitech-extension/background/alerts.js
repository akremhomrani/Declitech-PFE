import { ALERT_URL, ALLOWED_SITES, TIMING } from "./config.js";
import { state } from "./state.js";

async function postAlert(alert) {
  try {
    await fetch(ALERT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    });
  } catch {}
}

function buildAlert(alertType, severity, message, metadata = {}) {
  return {
    participantId: state.participantId,
    sessionId: state.sessionCode,
    studentLoginIdentity: state.studentLoginIdentity,
    alertType,
    severity,
    message,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

export async function sendTabSwitchAlert(currentUrl, tabTitle) {
  const now = Date.now();
  if (now - state.lastAlertTime < TIMING.ALERT_COOLDOWN_MS) return;
  state.lastAlertTime = now;
  state.tabSwitchCount++;

  const alertType = state.tabSwitchCount >= 5 ? "MULTIPLE_SWITCHES" : "TAB_SWITCH";
  const severity = state.tabSwitchCount >= 5 ? "HIGH" : state.tabSwitchCount >= 3 ? "MEDIUM" : "LOW";

  let siteName = tabTitle || currentUrl;
  try {
    siteName = new URL(currentUrl).hostname.replace(/^www\./, "");
  } catch {}

  await postAlert(buildAlert(alertType, severity, `Student navigated to: ${siteName}`, {
    switchCount: state.tabSwitchCount,
    currentUrl,
    tabTitle,
    siteName,
    allowedSites: ALLOWED_SITES,
  }));
}

export async function sendAlertResolved(currentUrl) {
  await postAlert(buildAlert("ALERT_RESOLVED", "LOW", `Student returned to allowed site: ${currentUrl}`, {
    currentUrl,
    allowedSites: ALLOWED_SITES,
    resolved: true,
  }));
}

export async function sendMouseInactivityAlert() {
  state.mouseAlertSent = true;
  await postAlert(buildAlert(
    "MOUSE_INACTIVITY",
    "MEDIUM",
    "Enfant bloqué - Aucun mouvement de souris détecté pendant 30 secondes",
    {
      inactivityDurationMs: Date.now() - state.lastMouseMoveTime,
      lastMouseMoveTime: new Date(state.lastMouseMoveTime).toISOString(),
    }
  ));
}
