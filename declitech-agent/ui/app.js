function fmt(dt){
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}
function ftime(dt){
  try { return new Date(dt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch { return '--:--'; }
}

// 1 décimale en %
function pct1(x){
  return Math.round((Number(x) || 0) * 1000) / 10; // ex: 0.5429 => 54.3
}

function buildUI(report){
  // ----------------------------
  // Header identity
  // ----------------------------
  const name = report.studentLoginIdentity || report.participantId || "Student";
  document.getElementById("studentName").textContent = name;

  document.getElementById("studentSub").textContent =
    `Session: ${report.sessionId} • Participant: ${report.participantId} • Generated: ${fmt(report.generatedAt)}`;

  // ----------------------------
  // ✅ MEAN PROBS -> BAR + CHIPS (7 emotions)
  // ----------------------------
  const mean = report.summaryMean?.mean_probs || {};

  // ordre + couleurs (tu peux modifier)
  const chips = [
    { label: 'Angry',    key: 'angry',    cls: 'c-red'   },
    { label: 'Disgust',  key: 'disgust',  cls: 'c-yellow'},
    { label: 'Fear',     key: 'fear',     cls: 'c-blue'  },
    { label: 'Happy',    key: 'happy',    cls: 'c-teal'  },
    { label: 'Sad',      key: 'sad',      cls: 'c-blue'  },
    { label: 'Surprise', key: 'surprise', cls: 'c-yellow'},
    { label: 'Neutral',  key: 'neutral',  cls: 'c-green' }
  ].map(x => ({
    ...x,
    p: pct1(mean[x.key])
  }));

  // total en %
  const total = chips.reduce((s, c) => s + c.p, 0) || 100;

  // BAR
  const bar = document.getElementById("bar");
  bar.innerHTML = "";
  for(const c of chips){
    const seg = document.createElement("div");
    seg.className = `seg ${c.cls}`;
    seg.style.width = `${(c.p / total) * 100}%`;
    seg.title = `${c.label}: ${c.p}%`; // tooltip
    bar.appendChild(seg);
  }

  // CHIPS
  const chipsDiv = document.getElementById("chips");
  chipsDiv.innerHTML = "";
  for(const c of chips){
    const div = document.createElement("div");
    div.className = `chip ${c.cls}`;
    div.innerHTML = `<span class="pill-dot"></span>${c.label} (${c.p}%)`;
    chipsDiv.appendChild(div);
  }

 // ----------------------------
// ✅ Behavior Intelligence Log
// → afficher UNIQUEMENT final_sentence
// ----------------------------
const logsDiv = document.getElementById("logs");
logsDiv.innerHTML = "";

const sentence = report.finalState?.final_sentence || "Aucune conclusion disponible.";
const state = report.finalState?.state || "";

// Choix du style selon l’état
let sev = "info";
if (state.includes("SATISFAIT")) sev = "success";
else if (state.includes("CONFUS") || state.includes("DIFFICULTE")) sev = "warn";
else if (state.includes("FRUSTRE") || state.includes("STRESSE")) sev = "danger";

const d = document.createElement("div");
d.className = `log ${sev}`;
d.innerHTML = `
  <div class="log-left">
    <div class="log-title">Session Summary</div>
    <div class="log-desc">${sentence}</div>
  </div>
  <div class="log-right">
    <div class="time">${ftime(report.generatedAt)}</div>
  </div>
`;
logsDiv.appendChild(d);


  // ----------------------------
  // ✅ Footer: show state + sentence
  // ----------------------------
  document.getElementById("footer").innerHTML =
    `<div><b>Generated:</b> ${fmt(report.generatedAt)}</div>
     <div><b>Final State:</b> ${report.finalState?.state || 'N/A'} — ${report.finalState?.final_sentence || ''}</div>`;
}

async function load(){
  const res = await fetch("/report");
  const data = await res.json();
  buildUI(data);
}

document.getElementById("btnReload").addEventListener("click", load);

document.getElementById("btnExport").addEventListener("click", () => {
  alert("Export PDF (à brancher plus tard)");
});

load();
