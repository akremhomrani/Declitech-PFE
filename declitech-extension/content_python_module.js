// =========================================================
//  DecliTech Extension — Vittascience Python Module Tracker
//  Detects Python execution, captures code and console output
// =========================================================

(function () {
  "use strict";

  const EXTRACT_INTERVAL = 2000; // Check every 2 seconds
  let lastExecutionHash = "";
  let lastConsoleOutput = "";

  // -------------------------------------------------------
  //  Detect if current interface is Vittascience Python
  // -------------------------------------------------------
  function isPythonModule() {
    // Look for Python-specific UI elements
    const hasExecuteButton = !!findElementByText("Exécuter");
    const hasConsoleArea = !!document.querySelector('[class*="console"], [class*="output"], [class*="terminal"]');
    const hasPythonMenu = !!findElementByText("Affichage") ||
                          !!findElementByText("Turtle") ||
                          !!findElementByText("Graphiques");

    return hasExecuteButton || (hasConsoleArea && hasPythonMenu);
  }

  // -------------------------------------------------------
  //  Helper: Find element by text content
  // -------------------------------------------------------
  function findElementByText(text) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim().includes(text)) {
        return walker.currentNode.parentElement;
      }
    }
    return null;
  }

  // -------------------------------------------------------
  //  Extract Python code from editor
  // -------------------------------------------------------
  function extractPythonCode() {
    // Look for code editor elements (common patterns)
    const editorPatterns = [
      'textarea[data-testid*="code"]',
      '.editor-code',
      '.monaco-editor',
      '.cm-editor',
      '[contenteditable="true"][class*="code"]',
      'textarea'
    ];

    for (const selector of editorPatterns) {
      const editor = document.querySelector(selector);
      if (editor) {
        return editor.value || editor.textContent || "";
      }
    }

    // Fallback: search for pre or code blocks with code
    const codeBlocks = document.querySelectorAll("pre, code");
    for (const block of codeBlocks) {
      if (block.textContent.length > 10) {
        return block.textContent;
      }
    }

    return "";
  }

  // -------------------------------------------------------
  //  Extract console output
  // -------------------------------------------------------
  function extractConsoleOutput() {
    // Look for console/output area
    const consolePatterns = [
      '.console-output',
      '.output-console',
      '.terminal',
      '[class*="console"]',
      '[class*="output"]'
    ];

    for (const selector of consolePatterns) {
      const console = document.querySelector(selector);
      if (console && console.textContent.trim()) {
        return console.textContent.trim();
      }
    }

    // Fallback: look for elements with ">>>" or result indicators
    const allDivs = document.querySelectorAll("div, span, p");
    let output = "";
    for (const div of allDivs) {
      const text = div.textContent;
      if (text.includes(">>>") || text.includes("Bonjour") || /\d+/.test(text)) {
        output = text;
        if (output.length > 5) break;
      }
    }

    return output;
  }

  // -------------------------------------------------------
  //  Detect if Execute button was clicked (by listening to DOM changes)
  // -------------------------------------------------------
  function setupExecutionListener() {
    const executeButton = findElementByText("Exécuter");
    if (!executeButton) return;

    // Listen for click on execute button
    executeButton.addEventListener("click", () => {
      setTimeout(() => {
        const code = extractPythonCode();
        const output = extractConsoleOutput();

        if (code || output) {
          sendPythonExecutionData({
            code: code,
            output: output,
            timestamp: new Date().toISOString()
          });
        }
      }, 500); // Wait 500ms for output to appear
    }, true);
  }

  // -------------------------------------------------------
  //  Detect module menu changes
  // -------------------------------------------------------
  function detectModuleChange() {
    const moduleNames = ["Affichage", "Turtle", "Graphiques", "Numpy", "IA", "Logique", "Boucles", "Math", "Texte", "Variables", "Listes"];

    let lastSelectedModule = "";

    return function checkModuleChange() {
      for (const moduleName of moduleNames) {
        const moduleElement = findElementByText(moduleName);
        if (moduleElement && moduleElement.closest("[class*='selected'], [class*='active'], .active")) {
          if (lastSelectedModule !== moduleName) {
            lastSelectedModule = moduleName;
            return { module: moduleName, changed: true };
          }
        }
      }
      return { module: lastSelectedModule, changed: false };
    };
  }

  // -------------------------------------------------------
  //  Extract all Python module data
  // -------------------------------------------------------
  function extractPythonData() {
    const moduleChecker = detectModuleChange();
    const moduleInfo = moduleChecker();

    const data = {
      timestamp: new Date().toISOString(),
      isPythonModule: isPythonModule(),
      moduleType: "Python",
      activeModule: moduleInfo.module || "Unknown",
      code: extractPythonCode(),
      consoleOutput: extractConsoleOutput(),
      pageUrl: window.location.href,
      frameType: window === window.top ? "main" : "iframe"
    };

    return data;
  }

  // -------------------------------------------------------
  //  Send Python execution data
  // -------------------------------------------------------
  function sendPythonExecutionData(executionData) {
    try {
      chrome.runtime.sendMessage({
        type: "PYTHON_EXECUTION",
        data: executionData
      }).catch(() => { });
    } catch (e) { }
  }

  // -------------------------------------------------------
  //  Send periodic Python module data
  // -------------------------------------------------------
  function sendPythonModuleData(data) {
    const hash = JSON.stringify(data.code) + JSON.stringify(data.consoleOutput);

    // Only send if data changed
    if (hash === lastExecutionHash) return;
    lastExecutionHash = hash;

    try {
      chrome.runtime.sendMessage({
        type: "PYTHON_MODULE_DATA",
        data: data
      }).catch(() => { });
    } catch (e) { }
  }

  // -------------------------------------------------------
  //  Start periodic extraction
  // -------------------------------------------------------
  function startPythonTracking() {
    // Initial setup for button listener
    setTimeout(() => {
      setupExecutionListener();
    }, 1000);

    // Periodic extraction
    setInterval(() => {
      try {
        const data = extractPythonData();
        if (data.isPythonModule) {
          sendPythonModuleData(data);
        }
      } catch (e) { }
    }, EXTRACT_INTERVAL);

    // Re-setup button listener every 10 seconds (in case DOM changes)
    setInterval(() => {
      try {
        setupExecutionListener();
      } catch (e) { }
    }, 10000);
  }

  // -------------------------------------------------------
  //  Listen for extraction requests from background
  // -------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "REQUEST_PYTHON_DATA") {
      try {
        const data = extractPythonData();
        sendResponse({ success: true, data: data });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
  });

  // Start tracking
  startPythonTracking();
})();
