const BASE = "http://127.0.0.1:8765";
const SESSION_CHECK_INTERVAL = 5000; // Check session validity every 5 seconds

const boxes = Array.from(document.querySelectorAll(".code-box"));
const btnJoin = document.getElementById("btnJoin");
const sessionActive = document.getElementById("sessionActive");
const message = document.getElementById("message");

const agentStatus = document.getElementById("agentStatus");
const liveDot = document.getElementById("liveDot");
const liveText = document.getElementById("liveText");

let sessionCheckInterval = null;
let currentSessionCode = null;

const detIdentity = document.getElementById("detIdentity");
const detHint = document.getElementById("detHint");
const btnClear = document.getElementById("btnClear");

const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("backdrop");
const btnSettings = document.getElementById("btnSettings");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const studentIdEl = document.getElementById("studentId");
const deviceIdEl = document.getElementById("deviceId");
const durationMinEl = document.getElementById("durationMin");
const intervalMinEl = document.getElementById("intervalMin");

function setMsg(text, isError = false) {
  message.style.color = isError ? "#b42318" : "#344054";
  message.textContent = text || "";
}

function setLive(ok) {
  if (ok) {
    liveDot.style.background = "#12b76a";
    liveDot.style.boxShadow = "0 0 0 4px rgba(18,183,106,0.15)";
    liveText.style.color = "#12b76a";
    liveText.textContent = "LIVE";
  } else {
    liveDot.style.background = "#f04438";
    liveDot.style.boxShadow = "0 0 0 4px rgba(240,68,56,0.15)";
    liveText.style.color = "#f04438";
    liveText.textContent = "OFF";
  }
}

function codeValue() {
  return boxes.map(b => (b.value || "").trim()).join("").toUpperCase();
}

function normalizeChar(ch) {
  if (!ch) return "";
  const c = ch.toUpperCase();
  return /[A-Z0-9]/.test(c) ? c : "";
}

boxes.forEach((box, i) => {
  box.addEventListener("input", () => {
    box.value = normalizeChar(box.value);
    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    setMsg("");
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !box.value && i > 0) boxes[i - 1].focus();
  });
  box.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const clean = (text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    for (let k = 0; k < boxes.length; k++) boxes[k].value = clean[k] ? clean[k] : "";
  });
});

function openDrawer() {
  drawer.classList.add("open");
  backdrop.classList.add("show");
}
function closeDrawer() {
  drawer.classList.remove("open");
  backdrop.classList.remove("show");
}
btnSettings.addEventListener("click", openDrawer);
btnCloseDrawer.addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);

function loadSettings() {
  const s = JSON.parse(localStorage.getItem("decli_settings") || "{}");
  studentIdEl.value = s.studentId || "E12";
  deviceIdEl.value = s.deviceId || "PC-001";
  durationMinEl.value = Number.isFinite(s.durationMin) ? s.durationMin : 30;
  intervalMinEl.value = Number.isFinite(s.intervalMin) ? s.intervalMin : 15;
}
function saveSettings() {
  const s = {
    studentId: (studentIdEl.value || "").trim() || "E12",
    deviceId: (deviceIdEl.value || "").trim() || "PC-001",
    durationMin: parseInt(durationMinEl.value, 10) || 30,
    intervalMin: parseInt(intervalMinEl.value, 10) || 15
  };
  localStorage.setItem("decli_settings", JSON.stringify(s));
  return s;
}
btnSaveSettings.addEventListener("click", () => {
  saveSettings();
  setMsg("✅ Settings saved.");
  closeDrawer();
});

async function httpGet(path) {
  const res = await fetch(BASE + path);
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error(data.detail || txt);
  return data;
}

async function httpPost(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error(data.detail || txt);
  return data;
}

async function refreshStatus() {
  try {
    const s = await httpGet("/status");
    const isRunning = s.running;
    agentStatus.textContent = isRunning ? "Running" : "Ready";
    setLive(true);

    // Update UI based on running state
    if (isRunning) {
      btnJoin.style.display = "none";
      sessionActive.style.display = "flex";
      currentSessionCode = s.session_id ? s.session_id.replace("SESSION-", "") : null;

      // Start session validity check if not already running
      if (!sessionCheckInterval) {
        startSessionValidityCheck();
      }
    } else {
      btnJoin.style.display = "block";
      sessionActive.style.display = "none";
      stopSessionValidityCheck();
    }
  } catch (e) {
    agentStatus.textContent = "Offline";
    setLive(false);
    btnJoin.style.display = "block";
    sessionActive.style.display = "none";
    setMsg("❌ Agent not reachable. Check: http://127.0.0.1:8765/status", true);
  }
}

function startSessionValidityCheck() {
  if (sessionCheckInterval) return;

  sessionCheckInterval = setInterval(async () => {
    if (!currentSessionCode) return;

    try {
      const validation = await httpGet(`/validate/${currentSessionCode}`);

      if (!validation.valid) {
        console.log("⏰ Session ended by instructor:", validation.reason);
        setMsg(`⏰ Session ended: ${validation.reason}`, false);
        await autoDisconnect();
      }
    } catch (e) {
      console.error("Session validation error:", e);
    }
  }, SESSION_CHECK_INTERVAL);
}

function stopSessionValidityCheck() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

async function autoDisconnect() {
  try {
    await httpPost("/stop", {});

    // Notify background script to stop monitoring
    chrome.runtime.sendMessage({ type: "SESSION_STOPPED" });

    setMsg("✅ Session ended. Camera stopped.");
    currentSessionCode = null;
    stopSessionValidityCheck();
    btnJoin.style.display = "block";
    sessionActive.style.display = "none";
    agentStatus.textContent = "Ready";
  } catch (e) {
    console.error("Auto-disconnect error:", e);
  }
}

/**
 * ✅ Lecture fiable du champ pseudonyme/email depuis l'onglet actif
 */
async function detectIdentityFromActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) return resolve("");

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const norm = (s) => (s || "").toLowerCase().trim();

          // on cherche input visible (pas password)
          const inputs = Array.from(document.querySelectorAll("input"))
            .filter(i => {
              const t = norm(i.type);
              if (t === "password" || t === "hidden") return false;
              const r = i.getBoundingClientRect();
              return r.width > 50 && r.height > 20 && !i.disabled && !i.readOnly;
            });

          function score(i) {
            const attrs = norm([i.name, i.id, i.placeholder, i.getAttribute("aria-label"), i.getAttribute("autocomplete")].filter(Boolean).join(" "));
            let s = 0;
            if (attrs.includes("pseud")) s += 30;
            if (attrs.includes("username") || attrs.includes("user") || attrs.includes("utilisateur")) s += 25;
            if (attrs.includes("email") || attrs.includes("mail")) s += 20;

            // label proche
            let lbl = "";
            if (i.id) {
              const l = document.querySelector(`label[for="${CSS.escape(i.id)}"]`);
              if (l) lbl += " " + norm(l.innerText);
            }
            const parent = i.closest("div, form, section") || i.parentElement;
            if (parent) {
              const texts = parent.querySelectorAll("label, span, div, p");
              for (const t of texts) {
                const tt = norm(t.innerText || t.textContent);
                if (tt.includes("pseudonyme") || tt.includes("pseudo")) lbl += " " + tt;
                if (tt.includes("nom d'utilisateur") || tt.includes("utilisateur")) lbl += " " + tt;
                if (tt.includes("email") || tt.includes("mail")) lbl += " " + tt;
              }
            }
            if (lbl.includes("pseudonyme") || lbl.includes("pseudo")) s += 40;
            if (lbl.includes("nom d'utilisateur") || lbl.includes("utilisateur")) s += 30;
            if (lbl.includes("email") || lbl.includes("mail")) s += 25;

            return s;
          }

          let best = null, bestScore = -999;
          for (const i of inputs) {
            const sc = score(i);
            if (sc > bestScore) {
              bestScore = sc;
              best = i;
            }
          }

          return best && best.value ? best.value.trim() : "";
        }
      }, (results) => {
        const val = results?.[0]?.result || "";
        resolve(val);
      });
    });
  });
}

async function loadDetectedIdentity() {
  // essaie de lire depuis l'onglet actif
  const v = (await detectIdentityFromActiveTab()) || "";
  if (v) {
    chrome.storage.local.set({ decli_identity: v }, () => { });
    detIdentity.textContent = v;
    detHint.textContent = "Captured from current page.";
  } else {
    chrome.storage.local.get(["decli_identity"], (res) => {
      const saved = (res.decli_identity || "").trim();
      detIdentity.textContent = saved || "—";
      detHint.textContent = saved ? "Loaded from extension storage." : "Type your pseudonyme/email in the login field, then reopen the popup.";
    });
  }
}

btnClear.addEventListener("click", () => {
  chrome.storage.local.set({ decli_identity: "" }, () => {
    detIdentity.textContent = "—";
    detHint.textContent = "Cleared.";
  });
});

btnJoin.addEventListener("click", async () => {
  const code = codeValue();
  if (code.length !== 6) {
    setMsg("❌ Please enter the 6-character code.", true);
    return;
  }

  const s = saveSettings();

  // prend le pseudo depuis l’onglet actif au moment du Join
  const identity = (await detectIdentityFromActiveTab()) || detIdentity.textContent || "";
  const login_identity = identity === "—" ? "" : identity;

  try {
    setMsg("Connecting to agent...");
    const payload = {
      code,
      student_id: s.studentId,
      device_id: s.deviceId,
      duration_min: s.durationMin,
      interval_min: s.intervalMin,
      login_identity: login_identity
    };
    const r = await httpPost("/start", payload);
    currentSessionCode = code; // Store the session code

    // Notify background script to start monitoring
    chrome.runtime.sendMessage({
      type: "SESSION_STARTED",
      sessionCode: code,
      participantId: `PARTICIPANT-${s.studentId}`,
      studentLoginIdentity: login_identity
    });

    setMsg(`✅ Joined. Session: ${code}`);
    await refreshStatus();
  } catch (err) {
    setMsg("❌ " + err.message, true);
    setLive(false);
  }
});

// init
loadSettings();
boxes[0].focus();
refreshStatus();
loadDetectedIdentity();

// Refresh status periodically to catch external changes
setInterval(refreshStatus, 5000);
