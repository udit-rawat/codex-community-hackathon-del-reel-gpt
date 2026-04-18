const els = {
  title: document.querySelector("#title"),
  summary: document.querySelector("#summary"),
  hook: document.querySelector("#hook"),
  concept1: document.querySelector("#concept_1"),
  concept2: document.querySelector("#concept_2"),
  takeaway: document.querySelector("#takeaway_cta"),
  themeGrid: document.querySelector("#theme-grid"),
  beatList: document.querySelector("#beat-list"),
  saveBeatsBtn: document.querySelector("#save-beats-btn"),
  generateBeatsBtn: document.querySelector("#generate-beats-btn"),
  newProjectBtn: document.querySelector("#new-project-btn"),
  duplicateProjectBtn: document.querySelector("#duplicate-project-btn"),
  loadProjectBtn: document.querySelector("#load-project-btn"),
  projectSelect: document.querySelector("#project-select"),
  currentProjectId: document.querySelector("#current-project-id"),
  projectMeta: document.querySelector("#project-meta"),
  video: document.querySelector("#video"),
  downloadVideo: document.querySelector("#download-video"),
  heuristics: document.querySelector("#heuristics"),
  statusPill: document.querySelector("#status-pill"),
  statusText: document.querySelector("#status-text"),
  nextTaskText: document.querySelector("#next-task-text"),
  jobProgress: document.querySelector("#job-progress"),
  jobSessions: document.querySelector("#job-sessions"),
  renderMeta: document.querySelector("#render-meta"),
  wordTimingState: document.querySelector("#word-timing-state"),
  pipelineLog: document.querySelector("#pipeline-log"),
  topicForm: document.querySelector("#topic-form"),
  renderBtn: document.querySelector("#render-btn"),
};

let state = {
  projectId: null,
  project: null,
  projects: [],
  topic: {},
  theme: "deep_winter",
  themes: {},
};
let runPollTimer = null;
let uiErrorHint = "";

function setStatus(label, detail) {
  els.statusPill.textContent = label;
  els.statusText.textContent = detail;
}

function setPanelOpen(panelBodyId, open) {
  const panelBody = document.getElementById(panelBodyId);
  if (!panelBody) {
    return;
  }
  panelBody.classList.toggle("is-collapsed", !open);
  const toggle = document.querySelector(`.panel-toggle[data-target="${panelBodyId}"]`);
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Collapse" : "Expand";
  }
}

function initPanelToggles() {
  document.querySelectorAll(".panel-toggle").forEach((toggle) => {
    const panelBodyId = toggle.dataset.target;
    if (!panelBodyId) {
      return;
    }
    setPanelOpen(panelBodyId, false);
    toggle.addEventListener("click", () => {
      const panelBody = document.getElementById(panelBodyId);
      const shouldOpen = Boolean(panelBody?.classList.contains("is-collapsed"));
      setPanelOpen(panelBodyId, shouldOpen);
    });
  });
}

function setRunControlsDisabled(disabled) {
  const submitBtn = els.topicForm.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = disabled;
  els.renderBtn.disabled = disabled;
  els.saveBeatsBtn.disabled = disabled;
  els.generateBeatsBtn.disabled = disabled;
  els.newProjectBtn.disabled = disabled;
  els.duplicateProjectBtn.disabled = disabled;
  els.loadProjectBtn.disabled = disabled;
  els.projectSelect.disabled = disabled;
  document.querySelectorAll(".beat-generate-btn").forEach((button) => {
    button.disabled = disabled;
  });
}

function startRunPolling() {
  if (runPollTimer) {
    clearInterval(runPollTimer);
  }
  runPollTimer = window.setInterval(async () => {
    try {
      const response = await fetch("/api/run-status");
      const data = await response.json();
      applyState(data);

      const job = data.job || {};
      if (!job.active) {
        clearInterval(runPollTimer);
        runPollTimer = null;
        if (job.completed && job.success) {
          if (job.kind === "render") {
            setStatus("Rendered", "Video render complete.");
          } else if (job.kind === "generate-script") {
            setStatus("Draft Ready", "Review narration, then render.");
          } else if (job.kind === "generate-beat-assets") {
            setStatus("Assets Ready", "Motion assets updated.");
          }
        } else if (job.completed && !job.success) {
          setStatus("Failed", `${job.failedStage || job.kind || "Pipeline"} failed. Inspect log.`);
        }
      } else {
        setStatus("Running", job.currentStage ? `Stage: ${job.currentStage}` : "Pipeline running.");
      }
    } catch (error) {
      clearInterval(runPollTimer);
      runPollTimer = null;
      setStatus("Offline", "Polling failed.");
      uiErrorHint = `Live status polling failed: ${String(error)}`;
      renderHeuristics(state, uiErrorHint);
    }
  }, 1000);
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

function beatStatusClass(status) {
  if (status === "ready" || status === "pending" || status === "failed") {
    return status;
  }
  return "";
}

function assetUrl(path) {
  if (!path) {
    return "";
  }
  return `/${String(path).replace(/\\/g, "/")}`;
}

function assetLinks(beat) {
  const links = [];
  if (beat.assets?.video_asset?.path) {
    links.push(`<a class="beat-asset-link" href="${assetUrl(beat.assets.video_asset.path)}" target="_blank" rel="noreferrer">Video</a>`);
  }
  if (beat.assets?.thumbnail_asset?.path) {
    links.push(`<a class="beat-asset-link" href="${assetUrl(beat.assets.thumbnail_asset.path)}" target="_blank" rel="noreferrer">Thumbnail</a>`);
  }
  if (beat.assets?.spritesheet_asset?.path) {
    links.push(`<a class="beat-asset-link" href="${assetUrl(beat.assets.spritesheet_asset.path)}" target="_blank" rel="noreferrer">Spritesheet</a>`);
  }
  return links.join("");
}

function renderBeats(project) {
  els.beatList.innerHTML = "";
  if (!project || !Array.isArray(project.beats) || project.beats.length === 0) {
    els.projectMeta.textContent = "No beat data yet. Generate a script first.";
    return;
  }

  els.projectMeta.textContent = `Project ${project.project_id} · ${project.beats.length} beats · theme ${project.theme_name}`;

  project.beats.forEach((beat) => {
    const article = document.createElement("article");
    article.className = "beat-card";
    article.dataset.beatId = beat.id;
    article.innerHTML = `
      <div class="beat-top">
        <div>
          <h3 class="beat-title">${beat.title}</h3>
          <p class="beat-subtitle">${beat.id} · segment ${beat.narration_segment}</p>
        </div>
        <span class="beat-status ${beatStatusClass(beat.assets?.status)}">${beat.assets?.status || "not_requested"}</span>
      </div>
      <div class="beat-meta">
        <div class="beat-kv">
          <span>Template</span>
          <strong>${beat.scene_template || "n/a"}</strong>
        </div>
        <div class="beat-kv">
          <span>Duration</span>
          <strong>${beat.duration_seconds ? `${beat.duration_seconds}s` : "n/a"}</strong>
        </div>
        <div class="beat-kv">
          <span>Theme</span>
          <strong>${beat.theme || project.theme_name}</strong>
        </div>
      </div>
      <div class="mode-group">
        ${["infographic", "animation", "hybrid"].map((mode) => `
          <button type="button" class="mode-pill ${beat.mode === mode ? "active" : ""}" data-mode="${mode}">${mode}</button>
        `).join("")}
      </div>
      <label>
        <span>Animation Prompt</span>
        <textarea class="beat-prompt" rows="3" placeholder="Future Sora prompt for this beat...">${beat.assets?.prompt || ""}</textarea>
      </label>
      <div class="check-row">
        <label><input class="beat-overlay" type="checkbox" ${beat.overlay_enabled ? "checked" : ""} /> Overlay enabled</label>
        <label><input class="beat-cutout" type="checkbox" ${beat.cutout_enabled ? "checked" : ""} /> Cutout enabled</label>
      </div>
      <div class="beat-actions">
        <button type="button" class="ghost beat-generate-btn">Generate This Beat</button>
        ${beat.assets?.sora_job_id ? `<span class="beat-job">job ${beat.assets.sora_job_id}</span>` : `<span class="beat-job">No Sora job yet</span>`}
      </div>
      ${beat.assets?.thumbnail_asset?.path ? `<img class="beat-thumb" src="${assetUrl(beat.assets.thumbnail_asset.path)}" alt="${beat.title} preview" />` : ""}
      ${assetLinks(beat) ? `<div class="beat-assets">${assetLinks(beat)}</div>` : ""}
      ${beat.assets?.last_error ? `<p class="beat-error">${beat.assets.last_error}</p>` : ""}
    `;

    article.querySelectorAll(".mode-pill").forEach((button) => {
      button.addEventListener("click", () => {
        article.querySelectorAll(".mode-pill").forEach((pill) => pill.classList.remove("active"));
        button.classList.add("active");
        if (button.dataset.mode === "infographic") {
          const promptInput = article.querySelector(".beat-prompt");
          if (promptInput) {
            promptInput.value = "";
          }
        }
      });
    });
    article.querySelector(".beat-generate-btn")?.addEventListener("click", () => {
      generateBeatAssets(beat.id);
    });

    els.beatList.appendChild(article);
  });
}

function collectBeatUpdates() {
  return [...document.querySelectorAll(".beat-card")].map((card) => ({
    id: card.dataset.beatId,
    mode: card.querySelector(".mode-pill.active")?.dataset.mode || "infographic",
    prompt: card.querySelector(".beat-prompt")?.value.trim() || "",
    overlay_enabled: Boolean(card.querySelector(".beat-overlay")?.checked),
    cutout_enabled: Boolean(card.querySelector(".beat-cutout")?.checked),
  }));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function currentTopicMatchesInputs(title, summary) {
  const currentTitle = normalizeText(state.topic?.title);
  const currentSummary = normalizeText(state.topic?.summary);
  return currentTitle === normalizeText(title) && currentSummary === normalizeText(summary);
}

function activeProjectIdForTopic(title, summary) {
  if (!state.projectId) {
    return "";
  }
  return currentTopicMatchesInputs(title, summary) ? state.projectId : "";
}

function renderProjectSelector(projects, currentProjectId) {
  if (!els.projectSelect) {
    return;
  }
  const sorted = Array.isArray(projects) ? projects : [];
  els.projectSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = sorted.length ? "Select a project" : "No projects yet";
  els.projectSelect.appendChild(placeholder);

  sorted.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.project_id;
    const title = String(project.title || "untitled").trim() || "untitled";
    option.textContent = `${project.project_id} · ${title}`;
    if (project.project_id === currentProjectId) {
      option.selected = true;
    }
    els.projectSelect.appendChild(option);
  });
}

function formatStageName(name) {
  return String(name || "").replaceAll("_", " ");
}

function formatKind(kind) {
  return String(kind || "pipeline").replaceAll("-", " ");
}

function renderJob(job) {
  els.jobProgress.innerHTML = "";
  if (els.nextTaskText) {
    els.nextTaskText.textContent = job?.nextTask || "Next task will appear when a run starts.";
  }
  if (!job || !Array.isArray(job.stageStates) || job.stageStates.length === 0) {
    return;
  }

  const progress = Number(job.progress || 0);
  const track = document.createElement("div");
  track.className = "job-progress-track";
  track.innerHTML = `<div class="job-progress-fill" style="width:${progress}%;"></div>`;

  const stageWrap = document.createElement("div");
  stageWrap.className = "job-stages";
  job.stageStates.forEach((stage) => {
    const row = document.createElement("div");
    row.className = `job-stage ${stage.status || "pending"}`;
    row.innerHTML = `
      <span class="job-stage-dot"></span>
      <span>${formatStageName(stage.name)}</span>
      <strong>${stage.status}</strong>
    `;
    stageWrap.appendChild(row);
  });

  els.jobProgress.appendChild(track);
  els.jobProgress.appendChild(stageWrap);
}

function renderJobSessions(sessions = []) {
  if (!els.jobSessions) {
    return;
  }
  els.jobSessions.innerHTML = "";
  if (!Array.isArray(sessions) || sessions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "session-empty";
    empty.textContent = "No sessions yet.";
    els.jobSessions.appendChild(empty);
    return;
  }

  sessions.slice(0, 3).forEach((session) => {
    const card = document.createElement("article");
    const status = session.active
      ? "running"
      : session.completed && session.success
      ? "success"
      : session.completed && !session.success
      ? "failed"
      : "idle";
    card.className = `session-card ${status}`;

    const progress = Number(session.progress || 0);
    const sessionId = session.sessionId || "run";
    const stageLabel = session.currentStage
      ? `Current: ${formatStageName(session.currentStage)}`
      : session.failedStage
      ? `Failed: ${formatStageName(session.failedStage)}`
      : session.completed
      ? "Completed"
      : "Pending";

    card.innerHTML = `
      <div class="session-head">
        <strong>${formatKind(session.kind)}</strong>
        <span>${sessionId}</span>
      </div>
      <div class="session-progress-track"><div class="session-progress-fill" style="width:${progress}%;"></div></div>
      <p class="session-meta">${progress}% · ${stageLabel}</p>
      <p class="session-next">${session.nextTask || "No next task available."}</p>
    `;

    if (Array.isArray(session.stageStates) && session.stageStates.length) {
      const stageWrap = document.createElement("div");
      stageWrap.className = "session-stages";
      session.stageStates.forEach((stage) => {
        const row = document.createElement("div");
        row.className = `job-stage ${stage.status || "pending"}`;
        row.innerHTML = `
          <span class="job-stage-dot"></span>
          <span>${formatStageName(stage.name)}</span>
          <strong>${stage.status}</strong>
        `;
        stageWrap.appendChild(row);
      });
      card.appendChild(stageWrap);
    }

    els.jobSessions.appendChild(card);
  });
}

function renderHeuristics(nextState, fallbackHint = "") {
  if (!els.heuristics) {
    return;
  }
  const lines = [];
  const project = nextState.project || null;
  const job = nextState.job || {};
  const beats = Array.isArray(project?.beats) ? project.beats : [];
  const animationBeats = beats.filter((beat) => beat.mode === "animation" || beat.mode === "hybrid");
  const readyAnimationBeats = animationBeats.filter((beat) => beat.assets?.status === "ready");
  const failedAnimationBeats = animationBeats.filter((beat) => beat.assets?.status === "failed");

  if (!nextState.projectId) {
    lines.push("No active project loaded in this session. Start with New Project and Generate Script.");
  } else {
    lines.push(`Active project: ${nextState.projectId}.`);
    lines.push(`Beat mix: ${beats.length} total, ${animationBeats.length} motion-enabled, ${readyAnimationBeats.length} ready.`);
  }

  if (job.active) {
    lines.push(`Pipeline is running now: ${formatStageName(job.currentStage || job.kind || "stage")}.`);
    if (job.nextTask) {
      lines.push(`Next expected step: ${job.nextTask}`);
    }
  } else if (job.completed && job.success) {
    lines.push(`Last run succeeded (${formatKind(job.kind || "pipeline")}).`);
    if (job.nextTask) {
      lines.push(`Recommended action: ${job.nextTask}`);
    }
  } else if (job.completed && !job.success) {
    lines.push(`Last run failed at ${formatStageName(job.failedStage || job.kind || "pipeline")}.`);
    lines.push("Action: review the pipeline log, fix inputs/env, and rerun the failed stage.");
  } else {
    lines.push("No run in progress.");
  }

  if (failedAnimationBeats.length > 0) {
    const failedIds = failedAnimationBeats.map((beat) => beat.id).join(", ");
    lines.push(`Motion assets failed on: ${failedIds}. Regenerate those beats before rendering.`);
  }

  if (animationBeats.length > 0 && readyAnimationBeats.length < animationBeats.length) {
    lines.push("Some motion beats are not ready yet. Generate beat assets before final render.");
  } else if (animationBeats.length > 0 && readyAnimationBeats.length === animationBeats.length) {
    lines.push("All motion-enabled beats are ready for render.");
  }

  if (nextState.videoUrl) {
    lines.push("Rendered output is available in the preview panel.");
  }

  if (fallbackHint) {
    lines.push(fallbackHint);
  } else if (uiErrorHint) {
    lines.push(uiErrorHint);
  }

  els.heuristics.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
}

function applyState(nextState, fallbackLog = "") {
  state = nextState;
  const topic = nextState.topic || {};
  state.topic = topic;
  state.projects = Array.isArray(nextState.projects) ? nextState.projects : [];
  const script = nextState.script || {};

  if (topic.title) {
    els.title.value = topic.title;
  }
  if (topic.summary) {
    els.summary.value = topic.summary;
  }

  applyScript(script);
  renderThemes(nextState.themes || {}, nextState.theme || "deep_winter");
  renderBeats(nextState.project);
  renderProjectSelector(state.projects, nextState.projectId);
  renderJob(nextState.job);
  renderJobSessions(nextState.jobSessions || (nextState.job ? [nextState.job] : []));
  renderHeuristics(nextState, fallbackLog);
  setRunControlsDisabled(Boolean(nextState.job?.active));

  if (nextState.videoUrl) {
    els.video.src = nextState.videoUrl;
    els.renderMeta.textContent = `Rendered video ready. Theme: ${nextState.theme}.`;
    if (els.downloadVideo) {
      els.downloadVideo.href = nextState.videoUrl;
      els.downloadVideo.style.pointerEvents = "auto";
      els.downloadVideo.style.opacity = "1";
    }
  } else {
    els.video.removeAttribute("src");
    els.video.load();
    els.renderMeta.textContent = "No render loaded yet.";
    if (els.downloadVideo) {
      els.downloadVideo.removeAttribute("href");
      els.downloadVideo.style.pointerEvents = "none";
      els.downloadVideo.style.opacity = "0.55";
    }
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

  if (nextState.projectId) {
    els.currentProjectId.textContent = `Current project: ${nextState.projectId}`;
    els.renderMeta.textContent = nextState.videoUrl
      ? `Rendered video ready. Theme: ${nextState.theme}. Project: ${nextState.projectId}.`
      : `Current project: ${nextState.projectId}`;
  } else {
    els.currentProjectId.textContent = "Current project: none";
  }
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
  if (data.job?.active) {
    startRunPolling();
  }
}

async function generateBeatAssets(beatId = "") {
  if (!state.projectId) {
    setStatus("No Project", "Generate a script first so beats exist.");
    return;
  }
  setStatus("Generating", beatId ? `Running Sora for ${beatId}.` : "Running Sora for animation and hybrid beats.");
  try {
    const data = await postJSON("/api/generate-beat-assets", {
      projectId: state.projectId,
      beatId,
      beats: collectBeatUpdates(),
    });
    applyState(data);
    setPanelOpen("script-panel-body", true);
    startRunPolling();
    setStatus("Running", beatId ? `Generating assets for ${beatId}.` : "Generating motion assets.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Motion asset generation failed. Inspect log.");
  }
}

async function createNewProject() {
  const title = els.title.value.trim() || "project";
  const summary = els.summary.value.trim();
  setStatus("Creating", "Creating a fresh project.");
  try {
    const data = await postJSON("/api/new-project", {
      title,
      summary,
      theme: state.theme,
    });
    applyState(data);
    setStatus("Ready", "Fresh project created and loaded.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "New project creation failed.");
  }
}

async function duplicateCurrentProject() {
  if (!state.projectId) {
    setStatus("No Project", "Load a project first, then duplicate.");
    return;
  }
  const title = `${els.title.value.trim() || state.topic?.title || "project"} copy`;
  const summary = els.summary.value.trim();
  setStatus("Duplicating", "Creating project duplicate.");
  try {
    const data = await postJSON("/api/duplicate-project", {
      sourceProjectId: state.projectId,
      title,
      summary,
      theme: state.theme,
    });
    applyState(data);
    setStatus("Ready", "Duplicate project created and loaded.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Duplicate project creation failed.");
  }
}

async function loadSelectedProject() {
  const projectId = String(els.projectSelect.value || "").trim();
  if (!projectId) {
    setStatus("No Selection", "Select a project to load.");
    return;
  }
  setStatus("Loading", `Loading ${projectId}.`);
  try {
    const data = await postJSON("/api/load-project", { projectId });
    applyState(data);
    setStatus("Loaded", `Project ${projectId} loaded.`);
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Project load failed.");
  }
}

els.topicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = els.title.value.trim();
  const summary = els.summary.value.trim();
  setStatus("Running", "Generating draft script from current topic.");
  try {
    const data = await postJSON("/api/generate-script", {
      projectId: activeProjectIdForTopic(title, summary),
      title,
      summary,
      theme: state.theme,
    });
    applyState(data);
    setPanelOpen("beats-panel-body", true);
    startRunPolling();
    setStatus("Running", "Generating draft script from current topic.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Script generation failed. Inspect log.");
  }
});

els.renderBtn.addEventListener("click", async () => {
  const title = els.title.value.trim();
  const summary = els.summary.value.trim();
  setPanelOpen("result-panel-body", true);
  setStatus("Rendering", "Running full pipeline with reviewed narration.");
  try {
    const data = await postJSON("/api/render", {
      projectId: activeProjectIdForTopic(title, summary),
      title,
      summary,
      theme: state.theme,
      script: {
        hook: els.hook.value.trim(),
        concept_1: els.concept1.value.trim(),
        concept_2: els.concept2.value.trim(),
        takeaway_cta: els.takeaway.value.trim(),
      },
    });
    applyState(data);
    startRunPolling();
    setStatus("Running", "Rendering final video.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Render failed. Inspect log.");
  }
});

els.saveBeatsBtn.addEventListener("click", async () => {
  if (!state.projectId) {
    setStatus("No Project", "Generate a script first so beats exist.");
    return;
  }
  setStatus("Saving", "Persisting beat modes and prompts.");
  try {
    const data = await postJSON("/api/project-beats", {
      projectId: state.projectId,
      beats: collectBeatUpdates(),
    });
    applyState(data);
    setStatus("Saved", "Beat config updated.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Beat config save failed.");
  }
});

els.generateBeatsBtn.addEventListener("click", async () => {
  await generateBeatAssets();
});

els.newProjectBtn.addEventListener("click", async () => {
  await createNewProject();
});

els.duplicateProjectBtn.addEventListener("click", async () => {
  await duplicateCurrentProject();
});

els.loadProjectBtn.addEventListener("click", async () => {
  await loadSelectedProject();
});

initPanelToggles();

refresh().catch((error) => {
  setStatus("Offline", "UI failed to load state.");
  uiErrorHint = String(error);
  renderHeuristics(state, uiErrorHint);
});
