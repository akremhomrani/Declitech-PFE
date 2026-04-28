import { AGENT_STOP_URL, TIMING } from "./config.js";
import { state, startSession, clearSession } from "./state.js";
import { startMonitoring, stopMonitoring } from "./monitoring.js";
import { startScreenCapture, stopScreenCapture, sendPythonExecutionEvent } from "./screen-capture.js";
import { initPedagogy } from "./pedagogy.js";
import { startSessionValidation, stopSessionValidation, logoutLearnPlatform } from "./session-validation.js";
import { applyToolbarBadge, restoreToolbarBadgeFromStorage } from "./toolbar-badge.js";

let quizSwitchTimeout = null;

function switchToQuiz() {
  quizSwitchTimeout = null;
  chrome.tabs.create({ url: "https://quiz.decli.tech/participant-login" });
}

function publishBadgeState(active, identity = "") {
  chrome.storage.local.set({
    decli_session_active: !!active,
    decli_session_identity: active ? (identity || "") : "",
  });
  applyToolbarBadge(active, identity);
}

function teardown() {
  clearSession();
  stopMonitoring();
  stopScreenCapture();
  stopSessionValidation();
  if (quizSwitchTimeout) {
    clearTimeout(quizSwitchTimeout);
    quizSwitchTimeout = null;
  }
  publishBadgeState(false);
  logoutLearnPlatform();
}

function handleSessionStarted(message) {
  startSession({
    sessionCode: message.sessionCode,
    participantId: message.participantId,
    studentLoginIdentity: message.studentLoginIdentity,
  });
  publishBadgeState(true, message.studentLoginIdentity);
  startMonitoring();
  startScreenCapture();
  startSessionValidation(teardown);
  quizSwitchTimeout = setTimeout(switchToQuiz, TIMING.LEARN_DURATION_MS);
}

function handleSessionStopped() {
  fetch(AGENT_STOP_URL, { method: "POST" }).catch(() => {});
  teardown();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "SESSION_STARTED":
      handleSessionStarted(message);
      sendResponse({ success: true });
      break;
    case "SESSION_STOPPED":
      handleSessionStopped();
      sendResponse({ success: true });
      break;
    case "MOUSE_MOVED":
      state.lastMouseMoveTime = Date.now();
      state.mouseAlertSent = false;
      sendResponse({ success: true });
      break;
    case "VITTASCIENCE_DATA":
      state.lastVittaData = message.data;
      sendResponse({ success: true });
      break;
    case "PYTHON_MODULE_DATA":
      state.lastPythonData = message.data;
      sendResponse({ success: true });
      break;
    case "PYTHON_EXECUTION":
      sendPythonExecutionEvent(message.data);
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ success: false });
  }
  return true;
});

initPedagogy();
restoreToolbarBadgeFromStorage();
