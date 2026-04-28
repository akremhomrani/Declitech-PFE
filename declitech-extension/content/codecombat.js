(function () {
  "use strict";

  const PEDAGOGY_INTERVAL = 10000;
  let lastSentData = null;

  function extractLevelNumberFromSlug(slug) {
    const numbers = slug.match(/\d+/);
    return numbers ? parseInt(numbers[0]) : 1;
  }

  function detectCodeCombatOverview() {
    try {
      const progressBars = document.querySelectorAll('.progress-bar, [role="progressbar"], [class*="progress"]');
      let maxProgress = 0;
      progressBars.forEach((bar) => {
        const val = parseFloat(bar.style.width || bar.getAttribute("aria-valuenow") || bar.innerText?.replace("%", "") || "0");
        if (val > maxProgress) maxProgress = val;
      });

      const classNameEl = document.querySelector('h1, h2, .classroom-name, [class*="classroom-name"], [class*="course-name"]');
      const className = classNameEl?.innerText?.trim()?.slice(0, 80) || "Classe CodeCombat";

      const lastLevelEl = document.querySelector('[class*="last-level"], [class*="current-level"], [class*="next-level"]');
      const bodyText = document.body.innerText || "";
      const levelMatch = bodyText.match(/(?:Dernier Niveau|Last Level)[:\s]+(\d+[.\s][^\n]+)/i);
      const lastLevelName = lastLevelEl?.innerText?.trim() || (levelMatch ? levelMatch[1].trim().slice(0, 60) : "");

      if (maxProgress === 0 && !lastLevelName) return null;

      const scoreInt = Math.round(maxProgress);
      return {
        type: "LEVEL_PROGRESS",
        site: "codecombat.com",
        levelSlug: "overview",
        levelName: lastLevelName || `Progression: ${scoreInt}%`,
        levelNumber: null,
        courseName: className,
        completed: scoreInt >= 100,
        score: scoreInt,
        studentWork: `Progression globale: ${scoreInt}%${lastLevelName ? " | Dernier niveau: " + lastLevelName : ""}`,
        url: location.href,
        timestamp: new Date().toISOString(),
      };
    } catch { return null; }
  }

  function detectCodeCombat() {
    try {
      const match = location.pathname.match(/\/play\/level\/([^/?]+)/);
      if (!match) return detectCodeCombatOverview();

      const levelSlug = match[1];
      const levelNameEl = document.querySelector(".level-name, h1.level-title, .game-menu-title, #level-name");
      const levelName = levelNameEl?.innerText?.trim() || levelSlug;

      const levelNumEl = document.querySelector(".level-number, .campaign-level-number, [data-level-number]");
      const levelNumber = levelNumEl
        ? parseInt(levelNumEl.innerText || levelNumEl.getAttribute("data-level-number") || "0")
        : extractLevelNumberFromSlug(levelSlug);

      const victoryModal = document.querySelector('.modal.victory, #victory, .level-complete, [data-i18n="victory.level_complete"]');
      const completed = !!victoryModal;

      const progressBar = document.querySelector(".progress-bar, [aria-valuenow]");
      const score = progressBar
        ? parseInt(progressBar.getAttribute("aria-valuenow") || progressBar.style.width || "0")
        : (completed ? 100 : 50);

      const editorSelectors = [
        ".ace_content", ".CodeMirror-code", "#code-area", ".code-editor",
        ".lines-content", ".editor-content", "textarea.code-input",
        "[data-ace-editor-id]", ".code-mirror-wrapper", "pre, code",
        '[contenteditable="true"]', ".active-editor",
      ];
      let studentCode = "";
      for (const selector of editorSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = el.innerText?.trim() || el.textContent?.trim();
          if (text && text.length > 5) { studentCode = text.slice(0, 500); break; }
        }
      }

      return {
        type: "LEVEL_PROGRESS",
        site: "codecombat.com",
        levelSlug,
        levelName,
        levelNumber,
        completed,
        score,
        studentWork: studentCode,
        url: location.href,
        timestamp: new Date().toISOString(),
      };
    } catch { return null; }
  }

  function detectCodeOrg() {
    try {
      const lessonMatch = location.pathname.match(/\/s\/([^/]+)\/lessons\/(\d+)\/levels\/(\d+)/);
      const simpleMatch = location.pathname.match(/\/s\/([^/]+)\//);
      if (!lessonMatch && !simpleMatch) return null;

      let courseName, lessonNumber, levelNumber;
      if (lessonMatch) {
        courseName = lessonMatch[1];
        lessonNumber = parseInt(lessonMatch[2]);
        levelNumber = parseInt(lessonMatch[3]);
      } else {
        courseName = simpleMatch[1];
        lessonNumber = 1;
        levelNumber = 1;
      }

      const titleEl = document.querySelector("h1.uitest-topInstructions-title, .instructions-title, h1, .puzzle-title");
      const activityTitle = titleEl?.innerText?.trim() || `${courseName} — Niveau ${levelNumber}`;

      const completionEl = document.querySelector('#finish-puzzle, .congrats-dialog, .btn-success.finish, .success-container, [data-id="congrats"], .uitest-topInstructions-congrats');
      const completed = !!completionEl;

      const starsEl = document.querySelectorAll('.star-active, .fa-star.active, img[src*="star_full"]');
      const stars = starsEl.length;
      const score = Math.round((stars / 3) * 100) || (completed ? 100 : 30);

      const blocklyEl = document.querySelector("#codeWorkspace, .blockly-div, #blocklyDiv, .ace_content");
      const studentWork = blocklyEl
        ? `[Blocs utilisés: ${document.querySelectorAll(".blocklyDraggable").length}] ` +
          (blocklyEl.innerText?.trim()?.slice(0, 300) || "")
        : (document.querySelector(".ace_content")?.innerText?.trim()?.slice(0, 500) || "");

      const instructionsEl = document.querySelector(".instructions-markdown, .uitest-topInstructions-instructions, .instructions p, .level-instructions");
      const activityInstructions = instructionsEl?.innerText?.trim()?.slice(0, 300) || "";

      return {
        type: "LEVEL_PROGRESS",
        site: "code.org",
        courseName,
        lessonNumber,
        levelNumber,
        levelName: `${courseName} — Leçon ${lessonNumber}, Niveau ${levelNumber}`,
        levelSlug: location.pathname,
        activityTitle,
        activityInstructions,
        completed,
        score,
        stars,
        studentWork,
        url: location.href,
        timestamp: new Date().toISOString(),
      };
    } catch { return null; }
  }

  function detectGeneric() {
    try {
      const titleEl = document.querySelector('h1, [role="heading"][aria-level="1"], .exercise-title, .activity-title');
      const title = titleEl?.innerText?.trim() || document.title?.slice(0, 100) || "";
      if (!title || title.length < 3) return null;

      const editorEl = document.querySelector('.ace_content, .CodeMirror-code, textarea.student-answer, [contenteditable="true"], #student-work');
      const studentWork = editorEl?.innerText?.trim()?.slice(0, 500) || "";

      return {
        type: "ACTIVITY_DETECTED",
        site: location.hostname,
        activityTitle: title,
        studentWork,
        url: location.href,
        timestamp: new Date().toISOString(),
      };
    } catch { return null; }
  }

  function detectCurrentSite() {
    const host = location.hostname;
    if (host.includes("codecombat.com")) return detectCodeCombat();
    if (host.includes("code.org")) return detectCodeOrg();
    return detectGeneric();
  }

  function sendPedagogyUpdate() {
    const data = detectCurrentSite();
    if (!data) return;
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSentData) return;
    lastSentData = dataStr;
    chrome.runtime.sendMessage({ type: "PEDAGOGY_UPDATE", data }).catch(() => {});
  }

  sendPedagogyUpdate();
  setInterval(sendPedagogyUpdate, PEDAGOGY_INTERVAL);

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSentData = null;
      setTimeout(sendPedagogyUpdate, 2000);
    }
  }).observe(document.documentElement, { subtree: true, childList: true });
})();
