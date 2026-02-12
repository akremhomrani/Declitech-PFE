function saveIdentity(value) {
  const identity = (value || "").trim();
  chrome.storage.local.set({
    decli_identity: identity,
    decli_identity_ts: new Date().toISOString(),
    decli_identity_url: location.href
  });
}

function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 30 && r.height > 18;
}

function textOf(el) {
  return (el?.innerText || el?.textContent || "").toLowerCase().trim();
}

function score(el) {
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (type === "password" || type === "hidden") return -999;
  if (el.disabled || el.readOnly) return -999;
  if (!visible(el)) return -50;

  const attrs = [
    el.name, el.id, el.placeholder,
    el.getAttribute("aria-label"),
    el.getAttribute("autocomplete")
  ].filter(Boolean).join(" ").toLowerCase();

  let s = 0;
  if (attrs.includes("pseud")) s += 20;
  if (attrs.includes("username") || attrs.includes("user") || attrs.includes("utilisateur")) s += 18;
  if (attrs.includes("email") || attrs.includes("mail")) s += 16;
  if (type === "email") s += 10;

  // Recherche label proche
  let labelText = "";
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) labelText += " " + textOf(lbl);
  }

  // Chercher texte “Pseudonyme” dans parents proches
  const parent = el.closest("div, form, section, article") || el.parentElement;
  if (parent) {
    const candidates = parent.querySelectorAll("label, span, div, p");
    for (const c of candidates) {
      const t = textOf(c);
      if (t.includes("pseudonyme") || t.includes("nom d'utilisateur") || t.includes("email")) {
        labelText += " " + t;
      }
    }
  }

  labelText = labelText.toLowerCase();
  if (labelText.includes("pseudonyme")) s += 25;
  if (labelText.includes("nom d'utilisateur") || labelText.includes("utilisateur")) s += 20;
  if (labelText.includes("email")) s += 15;

  return s;
}

let current = null;

function attach() {
  const inputs = Array.from(document.querySelectorAll("input"));
  let best = null;
  let bestScore = -999;

  for (const i of inputs) {
    const sc = score(i);
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  }

  if (!best || bestScore < 15) return;

  if (current === best) return;
  current = best;

  // Sauve si déjà rempli
  if (best.value && best.value.trim()) saveIdentity(best.value);

  best.addEventListener("input", () => saveIdentity(best.value));
  best.addEventListener("change", () => saveIdentity(best.value));

  // Debug (tu peux laisser)
  console.log("[DecliTechExt] Attached to identity input:", {
    score: bestScore,
    type: best.type,
    id: best.id,
    name: best.name,
    placeholder: best.placeholder
  });
}

// scan périodique + mutation observer
attach();
setInterval(attach, 500);

const obs = new MutationObserver(attach);
obs.observe(document.documentElement, { childList: true, subtree: true });

// ----------------------------
// Mouse movement tracking for inactivity detection
// ----------------------------
let lastMouseMoveNotification = 0;
const MOUSE_MOVE_THROTTLE = 5000; // Only notify every 5 seconds

document.addEventListener('mousemove', () => {
  const now = Date.now();
  if (now - lastMouseMoveNotification > MOUSE_MOVE_THROTTLE) {
    lastMouseMoveNotification = now;
    chrome.runtime.sendMessage({ type: 'MOUSE_MOVED' }).catch(() => {
      // Ignore errors if background script is not ready
    });
  }
});

console.log('🖱️ DecliTech mouse tracking initialized');
