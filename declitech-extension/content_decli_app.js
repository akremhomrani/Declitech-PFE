(function () {
  "use strict";

  function extractLearnDom() {
    const path = location.pathname;

    const titleEl = document.querySelector('h1, h2, .page-title, [class*="title"]');
    const pageTitle = titleEl?.innerText?.trim()?.slice(0, 100) || document.title?.split('|')[0]?.trim() || '';

    const exerciseEl = document.querySelector('[class*="exercise"], [class*="lesson"], [class*="activity"], [class*="module"], [class*="project"]');
    const exerciseName = exerciseEl?.innerText?.trim()?.slice(0, 100) || pageTitle;

    const progressBar = document.querySelector('[role="progressbar"]');
    const progressText = progressBar?.getAttribute('aria-valuenow')
      || progressBar?.innerText?.trim()
      || document.querySelector('[class*="progress"]')?.innerText?.trim()
      || null;

    const codeEl = document.querySelector('.ace_content, .CodeMirror-code, [class*="editor"] code, textarea[class*="code"]');
    const studentCode = codeEl?.innerText?.trim()?.slice(0, 500) || null;

    const completed = !!(
      document.querySelector('[class*="success"], [class*="complete"], [class*="congrats"], [class*="bravo"]') ||
      /félicitations|bravo|completed|terminé/i.test(document.body.innerText || '')
    );

    return { path, pageTitle, exerciseName, progress: progressText, studentCode, completed, url: location.href, timestamp: new Date().toISOString() };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'REQUEST_LEARN_DOM') {
      sendResponse({ success: true, data: extractLearnDom() });
      return true;
    }
  });
})();
