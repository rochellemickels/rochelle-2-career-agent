const STORAGE_KEY = "rochelle-career-tracking-v1";

const state = {
  jobs: [],
  statuses: [],
  tracking: loadTracking(),
  filters: { search: "", tier: "all", work: "all", company: "all", stage: "all", sort: "score" },
};

const els = {
  jobList: document.querySelector("#jobList"),
  search: document.querySelector("#searchInput"),
  tier: document.querySelector("#tierFilter"),
  work: document.querySelector("#workFilter"),
  company: document.querySelector("#companyFilter"),
  stage: document.querySelector("#stageFilter"),
  sort: document.querySelector("#sortFilter"),
  clear: document.querySelector("#clearFilters"),
  resultSummary: document.querySelector("#resultSummary"),
  activeFilterRow: document.querySelector("#activeFilterRow"),
  jobDialog: document.querySelector("#jobDialog"),
  dialogContent: document.querySelector("#dialogContent"),
  sourceDialog: document.querySelector("#sourceDialog"),
  sourceDialogContent: document.querySelector("#sourceDialogContent"),
  sourceButton: document.querySelector("#sourceHealthButton"),
};

function loadTracking() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveTracking() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tracking));
}

function trackingFor(id) {
  return state.tracking[id] || { favorite: false, stage: "Not reviewed", notes: "" };
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function formatSalary(job) {
  if (!job.salary_max) return "Salary not listed";
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: job.salary_currency || "USD", maximumFractionDigits: 0 }).format(value);
  return job.salary_min && job.salary_min !== job.salary_max
    ? `${money(job.salary_min)}–${money(job.salary_max)}`
    : `Up to ${money(job.salary_max)}`;
}

function formatDate(value) {
  if (!value) return "Date not listed";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date not listed" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relativeDate(value) {
  if (!value) return "Date not listed";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date not listed";
  const days = Math.max(0, Math.round((Date.now() - date.valueOf()) / 86400000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

function scoreColor(score) {
  if (score >= 90) return "#147d78";
  if (score >= 80) return "#7c3a72";
  if (score >= 70) return "#3568b8";
  if (score >= 60) return "#b7791f";
  return "#7b8495";
}

function getFilteredJobs() {
  const query = state.filters.search.toLowerCase().trim();
  const minimum = state.filters.tier === "all" ? 0 : Number(state.filters.tier);
  const filtered = state.jobs.filter(job => {
    const tracking = trackingFor(job.id);
    const haystack = `${job.title} ${job.company} ${job.department} ${job.location} ${job.description}`.toLowerCase();
    const work = `${job.workplace_type} ${job.location}`.toLowerCase();
    const workMatch = state.filters.work === "all"
      || (state.filters.work === "remote" && work.includes("remote"))
      || (state.filters.work === "hybrid" && work.includes("hybrid"))
      || (state.filters.work === "onsite" && !work.includes("remote") && !work.includes("hybrid"));
    return (!query || haystack.includes(query))
      && job.score >= minimum
      && workMatch
      && (state.filters.company === "all" || job.company === state.filters.company)
      && (state.filters.stage === "all" || tracking.stage === state.filters.stage);
  });

  return filtered.sort((a, b) => {
    if (state.filters.sort === "newest") return String(b.posted_at || "").localeCompare(String(a.posted_at || ""));
    if (state.filters.sort === "salary") return (b.salary_max || 0) - (a.salary_max || 0);
    if (state.filters.sort === "company") return a.company.localeCompare(b.company);
    return b.score - a.score;
  });
}

function icon(type) {
  const paths = {
    location: '<path d="M12 21s6-5.1 6-12a6 6 0 1 0-12 0c0 6.9 6 12 6 12Z"/><circle cx="12" cy="9" r="2"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M17 14h.01M14.5 12a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 5 0Z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[type]}</svg>`;
}

function renderCard(job) {
  const tracking = trackingFor(job.id);
  const topStrength = job.strengths?.[0];
  const topGap = job.gaps?.[0];
  return `
    <article class="job-card" data-job-id="${escapeHtml(job.id)}">
      <div class="score-block">
        <div class="score-ring" style="--score-color:${scoreColor(job.score)}">
          <div><strong>${job.score}</strong><small>/100</small></div>
        </div>
        <span class="tier-label">${escapeHtml(job.tier)}</span>
      </div>
      <div class="job-main">
        <div class="company-line">
          <span>${escapeHtml(job.company)}</span>
          <span class="source-badge">${escapeHtml(job.source_type)}</span>
          ${job.ai_evaluated ? '<span class="ai-badge">AI reviewed</span>' : '<span class="source-badge">Rules reviewed</span>'}
          ${tracking.stage !== "Not reviewed" ? `<span class="stage-badge">${escapeHtml(tracking.stage)}</span>` : ""}
        </div>
        <h3>${escapeHtml(job.title)}</h3>
        <div class="job-meta">
          <span>${icon("location")}${escapeHtml(job.location)}</span>
          <span>${icon("briefcase")}${escapeHtml(job.workplace_type)}</span>
          <span>${icon("money")}${escapeHtml(formatSalary(job))}</span>
        </div>
        <p class="job-summary">${escapeHtml(job.summary || job.description.slice(0, 260))}</p>
        <div class="signal-row">
          ${topStrength ? `<span class="signal">✓ ${escapeHtml(topStrength)}</span>` : ""}
          ${topGap ? `<span class="signal gap">Check: ${escapeHtml(topGap)}</span>` : ""}
        </div>
      </div>
      <div class="job-actions">
        <button class="button button-primary" type="button" data-view-job>View match details</button>
        <button class="button button-secondary favorite-button" type="button" data-favorite aria-pressed="${tracking.favorite}">${tracking.favorite ? "★ Saved" : "☆ Save role"}</button>
        <span class="date-line">${relativeDate(job.posted_at)}</span>
      </div>
    </article>`;
}

function renderJobs() {
  const jobs = getFilteredJobs();
  els.resultSummary.textContent = `${jobs.length} of ${state.jobs.length} opportunities shown`;
  if (!jobs.length) {
    const template = document.querySelector("#emptyTemplate");
    els.jobList.replaceChildren(template.content.cloneNode(true));
    els.jobList.querySelector("[data-clear-filters]")?.addEventListener("click", clearFilters);
  } else {
    els.jobList.innerHTML = jobs.map(renderCard).join("");
  }
  renderFilterChips();
  renderMetrics();
}

function renderMetrics() {
  document.querySelector("#metricTotal").textContent = state.jobs.length;
  document.querySelector("#metricTop").textContent = state.jobs.filter(job => job.score >= 80).length;
  document.querySelector("#metricRemote").textContent = state.jobs.filter(job => `${job.workplace_type} ${job.location}`.toLowerCase().includes("remote")).length;
  document.querySelector("#metricSalary").textContent = state.jobs.filter(job => (job.salary_max || 0) >= 150000).length;
  document.querySelector("#metricSaved").textContent = Object.values(state.tracking).filter(item => item.favorite).length;
}

function renderFilterChips() {
  const labels = [];
  if (state.filters.search) labels.push(`Search: ${state.filters.search}`);
  if (state.filters.tier !== "all") labels.push(`${state.filters.tier}+ match`);
  if (state.filters.work !== "all") labels.push(state.filters.work);
  if (state.filters.company !== "all") labels.push(state.filters.company);
  if (state.filters.stage !== "all") labels.push(state.filters.stage);
  els.activeFilterRow.innerHTML = labels.map(label => `<span class="filter-chip">${escapeHtml(label)}</span>`).join("");
}

function clearFilters() {
  state.filters = { search: "", tier: "all", work: "all", company: "all", stage: "all", sort: "score" };
  els.search.value = "";
  els.tier.value = els.work.value = els.company.value = els.stage.value = "all";
  els.sort.value = "score";
  renderJobs();
}

function updateFilter(key, value) {
  state.filters[key] = value;
  renderJobs();
}

function breakdownRows(job) {
  const dimensions = [
    ["Role fit", "role_fit", 25], ["Compensation", "compensation", 20], ["Work style", "work_style", 15],
    ["Values", "values", 15], ["Leadership", "leadership", 10], ["AI relevance", "ai_relevance", 10], ["Quality", "quality", 5],
  ];
  return dimensions.map(([label, key, max]) => {
    const value = job.breakdown[key];
    return `<div class="breakdown-row"><span>${label}</span><div class="bar"><i style="width:${(value / max) * 100}%"></i></div><strong>${value}/${max}</strong></div>`;
  }).join("");
}

function openJob(job) {
  const tracking = trackingFor(job.id);
  els.dialogContent.innerHTML = `
    <p class="dialog-kicker">${escapeHtml(job.tier)} · ${escapeHtml(job.recommended_action)}</p>
    <h2>${escapeHtml(job.title)}</h2>
    <p class="dialog-company">${escapeHtml(job.company)} · ${escapeHtml(job.location)} · ${escapeHtml(formatSalary(job))}</p>
    <div class="dialog-score">
      <div class="dialog-score-number" style="color:${scoreColor(job.score)}">${job.score}<small>/100</small></div>
      <div class="breakdown">${breakdownRows(job)}</div>
    </div>
    <p>${escapeHtml(job.summary)}</p>
    <div class="dialog-grid">
      <section class="evidence-panel"><h3>Why it matches</h3><ul>${(job.strengths || []).map(item => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No strong evidence captured yet.</li>"}</ul></section>
      <section class="evidence-panel"><h3>What to verify</h3><ul>${(job.gaps || []).map(item => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No material gaps captured.</li>"}</ul></section>
    </div>
    <section class="tracking-panel">
      <h3>Your private application tracker</h3>
      <div class="tracking-grid">
        <label><span>Stage</span><select id="dialogStage">${["Not reviewed","Interested","Preparing","Applied","Interviewing","Passed"].map(stage => `<option ${stage === tracking.stage ? "selected" : ""}>${stage}</option>`).join("")}</select></label>
        <label><span>Notes</span><textarea id="dialogNotes" placeholder="Why this role stands out, contacts, next step…">${escapeHtml(tracking.notes)}</textarea></label>
      </div>
    </section>
    <div class="dialog-actions">
      <a class="button button-primary" href="${escapeHtml(job.apply_url)}" target="_blank" rel="noreferrer">Open employer listing</a>
      <button class="button button-secondary favorite-button" type="button" id="dialogFavorite" aria-pressed="${tracking.favorite}">${tracking.favorite ? "★ Saved" : "☆ Save role"}</button>
    </div>
    <p class="date-line">Posting date: ${formatDate(job.posted_at)} · ${job.ai_evaluated ? `AI reviewed with ${escapeHtml(job.confidence)} confidence` : "Rule-based review"}</p>`;

  els.dialogContent.querySelector("#dialogStage").addEventListener("change", event => updateTracking(job.id, { stage: event.target.value }));
  els.dialogContent.querySelector("#dialogNotes").addEventListener("input", event => updateTracking(job.id, { notes: event.target.value }, false));
  els.dialogContent.querySelector("#dialogNotes").addEventListener("change", renderJobs);
  els.dialogContent.querySelector("#dialogFavorite").addEventListener("click", event => {
    const favorite = !trackingFor(job.id).favorite;
    updateTracking(job.id, { favorite });
    event.currentTarget.setAttribute("aria-pressed", String(favorite));
    event.currentTarget.textContent = favorite ? "★ Saved" : "☆ Save role";
  });
  els.jobDialog.showModal();
}

function updateTracking(id, changes, rerender = true) {
  state.tracking[id] = { ...trackingFor(id), ...changes };
  saveTracking();
  if (rerender) renderJobs();
}

function openSourceHealth() {
  const ok = state.statuses.filter(source => source.status === "ok").length;
  els.sourceDialogContent.innerHTML = `
    <p class="dialog-kicker">AUTOMATION HEALTH</p>
    <h2>Company career sources</h2>
    <p class="dialog-company">${ok} of ${state.statuses.length} configured sources refreshed successfully. A broken source never stops the others.</p>
    <div class="source-list">
      ${state.statuses.map(source => `<div class="source-row"><strong>${escapeHtml(source.company)}</strong><span class="${source.status === "ok" ? "health-ok" : "health-error"}">${source.status === "ok" ? "● Healthy" : "● Check"}</span><span>${source.jobs_found} roles</span></div>`).join("") || "<p>Source status will appear after the first automated refresh.</p>"}
    </div>`;
  els.sourceDialog.showModal();
}

function bindEvents() {
  let searchTimer;
  els.search.addEventListener("input", event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => updateFilter("search", event.target.value), 140);
  });
  els.tier.addEventListener("change", event => updateFilter("tier", event.target.value));
  els.work.addEventListener("change", event => updateFilter("work", event.target.value));
  els.company.addEventListener("change", event => updateFilter("company", event.target.value));
  els.stage.addEventListener("change", event => updateFilter("stage", event.target.value));
  els.sort.addEventListener("change", event => updateFilter("sort", event.target.value));
  els.clear.addEventListener("click", clearFilters);
  els.sourceButton.addEventListener("click", openSourceHealth);
  els.jobList.addEventListener("click", event => {
    const card = event.target.closest("[data-job-id]");
    if (!card) return;
    const job = state.jobs.find(item => item.id === card.dataset.jobId);
    if (!job) return;
    if (event.target.closest("[data-favorite]")) updateTracking(job.id, { favorite: !trackingFor(job.id).favorite });
    if (event.target.closest("[data-view-job]")) openJob(job);
  });
}

async function loadData() {
  try {
    const [jobsResponse, statusResponse] = await Promise.all([fetch("data/jobs.json", { cache: "no-store" }), fetch("data/status.json", { cache: "no-store" })]);
    if (!jobsResponse.ok) throw new Error(`Jobs database returned ${jobsResponse.status}`);
    const data = await jobsResponse.json();
    const statusData = statusResponse.ok ? await statusResponse.json() : { sources: [] };
    state.jobs = data.jobs || [];
    state.statuses = statusData.sources || [];
    const companies = [...new Set(state.jobs.map(job => job.company))].sort((a, b) => a.localeCompare(b));
    els.company.innerHTML = '<option value="all">All companies</option>' + companies.map(company => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join("");
    document.querySelector("#lastUpdated").textContent = data.generated_at ? `Last refreshed ${new Date(data.generated_at).toLocaleString()}` : "Awaiting first automated refresh";
    const aiStatus = data.metadata?.ai_status;
    document.querySelector("#refreshStatus").textContent = state.jobs.length ? `${state.jobs.length} roles ready · AI ${aiStatus || "status unknown"}` : "Ready for first job refresh";
    if (data.metadata?.sources_error) document.querySelector("#statusDot").classList.add("warning");
    renderJobs();
  } catch (error) {
    document.querySelector("#refreshStatus").textContent = "Database needs attention";
    document.querySelector("#lastUpdated").textContent = error.message;
    document.querySelector("#statusDot").classList.add("error");
    els.jobList.innerHTML = `<section class="empty-state"><div class="empty-icon">!</div><h3>The opportunity database could not load.</h3><p>Run the GitHub “Refresh career opportunities” workflow, then reload this page.</p></section>`;
  }
}

bindEvents();
loadData();
