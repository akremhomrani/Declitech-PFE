function initials(identity) {
  const s = (identity || "").trim();
  if (!s) return "ON";
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return s.slice(0, 3).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[1][0] + (parts[2]?.[0] || "")).toUpperCase().slice(0, 3);
}

export function applyToolbarBadge(active, identity = "") {
  if (active) {
    chrome.action.setBadgeText({ text: initials(identity) });
    chrome.action.setBadgeBackgroundColor({ color: "#12b76a" });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: "#ffffff" });
    }
    chrome.action.setTitle({
      title: identity ? `DecliTrack — ${identity}` : "DecliTrack — Session active",
    });
  } else {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "DecliTrack" });
  }
}

export function restoreToolbarBadgeFromStorage() {
  chrome.storage.local.get(["decli_session_active", "decli_session_identity"], (res) => {
    applyToolbarBadge(!!res.decli_session_active, res.decli_session_identity || "");
  });
}
