const STORAGE_KEY = "rochelleCareerTrackingV3";
const PAGE_SIZE = 60;
const ACTIVE_APPLICATION_STAGES = new Set(["applied", "interview", "offer"]);
const CLOSED_STAGES = new Set(["skipped", "passed"]);
const STAGE_LABELS = {
  "": "Not tracked",
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  skipped: "Skipped by me",
  passed: "Passed / Closed",
};

export function matchesFilters(job, filters, stage = "") {
  const query = (filters.search || "").trim().toLocaleLowerCase();
  const haystack = `${job.title || ""} ${job.company || ""} ${job.description || ""}`.toLocaleLowerCase();
  const stageMatch = filters.stage === "all"
    || (filters.stage === "active" && !CLOSED_STAGES.has(stage))
    || (filters.stage === "untracked" && !stage)
    || filters.stage === stage;
  const fitMatch = filters.fit === "all"
    || (filters.fit === "recommended" && job.default_visible === true)
    || (filters.fit === "hard-flags" && (job.hard_flags || []).length > 0);

  return [
    !query || haystack.includes(query),
    fitMatch,
    !filters.company || job.company === filters.company,
    !filters.lane || job.career_lane === filters.lane,
    !filters.work || job.workplace_type === filters.work,
    !filters.location || job.location_eligibility === filters.location,
    !filters.salary || job.salary_band === filters.salary,
    stageMatch,
  ].every(Boolean);
}

export function applyCompanyCap(jobs, selectedCompany = "", cap = 3) {
  if (selectedCompany) return [...jobs];
  const counts = new Map();
  return jobs.filter((job) => {
    const count = counts.get(job.company) || 0;
    if (count >= cap) return false;
    counts.set(job.company, count + 1);
    return true;
  });
}

const portal = {
  jobs: [],
  payload: null,
  tracking: loadTracking(),
  visibleCount: PAGE_SIZE,
  currentDialogId: null,
};

function loadTracking() {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveTracking() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portal.tracking));
}

function trackingFor(id) {
  return portal.tracking[id] || { stage: "", updatedAt: null, appliedAt: null };
}

function setStage(id, stage) {
  const existing = trackingFor(id);
  const now = new Date().toISOString();
  const applicationStage = ACTIVE_APPLICATION_STAGES.has(stage);
  portal.tracking[id] = {
    ...existing,
    stage,
    updatedAt: now,
    appliedAt: applicationStage ? (existing.appliedAt || now) : existing.appliedAt,
  };
  saveTracking();
  renderAll();
  if (portal.currentDialogId === id) renderDialog(id);
  showToast(stage === "skipped" ? "Skipped and removed from the active list." : `Stage updated to ${STAGE_LABELS[stage]}.`);
}

function e(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, includeTime = false) {
  if (!value) return "Date not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not listed";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function salaryText(job) {
  const money = (number) => `$${Math.round(number / 1000)}K`;
  if (job.salary_min && job.salary_max) return `${money(job.salary_min)}–${money(job.salary_max)} base`;
  if (job.salary_min) return `From ${money(job.salary_min)}`;
  if (job.salary_max) return `Up to ${money(job.salary_max)}`;
  return "Salary not listed";
}

function currentFilters() {
  return {
    search: document.querySelector("#searchFilter").value,
    fit: document.querySelector("#fitFilter").value,
    company: document.querySelector("#companyFilter").value,
    lane: document.querySelector("#laneFilter").value,
    work: document.querySelector("#workFilter").value,
    location: document.querySelector("#locationFilter").value,
    salary: document.querySelector("#salaryFilter").value,
    stage: document.querySelector("#stageFilter").value,
  };
}

function filteredJobs() {
  const filters = currentFilters();
  const matches = portal.jobs.filter((job) => matchesFilters(job, filters, trackingFor(job.id).stage));
  return applyCompanyCap(matches, filters.company, 3);
}

function topFiveJobs() {
  const recommended = portal.jobs.filter((job) => job.default_visible && !CLOSED_STAGES.has(trackingFor(job.id).stage));
  return applyCompanyCap(recommended, "", 3).slice(0, 5);
}

function populateSelect(id, values) {
  const select = document.querySelector(id);
  const first = select.options[0];
  select.replaceChildren(first);
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function populateFilters() {
  populateSelect("#companyFilter", portal.jobs.map((job) => job.company));
  populateSelect("#laneFilter", portal.jobs.map((job) => job.career_lane));
  populateSelect("#workFilter", portal.jobs.map((job) => job.workplace_type));
  populateSelect("#locationFilter", portal.jobs.map((job) => job.location_eligibility));
  populateSelect("#salaryFilter", portal.jobs.map((job) => job.salary_band));

  const studio = document.querySelector("#studioSelect");
  const first = studio.options[0];
  studio.replaceChildren(first);
  portal.jobs.filter((job) => job.default_visible).forEach((job) => {
    const option = document.createElement("option");
    option.value = job.id;
    option.textContent = `${job.score} — ${job.company} — ${job.title}`;
    studio.append(option);
  });
}

function renderMetrics() {
  const activeApplied = portal.jobs.filter((job) => ACTIVE_APPLICATION_STAGES.has(trackingFor(job.id).stage));
  document.querySelector("#recommendedCount").textContent = portal.jobs.filter((job) => job.default_visible).length;
  document.querySelector("#idealCount").textContent = portal.jobs.filter((job) => job.salary_band === "Ideal overlap" && job.default_visible).length;
  document.querySelector("#workStyleCount").textContent = portal.jobs.filter((job) => job.default_visible && (job.workplace_type === "Remote" || job.location_eligibility === "Eligible — DFW")).length;
  document.querySelector("#appliedCount").textContent = activeApplied.length;
}

function renderTopFive() {
  const jobs = topFiveJobs();
  const target = document.querySelector("#topFive");
  if (!jobs.length) {
    target.innerHTML = '<div class="empty-state">No active recommended roles are available yet.</div>';
    return;
  }
  target.innerHTML = jobs.map((job, index) => `
    <article class="top-card" data-details="${e(job.id)}" tabindex="0">
      <span class="rank-pill">Highly recommended #${index + 1}</span>
      <h3>${e(job.title)}</h3>
      <p class="company">${e(job.company)}</p>
      <p class="job-meta">${e(job.workplace_type)} · ${e(job.salary_band)}</p>
      <span class="score" aria-label="Score ${job.score}">${job.score}</span>
    </article>
  `).join("");
}

function jobCard(job) {
  const tracking = trackingFor(job.id);
  const topIndex = topFiveJobs().findIndex((item) => item.id === job.id);
  const flags = (job.hard_flags || []).length;
  return `
    <article class="job-card ${flags ? "hard-flag" : ""}" data-job-id="${e(job.id)}">
      <div class="score-badge"><span>${job.score}</span><small>MATCH</small></div>
      <div>
        <div class="job-kicker">
          ${topIndex >= 0 ? `<span class="pill coral">Highly recommended #${topIndex + 1}</span>` : ""}
          <span class="pill teal">${e(job.career_lane)}</span>
          <span class="pill">${e(job.salary_band)}</span>
          ${flags ? '<span class="pill coral">Hard penalty</span>' : ""}
        </div>
        <h3 class="job-title">${e(job.title)}</h3>
        <p class="job-company">${e(job.company)}</p>
        <p class="job-meta">${e(job.location)} · ${e(job.workplace_type)} · ${e(salaryText(job))}</p>
        <p class="job-meta">Added to portal ${e(formatDate(job.discovered_at))} · Verified ${e(formatDate(job.verified_at))}</p>
        <p class="job-summary">${e(job.summary)}</p>
      </div>
      <div class="job-actions">
        <span class="stage-label">${e(STAGE_LABELS[tracking.stage])}</span>
        <button class="button button-small button-soft" data-action="details" data-id="${e(job.id)}">Details</button>
        <button class="button button-small button-teal" data-action="applied" data-id="${e(job.id)}">Applied</button>
        <button class="button button-small button-skip" data-action="skip" data-id="${e(job.id)}">Skip</button>
      </div>
    </article>
  `;
}

function renderJobs(reset = false) {
  if (reset) portal.visibleCount = PAGE_SIZE;
  const jobs = filteredJobs();
  const shown = jobs.slice(0, portal.visibleCount);
  document.querySelector("#resultCount").textContent = `${jobs.length} matching ${jobs.length === 1 ? "position" : "positions"}`;
  document.querySelector("#companyCapNote").textContent = currentFilters().company
    ? `Showing all scored roles from ${currentFilters().company}.`
    : "Default browsing is capped at three roles per company.";
  document.querySelector("#jobList").innerHTML = shown.length
    ? shown.map(jobCard).join("")
    : '<div class="empty-state">No roles match every selected filter. Reset filters or choose “All scored US roles.”</div>';
  document.querySelector("#loadMore").classList.toggle("hidden", shown.length >= jobs.length);
}

function renderApplied() {
  const showClosed = document.querySelector("#showClosedApplied").checked;
  const jobs = portal.jobs.filter((job) => {
    const tracking = trackingFor(job.id);
    if (!tracking.appliedAt) return false;
    if (ACTIVE_APPLICATION_STAGES.has(tracking.stage)) return true;
    return showClosed && tracking.stage === "passed";
  });
  const target = document.querySelector("#appliedList");
  if (!jobs.length) {
    target.innerHTML = '<div class="empty-state">No active submitted applications yet. Use the Applied button only after you submit one.</div>';
    return;
  }
  target.innerHTML = jobs.map((job) => {
    const tracking = trackingFor(job.id);
    return `
      <article class="pipeline-card">
        <div>
          <span class="pipeline-stage">${e(STAGE_LABELS[tracking.stage])}</span>
          <h3>${e(job.title)}</h3>
          <p class="job-company">${e(job.company)}</p>
          <p class="job-meta">Applied ${e(formatDate(tracking.appliedAt))} · Updated ${e(formatDate(tracking.updatedAt))}</p>
        </div>
        <div class="job-actions">
          <select aria-label="Update application stage" data-stage-id="${e(job.id)}">
            ${["applied", "interview", "offer", "passed"].map((stage) => `<option value="${stage}" ${tracking.stage === stage ? "selected" : ""}>${e(STAGE_LABELS[stage])}</option>`).join("")}
          </select>
          <button class="button button-small button-soft" data-action="details" data-id="${e(job.id)}">View details</button>
          <a class="button button-small button-outline" href="${e(job.apply_url)}" target="_blank" rel="noopener">Company page ↗</a>
        </div>
      </article>
    `;
  }).join("");
}

function renderStudio(id = document.querySelector("#studioSelect").value) {
  const target = document.querySelector("#studioContent");
  const job = portal.jobs.find((item) => item.id === id);
  if (!job) {
    target.className = "studio-content empty-state";
    target.textContent = "Choose a position to begin.";
    return;
  }
  target.className = "studio-content";
  target.innerHTML = `
    <div class="studio-grid">
      <div class="studio-score"><strong>${job.score}</strong><span>same score used everywhere</span></div>
      <div>
        <p class="eyebrow teal">${e(job.career_lane)}</p>
        <h2>${e(job.title)}</h2>
        <p class="job-company">${e(job.company)}</p>
        <p>${e(job.summary)}</p>
        <a class="button button-coral" href="${e(job.apply_url)}" target="_blank" rel="noopener">Apply on company website ↗</a>
      </div>
    </div>
    <div class="evidence-columns">
      <section class="evidence-box"><h3>Evidence to emphasize</h3><ul>${(job.strengths || []).map((item) => `<li>${e(item)}</li>`).join("") || "<li>Review the description for transferable evidence.</li>"}</ul></section>
      <section class="evidence-box gaps"><h3>Questions or gaps to verify</h3><ul>${(job.gaps || []).map((item) => `<li>${e(item)}</li>`).join("") || "<li>No major rule-based gap detected.</li>"}</ul></section>
    </div>
  `;
}

function renderDialog(id) {
  const job = portal.jobs.find((item) => item.id === id);
  if (!job) return;
  portal.currentDialogId = id;
  const tracking = trackingFor(id);
  const breakdown = job.breakdown || {};
  document.querySelector("#dialogContent").innerHTML = `
    <p class="eyebrow teal">${e(job.career_lane)}</p>
    <h2>${e(job.title)}</h2>
    <p class="job-company">${e(job.company)} · Score ${job.score}</p>
    <p>${e(job.location)} · ${e(job.workplace_type)} · ${e(salaryText(job))}</p>
    <p>${e(job.summary)}</p>
    <div class="breakdown-grid">
      ${Object.entries(breakdown).map(([key, value]) => `<div><strong>${e(String(key).replaceAll("_", " "))}</strong><br>${e(value)}</div>`).join("")}
    </div>
    <div class="evidence-columns">
      <section class="evidence-box"><h3>Strengths</h3><ul>${(job.strengths || []).map((item) => `<li>${e(item)}</li>`).join("") || "<li>No evidence tags available.</li>"}</ul></section>
      <section class="evidence-box gaps"><h3>Gaps / cautions</h3><ul>${(job.gaps || []).map((item) => `<li>${e(item)}</li>`).join("") || "<li>No major rule-based caution.</li>"}</ul></section>
    </div>
    <label class="dialog-stage">Application stage
      <select data-stage-id="${e(job.id)}">
        ${Object.entries(STAGE_LABELS).map(([stage, label]) => `<option value="${stage}" ${tracking.stage === stage ? "selected" : ""}>${e(label)}</option>`).join("")}
      </select>
    </label>
    <div class="description"><strong>Job description</strong><p>${e(job.description || "Description unavailable.")}</p></div>
    <p><a class="button button-coral" href="${e(job.apply_url)}" target="_blank" rel="noopener">Open company application ↗</a></p>
  `;
  const dialog = document.querySelector("#jobDialog");
  if (!dialog.open) dialog.showModal();
}

function renderAll() {
  renderMetrics();
  renderTopFive();
  renderJobs(true);
  renderApplied();
  renderStudio();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function loadWorkflowState() {
  const dot = document.querySelector("#workflowDot");
  const label = document.querySelector("#workflowState");
  try {
    const response = await fetch(`https://api.github.com/repos/rochellemickels/rochelle-2-career-agent/actions/workflows/refresh-and-publish.yml/runs?per_page=1&_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("status unavailable");
    const data = await response.json();
    const run = data.workflow_runs?.[0];
    if (!run) throw new Error("no run");
    dot.className = `status-dot ${run.status === "completed" ? (run.conclusion === "success" ? "done" : "error") : "running"}`;
    label.textContent = run.status === "completed"
      ? (run.conclusion === "success" ? "Refresh and publish complete" : "Last refresh needs attention")
      : "Refresh in progress…";
    if (run.status !== "completed") window.setTimeout(loadWorkflowState, 30000);
  } catch {
    dot.className = "status-dot done";
    label.textContent = "Published data loaded";
  }
}

async function loadPortal() {
  const cacheBust = Date.now();
  const [jobsResponse, statusResponse] = await Promise.all([
    fetch(`data/jobs.json?v=${cacheBust}`, { cache: "no-store" }),
    fetch(`data/status.json?v=${cacheBust}`, { cache: "no-store" }),
  ]);
  if (!jobsResponse.ok) throw new Error("The jobs database could not be loaded.");
  portal.payload = await jobsResponse.json();
  portal.jobs = portal.payload.jobs || [];
  const status = statusResponse.ok ? await statusResponse.json() : null;
  document.querySelector("#lastUpdated").textContent = `Published ${formatDate(status?.generated_at || portal.payload.generated_at, true)}`;
  populateFilters();
  renderAll();
}

function bindEvents() {
  let searchTimer;
  document.querySelectorAll("#fitFilter, #companyFilter, #laneFilter, #workFilter, #locationFilter, #salaryFilter, #stageFilter").forEach((control) => {
    control.addEventListener("change", () => renderJobs(true));
  });
  document.querySelector("#searchFilter").addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => renderJobs(true), 180);
  });
  document.querySelector("#clearFilters").addEventListener("click", () => {
    document.querySelector("#searchFilter").value = "";
    document.querySelector("#fitFilter").value = "recommended";
    document.querySelector("#companyFilter").value = "";
    document.querySelector("#laneFilter").value = "";
    document.querySelector("#workFilter").value = "";
    document.querySelector("#locationFilter").value = "";
    document.querySelector("#salaryFilter").value = "";
    document.querySelector("#stageFilter").value = "active";
    renderJobs(true);
  });
  document.querySelector("#loadMore").addEventListener("click", () => {
    portal.visibleCount += PAGE_SIZE;
    renderJobs(false);
  });
  document.querySelector("#showClosedApplied").addEventListener("change", renderApplied);
  document.querySelector("#studioSelect").addEventListener("change", (event) => renderStudio(event.target.value));
  document.querySelectorAll(".nav-tab").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".view").forEach((view) => {
      const active = view.id === `${button.dataset.view}View`;
      view.hidden = !active;
      view.classList.toggle("active-view", active);
    });
  }));
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    const details = event.target.closest("[data-details]");
    if (details) renderDialog(details.dataset.details);
    if (!action) return;
    const id = action.dataset.id;
    if (action.dataset.action === "details") renderDialog(id);
    if (action.dataset.action === "applied") setStage(id, "applied");
    if (action.dataset.action === "skip") setStage(id, "skipped");
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-stage-id]")) setStage(event.target.dataset.stageId, event.target.value);
  });
  document.querySelector("#closeDialog").addEventListener("click", () => document.querySelector("#jobDialog").close());
  document.querySelector("#jobDialog").addEventListener("close", () => { portal.currentDialogId = null; });
}

async function bootstrap() {
  bindEvents();
  loadWorkflowState();
  try {
    await loadPortal();
  } catch (error) {
    document.querySelector("#jobList").innerHTML = `<div class="empty-state">${e(error.message)} Refresh the page or check the GitHub workflow.</div>`;
    document.querySelector("#resultCount").textContent = "Data unavailable";
  }
}

if (typeof document !== "undefined") bootstrap();
