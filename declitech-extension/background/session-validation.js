import { AGENT_VALIDATE_URL, AGENT_STOP_URL, TIMING } from "./config.js";
import { state } from "./state.js";

let validationInterval = null;

export function startSessionValidation(onSessionEnded) {
  if (validationInterval) return;
  validationInterval = setInterval(async () => {
    if (!state.sessionCode) return;
    try {
      const res = await fetch(AGENT_VALIDATE_URL(state.sessionCode));
      if (!res.ok) return;
      const validation = await res.json().catch(() => null);
      if (!validation || validation.valid) return;
      const reason = validation.reason || "";
      if (reason === "inactive" || reason === "expired") {
        await fetch(AGENT_STOP_URL, { method: "POST" }).catch(() => {});
        onSessionEnded?.();
      }
    } catch {}
  }, TIMING.SESSION_VALIDATION_MS);
}

export function stopSessionValidation() {
  if (validationInterval) {
    clearInterval(validationInterval);
    validationInterval = null;
  }
}

export async function logoutLearnPlatform() {
  const tabs = await chrome.tabs.query({ url: "https://learn.decli.tech/*" });
  for (const tab of tabs) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        ["firstName", "lastName", "username", "role", "token", "accessToken"].forEach((k) =>
          localStorage.removeItem(k)
        );
        window.location.replace("/login");
      },
    }).catch(() => {});
  }
}
