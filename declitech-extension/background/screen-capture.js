import { AGENT_SCREEN_URL, AGENT_PYTHON_URL, TIMING, SCREEN_CAPTURE_DOMAIN } from "./config.js";
import { state, isActive } from "./state.js";

let captureInterval = null;

async function captureAndAnalyze() {
  if (!isActive()) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.startsWith(SCREEN_CAPTURE_DOMAIN)) return;

    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 70 });
    } catch { return; }
    if (!dataUrl) return;

    let domData = state.lastVittaData;
    let pythonData = state.lastPythonData;

    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: "REQUEST_VITTASCIENCE_DATA" });
      if (r?.success) domData = r.data;
    } catch {}

    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: "REQUEST_PYTHON_DATA" });
      if (r?.success) pythonData = r.data;
    } catch {}

    await fetch(AGENT_SCREEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.sessionCode,
        participant_id: state.participantId,
        student_login_identity: state.studentLoginIdentity,
        timestamp: new Date().toISOString(),
        screenshot_base64: dataUrl.split(",")[1],
        page_url: tab.url,
        dom_data: domData,
        python_module_data: pythonData,
      }),
    });
  } catch {}
}

export function startScreenCapture() {
  stopScreenCapture();
  setTimeout(captureAndAnalyze, TIMING.SCREEN_CAPTURE_DELAY_MS);
  captureInterval = setInterval(captureAndAnalyze, TIMING.SCREEN_CAPTURE_MS);
}

export function stopScreenCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  state.lastVittaData = null;
}

export async function sendPythonExecutionEvent(executionData) {
  if (!isActive()) return;
  try {
    await fetch(AGENT_PYTHON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionCode: state.sessionCode,
        participantId: state.participantId,
        studentLoginIdentity: state.studentLoginIdentity,
        timestamp: executionData.timestamp || new Date().toISOString(),
        moduleType: "Python",
        code: executionData.code || "",
        output: executionData.output || "",
        executionStatus: executionData.output ? "SUCCESS" : "NO_OUTPUT",
      }),
    });
  } catch {}
}
