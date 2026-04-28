import { ALLOWED_SITES, TIMING } from "./config.js";
import { state, isActive } from "./state.js";
import { sendTabSwitchAlert, sendAlertResolved, sendMouseInactivityAlert } from "./alerts.js";

let tabInterval = null;
let mouseInterval = null;

function isUrlAllowed(url) {
  return ALLOWED_SITES.some((site) => url.startsWith(site));
}

async function checkActiveTab() {
  if (!isActive()) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const url = tab.url;
    if (url === state.lastUrl) return;
    state.lastUrl = url;

    const allowed = isUrlAllowed(url);
    if (!allowed && !state.isOnWrongSite) {
      state.isOnWrongSite = true;
      await sendTabSwitchAlert(url, tab.title || "");
    } else if (allowed && state.isOnWrongSite) {
      state.isOnWrongSite = false;
      state.tabSwitchCount = 0;
      await sendAlertResolved(url);
    }
  } catch {}
}

async function checkMouseInactivity() {
  if (!isActive() || state.mouseAlertSent) return;
  if (Date.now() - state.lastMouseMoveTime >= TIMING.MOUSE_INACTIVITY_MS) {
    await sendMouseInactivityAlert();
  }
}

export function startMonitoring() {
  stopMonitoring();
  tabInterval = setInterval(checkActiveTab, TIMING.TAB_CHECK_MS);
  mouseInterval = setInterval(checkMouseInactivity, TIMING.MOUSE_CHECK_MS);
}

export function stopMonitoring() {
  if (tabInterval) { clearInterval(tabInterval); tabInterval = null; }
  if (mouseInterval) { clearInterval(mouseInterval); mouseInterval = null; }
}
