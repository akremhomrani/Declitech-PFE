(function () {
  "use strict";

  const EXTRACT_INTERVAL = 2000;
  const RESETUP_INTERVAL = 10000;
  const MODULE_NAMES = ["Affichage", "Turtle", "Graphiques", "Numpy", "IA", "Logique", "Boucles", "Math", "Texte", "Variables", "Listes"];

  let lastExecutionHash = "";

  function findElementByText(text) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim().includes(text)) {
        return walker.currentNode.parentElement;
      }
    }
    return null;
  }

  function isPythonModule() {
    const hasExecuteButton = !!findElementByText("Exécuter");
    const hasConsoleArea = !!document.querySelector('[class*="console"], [class*="output"], [class*="terminal"]');
    const hasPythonMenu =
      !!findElementByText("Affichage") ||
      !!findElementByText("Turtle") ||
      !!findElementByText("Graphiques");
    return hasExecuteButton || (hasConsoleArea && hasPythonMenu);
  }

  function extractPythonCode() {
    const editorPatterns = [
      'textarea[data-testid*="code"]',
      ".editor-code",
      ".monaco-editor",
      ".cm-editor",
      '[contenteditable="true"][class*="code"]',
      "textarea",
    ];
    for (const selector of editorPatterns) {
      const editor = document.querySelector(selector);
      if (editor) return editor.value || editor.textContent || "";
    }
    const codeBlocks = document.querySelectorAll("pre, code");
    for (const block of codeBlocks) {
      if (block.textContent.length > 10) return block.textContent;
    }
    return "";
  }

  function extractConsoleOutput() {
    const consolePatterns = [".console-output", ".output-console", ".terminal", '[class*="console"]', '[class*="output"]'];
    for (const selector of consolePatterns) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    let output = "";
    for (const div of document.querySelectorAll("div, span, p")) {
      const text = div.textContent;
      if (text.includes(">>>") || text.includes("Bonjour") || /\d+/.test(text)) {
        output = text;
        if (output.length > 5) break;
      }
    }
    return output;
  }

  function setupExecutionListener() {
    const executeButton = findElementByText("Exécuter");
    if (!executeButton) return;
    executeButton.addEventListener("click", () => {
      setTimeout(() => {
        const code = extractPythonCode();
        const output = extractConsoleOutput();
        if (code || output) {
          chrome.runtime.sendMessage({
            type: "PYTHON_EXECUTION",
            data: { code, output, timestamp: new Date().toISOString() },
          }).catch(() => {});
        }
      }, 500);
    }, true);
  }

  function activeModule() {
    for (const name of MODULE_NAMES) {
      const el = findElementByText(name);
      if (el && el.closest("[class*='selected'], [class*='active'], .active")) return name;
    }
    return "Unknown";
  }

  function extractPythonData() {
    return {
      timestamp: new Date().toISOString(),
      isPythonModule: isPythonModule(),
      moduleType: "Python",
      activeModule: activeModule(),
      code: extractPythonCode(),
      consoleOutput: extractConsoleOutput(),
      pageUrl: window.location.href,
      frameType: window === window.top ? "main" : "iframe",
    };
  }

  function sendPythonModuleData(data) {
    const hash = JSON.stringify(data.code) + JSON.stringify(data.consoleOutput);
    if (hash === lastExecutionHash) return;
    lastExecutionHash = hash;
    try {
      chrome.runtime.sendMessage({ type: "PYTHON_MODULE_DATA", data }).catch(() => {});
    } catch {}
  }

  function startPythonTracking() {
    setTimeout(setupExecutionListener, 1000);
    setInterval(() => {
      try {
        const data = extractPythonData();
        if (data.isPythonModule) sendPythonModuleData(data);
      } catch {}
    }, EXTRACT_INTERVAL);
    setInterval(() => {
      try { setupExecutionListener(); } catch {}
    }, RESETUP_INTERVAL);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_PYTHON_DATA") {
      try {
        sendResponse({ success: true, data: extractPythonData() });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
  });

  startPythonTracking();
})();
