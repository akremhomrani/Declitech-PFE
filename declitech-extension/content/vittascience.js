(function () {
  "use strict";

  const EXTRACT_INTERVAL = 3000;
  let lastDataHash = "";

  function findElementByText(text) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim().includes(text)) {
        return walker.currentNode.parentElement;
      }
    }
    return null;
  }

  function findAllElementsByText(text) {
    const results = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim().includes(text)) {
        results.push(walker.currentNode.parentElement);
      }
    }
    return results;
  }

  function isVittascienceML() {
    const hasTrainButton = !!findElementByText("Entraîner le modèle");
    const hasDonnees = !!findElementByText("DONNÉES") || !!findElementByText("DONNEES");
    const hasApercu = !!findElementByText("APERÇU") || !!findElementByText("APERCU");
    const hasAddCategory = !!findElementByText("Ajouter une catégorie");
    return (hasTrainButton && hasDonnees) || (hasTrainButton && hasApercu) || hasAddCategory;
  }

  function findCategoryNameInContainer(container) {
    if (!container) return null;
    const editableInputs = container.querySelectorAll("input[type='text'], [contenteditable='true']");
    for (const input of editableInputs) {
      const val = input.value || input.textContent || "";
      if (val.trim() && !val.includes("image") && !val.includes("Supprimer")) return val.trim();
    }
    for (const node of container.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t && t.length < 50 && !t.includes("image") && !t.includes("Supprimer") &&
            !t.includes("DONNÉES") && !t.includes("catégorie")) return t;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const t = node.textContent.trim();
        if (t && t.length < 30 && !t.includes("image") && !t.includes("Supprimer") &&
            !t.includes("DONNÉES") && !t.includes("catégorie") && !t.includes("Ajouter") &&
            !t.includes("RGPD")) return t;
      }
    }
    return null;
  }

  function extractCategories() {
    const categories = [];
    const imageCountElements = findAllElementsByText("image(s)");
    for (const el of imageCountElements) {
      const countMatch = el.textContent.match(/(\d+)\s*image\(s\)/);
      const imageCount = countMatch ? parseInt(countMatch[1], 10) : 0;
      let container = el.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const nameEl = findCategoryNameInContainer(container);
        if (nameEl !== null) {
          categories.push({ name: nameEl || "", imageCount });
          break;
        }
        container = container.parentElement;
      }
    }

    if (categories.length === 0) {
      const deleteButtons = findAllElementsByText("Supprimer");
      for (const btn of deleteButtons) {
        let container = btn.parentElement;
        for (let i = 0; i < 3 && container; i++) container = container.parentElement;
        if (container) {
          const name = findCategoryNameInContainer(container) || "";
          const countText = container.textContent.match(/(\d+)\s*image/);
          categories.push({
            name,
            imageCount: countText ? parseInt(countText[1], 10) : 0,
          });
        }
      }
    }
    return categories;
  }

  function extractPredictions() {
    const predictions = [];
    const percentElements = [];
    document.querySelectorAll("*").forEach((el) => {
      const text = el.textContent.trim();
      if (/^\d{1,3}%$/.test(text) && el.children.length === 0) percentElements.push(el);
    });

    for (const pctEl of percentElements) {
      const pct = parseInt(pctEl.textContent, 10);
      const parent = pctEl.parentElement;
      if (!parent) continue;

      let found = false;
      for (const sib of parent.children) {
        const t = sib.textContent.trim();
        if (t !== pctEl.textContent.trim() && t.length < 30 && !/^\d+%$/.test(t)) {
          predictions.push({ category: t, confidence: pct });
          found = true;
          break;
        }
      }
      if (!found) {
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
    return predictions;
  }

  function extractTrainingState() {
    const trainButton = findElementByText("Entraîner le modèle");
    const verifyButton = findElementByText("Vérifier les données");
    const isVerifyActive = verifyButton
      ? !verifyButton.closest("[disabled]") && !verifyButton.classList.contains("disabled")
      : false;
    return {
      trainButtonVisible: !!trainButton,
      modelTrained: isVerifyActive || extractPredictions().length > 0,
      hasAddCategoryButton: !!findElementByText("Ajouter une catégorie"),
    };
  }

  function extractExerciseInfo() {
    const h1 = document.querySelector("h1, h2, [class*='title']");
    const breadcrumb = document.querySelector("[class*='breadcrumb']");
    let title = "";
    if (h1) title = h1.textContent.trim();
    if (!title && breadcrumb) title = breadcrumb.textContent.trim();
    return { title };
  }

  function extractAllData() {
    const data = {
      timestamp: new Date().toISOString(),
      isVittascienceML: false,
      exerciseInfo: null,
      categories: [],
      predictions: [],
      trainingState: null,
      pageUrl: window.location.href,
      frameType: window === window.top ? "main" : "iframe",
    };

    if (window === window.top) data.exerciseInfo = extractExerciseInfo();

    if (isVittascienceML()) {
      data.isVittascienceML = true;
      data.categories = extractCategories();
      data.predictions = extractPredictions();
      data.trainingState = extractTrainingState();
    }
    return data;
  }

  function sendData(data) {
    const hash =
      JSON.stringify(data.categories) +
      JSON.stringify(data.predictions) +
      JSON.stringify(data.trainingState);
    if (hash === lastDataHash) return;
    lastDataHash = hash;
    try {
      chrome.runtime.sendMessage({ type: "VITTASCIENCE_DATA", data }).catch(() => {});
    } catch {}
  }

  function startExtraction() {
    setInterval(() => {
      try {
        const data = extractAllData();
        if (data.isVittascienceML || (data.exerciseInfo && data.exerciseInfo.title)) sendData(data);
      } catch {}
    }, EXTRACT_INTERVAL);

    setTimeout(() => {
      try {
        const data = extractAllData();
        if (data.isVittascienceML || (data.exerciseInfo && data.exerciseInfo.title)) sendData(data);
      } catch {}
    }, 2000);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_VITTASCIENCE_DATA") {
      try {
        sendResponse({ success: true, data: extractAllData() });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
  });

  startExtraction();
})();
