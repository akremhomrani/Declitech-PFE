// =========================================================
//  DecliTech — Suivi Pédagogique
//  Détecte le niveau et le travail de l'élève sur :
//    - CodeCombat (codecombat.com)
//    - Code.org (code.org)
//  Envoie les données à background.js toutes les 10 secondes
// =========================================================

const PEDAGOGY_INTERVAL = 10000; // 10 secondes
let lastSentData = null;

// =========================================================
//  Détecteur CodeCombat — Page "Mes Classes" (overview)
// =========================================================
function detectCodeCombatOverview() {
    try {
        // Page principale codecombat.com avec "Mes Classes"
        // Cherche les cartes de classes avec progression
        const classCards = document.querySelectorAll(
            '.classroom-card, .my-classes-item, [class*="classroom"], [class*="course-instance"]'
        );

        // Extraire le dernier niveau joué depuis le texte de la page
        // "Dernier Niveau: 20. Un Bloc" visible dans la screenshot
        const lastLevelText = [...document.querySelectorAll('*')].find(el =>
            el.childNodes.length === 1 &&
            el.innerText?.match(/Dernier Niveau|Last Level|dernier niveau/i)
        );

        // Barre de progression globale (11.6% dans la screenshot)
        const progressBars = document.querySelectorAll(
            '.progress-bar, [role="progressbar"], [class*="progress"]'
        );
        let maxProgress = 0;
        progressBars.forEach(bar => {
            const val = parseFloat(
                bar.style.width ||
                bar.getAttribute('aria-valuenow') ||
                bar.innerText?.replace('%', '') || '0'
            );
            if (val > maxProgress) maxProgress = val;
        });

        // Nom de la classe (ex: "1316DIMANCHE16:30H (Python)")
        const classNameEl = document.querySelector(
            'h1, h2, .classroom-name, [class*="classroom-name"], [class*="course-name"]'
        );
        const className = classNameEl?.innerText?.trim()?.slice(0, 80) || 'Classe CodeCombat';

        // Dernier niveau depuis le DOM
        const lastLevelEl = document.querySelector(
            '[class*="last-level"], [class*="current-level"], [class*="next-level"]'
        );
        // Cherche "Dernier Niveau: X.Y Nom" dans le texte de la page
        const bodyText = document.body.innerText || '';
        const levelMatch = bodyText.match(/(?:Dernier Niveau|Last Level)[:\s]+(\d+[.\s][^\n]+)/i);
        const lastLevelName = lastLevelEl?.innerText?.trim() ||
            (levelMatch ? levelMatch[1].trim().slice(0, 60) : '');

        // Si pas de données utiles, on ne retourne rien
        if (maxProgress === 0 && !lastLevelName) return null;

        const scoreInt = Math.round(maxProgress);

        return {
            type: 'LEVEL_PROGRESS',
            site: 'codecombat.com',
            levelSlug: 'overview',
            levelName: lastLevelName || `Progression: ${scoreInt}%`,
            levelNumber: null,
            courseName: className,
            completed: scoreInt >= 100,
            score: scoreInt,
            studentWork: `Progression globale: ${scoreInt}%${lastLevelName ? ' | Dernier niveau: ' + lastLevelName : ''}`,
            url: location.href,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return null;
    }
}

// =========================================================
//  Détecteur CodeCombat — À l'intérieur d'un niveau
// =========================================================
function detectCodeCombat() {
    try {
        // Extraire le slug du niveau depuis l'URL
        // Ex: /play/level/dungeons-of-kithgard
        const match = location.pathname.match(/\/play\/level\/([^/?]+)/);

        // Si pas dans un niveau → essayer la page overview
        if (!match) return detectCodeCombatOverview();

        const levelSlug = match[1];

        // Nom du niveau depuis la page
        const levelNameEl = document.querySelector(
            '.level-name, h1.level-title, .game-menu-title, #level-name'
        );
        const levelName = levelNameEl?.innerText?.trim() || levelSlug;

        // Numéro de niveau si disponible
        const levelNumEl = document.querySelector(
            '.level-number, .campaign-level-number, [data-level-number]'
        );
        const levelNumber = levelNumEl
            ? parseInt(levelNumEl.innerText || levelNumEl.getAttribute('data-level-number') || '0')
            : extractLevelNumberFromSlug(levelSlug);

        // Complétion : modal de victoire visible ?
        const victoryModal = document.querySelector(
            '.modal.victory, #victory, .level-complete, [data-i18n="victory.level_complete"]'
        );
        const completed = !!victoryModal;

        // Score de progression (barre de progression si visible)
        const progressBar = document.querySelector('.progress-bar, [aria-valuenow]');
        const score = progressBar
            ? parseInt(progressBar.getAttribute('aria-valuenow') || progressBar.style.width || '0')
            : (completed ? 100 : 50);

        // Code de l'élève dans l'éditeur
        // Try multiple selectors for different CodeCombat versions and layouts
        let studentCode = '';
        
        // Try common editor containers
        const possibleSelectors = [
            '.ace_content',           // Ace editor
            '.CodeMirror-code',       // CodeMirror editor
            '#code-area',             // Direct ID
            '.code-editor',           // Generic code editor class
            '.lines-content',         // Editor content
            '.editor-content',        // Alternative
            'textarea.code-input',    // Textarea input
            '[data-ace-editor-id]',   // Ace editor data attr
            '.code-mirror-wrapper',   // Wrapped CodeMirror
            'pre, code',              // Fallback to pre/code tags
            '[contenteditable="true"]', // Editable div
            '.active-editor'          // Active editor class
        ];
        
        for (const selector of possibleSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.innerText?.trim() || el.textContent?.trim();
                if (text && text.length > 5) {  // Must have some content
                    studentCode = text.slice(0, 500);
                    break;
                }
            }
        }
        
        // DEBUG: Log if we couldn't find code
        if (!studentCode && !completed) {
            // Only log during active coding, not on overview
            console.warn('[DecliTech] Could not extract student code from CodeCombat. DOM selectors may need updating.');
        }

        return {
            type: 'LEVEL_PROGRESS',
            site: 'codecombat.com',
            levelSlug,
            levelName,
            levelNumber,
            completed,
            score,
            studentWork: studentCode,
            url: location.href,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return null;
    }
}

function extractLevelNumberFromSlug(slug) {
    const numbers = slug.match(/\d+/);
    return numbers ? parseInt(numbers[0]) : 1;
}

// =========================================================
//  Détecteur Code.org
// =========================================================
function detectCodeOrg() {
    try {
        // URLs de type :
        //   /s/course3/lessons/2/levels/3
        //   /s/algebra/lessons/1/levels/1
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

        // Titre de l'activité depuis la page
        const titleEl = document.querySelector(
            'h1.uitest-topInstructions-title, .instructions-title, h1, .puzzle-title'
        );
        const activityTitle = titleEl?.innerText?.trim() || `${courseName} — Niveau ${levelNumber}`;

        // Complétion
        const completionEl = document.querySelector(
            '#finish-puzzle, .congrats-dialog, .btn-success.finish, .success-container, ' +
            '[data-id="congrats"], .uitest-topInstructions-congrats'
        );
        const completed = !!completionEl;

        // Étoiles gagnées (0-3 pour code.org)
        const starsEl = document.querySelectorAll('.star-active, .fa-star.active, img[src*="star_full"]');
        const stars = starsEl.length;
        const score = Math.round((stars / 3) * 100) || (completed ? 100 : 30);

        // Blocs de code / programme de l'élève
        const blocklyEl = document.querySelector(
            '#codeWorkspace, .blockly-div, #blocklyDiv, .ace_content'
        );
        const studentWork = blocklyEl
            ? `[Blocs utilisés: ${document.querySelectorAll('.blocklyDraggable').length}] ` +
            (blocklyEl.innerText?.trim()?.slice(0, 300) || '')
            : (document.querySelector('.ace_content')?.innerText?.trim()?.slice(0, 500) || '');

        // Instructions de l'activité (pour l'IA)
        const instructionsEl = document.querySelector(
            '.instructions-markdown, .uitest-topInstructions-instructions, ' +
            '.instructions p, .level-instructions'
        );
        const activityInstructions = instructionsEl?.innerText?.trim()?.slice(0, 300) || '';

        return {
            type: 'LEVEL_PROGRESS',
            site: 'code.org',
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
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return null;
    }
}

// =========================================================
//  Détecteur générique (pour autres sites)
//  Extrait le titre de l'activité pour analyse IA
// =========================================================
function detectGeneric() {
    try {
        const titleEl = document.querySelector('h1, [role="heading"][aria-level="1"], .exercise-title, .activity-title');
        const title = titleEl?.innerText?.trim() || document.title?.slice(0, 100) || '';

        if (!title || title.length < 3) return null;

        // Contenu du travail de l'élève (éditeur de code ou zone de texte)
        const editorEl = document.querySelector(
            '.ace_content, .CodeMirror-code, textarea.student-answer, ' +
            '[contenteditable="true"], #student-work'
        );
        const studentWork = editorEl?.innerText?.trim()?.slice(0, 500) || '';

        return {
            type: 'ACTIVITY_DETECTED',
            site: location.hostname,
            activityTitle: title,
            studentWork,
            url: location.href,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return null;
    }
}

// =========================================================
//  Sélectionne le bon détecteur selon le site
// =========================================================
function detectCurrentSite() {
    const host = location.hostname;

    if (host.includes('codecombat.com')) return detectCodeCombat();
    if (host.includes('code.org')) return detectCodeOrg();

    return detectGeneric();
}

// =========================================================
//  Envoi périodique à background.js
// =========================================================
function sendPedagogyUpdate() {
    const data = detectCurrentSite();
    if (!data) return;

    // Éviter d'envoyer les mêmes données en boucle
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSentData) return;
    lastSentData = dataStr;

    chrome.runtime.sendMessage({ type: 'PEDAGOGY_UPDATE', data }).catch(() => { });
}

// Démarrage immédiat puis toutes les 10 secondes
sendPedagogyUpdate();
setInterval(sendPedagogyUpdate, PEDAGOGY_INTERVAL);

// Écouter les changements de page (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastSentData = null; // reset pour re-envoyer sur la nouvelle page
        setTimeout(sendPedagogyUpdate, 2000); // attendre que la page charge
    }
}).observe(document.documentElement, { subtree: true, childList: true });
