// =========================================================
//  DecliTech Extension — Vittascience DOM Extractor
//  Runs inside ALL frames (including Vittascience iframe)
//  Extracts exercise data: categories, image counts, 
//  predictions, training state
// =========================================================

(function () {
  "use strict";

  const EXTRACT_INTERVAL = 3000; // Extract every 3 seconds
  let lastDataHash = "";

  // -------------------------------------------------------
  //  Detect if current frame is a Vittascience ML interface
  // -------------------------------------------------------
  function isVittascienceML() {
    // Look for characteristic elements of the Vittascience ML interface
    const hasTrainButton = !!findElementByText("Entraîner le modèle");
    const hasDonnees = !!findElementByText("DONNÉES") || !!findElementByText("DONNEES");
    const hasApercu = !!findElementByText("APERÇU") || !!findElementByText("APERCU");
    const hasAddCategory = !!findElementByText("Ajouter une catégorie");

    return (hasTrainButton && hasDonnees) || (hasTrainButton && hasApercu) || (hasAddCategory);
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

  function findAllElementsByText(text) {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim().includes(text)) {
        results.push(walker.currentNode.parentElement);
      }
    }
    return results;
  }

  // -------------------------------------------------------
  //  Extract categories from DONNÉES section
  // -------------------------------------------------------
  function extractCategories() {
    const categories = [];

    // Strategy 1: Find "image(s)" text elements to locate categories
    const imageCountElements = findAllElementsByText("image(s)");

    for (const el of imageCountElements) {
      const countMatch = el.textContent.match(/(\d+)\s*image\(s\)/);
      const imageCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      // Walk up to find the category container, then find the category name
      let container = el.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const nameEl = findCategoryNameInContainer(container);
        if (nameEl !== null) {
          categories.push({
            name: nameEl || "",
            imageCount: imageCount
          });
          break;
        }
        container = container.parentElement;
      }
    }

    // Strategy 2: If Strategy 1 found nothing, look for "Supprimer" buttons
    if (categories.length === 0) {
      const deleteButtons = findAllElementsByText("Supprimer");
      for (const btn of deleteButtons) {
        let container = btn.parentElement;
        for (let i = 0; i < 3 && container; i++) {
          container = container.parentElement;
        }
        if (container) {
          const name = findCategoryNameInContainer(container) || "";
          const countEl = container.querySelector('[class*="count"], [class*="number"]');
          const countText = container.textContent.match(/(\d+)\s*image/);
          categories.push({
            name: name,
            imageCount: countText ? parseInt(countText[1], 10) : 0
          });
        }
      }
    }

    return categories;
  }

  function findCategoryNameInContainer(container) {
    if (!container) return null;

    // Look for editable text elements near the top of the container
    // Category names are typically in editable spans/inputs or plain text near pencil icons
    const editableInputs = container.querySelectorAll("input[type='text'], [contenteditable='true']");
    for (const input of editableInputs) {
      const val = input.value || input.textContent || "";
      if (val.trim() && !val.includes("image") && !val.includes("Supprimer")) {
        return val.trim();
      }
    }

    // Look for text directly before "Supprimer" button or pencil icon  
    const allText = container.childNodes;
    for (const node of allText) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t && t.length < 50 && !t.includes("image") && !t.includes("Supprimer") &&
          !t.includes("DONNÉES") && !t.includes("catégorie")) {
          return t;
        }
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const t = node.textContent.trim();
        if (t && t.length < 30 && !t.includes("image") && !t.includes("Supprimer") &&
          !t.includes("DONNÉES") && !t.includes("catégorie") && !t.includes("Ajouter") &&
          !t.includes("RGPD")) {
          return t;
        }
      }
    }

    return null;
  }

  // -------------------------------------------------------
  //  Extract prediction results from APERÇU section
  // -------------------------------------------------------
  function extractPredictions() {
    const predictions = [];

    // Look for percentage text patterns (e.g., "100%", "0%")
    const allElements = document.querySelectorAll("*");
    const percentElements = [];

    for (const el of allElements) {
      const text = el.textContent.trim();
      if (/^\d{1,3}%$/.test(text) && el.children.length === 0) {
        percentElements.push(el);
      }
    }

    for (const pctEl of percentElements) {
      const pct = parseInt(pctEl.textContent, 10);

      // Find the associated category name (usually a sibling or nearby element)
      const parent = pctEl.parentElement;
      if (parent) {
        const siblings = parent.children;
        for (const sib of siblings) {
          const t = sib.textContent.trim();
          if (t !== pctEl.textContent.trim() && t.length < 30 && !/^\d+%$/.test(t)) {
            predictions.push({ category: t, confidence: pct });
            break;
          }
        }

        // If not found in siblings, check parent's siblings
        if (predictions.length === percentElements.indexOf(pctEl)) {
          const grandParent = parent.parentElement;
          if (grandParent) {
            const labelEl = grandParent.querySelector("span, label, div, p");
            if (labelEl && labelEl !== pctEl) {
              const t = labelEl.textContent.trim();
              if (t.length < 30 && !/^\d+%$/.test(t)) {
                predictions.push({ category: t, confidence: pct });
              }
            }
          }
        }
      }
    }

    return predictions;
  }

  // -------------------------------------------------------
  //  Extract training state
  // -------------------------------------------------------
  function extractTrainingState() {
    const trainButton = findElementByText("Entraîner le modèle");
    const verifyButton = findElementByText("Vérifier les données");
    const visualizeButton = findElementByText("Visualiser le réseau");

    // Check if verify/visualize buttons are active (model has been trained)
    const isVerifyActive = verifyButton ? !verifyButton.closest("[disabled]") && 
      !verifyButton.classList.contains("disabled") : false;

    return {
      trainButtonVisible: !!trainButton,
      modelTrained: isVerifyActive || extractPredictions().length > 0,
      hasAddCategoryButton: !!findElementByText("Ajouter une catégorie")
    };
  }

  // -------------------------------------------------------
  //  Extract exercise title from parent frame
  // -------------------------------------------------------
  function extractExerciseInfo() {
    // Try to get exercise title from the page (works in parent frame)
    const h1 = document.querySelector("h1, h2, [class*='title']");
    const breadcrumb = document.querySelector("[class*='breadcrumb']");

    let title = "";
    if (h1) title = h1.textContent.trim();
    if (!title && breadcrumb) title = breadcrumb.textContent.trim();

    return { title };
  }

  // -------------------------------------------------------
  //  Main extraction function
  // -------------------------------------------------------
  function extractAllData() {
    const data = {
      timestamp: new Date().toISOString(),
      isVittascienceML: false,
      exerciseInfo: null,
      categories: [],
      predictions: [],
      trainingState: null,
      pageUrl: window.location.href,
      frameType: window === window.top ? "main" : "iframe"
    };

    // Always try to extract exercise info from main frame
    if (window === window.top) {
      data.exerciseInfo = extractExerciseInfo();
    }

    // Only extract ML data if this is a Vittascience ML interface
    if (isVittascienceML()) {
      data.isVittascienceML = true;
      data.categories = extractCategories();
      data.predictions = extractPredictions();
      data.trainingState = extractTrainingState();
    }

    return data;
  }

  // -------------------------------------------------------
  //  Send extracted data to background script
  // -------------------------------------------------------
  function sendData(data) {
    const hash = JSON.stringify(data.categories) + JSON.stringify(data.predictions) +
      JSON.stringify(data.trainingState);

    // Only send if data changed or it's the first time
    if (hash === lastDataHash) return;
    lastDataHash = hash;

    try {
      chrome.runtime.sendMessage({
        type: "VITTASCIENCE_DATA",
        data: data
      }).catch(() => { });
    } catch (e) { }
  }

  // -------------------------------------------------------
  //  Periodic extraction
  // -------------------------------------------------------
  function startExtraction() {
    setInterval(() => {
      try {
        const data = extractAllData();
        if (data.isVittascienceML || (data.exerciseInfo && data.exerciseInfo.title)) {
          sendData(data);
        }
      } catch (e) { }
    }, EXTRACT_INTERVAL);

    // Initial extraction
    setTimeout(() => {
      try {
        const data = extractAllData();
        if (data.isVittascienceML || (data.exerciseInfo && data.exerciseInfo.title)) {
          sendData(data);
        }
      } catch (e) { }
    }, 2000);
  }

  // -------------------------------------------------------
  //  Listen for extraction requests from background
  // -------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "REQUEST_VITTASCIENCE_DATA") {
      try {
        const data = extractAllData();
        sendResponse({ success: true, data: data });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
  });

  // Start periodic extraction
  startExtraction();
})();
