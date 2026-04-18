const els = {
  title: document.querySelector("#title"),
  summary: document.querySelector("#summary"),
  hook: document.querySelector("#hook"),
  concept1: document.querySelector("#concept_1"),
  concept2: document.querySelector("#concept_2"),
  takeaway: document.querySelector("#takeaway_cta"),
  themeGrid: document.querySelector("#theme-grid"),
  video: document.querySelector("#video"),
  logOutput: document.querySelector("#log-output"),
  statusPill: document.querySelector("#status-pill"),
  statusText: document.querySelector("#status-text"),
  renderMeta: document.querySelector("#render-meta"),
  wordTimingState: document.querySelector("#word-timing-state"),
  pipelineLog: document.querySelector("#pipeline-log"),
  topicForm: document.querySelector("#topic-form"),
  renderBtn: document.querySelector("#render-btn"),
};

let state = {
  theme: "deep_winter",
  themes: {},
};

function setStatus(label, detail) {
  els.statusPill.textContent = label;
  els.statusText.textContent = detail;
}

function applyScript(script = {}) {
  els.hook.value = script.hook || "";
  els.concept1.value = script.concept_1 || "";
  els.concept2.value = script.concept_2 || "";
  els.takeaway.value = script.takeaway_cta || "";
}

function pickTheme(themeName) {
  state.theme = themeName;
  document.querySelectorAll(".theme-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.theme === themeName);
  });
}

function renderThemes(themes, activeTheme) {
  els.themeGrid.innerHTML = "";
  Object.entries(themes).forEach(([key, meta]) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "theme-card";
    card.dataset.theme = key;
    card.innerHTML = `
      <div class="theme-preview" style="background: linear-gradient(180deg, ${meta.bg} 0%, rgba(15,23,42,0.92) 100%); color: white;">
        <div class="mini-label">${meta.label}</div>
        <div class="mini-number" style="color:${meta.accent};">42%</div>
        <div class="mini-label">${meta.description}</div>
      </div>
      <div class="theme-swatches">
        <span class="swatch" style="background:${meta.accent};"></span>
        <span class="swatch" style="background:${meta.bg};"></span>
      </div>
    `;
    card.addEventListener("click", () => pickTheme(key));
    els.themeGrid.appendChild(card);
  });
  pickTheme(activeTheme);
}

function applyState(nextState, fallbackLog = "") {
  state = nextState;
  const topic = nextState.topic || {};
  const script = nextState.script || {};

  if (topic.title) {
    els.title.value = topic.title;
  }
  if (topic.summary) {
    els.summary.value = topic.summary;
  }

  applyScript(script);
  renderThemes(nextState.themes || {}, nextState.theme || "deep_winter");

  if (nextState.videoUrl) {
    els.video.src = nextState.videoUrl;
    els.renderMeta.textContent = `Rendered video ready. Theme: ${nextState.theme}.`;
  } else {
    els.video.removeAttribute("src");
    els.video.load();
    els.renderMeta.textContent = "No render loaded yet.";
  }

  if (nextState.pipelineLogUrl) {
    els.pipelineLog.href = nextState.pipelineLogUrl;
    els.pipelineLog.style.pointerEvents = "auto";
    els.pipelineLog.style.opacity = "1";
  } else {
    els.pipelineLog.removeAttribute("href");
    els.pipelineLog.style.pointerEvents = "none";
    els.pipelineLog.style.opacity = "0.5";
  }

  els.wordTimingState.textContent = nextState.hasWordTimings
    ? "Word-level alignment active."
    : "Segment-level timing only. Install `openai-whisper` for word cues.";

  els.logOutput.textContent = nextState.log || fallbackLog || "No run log yet.";
}

async function postJSON(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = data.error || data.log || `Request failed: ${response.status}`;
    throw { message: error, data };
  }
  return data;
}

async function refresh() {
  const response = await fetch("/api/state");
  const data = await response.json();
  applyState(data);
}

els.topicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Running", "Generating draft script from current topic.");
  try {
    const data = await postJSON("/api/generate-script", {
      title: els.title.value.trim(),
      summary: els.summary.value.trim(),
      theme: state.theme,
    });
    applyState(data);
    setStatus("Draft Ready", "Review narration, then render.");
  } catch (error) {
    applyState(error.data || state, error.message);
    setStatus("Failed", "Script generation failed. Inspect log.");
  }
});

els.renderBtn.addEventListener("click", async () => {
  setStatus("Rendering", "Running full pipeline with reviewed narration.");
  try {
    const data = await postJSON("/api/render", {
      title: els.title.value.trim(),
      summary: els.summary.value.trim(),
      theme: state.theme,
      script: {
        hook: els.hook.value.trim(),
        concept_1: els.concept1.value.trim(),
        concept_2: els.concept2.value.trim(),
        takeaway_cta: els.takeaway.value.trim(),
      },
    });
    applyState(data);
    setStatus("Rendered", "Video render complete.");
  } catch (error) {
    applyState(error.data || state, error.message);
    setStatus("Failed", "Render failed. Inspect log.");
  }
});

refresh().catch((error) => {
  setStatus("Offline", "UI failed to load state.");
  els.logOutput.textContent = String(error);
});
