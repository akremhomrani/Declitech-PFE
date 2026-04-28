const AGENT_BASE = "http://127.0.0.1:8765";
const STATUS_POLL_MS = 5000;
const VALIDATION_POLL_MS = 5000;

const dom = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  codeRow: document.getElementById("codeRow"),
  boxes: Array.from(document.querySelectorAll(".code-box")),
  btnJoin: document.getElementById("btnJoin"),
  sessionActive: document.getElementById("sessionActive"),
  message: document.getElementById("message"),
  agentStatus: document.getElementById("agentStatus"),
  liveDot: document.getElementById("liveDot"),
  liveText: document.getElementById("liveText"),
  detIdentity: document.getElementById("detIdentity"),
  detHint: document.getElementById("detHint"),
  btnClear: document.getElementById("btnClear"),
  drawer: document.getElementById("drawer"),
  backdrop: document.getElementById("backdrop"),
  btnSettings: document.getElementById("btnSettings"),
  btnCloseDrawer: document.getElementById("btnCloseDrawer"),
  btnSaveSettings: document.getElementById("btnSaveSettings"),
  studentId: document.getElementById("studentId"),
  deviceId: document.getElementById("deviceId"),
  durationMin: document.getElementById("durationMin"),
  intervalMin: document.getElementById("intervalMin"),
};

let validationInterval = null;
let currentSessionCode = null;

function setMsg(text, isError = false) {
  dom.message.style.color = isError ? "#b42318" : "#344054";
  dom.message.textContent = text || "";
}

function setLive(ok) {
  if (ok) {
    dom.liveDot.style.background = "#12b76a";
    dom.liveDot.style.boxShadow = "0 0 0 4px rgba(18,183,106,0.15)";
    dom.liveText.style.color = "#12b76a";
    dom.liveText.textContent = "LIVE";
  } else {
    dom.liveDot.style.background = "#f04438";
    dom.liveDot.style.boxShadow = "0 0 0 4px rgba(240,68,56,0.15)";
    dom.liveText.style.color = "#f04438";
    dom.liveText.textContent = "OFF";
  }
}

function applyActiveUI(active) {
  if (active) {
    dom.codeRow.style.display = "none";
    dom.btnJoin.style.display = "none";
    dom.title.style.display = "none";
    dom.subtitle.style.display = "none";
    dom.sessionActive.style.display = "flex";
  } else {
    dom.codeRow.style.display = "flex";
    dom.btnJoin.style.display = "flex";
    dom.title.style.display = "block";
    dom.subtitle.style.display = "block";
    dom.sessionActive.style.display = "none";
  }
}

function codeValue() {
  return dom.boxes.map(b => (b.value || "").trim()).join("").toUpperCase();
}

function normalizeChar(ch) {
  const c = (ch || "").toUpperCase();
  return /[A-Z0-9]/.test(c) ? c : "";
}

function clearCodeInputs() {
  dom.boxes.forEach(b => (b.value = ""));
}

function bindCodeInputs() {
  dom.boxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = normalizeChar(box.value);
      if (box.value && i < dom.boxes.length - 1) dom.boxes[i + 1].focus();
      setMsg("");
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && i > 0) dom.boxes[i - 1].focus();
    });
    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      const clean = (text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      dom.boxes.forEach((b, k) => (b.value = clean[k] || ""));
    });
  });
}

function openDrawer() {
  dom.drawer.classList.add("open");
  dom.backdrop.classList.add("show");
}

function closeDrawer() {
  dom.drawer.classList.remove("open");
  dom.backdrop.classList.remove("show");
}

function loadSettings() {
  const s = JSON.parse(localStorage.getItem("decli_settings") || "{}");
  dom.studentId.value = s.studentId || "E12";
  dom.deviceId.value = s.deviceId || "PC-001";
  dom.durationMin.value = Number.isFinite(s.durationMin) ? s.durationMin : 30;
  dom.intervalMin.value = Number.isFinite(s.intervalMin) ? s.intervalMin : 15;
}

function saveSettings() {
  const s = {
    studentId: (dom.studentId.value || "").trim() || "E12",
    deviceId: (dom.deviceId.value || "").trim() || "PC-001",
    durationMin: parseInt(dom.durationMin.value, 10) || 30,
    intervalMin: parseInt(dom.intervalMin.value, 10) || 15,
  };
  localStorage.setItem("decli_settings", JSON.stringify(s));
  return s;
}

async function httpGet(path) {
  const res = await fetch(AGENT_BASE + path);
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error(data.detail || txt);
  return data;
}

async function httpPost(path, body) {
  const res = await fetch(AGENT_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error(data.detail || txt);
  return data;
}

function decodeSessionCode(rawId) {
  if (!rawId) return null;
  return rawId.replace("SESSION-", "").replace("LOCAL-", "");
}

async function refreshStatus() {
  try {
    const s = await httpGet("/status");
    setLive(true);
    dom.agentStatus.textContent = s.running ? "Running" : "Ready";

    if (s.running) {
      currentSessionCode = decodeSessionCode(s.session_id);
      applyActiveUI(true);
      ensureValidationCheck();
    } else {
      currentSessionCode = null;
      stopValidationCheck();
      applyActiveUI(false);
    }
  } catch {
    dom.agentStatus.textContent = "Offline";
    setLive(false);
    applyActiveUI(false);
    setMsg("Agent unreachable. Make sure the service is running.", true);
  }
}

function ensureValidationCheck() {
  if (validationInterval) return;
  validationInterval = setInterval(async () => {
    if (!currentSessionCode) return;
    try {
      const validation = await httpGet(`/validate/${currentSessionCode}`);
      if (!validation.valid) {
        const reason = validation.reason || "";
        if (reason === "inactive" || reason === "expired") {
          setMsg(`Session ended by instructor.`);
          await autoDisconnect();
        }
      }
    } catch {}
  }, VALIDATION_POLL_MS);
}

function stopValidationCheck() {
  if (validationInterval) {
    clearInterval(validationInterval);
    validationInterval = null;
  }
}

async function autoDisconnect() {
  try {
    await httpPost("/stop", {});
    chrome.runtime.sendMessage({ type: "SESSION_STOPPED" });
  } catch {}
  currentSessionCode = null;
  stopValidationCheck();
  clearCodeInputs();
  applyActiveUI(false);
  dom.agentStatus.textContent = "Ready";
  dom.boxes[0]?.focus();
}

async function detectIdentityFromActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) return resolve("");
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeIdentity,
      }, (results) => resolve(results?.[0]?.result || ""));
    });
  });
}

function scrapeIdentity() {
  const norm = (s) => (s || "").toLowerCase().trim();
  const inputs = Array.from(document.querySelectorAll("input")).filter((i) => {
    const t = norm(i.type);
    if (t === "password" || t === "hidden") return false;
    const r = i.getBoundingClientRect();
    return r.width > 50 && r.height > 20 && !i.disabled && !i.readOnly;
  });

  const score = (i) => {
    const attrs = norm([i.name, i.id, i.placeholder, i.getAttribute("aria-label"), i.getAttribute("autocomplete")].filter(Boolean).join(" "));
    let s = 0;
    if (attrs.includes("pseud")) s += 30;
    if (attrs.includes("username") || attrs.includes("user") || attrs.includes("utilisateur")) s += 25;
    if (attrs.includes("email") || attrs.includes("mail")) s += 20;
    let lbl = "";
    if (i.id) {
      const l = document.querySelector(`label[for="${CSS.escape(i.id)}"]`);
      if (l) lbl += " " + norm(l.innerText);
    }
    const parent = i.closest("div, form, section") || i.parentElement;
    if (parent) {
      parent.querySelectorAll("label, span, div, p").forEach((t) => {
        const tt = norm(t.innerText || t.textContent);
        if (tt.includes("pseudonyme") || tt.includes("pseudo")) lbl += " " + tt;
        if (tt.includes("nom d'utilisateur") || tt.includes("utilisateur")) lbl += " " + tt;
        if (tt.includes("email") || tt.includes("mail")) lbl += " " + tt;
      });
    }
    if (lbl.includes("pseudonyme") || lbl.includes("pseudo")) s += 40;
    if (lbl.includes("nom d'utilisateur") || lbl.includes("utilisateur")) s += 30;
    if (lbl.includes("email") || lbl.includes("mail")) s += 25;
    return s;
  };

  let best = null;
  let bestScore = -999;
  for (const i of inputs) {
    const sc = score(i);
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  return best && best.value ? best.value.trim() : "";
}

async function loadDetectedIdentity() {
  const v = (await detectIdentityFromActiveTab()) || "";
  if (v) {
    chrome.storage.local.set({ decli_identity: v });
    dom.detIdentity.textContent = v;
    dom.detHint.textContent = "Captured from current page.";
    return;
  }
  chrome.storage.local.get(["decli_identity"], (res) => {
    const saved = (res.decli_identity || "").trim();
    dom.detIdentity.textContent = saved || "—";
    dom.detHint.textContent = saved
      ? "Loaded from extension storage."
      : "Type your pseudonyme/email in the login field, then reopen the popup.";
  });
}

async function handleJoin() {
  const code = codeValue();
  if (code.length !== 6) {
    setMsg("Please enter the 6-character code.", true);
    return;
  }
  const settings = saveSettings();
  const identity = (await detectIdentityFromActiveTab()) || dom.detIdentity.textContent || "";
  const loginIdentity = identity === "—" ? "" : identity;

  try {
    setMsg("Connecting to agent...");
    await httpPost("/start", {
      code,
      student_id: settings.studentId,
      device_id: settings.deviceId,
      duration_min: settings.durationMin,
      interval_min: settings.intervalMin,
      interval_sec: 10,
      login_identity: loginIdentity,
    });
    currentSessionCode = code;
    chrome.runtime.sendMessage({
      type: "SESSION_STARTED",
      sessionCode: code,
      participantId: `PARTICIPANT-${settings.studentId}`,
      studentLoginIdentity: loginIdentity,
    });
    setMsg(`Joined. Session: ${code}`);
    await refreshStatus();
  } catch (err) {
    setMsg(err.message || "Failed to join.", true);
    setLive(false);
  }
}

function bindEvents() {
  bindCodeInputs();
  dom.btnSettings.addEventListener("click", openDrawer);
  dom.btnCloseDrawer.addEventListener("click", closeDrawer);
  dom.backdrop.addEventListener("click", closeDrawer);
  dom.btnSaveSettings.addEventListener("click", () => {
    saveSettings();
    setMsg("Settings saved.");
    closeDrawer();
  });
  dom.btnClear.addEventListener("click", () => {
    chrome.storage.local.set({ decli_identity: "" }, () => {
      dom.detIdentity.textContent = "—";
      dom.detHint.textContent = "Cleared.";
    });
  });
  dom.btnJoin.addEventListener("click", handleJoin);
}

function init() {
  bindEvents();
  loadSettings();
  dom.boxes[0]?.focus();
  refreshStatus();
  loadDetectedIdentity();
  setInterval(refreshStatus, STATUS_POLL_MS);
}

init();
