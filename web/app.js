const els = {
  title: document.querySelector("#title"),
  summary: document.querySelector("#summary"),
  hook: document.querySelector("#hook"),
  concept1: document.querySelector("#concept_1"),
  concept2: document.querySelector("#concept_2"),
  takeaway: document.querySelector("#takeaway_cta"),
  themeGrid: document.querySelector("#theme-grid"),
  customBg: document.querySelector("#custom-bg"),
  customAccent: document.querySelector("#custom-accent"),
  customText: document.querySelector("#custom-text"),
  swatchBg: document.querySelector("#swatch-bg"),
  swatchAccent: document.querySelector("#swatch-accent"),
  swatchText: document.querySelector("#swatch-text"),
  saveCustomThemeBtn: document.querySelector("#save-custom-theme-btn"),
  resetCustomThemeBtn: document.querySelector("#reset-custom-theme-btn"),
  templateEditor: document.querySelector("#template-editor"),
  beatList: document.querySelector("#beat-list"),
  saveBeatsBtn: document.querySelector("#save-beats-btn"),
  generateBeatsBtn: document.querySelector("#generate-beats-btn"),
  newProjectBtn: document.querySelector("#new-project-btn"),
  duplicateProjectBtn: document.querySelector("#duplicate-project-btn"),
  demoFlowBtn: document.querySelector("#demo-flow-btn"),
  demoBeatBtn: document.querySelector("#demo-beat-btn"),
  loadProjectBtn: document.querySelector("#load-project-btn"),
  projectSelect: document.querySelector("#project-select"),
  currentProjectId: document.querySelector("#current-project-id"),
  projectMeta: document.querySelector("#project-meta"),
  resultVideoPane: document.querySelector("#result-video-pane"),
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
  costTotal: document.querySelector("#cost-total"),
  costLines: document.querySelector("#cost-lines"),
  costNote: document.querySelector("#cost-note"),
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
let runPollInFlight = false;
let uiErrorHint = "";
let activeCustomTheme = { bg: "", accent: "", text: "" };

const DEMO_FLOW = {
  title: "AI agents in production: from demos to reliable workflows",
  summary: [
    "Teams are moving from simple chatbots to production agent systems that can plan tasks, call tools, and iterate toward outcomes.",
    "The biggest shift is reliability engineering: guardrails, retries, structured outputs, and human review checkpoints before agents touch business workflows.",
    "Winning teams use hybrid orchestration: deterministic code handles critical path logic, while agents handle interpretation and drafting.",
    "Latency and cost are managed by routing easy requests to smaller models and escalating only complex work.",
  ].join(" "),
  script: {
    hook: "AI agents are leaving demo mode.",
    concept_1: "Production teams now wrap agents with guardrails, retries, and structured outputs before they touch real workflows.",
    concept_2: "The winning pattern is hybrid: code owns the critical path, agents handle interpretation and drafting.",
    takeaway_cta: "Treat agents like software systems. Log them, evaluate them, and keep rollback ready.",
  },
  theme: "graphite_lime",
  motionBeatId: "beat_2",
  motionPrompt: "Silent cinematic footage of an AI operations room: dashboards, tool-call traces, approval gates, and green status lights. Slow forward camera move. No people, no text, no logos, no sound. Keep clean negative space for overlay graphics.",
};

const PRICING = {
  checkedAt: "2026-04-18",
  sourceUrl: "https://platform.openai.com/docs/pricing",
  text: {
    "gpt-5": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
    "gpt-5.4": { inputPerMillion: 2.5, outputPerMillion: 15.0 },
    "gpt-5.4-mini": { inputPerMillion: 0.75, outputPerMillion: 4.5 },
    "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
    "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  ttsPerMinute: {
    "gpt-4o-mini-tts": 0.015,
  },
  soraPerSecond: {
    "sora-2": { "720x1280": 0.1, "1280x720": 0.1 },
    "sora-2-pro": {
      "720x1280": 0.3,
      "1280x720": 0.3,
      "1024x1792": 0.5,
      "1792x1024": 0.5,
      "1080x1920": 0.7,
      "1920x1080": 0.7,
    },
  },
};

function setStatus(label, detail) {
  els.statusPill.textContent = label;
  els.statusText.textContent = detail;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidCssColor(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  return CSS.supports("color", raw);
}

function applyCustomThemePreview(theme) {
  const next = {
    bg: String(theme?.bg || "").trim(),
    accent: String(theme?.accent || "").trim(),
    text: String(theme?.text || "").trim(),
  };
  activeCustomTheme = next;

  const bg = isValidCssColor(next.bg) ? next.bg : "";
  const accent = isValidCssColor(next.accent) ? next.accent : "";
  const text = isValidCssColor(next.text) ? next.text : "";

  els.swatchBg.style.background = bg || "rgba(148,163,184,0.28)";
  els.swatchAccent.style.background = accent || "rgba(148,163,184,0.28)";
  els.swatchText.style.background = text || "rgba(148,163,184,0.28)";

  if (state.themes && Object.keys(state.themes).length > 0) {
    renderThemes(state.themes, state.theme);
  }
}

function fillCustomThemeInputs(theme) {
  const payload = {
    bg: String(theme?.bg || "").trim(),
    accent: String(theme?.accent || "").trim(),
    text: String(theme?.text || "").trim(),
  };
  els.customBg.value = payload.bg;
  els.customAccent.value = payload.accent;
  els.customText.value = payload.text;
  applyCustomThemePreview(payload);
}

function readCustomThemeInputs() {
  return {
    bg: els.customBg.value.trim(),
    accent: els.customAccent.value.trim(),
    text: els.customText.value.trim(),
  };
}

function validateCustomThemeForRender() {
  const payload = readCustomThemeInputs();
  const hasAny = Boolean(payload.bg || payload.accent || payload.text);
  if (!hasAny) {
    return { customTheme: payload };
  }
  if (!payload.bg || !payload.accent || !payload.text) {
    throw new Error("Custom theme needs background, accent, and text before render.");
  }
  if (!isValidCssColor(payload.bg) || !isValidCssColor(payload.accent) || !isValidCssColor(payload.text)) {
    throw new Error("Custom theme has invalid CSS colors. Use hex, rgb, hsl, or color names.");
  }
  return { customTheme: payload };
}

function initCustomCursorAndGlow() {
  const glow = document.getElementById("cursor-glow");
  if (!glow) {
    return;
  }
  if (window.matchMedia("(pointer: coarse)").matches) {
    glow.style.display = "none";
    return;
  }

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let glowPaused = false;

  const update = () => {
    document.documentElement.style.setProperty("--mx", `${x}px`);
    document.documentElement.style.setProperty("--my", `${y}px`);
    glow.classList.toggle("is-paused", glowPaused);
    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);

  window.addEventListener("mousemove", (event) => {
    x = event.clientX;
    y = event.clientY;
  });

  document.addEventListener("mouseover", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const insideBox = Boolean(
      target?.closest(
        ".panel, .status-card, .theme-card, .beat-card, .custom-theme, input, textarea, select, video, .heuristics, .session-card, .job-progress, .panel-body",
      ),
    );
    glowPaused = insideBox;
  });

  document.addEventListener("mouseout", (event) => {
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const stillInsideBox = Boolean(
      related?.closest(
        ".panel, .status-card, .theme-card, .beat-card, .custom-theme, input, textarea, select, video, .heuristics, .session-card, .job-progress, .panel-body",
      ),
    );
    glowPaused = stillInsideBox;
  });
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
  els.demoFlowBtn.disabled = disabled;
  els.demoBeatBtn.disabled = disabled || !state.project?.beats?.length;
  els.loadProjectBtn.disabled = disabled;
  els.projectSelect.disabled = disabled;
  document.querySelectorAll(".beat-generate-btn").forEach((button) => {
    button.disabled = disabled;
  });
}

function startRunPolling() {
  if (runPollTimer) {
    clearTimeout(runPollTimer);
  }
  runPollTimer = window.setTimeout(pollRunStatus, 0);
}

async function pollRunStatus() {
  if (runPollInFlight) {
    return;
  }

  runPollTimer = null;
  runPollInFlight = true;
  try {
    const response = await fetch(`/api/run-status?ts=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    const activeStage = data.job?.currentStage || "";
    applyState(data, "", {
      preserveScroll: true,
      statusOnly: activeStage === "animator",
    });

    const job = data.job || {};
    if (!job.active) {
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
      return;
    }

    setStatus("Running", job.currentStage ? `Stage: ${formatStageName(job.currentStage)}` : "Pipeline running.");
    runPollTimer = window.setTimeout(pollRunStatus, 1000);
  } catch (error) {
    setStatus("Offline", "Polling failed.");
    uiErrorHint = `Live status polling failed: ${String(error)}`;
    renderHeuristics(state, uiErrorHint);
    runPollTimer = window.setTimeout(pollRunStatus, 2000);
  } finally {
    runPollInFlight = false;
  }
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
  const hasCustomTheme = isValidCssColor(activeCustomTheme.bg)
    && isValidCssColor(activeCustomTheme.accent)
    && isValidCssColor(activeCustomTheme.text);
  els.themeGrid.innerHTML = "";
  Object.entries(themes).forEach(([key, meta]) => {
    const useCustomOnSelected = hasCustomTheme && key === activeTheme;
    const cardBg = useCustomOnSelected ? activeCustomTheme.bg : meta.bg;
    const cardAccent = useCustomOnSelected ? activeCustomTheme.accent : meta.accent;
    const cardLabel = useCustomOnSelected ? `${meta.label} (Custom)` : meta.label;
    const cardDescription = useCustomOnSelected
      ? "Render will use your custom color inputs."
      : meta.description;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "theme-card";
    card.dataset.theme = key;
    card.innerHTML = `
      <div class="theme-preview" style="background: linear-gradient(180deg, ${cardBg} 0%, rgba(15,23,42,0.92) 100%); color: white;">
        <div class="mini-label">${cardLabel}</div>
        <div class="mini-number" style="color:${cardAccent};">42%</div>
        <div class="mini-label">${cardDescription}</div>
      </div>
      <div class="theme-swatches">
        <span class="swatch" style="background:${cardAccent};"></span>
        <span class="swatch" style="background:${cardBg};"></span>
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

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (amount < 0.01 && amount > 0) {
    return "<$0.01";
  }
  return `$${amount.toFixed(2)}`;
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

function selectedSoraSeconds(durationSeconds) {
  const duration = Number(durationSeconds || 0);
  if (!duration) {
    return 4;
  }
  for (const allowed of [4, 8, 12]) {
    if (allowed >= duration) {
      return allowed;
    }
  }
  return 12;
}

function getBeatSnapshot() {
  const beats = Array.isArray(state.project?.beats) ? state.project.beats : [];
  const byId = new Map(beats.map((beat) => [beat.id, beat]));
  const cards = [...document.querySelectorAll(".beat-card")];
  if (!cards.length) {
    return beats;
  }

  return cards.map((card) => {
    const beat = byId.get(card.dataset.beatId) || {};
    return {
      ...beat,
      mode: card.querySelector(".mode-pill.active")?.dataset.mode || beat.mode || "infographic",
      assets: beat.assets || {},
    };
  });
}

function estimateNarrationMinutes() {
  const beats = Array.isArray(state.project?.beats) ? state.project.beats : [];
  const timedSeconds = beats.reduce((total, beat) => total + Number(beat.duration_seconds || 0), 0);
  if (timedSeconds > 0) {
    return Math.max(0.1, timedSeconds / 60);
  }

  const narrationText = [els.hook.value, els.concept1.value, els.concept2.value, els.takeaway.value]
    .filter(Boolean)
    .join(" ");
  const words = wordCount(narrationText || `${els.title.value} ${els.summary.value}`);
  if (!words) {
    return 0;
  }
  return Math.max(0.1, words / 150);
}

function estimateCost() {
  const costConfig = state.costConfig || {};
  const textModel = costConfig.textModel || "gpt-4.1-mini";
  const ttsModel = costConfig.ttsModel || "gpt-4o-mini-tts";
  const videoModel = costConfig.videoModel || "sora-2";
  const videoSize = costConfig.videoSize || "720x1280";
  const textPrice = PRICING.text[textModel] || PRICING.text["gpt-4.1-mini"];
  const ttsPerMinute = PRICING.ttsPerMinute[ttsModel] || PRICING.ttsPerMinute["gpt-4o-mini-tts"];
  const soraPerSecond = PRICING.soraPerSecond[videoModel]?.[videoSize] ?? PRICING.soraPerSecond["sora-2"]["720x1280"];

  const sourceText = `${els.title.value}\n${els.summary.value}`;
  const hasPipelineInput = Boolean(state.projectId || normalizeText(sourceText));
  const inputTokens = hasPipelineInput ? estimateTokens(sourceText) + 2600 : 0;
  const outputTokens = hasPipelineInput ? 1800 : 0;
  const textCost = ((inputTokens * textPrice.inputPerMillion) + (outputTokens * textPrice.outputPerMillion)) / 1_000_000;

  const narrationMinutes = estimateNarrationMinutes();
  const ttsCost = narrationMinutes * ttsPerMinute;

  const motionBeats = getBeatSnapshot().filter((beat) => beat.mode === "animation" || beat.mode === "hybrid");
  const missingMotionBeats = motionBeats.filter((beat) => beat.assets?.status !== "ready" || !beat.assets?.video_asset?.path);
  const totalSoraSeconds = motionBeats.reduce((total, beat) => total + selectedSoraSeconds(beat.duration_seconds), 0);
  const pendingSoraSeconds = missingMotionBeats.reduce((total, beat) => total + selectedSoraSeconds(beat.duration_seconds), 0);
  const allSoraCost = totalSoraSeconds * soraPerSecond;
  const pendingSoraCost = pendingSoraSeconds * soraPerSecond;

  return {
    textModel,
    ttsModel,
    videoModel,
    videoSize,
    inputTokens,
    outputTokens,
    narrationMinutes,
    motionBeatCount: motionBeats.length,
    pendingMotionBeatCount: missingMotionBeats.length,
    totalSoraSeconds,
    pendingSoraSeconds,
    textCost,
    ttsCost,
    allSoraCost,
    pendingSoraCost,
    totalCost: textCost + ttsCost + pendingSoraCost,
    soraPerSecond,
  };
}

function renderCostEstimate() {
  if (!els.costTotal || !els.costLines) {
    return;
  }
  const estimate = estimateCost();
  els.costTotal.textContent = formatCurrency(estimate.totalCost);
  els.costLines.innerHTML = `
    <div class="cost-line primary-cost">
      <span>Sora still to generate</span>
      <strong>${formatCurrency(estimate.pendingSoraCost)}</strong>
      <small>${estimate.pendingMotionBeatCount} scene(s), ${estimate.pendingSoraSeconds}s @ ${formatCurrency(estimate.soraPerSecond)}/sec</small>
    </div>
    <div class="cost-line">
      <span>All selected Sora scenes</span>
      <strong>${formatCurrency(estimate.allSoraCost)}</strong>
      <small>${estimate.motionBeatCount} motion scene(s), ${estimate.totalSoraSeconds}s total</small>
    </div>
    <div class="cost-line">
      <span>Script generation</span>
      <strong>${formatCurrency(estimate.textCost)}</strong>
      <small>${estimate.textModel}, approx ${estimate.inputTokens.toLocaleString()} input + ${estimate.outputTokens.toLocaleString()} output tokens</small>
    </div>
    <div class="cost-line">
      <span>Narration TTS</span>
      <strong>${formatCurrency(estimate.ttsCost)}</strong>
      <small>${estimate.ttsModel}, approx ${estimate.narrationMinutes.toFixed(1)} min</small>
    </div>
  `;
  if (els.costNote) {
    els.costNote.innerHTML = `
      Estimate only, checked ${PRICING.checkedAt}. Uses ${escapeHtml(estimate.videoModel)} ${escapeHtml(estimate.videoSize)}.
      Local Remotion rendering and local word alignment are not included.
      Pricing reference:
      <a href="${PRICING.sourceUrl}" target="_blank" rel="noreferrer">OpenAI API pricing</a>.
    `;
  }
}

function renderSceneJson(beat) {
  const scene = beat.render_scene_override || beat.infographic_scene || null;
  return scene ? JSON.stringify(scene, null, 2) : "";
}

function sceneForBeat(beat) {
  const scene = beat?.render_scene_override || beat?.infographic_scene || null;
  return scene && typeof scene === "object" && !Array.isArray(scene) ? scene : null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fieldLabelFromPath(path) {
  return path
    .replace(/\.(\d+)(?=\.|$)/g, " $1")
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ");
}

function setPathValue(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    cursor = cursor[Number.isInteger(Number(part)) ? Number(part) : part];
  });
  const last = parts[parts.length - 1];
  cursor[Number.isInteger(Number(last)) ? Number(last) : last] = value;
}

function collectTemplateFields(value, basePath = "") {
  if (!isPlainObject(value)) {
    return [];
  }
  const skipKeys = new Set([
    "layout",
    "accent_color",
    "color",
    "glow",
    "highlight",
    "highlight_index",
    "flow_direction",
    "pulse_line",
    "pulse_frames",
    "state",
    "type",
  ]);
  const fields = [];

  Object.entries(value).forEach(([key, item]) => {
    if (skipKeys.has(key)) {
      return;
    }
    const path = basePath ? `${basePath}.${key}` : key;
    if (typeof item === "string") {
      fields.push({ path, type: "text", value: item });
      return;
    }
    if (typeof item === "number") {
      fields.push({ path, type: "number", value: item });
      return;
    }
    if (Array.isArray(item)) {
      if (item.every((entry) => typeof entry === "string" || typeof entry === "number")) {
        fields.push({ path, type: "lines", value: item.join("\n") });
        return;
      }
      item.forEach((entry, index) => {
        if (isPlainObject(entry)) {
          fields.push(...collectTemplateFields(entry, `${path}.${index}`));
        }
      });
      return;
    }
    if (isPlainObject(item)) {
      fields.push(...collectTemplateFields(item, path));
    }
  });

  return fields;
}

function templateFieldMarkup(field) {
  const label = fieldLabelFromPath(field.path);
  const value = escapeHtml(field.value);
  if (field.type === "lines") {
    return `
      <label class="template-field template-field-wide">
        <span>${escapeHtml(label)}</span>
        <textarea rows="4" data-template-path="${escapeHtml(field.path)}" data-template-type="lines">${value}</textarea>
      </label>
    `;
  }
  return `
    <label class="template-field">
      <span>${escapeHtml(label)}</span>
      <input type="${field.type === "number" ? "number" : "text"}" value="${value}" data-template-path="${escapeHtml(field.path)}" data-template-type="${field.type}" />
    </label>
  `;
}

function renderTemplateEditor(project) {
  if (!els.templateEditor) {
    return;
  }
  els.templateEditor.innerHTML = "";
  const beats = Array.isArray(project?.beats) ? project.beats : [];
  if (!beats.length) {
    els.templateEditor.innerHTML = `<p class="template-empty">Create a reel draft first. Template props will appear here.</p>`;
    return;
  }

  beats.forEach((beat, index) => {
    const scene = sceneForBeat(beat);
    const card = document.createElement("article");
    card.className = "template-card";
    card.dataset.beatId = beat.id;

    if (!scene) {
      card.innerHTML = `
        <div class="template-card-head">
          <div>
            <span class="template-kicker">Scene ${index + 1}</span>
            <h3>${escapeHtml(beat.title || beat.id)}</h3>
          </div>
        </div>
        <p class="template-empty">No generated template props for this scene yet.</p>
      `;
      els.templateEditor.appendChild(card);
      return;
    }

    const fields = collectTemplateFields(scene);
    card.innerHTML = `
      <div class="template-card-head">
        <div>
          <span class="template-kicker">Scene ${index + 1}</span>
          <h3>${escapeHtml(beat.title || beat.id)}</h3>
        </div>
        <span class="template-layout-pill">${escapeHtml(scene.layout || beat.scene_template || "template")}</span>
      </div>
      <div class="template-fields">
        ${fields.length ? fields.map(templateFieldMarkup).join("") : `<p class="template-empty">This template has no editable text props.</p>`}
      </div>
    `;
    els.templateEditor.appendChild(card);
  });

  els.templateEditor.querySelectorAll("[data-template-path]").forEach((input) => {
    input.addEventListener("input", () => {
      input.closest(".template-card")?.classList.add("is-dirty");
      syncTemplateOverridesToBeatCards();
    });
  });
}

function collectTemplateOverridesByBeatId() {
  const beats = Array.isArray(state.project?.beats) ? state.project.beats : [];
  const byId = new Map(beats.map((beat) => [beat.id, beat]));
  const overrides = new Map();

  document.querySelectorAll(".template-card[data-beat-id]").forEach((card) => {
    if (!card.classList.contains("is-dirty")) {
      return;
    }
    const beat = byId.get(card.dataset.beatId);
    const scene = sceneForBeat(beat);
    if (!scene) {
      return;
    }
    const override = cloneJson(scene);
    card.querySelectorAll("[data-template-path]").forEach((input) => {
      const type = input.dataset.templateType;
      let value = input.value;
      if (type === "number") {
        value = Number(value);
      } else if (type === "lines") {
        value = input.value.split("\n").map((line) => line.trim()).filter(Boolean);
      }
      setPathValue(override, input.dataset.templatePath, value);
    });
    overrides.set(card.dataset.beatId, override);
  });

  return overrides;
}

function beatCardById(beatId) {
  return [...document.querySelectorAll(".beat-card")].find((card) => card.dataset.beatId === beatId);
}

function syncTemplateOverridesToBeatCards() {
  const overrides = collectTemplateOverridesByBeatId();
  overrides.forEach((override, beatId) => {
    const textarea = beatCardById(beatId)?.querySelector(".beat-scene-json");
    if (!textarea) {
      return;
    }
    textarea.value = JSON.stringify(override, null, 2);
    textarea.dataset.hasOverride = "1";
  });
}

function compactSceneJson(scene) {
  return scene ? JSON.stringify(scene) : "";
}

function renderBeats(project) {
  els.beatList.innerHTML = "";
  if (!project || !Array.isArray(project.beats) || project.beats.length === 0) {
    els.projectMeta.textContent = "No scene plan yet. Create a reel draft first.";
    return;
  }

  els.projectMeta.textContent = `Project ${project.project_id} · ${project.beats.length} scenes · theme ${project.theme_name}`;

  project.beats.forEach((beat) => {
    const article = document.createElement("article");
    const videoPath = beat.assets?.video_asset?.path || "";
    const thumbnailPath = beat.assets?.thumbnail_asset?.path || "";
    const posterAttr = thumbnailPath ? ` poster="${assetUrl(thumbnailPath)}"` : "";
    const generatedSceneJson = compactSceneJson(beat.infographic_scene || null);
    const hasRenderOverride = Boolean(beat.render_scene_override);
    article.className = "beat-card";
    article.dataset.beatId = beat.id;
    article.innerHTML = `
      <div class="beat-top">
        <div>
          <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
          <p class="beat-subtitle">${escapeHtml(beat.id)} · segment ${escapeHtml(beat.narration_segment)}</p>
        </div>
        <span class="beat-status ${beatStatusClass(beat.assets?.status)}">${beat.assets?.status || "not_requested"}</span>
      </div>
      <div class="beat-meta">
        <div class="beat-kv">
          <span>Template</span>
          <strong>${escapeHtml(beat.scene_template || "n/a")}</strong>
        </div>
        <div class="beat-kv">
          <span>Duration</span>
          <strong>${beat.duration_seconds ? `${beat.duration_seconds}s` : "n/a"}</strong>
        </div>
        <div class="beat-kv">
          <span>Theme</span>
          <strong>${escapeHtml(beat.theme || project.theme_name)}</strong>
        </div>
      </div>
      <div class="mode-group">
        ${["infographic", "animation", "hybrid"].map((mode) => `
          <button type="button" class="mode-pill ${beat.mode === mode ? "active" : ""}" data-mode="${mode}">${mode}</button>
        `).join("")}
      </div>
      <label>
        <span>Animation Prompt</span>
        <textarea class="beat-prompt" rows="3" placeholder="Future Sora prompt for this beat...">${escapeHtml(beat.assets?.prompt || "")}</textarea>
      </label>
      <details class="render-props">
        <summary>Rendered Text Props</summary>
        <p>Edit the visual text/data Remotion will use for this scene. Leave empty to use generated props.</p>
        <textarea class="beat-scene-json" rows="8" spellcheck="false" data-generated-scene="${escapeHtml(generatedSceneJson)}" data-has-override="${hasRenderOverride ? "1" : "0"}">${escapeHtml(renderSceneJson(beat))}</textarea>
      </details>
      <div class="check-row">
        <label><input class="beat-overlay" type="checkbox" ${beat.overlay_enabled ? "checked" : ""} /> Overlay enabled</label>
        <label><input class="beat-cutout" type="checkbox" ${beat.cutout_enabled ? "checked" : ""} /> Cutout enabled</label>
      </div>
      <div class="beat-actions">
        <button type="button" class="ghost beat-generate-btn">Generate This Scene</button>
        ${beat.assets?.sora_job_id ? `<span class="beat-job">job ${beat.assets.sora_job_id}</span>` : `<span class="beat-job">No Sora job yet</span>`}
      </div>
      ${videoPath ? `
        <div class="beat-preview">
          <span>Sora Preview</span>
          <video class="beat-preview-video" controls muted playsinline preload="metadata" src="${assetUrl(videoPath)}"${posterAttr}></video>
        </div>
      ` : thumbnailPath ? `<img class="beat-thumb" src="${assetUrl(thumbnailPath)}" alt="${escapeHtml(beat.title)} preview" />` : ""}
      ${assetLinks(beat) ? `<div class="beat-assets">${assetLinks(beat)}</div>` : ""}
      ${beat.assets?.last_error ? `<p class="beat-error">${escapeHtml(beat.assets.last_error)}</p>` : ""}
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
        renderCostEstimate();
      });
    });
    article.querySelector(".beat-generate-btn")?.addEventListener("click", () => {
      generateBeatAssets(beat.id);
    });

    els.beatList.appendChild(article);
  });
}

function readBeatRenderOverride(card) {
  const textarea = card.querySelector(".beat-scene-json");
  if (!textarea) {
    return undefined;
  }
  const raw = textarea.value.trim();
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Rendered Text Props for ${card.dataset.beatId} must be a JSON object.`);
  }
  if (!parsed.layout) {
    throw new Error(`Rendered Text Props for ${card.dataset.beatId} must include a layout field.`);
  }
  if (textarea.dataset.hasOverride !== "1" && textarea.dataset.generatedScene) {
    try {
      const generated = JSON.parse(textarea.dataset.generatedScene);
      if (JSON.stringify(parsed) === JSON.stringify(generated)) {
        return undefined;
      }
    } catch {
      return parsed;
    }
  }
  return parsed;
}

function collectBeatUpdates() {
  const templateOverrides = collectTemplateOverridesByBeatId();
  return [...document.querySelectorAll(".beat-card")].map((card) => ({
    id: card.dataset.beatId,
    mode: card.querySelector(".mode-pill.active")?.dataset.mode || "infographic",
    prompt: card.querySelector(".beat-prompt")?.value.trim() || "",
    overlay_enabled: Boolean(card.querySelector(".beat-overlay")?.checked),
    cutout_enabled: Boolean(card.querySelector(".beat-cutout")?.checked),
    render_scene_override: templateOverrides.has(card.dataset.beatId)
      ? templateOverrides.get(card.dataset.beatId)
      : readBeatRenderOverride(card),
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
    const stageProgress = Number(stage.progress || 0);
    row.className = `job-stage ${stage.status || "pending"}`;
    row.innerHTML = `
      <span class="job-stage-dot"></span>
      <span>${formatStageName(stage.name)}</span>
      <strong>${stage.status === "active" ? `${stageProgress}%` : stage.status}</strong>
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
    return;
  }

  const activeSession = sessions.find((session) => session.active);
  if (!activeSession) {
    return;
  }

  const note = document.createElement("p");
  note.className = "session-empty";
  note.textContent = `${formatKind(activeSession.kind)} · ${activeSession.sessionId || "active run"}`;
  els.jobSessions.appendChild(note);
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
    lines.push({ text: "No active project loaded in this session. Start with New Project and Create Reel Draft." });
  } else {
    lines.push({ text: `Active project: ${nextState.projectId}.` });
    lines.push({ text: `Scene mix: ${beats.length} total, ${animationBeats.length} motion-enabled, ${readyAnimationBeats.length} ready.` });
  }

  if (job.active) {
    lines.push({
      text: `Pipeline is running now: ${formatStageName(job.currentStage || job.kind || "stage")}.`,
      className: "active-insight",
    });
    if (job.nextTask) {
      lines.push({ text: `Next expected step: ${job.nextTask}`, className: "active-insight subtle" });
    }
  } else if (job.completed && job.success) {
    lines.push({ text: `Last run succeeded (${formatKind(job.kind || "pipeline")}).`, className: "success-insight" });
    if (job.nextTask) {
      lines.push({ text: `Recommended action: ${job.nextTask}` });
    }
  } else if (job.completed && !job.success) {
    lines.push({ text: `Last run failed at ${formatStageName(job.failedStage || job.kind || "pipeline")}.`, className: "danger-insight" });
    lines.push({ text: "Action: review the pipeline log, fix inputs/env, and rerun the failed stage." });
  } else {
    lines.push({ text: "No run in progress." });
  }

  if (failedAnimationBeats.length > 0) {
    const failedIds = failedAnimationBeats.map((beat) => beat.id).join(", ");
    lines.push({ text: `Motion assets failed on: ${failedIds}. Regenerate those scenes before rendering.`, className: "danger-insight" });
  }

  if (animationBeats.length > 0 && readyAnimationBeats.length < animationBeats.length) {
    lines.push({ text: "Some motion scenes are not ready yet. Generate motion assets before final render." });
  } else if (animationBeats.length > 0 && readyAnimationBeats.length === animationBeats.length) {
    lines.push({ text: "All motion-enabled scenes are ready for render.", className: "success-insight" });
  }

  if (nextState.videoUrl) {
    lines.push({ text: "Rendered output is available in the preview panel.", className: "success-insight" });
  }

  if (fallbackHint) {
    lines.push({ text: fallbackHint, className: "danger-insight" });
  } else if (uiErrorHint) {
    lines.push({ text: uiErrorHint, className: "danger-insight" });
  }

  els.heuristics.innerHTML = lines
    .map((line) => `<p class="${line.className || ""}">${escapeHtml(line.text)}</p>`)
    .join("");
}

function restoreScrollPosition(scrollPosition) {
  if (!scrollPosition) {
    return;
  }
  const restore = () => {
    window.scrollTo(scrollPosition.x, scrollPosition.y);
  };
  requestAnimationFrame(restore);
  window.setTimeout(restore, 0);
}

function applyState(nextState, fallbackLog = "", options = {}) {
  const scrollPosition = options.preserveScroll
    ? { x: window.scrollX, y: window.scrollY }
    : null;
  const currentVideoSrc = els.video.getAttribute("src") || "";
  state = nextState;
  const topic = nextState.topic || {};
  state.topic = topic;
  state.projects = Array.isArray(nextState.projects) ? nextState.projects : [];
  const active = document.activeElement;
  const editingCustomTheme = active === els.customBg || active === els.customAccent || active === els.customText;
  if (!editingCustomTheme && nextState.customTheme && typeof nextState.customTheme === "object") {
    fillCustomThemeInputs(nextState.customTheme);
  }
  const script = nextState.script || {};

  if (topic.title) {
    els.title.value = topic.title;
  }
  if (topic.summary) {
    els.summary.value = topic.summary;
  }

  applyScript(script);
  if (!options.statusOnly) {
    renderThemes(nextState.themes || {}, nextState.theme || "deep_winter");
    renderBeats(nextState.project);
    renderTemplateEditor(nextState.project);
    renderProjectSelector(state.projects, nextState.projectId);
  }
  renderJob(nextState.job);
  renderJobSessions(nextState.jobSessions || (nextState.job ? [nextState.job] : []));
  renderHeuristics(nextState, fallbackLog);
  setRunControlsDisabled(Boolean(nextState.job?.active));
  if (!options.statusOnly) {
    renderCostEstimate();
  }

  if (nextState.videoUrl) {
    if (currentVideoSrc !== nextState.videoUrl) {
      els.video.src = nextState.videoUrl;
    }
    els.video.controls = true;
    els.video.classList.remove("video-disabled");
    els.resultVideoPane?.classList.remove("is-locked");
    els.renderMeta.textContent = `Rendered video ready. Theme: ${nextState.theme}.`;
    if (els.downloadVideo) {
      els.downloadVideo.href = nextState.videoUrl;
      els.downloadVideo.classList.remove("is-disabled");
      els.downloadVideo.setAttribute("aria-disabled", "false");
      els.downloadVideo.style.pointerEvents = "auto";
      els.downloadVideo.style.opacity = "1";
    }
  } else {
    if (currentVideoSrc) {
      els.video.removeAttribute("src");
      els.video.load();
    }
    els.video.controls = false;
    els.video.classList.add("video-disabled");
    els.resultVideoPane?.classList.add("is-locked");
    els.renderMeta.textContent = "No render loaded yet.";
    if (els.downloadVideo) {
      els.downloadVideo.removeAttribute("href");
      els.downloadVideo.classList.add("is-disabled");
      els.downloadVideo.setAttribute("aria-disabled", "true");
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

  restoreScrollPosition(scrollPosition);
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
  const response = await fetch(`/api/state?ts=${Date.now()}`, { cache: "no-store" });
  const data = await response.json();
  applyState(data);
  if (data.job?.active) {
    startRunPolling();
  }
}

async function generateBeatAssets(beatId = "") {
  if (!state.projectId) {
    setStatus("No Project", "Create a reel draft first so scenes exist.");
    return;
  }
  setStatus("Generating", beatId ? `Running Sora for ${beatId}.` : "Running Sora for animation and hybrid scenes.");
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

function loadDemoFlow() {
  els.title.value = DEMO_FLOW.title;
  els.summary.value = DEMO_FLOW.summary;
  applyScript(DEMO_FLOW.script);
  pickTheme(DEMO_FLOW.theme);
  setPanelOpen("script-panel-body", true);
  setStatus("Demo Loaded", "Create the reel draft first, then apply the example motion setup.");
  renderCostEstimate();
}

function applyDemoBeatSetup() {
  if (!state.project?.beats?.length) {
    setStatus("No Scenes", "Create the reel draft first so the demo can configure scenes.");
    return;
  }

  setPanelOpen("beats-panel-body", true);
  const targetBeat =
    state.project.beats.find((beat) => beat.id === DEMO_FLOW.motionBeatId) ||
    state.project.beats.find((beat) => beat.narration_segment?.startsWith("concept")) ||
    state.project.beats[1] ||
    state.project.beats[0];

  const card = document.querySelector(`.beat-card[data-beat-id="${targetBeat.id}"]`);
  if (!card) {
    setStatus("Scene Missing", "Scene cards are not rendered yet.");
    return;
  }

  card.querySelectorAll(".mode-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.mode === "hybrid");
  });
  const prompt = card.querySelector(".beat-prompt");
  if (prompt) {
    prompt.value = DEMO_FLOW.motionPrompt;
  }
  const overlay = card.querySelector(".beat-overlay");
  if (overlay) {
    overlay.checked = true;
  }
  const cutout = card.querySelector(".beat-cutout");
  if (cutout) {
    cutout.checked = false;
  }
  renderCostEstimate();
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  setStatus("Demo Motion Ready", `Configured ${targetBeat.id}. Save scene config, then generate this scene or all motion assets.`);
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
  let customTheme;
  try {
    customTheme = validateCustomThemeForRender().customTheme;
  } catch (error) {
    setStatus("Invalid Theme", error.message);
    return;
  }
  setPanelOpen("result-panel-body", true);
  setStatus("Rendering", "Running full pipeline with reviewed template props.");
  try {
    const data = await postJSON("/api/render", {
      projectId: activeProjectIdForTopic(title, summary),
      title,
      summary,
      theme: state.theme,
      customTheme,
      script: {
        hook: els.hook.value.trim(),
        concept_1: els.concept1.value.trim(),
        concept_2: els.concept2.value.trim(),
        takeaway_cta: els.takeaway.value.trim(),
      },
      beats: collectBeatUpdates(),
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
    setStatus("No Project", "Create a reel draft first so scenes exist.");
    return;
  }
  setStatus("Saving", "Persisting scene modes, prompts, and template props.");
  try {
    const data = await postJSON("/api/project-beats", {
      projectId: state.projectId,
      beats: collectBeatUpdates(),
    });
    applyState(data);
    setStatus("Saved", "Scene config updated.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Scene config save failed.");
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

els.demoFlowBtn.addEventListener("click", () => {
  loadDemoFlow();
});

els.demoBeatBtn.addEventListener("click", () => {
  applyDemoBeatSetup();
});

els.loadProjectBtn.addEventListener("click", async () => {
  await loadSelectedProject();
});

els.saveCustomThemeBtn.addEventListener("click", async () => {
  const payload = readCustomThemeInputs();
  if (!payload.bg || !payload.accent || !payload.text) {
    setStatus("Invalid Theme", "Background, accent, and text are all required.");
    return;
  }
  if (!isValidCssColor(payload.bg) || !isValidCssColor(payload.accent) || !isValidCssColor(payload.text)) {
    setStatus("Invalid Theme", "Use valid CSS colors (hex/rgb/hsl/name).");
    return;
  }
  setStatus("Saving", "Persisting custom theme.");
  try {
    const data = await postJSON("/api/custom-theme", { customTheme: payload });
    applyState(data);
    setStatus("Saved", "Custom theme saved.");
  } catch (error) {
    applyState(error.data || state, error.message);
    uiErrorHint = error.message || "";
    setStatus("Failed", "Custom theme save failed.");
  }
});

els.resetCustomThemeBtn.addEventListener("click", async () => {
  fillCustomThemeInputs({ bg: "", accent: "", text: "" });
  setStatus("Reset", "Custom theme preview reset.");
});

["input", "change"].forEach((eventName) => {
  els.customBg.addEventListener(eventName, () => applyCustomThemePreview(readCustomThemeInputs()));
  els.customAccent.addEventListener(eventName, () => applyCustomThemePreview(readCustomThemeInputs()));
  els.customText.addEventListener(eventName, () => applyCustomThemePreview(readCustomThemeInputs()));
  els.title.addEventListener(eventName, renderCostEstimate);
  els.summary.addEventListener(eventName, renderCostEstimate);
  els.hook.addEventListener(eventName, renderCostEstimate);
  els.concept1.addEventListener(eventName, renderCostEstimate);
  els.concept2.addEventListener(eventName, renderCostEstimate);
  els.takeaway.addEventListener(eventName, renderCostEstimate);
  els.beatList.addEventListener(eventName, renderCostEstimate);
});

initPanelToggles();
initCustomCursorAndGlow();

refresh().catch((error) => {
  setStatus("Offline", "UI failed to load state.");
  uiErrorHint = String(error);
  renderHeuristics(state, uiErrorHint);
});
