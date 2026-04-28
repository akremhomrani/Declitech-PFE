(function () {
  "use strict";

  if (window.top !== window) return;

  const HOST_ID = "decli-identity-badge-host";
  const STORAGE_KEYS = ["decli_session_active", "decli_session_identity"];

  let host = null;
  let labelEl = null;

  function buildBadge() {
    if (host) return;

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = [
      "all: initial",
      "position: fixed",
      "top: 16px",
      "right: 16px",
      "z-index: 2147483647",
      "pointer-events: none",
    ].join(";");

    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 14px 22px 14px 18px;
        background: rgba(16, 24, 40, 0.9);
        color: #ffffff;
        font: 800 18px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        letter-spacing: 0.3px;
        border-radius: 999px;
        box-shadow: 0 10px 28px rgba(16, 24, 40, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        max-width: 480px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #12b76a;
        box-shadow: 0 0 0 6px rgba(18, 183, 106, 0.28);
        animation: pulse 1.6s ease-in-out infinite;
        flex-shrink: 0;
      }
      .brand {
        color: #2ed3d8;
        font-weight: 900;
        font-size: 18px;
        margin-right: 4px;
      }
      .name {
        color: #ffffff;
        font-weight: 800;
        font-size: 18px;
        max-width: 360px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.82); }
      }
    `;

    const pill = document.createElement("div");
    pill.className = "pill";

    const dot = document.createElement("span");
    dot.className = "dot";

    const brand = document.createElement("span");
    brand.className = "brand";
    brand.textContent = "DecliTrack";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = "—";
    labelEl = name;

    pill.appendChild(dot);
    pill.appendChild(brand);
    pill.appendChild(name);
    shadow.appendChild(style);
    shadow.appendChild(pill);

    document.documentElement.appendChild(host);
  }

  function removeBadge() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    labelEl = null;
  }

  function render(active, identity) {
    if (!active) {
      removeBadge();
      return;
    }
    buildBadge();
    if (labelEl) labelEl.textContent = (identity || "Student").trim() || "Student";
  }

  function applyFromStorage() {
    chrome.storage.local.get(STORAGE_KEYS, (res) => {
      render(!!res.decli_session_active, res.decli_session_identity || "");
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!(STORAGE_KEYS.some((k) => k in changes))) return;
    applyFromStorage();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFromStorage, { once: true });
  } else {
    applyFromStorage();
  }
})();
