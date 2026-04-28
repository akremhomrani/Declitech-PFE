import { AGENT_PEDAGOGY_URL, PEDAGOGY_SITES, TIMING } from "./config.js";
import { state, isActive } from "./state.js";

let scanInterval = null;

function prevStateKey(tabId) { return `pedago_prev_${tabId}`; }

function detectPhase(current, prev) {
  if (!prev) return "STARTED";
  if (current.levelSlug !== prev.levelSlug) return "NEW_LEVEL";
  if (current.completed && !prev.completed) return "LEVEL_COMPLETE";
  const blocksNow = current.blocksCount || 0;
  const blocksBefore = prev.blocksCount || 0;
  if (blocksNow > blocksBefore) return "IN_PROGRESS";
  if (blocksNow === blocksBefore && blocksNow > 0) return "STALLED";
  return "IN_PROGRESS";
}

function extractPedagogyData() {
  try {
    const host = location.hostname;
    const path = location.pathname;

    if (host.includes("codecombat.com")) {
      const levelMatch = path.match(/\/play\/level\/([^/?]+)/);
      if (levelMatch) {
        const slug = levelMatch[1];
        const titleSelectors = [".level-name", '[data-i18n="play.level_title"]', ".game-menu-title", "h1.level-title", "#level-name", "h1"];
        let levelName = "";
        for (const sel of titleSelectors) {
          const el = document.querySelector(sel);
          const txt = el?.innerText?.trim();
          if (txt && txt.length > 1 && txt.length < 80) { levelName = txt; break; }
        }
        if (!levelName && document.title) {
          levelName = document.title.split("|")[0].split("-")[0].trim();
        }
        levelName = levelName || slug;

        const victorySelectors = [".modal.victory", "#victory", ".level-complete", '[data-i18n="victory.level_complete"]', ".level-victory", ".victory-container", ".victory-modal"];
        let victory = victorySelectors.some((s) => !!document.querySelector(s));
        if (!victory) {
          const pt = document.body.innerText || "";
          victory = /LEVEL COMPLETE|JOLIS COUPS|Félicitations|Congratulations/i.test(pt);
        }

        const codeEl = document.querySelector(".ace_content, .CodeMirror-code, #code-area");
        let studentWork = codeEl?.innerText?.trim()?.slice(0, 500) || "";
        if (victory && !studentWork) studentWork = "[Niveau complété avec succès]";

        let score = 20;
        if (victory) score = 100;
        else if (studentWork.length > 200) score = 70;
        else if (studentWork.length > 80) score = 50;
        else if (studentWork.length > 20) score = 35;

        return {
          type: "LEVEL_PROGRESS", site: "codecombat.com",
          levelSlug: slug, levelName,
          completed: victory, score,
          studentWork, url: location.href, timestamp: new Date().toISOString(),
        };
      }

      const bodyText = document.body.innerText || "";
      const levelMatch2 = bodyText.match(/(?:Dernier Niveau|Last Level)[:\s]+([^\n]{3,60})/i);
      const lastLevel = levelMatch2 ? levelMatch2[1].trim() : "";

      let maxProg = 0;
      document.querySelectorAll('[style*="width"]').forEach((el) => {
        const w = parseFloat(el.style.width || "0");
        if (w > 0 && w <= 100) maxProg = Math.max(maxProg, w);
      });
      if (maxProg === 0) {
        const pctMatch = bodyText.match(/(\d{1,3}(?:\.\d)?)\s*%/);
        if (pctMatch) maxProg = parseFloat(pctMatch[1]);
      }
      if (maxProg === 0 && !lastLevel) return null;

      return {
        type: "LEVEL_PROGRESS", site: "codecombat.com",
        levelSlug: "overview",
        levelName: lastLevel || `Progression: ${Math.round(maxProg)}%`,
        completed: maxProg >= 100, score: Math.round(maxProg),
        studentWork: `Progression: ${Math.round(maxProg)}%${lastLevel ? " | " + lastLevel : ""}`,
        url: location.href, timestamp: new Date().toISOString(),
      };
    }

    if (host.includes("code.org")) {
      const lessonMatch = path.match(/\/s\/([^/]+)\/lessons\/(\d+)\/levels\/(\d+)/);
      if (!lessonMatch) return null;
      const titleEl = document.querySelector("h1, .instructions-title");
      const title = titleEl?.innerText?.trim() || `code.org niveau ${lessonMatch[3]}`;
      const done = !!document.querySelector("#finish-puzzle, .congrats-dialog");
      const stars = document.querySelectorAll('.fa-star.active, img[src*="star_full"]').length;
      const codeEl = document.querySelector(".ace_content, .CodeMirror-code");
      const work = codeEl?.innerText?.trim()?.slice(0, 400) || "";
      return {
        type: "LEVEL_PROGRESS", site: "code.org",
        courseName: lessonMatch[1], lessonNumber: +lessonMatch[2], levelNumber: +lessonMatch[3],
        levelName: title, activityTitle: title,
        completed: done, score: stars ? Math.round((stars / 3) * 100) : (done ? 100 : 30),
        stars, studentWork: work,
        url: location.href, timestamp: new Date().toISOString(),
      };
    }
    return null;
  } catch { return null; }
}

async function scanSingleTab(tab, immediate = false) {
  if (!isActive()) return;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPedagogyData,
    });
    const data = results?.[0]?.result;
    if (!data) return;

    const blocksCount = data.studentWork
      ? Math.max(1, Math.round(data.studentWork.split("\n").filter((l) => l.trim()).length))
      : 0;
    data.blocksCount = blocksCount;

    const prevKey = prevStateKey(tab.id);
    const stored = await chrome.storage.session.get([prevKey]);
    const prev = stored[prevKey] || null;
    const phase = detectPhase(data, prev);

    if (phase === "STALLED" && !immediate) {
      const lastSent = prev?._lastSentAt || 0;
      if (Date.now() - lastSent < 58000) return;
    }

    data._lastSentAt = Date.now();
    await chrome.storage.session.set({ [prevKey]: { ...data, blocksCount } });

    await fetch(AGENT_PEDAGOGY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        blocksCount,
        phase,
        sessionId: state.sessionCode,
        participantId: state.participantId,
        studentLoginIdentity: state.studentLoginIdentity,
      }),
    }).catch(() => {});
  } catch {}
}

async function scanPedagogyTabs() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url) return;
    if (!PEDAGOGY_SITES.some((s) => activeTab.url.includes(s))) return;
    await scanSingleTab(activeTab, false);
  } catch {}
}

export function initPedagogy() {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    if (!tab.url || !PEDAGOGY_SITES.some((s) => tab.url.includes(s))) return;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || activeTab.id !== tabId) return;
    setTimeout(() => scanSingleTab(tab, true), 1500);
  });

  if (scanInterval) clearInterval(scanInterval);
  scanInterval = setInterval(scanPedagogyTabs, TIMING.PEDAGOGY_SCAN_MS);
}
