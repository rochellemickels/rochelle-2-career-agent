const STORAGE_KEY = "rochelle-career-tracking-v1";
const RESUME_STORAGE_KEY = "rochelle-master-resume-v1";

const state = {
  jobs: [],
  statuses: [],
  generatedAt: null,
  tracking: loadTracking(),
  resume: loadResumeProfile(),
  applicationJobId: "",
  filters: { search: "", tier: "all", lane: "all", work: "all", location: "all", salary: "all", company: "all", stage: "all", sort: "score" },
};

const els = {
  jobList: document.querySelector("#jobList"),
  search: document.querySelector("#searchInput"),
  tier: document.querySelector("#tierFilter"),
  lane: document.querySelector("#laneFilter"),
  work: document.querySelector("#workFilter"),
  location: document.querySelector("#locationFilter"),
  salary: document.querySelector("#salaryFilter"),
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
  resumeUpload: document.querySelector("#resumeUpload"),
  resumeStatus: document.querySelector("#resumeStatus"),
  clearResume: document.querySelector("#clearResume"),
  applicationJobSelect: document.querySelector("#applicationJobSelect"),
  selectedJobSummary: document.querySelector("#selectedJobSummary"),
  openSelectedJob: document.querySelector("#openSelectedJob"),
  resumeMatchScore: document.querySelector("#resumeMatchScore"),
  studioGuidance: document.querySelector("#studioGuidance"),
  matchedKeywords: document.querySelector("#matchedKeywords"),
  missingKeywords: document.querySelector("#missingKeywords"),
  copyApplicationBrief: document.querySelector("#copyApplicationBrief"),
  downloadApplicationBrief: document.querySelector("#downloadApplicationBrief"),
  studioActionStatus: document.querySelector("#studioActionStatus"),
};

function loadTracking() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function loadResumeProfile() {
  try { return JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY)) || { name: "", text: "" }; }
  catch { return { name: "", text: "" }; }
}

function saveResumeProfile() {
  localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(state.resume));
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

function portalDateLine(job) {
  const added = formatDate(job.discovered_at || job.posted_at);
  const verified = formatDate(job.verified_at || state.generatedAt);
  return `Added to portal ${added} · Verified ${verified}`;
}

function plainText(value = "") {
  const parsed = new DOMParser().parseFromString(String(value), "text/html");
  return (parsed.body.textContent || "").replace(/\s+/g, " ").trim();
}

const ROLE_SIGNALS = [
  ["Strategic partnerships", ["strategic partnerships", "partner strategy", "partner ecosystem"]],
  ["Program management", ["program management", "program manager", "program roadmap"]],
  ["Project management", ["project management", "project manager", "project plans"]],
  ["Stakeholder management", ["stakeholder management", "stakeholder alignment", "stakeholder engagement"]],
  ["Executive communication", ["executive communication", "executive stakeholders", "senior leaders", "c-suite"]],
  ["Cross-functional leadership", ["cross-functional", "cross functional", "influence without direct authority"]],
  ["Customer success", ["customer success", "customer outcomes", "customer satisfaction"]],
  ["Consultative solutions", ["consultative", "trusted advisor", "solution discovery", "complex solutions"]],
  ["Implementation", ["implementation", "onboarding", "deployment"]],
  ["Adoption and enablement", ["adoption", "enablement", "training", "facilitation"]],
  ["Change management", ["change management", "organizational change"]],
  ["Go-to-market strategy", ["go-to-market", "go to market", "gtm"]],
  ["Business operations", ["business operations", "operational excellence", "operating rhythm"]],
  ["Revenue operations", ["revenue operations", "sales operations", "pipeline", "forecasting"]],
  ["Growth strategy", ["growth strategy", "market expansion", "revenue growth"]],
  ["Process improvement", ["process improvement", "continuous improvement", "operational efficiency"]],
  ["Data-informed decisions", ["data-driven", "data informed", "metrics", "analytics"]],
  ["AI fluency", ["artificial intelligence", "generative ai", "ai-enabled", "automation", "ai fluency"]],
  ["SaaS or cloud", ["saas", "cloud", "software platform"]],
  ["Commercial negotiations", ["commercial negotiations", "negotiation", "commercial strategy"]],
  ["Financial modeling", ["financial modeling", "business case", "roi"]],
  ["Learning and development", ["learning and development", "instructional design", "curriculum", "workshops"]],
  ["Risk management", ["risk management", "dependencies", "blockers"]],
  ["Documentation and playbooks", ["documentation", "playbooks", "self-service resources"]],
];

function scoreColor(score) {
  if (score >= 90) return "#147d78";
  if (score >= 80) return "#7c3a72";
  if (score >= 70) return "#3568b8";
  if (score >= 60) return "#b7791f";
  return "#7b8495";
}

function matchesCareerLane(job, lane) {
  if (lane === "all") return true;
  const title = job.title.toLowerCase();
  const terms = {
    relationships: ["partnership", "business development", "relationship", "alliances", "partner success", "partner enablement", "channel", "ecosystem"],
    implementation: ["implementation", "adoption", "onboarding", "transformation", "change management"],
    programs: ["program manager", "project manager", "strategy and operations", "strategy & operations", "business operations"],
    solutions: ["solutions", "customer success", "client success", "customer experience"],
    growth: ["growth", "go-to-market", "go to market", "market development", "enablement"],
    ai: ["ai ", "artificial intelligence", "transformation", "automation"],
  };
  return (terms[lane] || []).some(term => title.includes(term));
}

function matchesLocation(job, locationFilter) {
  if (locationFilter === "all") return true;
  const location = `${job.location} ${job.workplace_type}`.toLowerCase();
  const isRemote = location.includes("remote");
  const isDfw = ["dallas", "fort worth", "dfw", "grapevine", "plano", "frisco", "irving", "las colinas", "texas"].some(term => location.includes(term));
  if (locationFilter === "remote") return isRemote;
  if (locationFilter === "dfw") return isDfw;
  return !isRemote && !isDfw;
}

function overlapsIdealSalary(job) {
  if (!job.salary_max) return false;
  const lower = job.salary_min || 0;
  return job.salary_max >= 110000 && lower <= 135000;
}

function matchesSalary(job, salaryFilter) {
  if (salaryFilter === "all") return true;
  if (salaryFilter === "ideal") return overlapsIdealSalary(job);
  if (salaryFilter === "above") return Boolean(job.salary_min) && job.salary_min > 135000;
  if (salaryFilter === "preferred") return (job.salary_max || 0) >= 100000 && (job.salary_max || 0) < 110000;
  if (salaryFilter === "bridge") return (job.salary_max || 0) >= 85000 && (job.salary_max || 0) < 100000;
  if (salaryFilter === "below") return Boolean(job.salary_max) && job.salary_max < 85000;
  return !job.salary_max;
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
      && matchesCareerLane(job, state.filters.lane)
      && workMatch
      && matchesLocation(job, state.filters.location)
      && matchesSalary(job, state.filters.salary)
      && (state.filters.company === "all" || job.company === state.filters.company)
      && (state.filters.stage === "all" || tracking.stage === state.filters.stage);
  });

  return filtered.sort((a, b) => {
    if (state.filters.sort === "newest") return String(b.discovered_at || b.posted_at || "").localeCompare(String(a.discovered_at || a.posted_at || ""));
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
          <span class="source-badge">100-point match</span>
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
        <button class="button button-secondary" type="button" data-prepare-job>Prepare application</button>
        <button class="button button-secondary favorite-button" type="button" data-favorite aria-pressed="${tracking.favorite}">${tracking.favorite ? "★ Saved" : "☆ Save role"}</button>
        <span class="date-line">${escapeHtml(portalDateLine(job))}</span>
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
  document.querySelector("#metricSalary").textContent = state.jobs.filter(overlapsIdealSalary).length;
  document.querySelector("#metricSaved").textContent = Object.values(state.tracking).filter(item => item.favorite).length;
}

function renderFilterChips() {
  const labels = [];
  if (state.filters.search) labels.push(`Search: ${state.filters.search}`);
  if (state.filters.tier !== "all") labels.push(`${state.filters.tier}+ match`);
  if (state.filters.lane !== "all") labels.push(state.filters.lane);
  if (state.filters.work !== "all") labels.push(state.filters.work);
  if (state.filters.location !== "all") labels.push(state.filters.location);
  if (state.filters.salary !== "all") {
    const salaryLabels = { ideal: "$110K–$135K ideal", above: "Above $135K", preferred: "$100K–$109K", bridge: "$85K–$99K", below: "Below $85K", unlisted: "Salary unlisted" };
    labels.push(salaryLabels[state.filters.salary] || state.filters.salary);
  }
  if (state.filters.company !== "all") labels.push(state.filters.company);
  if (state.filters.stage !== "all") labels.push(state.filters.stage);
  els.activeFilterRow.innerHTML = labels.map(label => `<span class="filter-chip">${escapeHtml(label)}</span>`).join("");
}

function clearFilters() {
  state.filters = { search: "", tier: "all", lane: "all", work: "all", location: "all", salary: "all", company: "all", stage: "all", sort: "score" };
  els.search.value = "";
  els.tier.value = els.lane.value = els.work.value = els.location.value = els.salary.value = els.company.value = els.stage.value = "all";
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
      <button class="button button-secondary" type="button" id="dialogPrepare">Prepare application</button>
      <button class="button button-secondary favorite-button" type="button" id="dialogFavorite" aria-pressed="${tracking.favorite}">${tracking.favorite ? "★ Saved" : "☆ Save role"}</button>
    </div>
    <p class="date-line">Employer posting date: ${formatDate(job.posted_at)} · ${escapeHtml(portalDateLine(job))} · Transparent rules-based review</p>`;

  els.dialogContent.querySelector("#dialogPrepare").addEventListener("click", () => {
    els.jobDialog.close();
    prepareApplication(job);
  });
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

function jobForApplication() {
  return state.jobs.find(job => job.id === state.applicationJobId);
}

function roleSignals(job) {
  if (!job) return [];
  const source = plainText(`${job.title} ${job.description}`).toLowerCase();
  return ROLE_SIGNALS
    .filter(([, terms]) => terms.some(term => source.includes(term)))
    .map(([label, terms]) => ({ label, terms }));
}

function analyzeResume(job) {
  const signals = roleSignals(job);
  const resume = state.resume.text.toLowerCase();
  const matched = signals.filter(signal => signal.terms.some(term => resume.includes(term)));
  const missing = signals.filter(signal => !signal.terms.some(term => resume.includes(term)));
  const coverage = signals.length ? Math.round((matched.length / signals.length) * 100) : 0;
  return { signals, matched, missing, coverage };
}

function selectedJobOption(job) {
  const salary = formatSalary(job);
  return `${job.company} — ${job.title} · ${salary}`;
}

function renderApplicationStudio() {
  if (!els.applicationJobSelect) return;
  const selected = state.applicationJobId;
  const jobs = [...state.jobs].sort((a, b) => b.score - a.score);
  els.applicationJobSelect.innerHTML = '<option value="">Select a verified role</option>'
    + jobs.map(job => `<option value="${escapeHtml(job.id)}" ${job.id === selected ? "selected" : ""}>${escapeHtml(selectedJobOption(job))}</option>`).join("");

  const resumeLoaded = Boolean(state.resume.text);
  els.resumeStatus.innerHTML = resumeLoaded
    ? `<strong>${escapeHtml(state.resume.name)}</strong><span>${state.resume.text.split(/\s+/).filter(Boolean).length.toLocaleString()} words saved locally</span>`
    : "No master résumé loaded yet.";
  els.clearResume.hidden = !resumeLoaded;

  const job = jobForApplication();
  if (!job) {
    els.selectedJobSummary.textContent = "Use a job card’s “Prepare application” button or choose a role here.";
    els.openSelectedJob.href = "#";
    els.openSelectedJob.setAttribute("aria-disabled", "true");
    els.openSelectedJob.classList.add("disabled-link");
    els.resumeMatchScore.textContent = "—";
    els.studioGuidance.textContent = resumeLoaded
      ? "Choose a verified job to begin the recruiter review."
      : "Upload your master résumé and choose a job to compare your evidence with the employer’s priorities.";
    els.matchedKeywords.innerHTML = "<li>Waiting for a selected role.</li>";
    els.missingKeywords.innerHTML = "<li>Nothing flagged yet.</li>";
    els.copyApplicationBrief.disabled = true;
    els.downloadApplicationBrief.disabled = true;
    return;
  }

  els.selectedJobSummary.innerHTML = `
    <strong>${escapeHtml(job.company)} · ${escapeHtml(job.title)}</strong>
    <span>${escapeHtml(job.location)} · ${escapeHtml(formatSalary(job))} · ${job.score}/100 portal match</span>
    <span>${escapeHtml(portalDateLine(job))}</span>`;
  els.openSelectedJob.href = job.apply_url;
  els.openSelectedJob.removeAttribute("aria-disabled");
  els.openSelectedJob.classList.remove("disabled-link");

  const analysis = analyzeResume(job);
  els.resumeMatchScore.textContent = resumeLoaded ? `${analysis.coverage}%` : "—";
  els.studioGuidance.textContent = resumeLoaded
    ? `Your master résumé explicitly supports ${analysis.matched.length} of ${analysis.signals.length} role signals. Missing does not mean unqualified—it means the evidence is not yet obvious to a fast recruiter or ATS review.`
    : `This posting emphasizes ${analysis.signals.length} recruiter-visible signals. Upload your master résumé to see which are already supported.`;
  els.matchedKeywords.innerHTML = (resumeLoaded && analysis.matched.length)
    ? analysis.matched.map(item => `<li>✓ ${escapeHtml(item.label)}</li>`).join("")
    : "<li>No supported signals measured yet.</li>";
  els.missingKeywords.innerHTML = (resumeLoaded && analysis.missing.length)
    ? analysis.missing.map(item => `<li>${escapeHtml(item.label)}</li>`).join("")
    : "<li>No unsupported signals flagged.</li>";
  els.copyApplicationBrief.disabled = !resumeLoaded;
  els.downloadApplicationBrief.disabled = !resumeLoaded;
}

async function extractResumeText(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "txt" || extension === "md") return file.text();

  const data = await file.arrayBuffer();
  if (extension === "docx") {
    if (!window.mammoth) throw new Error("DOCX reader did not load. Refresh the portal and try again.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: data });
    return result.value;
  }
  if (extension === "pdf") {
    if (!window.pdfjsLib) throw new Error("PDF reader did not load. Refresh the portal and try again.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(" "));
    }
    return pages.join("\n");
  }
  throw new Error("Please choose a PDF, DOCX, TXT, or Markdown résumé.");
}

async function handleResumeUpload(file) {
  if (!file) return;
  els.resumeStatus.textContent = "Reading résumé locally…";
  try {
    const text = (await extractResumeText(file)).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 200) throw new Error("Very little résumé text was detected. Try the DOCX version or a text-based PDF.");
    state.resume = { name: file.name, text };
    saveResumeProfile();
    els.studioActionStatus.textContent = "Master résumé saved in this browser. It has not been uploaded to GitHub or an employer.";
    renderApplicationStudio();
  } catch (error) {
    state.resume = { name: "", text: "" };
    els.resumeStatus.textContent = error.message;
    renderApplicationStudio();
  }
}

function prepareApplication(job) {
  state.applicationJobId = job.id;
  renderApplicationStudio();
  document.querySelector("#application-studio").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildApplicationBrief() {
  const job = jobForApplication();
  if (!job || !state.resume.text) return "";
  const analysis = analyzeResume(job);
  return `You are a senior recruiter and executive résumé writer for ${job.company}. Create the strongest truthful, ATS-friendly application for the role below. The goal is to make the candidate's transferable value unmistakable and earn a recruiter screen—without inventing credentials, tools, metrics, employers, titles, dates, or technical expertise.

TARGET ROLE
Company: ${job.company}
Title: ${job.title}
Location/work style: ${job.location} / ${job.workplace_type}
Published compensation: ${formatSalary(job)}
Employer application: ${job.apply_url}

RECRUITER SIGNALS ALREADY EXPLICIT IN THE MASTER RÉSUMÉ
${analysis.matched.map(item => `- ${item.label}`).join("\n") || "- None detected yet"}

SIGNALS THAT NEED TRUTHFUL CLARIFICATION OR STRONGER EVIDENCE
${analysis.missing.map(item => `- ${item.label}`).join("\n") || "- None detected"}

FULL JOB DESCRIPTION
${plainText(job.description)}

MASTER RÉSUMÉ
${state.resume.text}

INSTRUCTIONS
1. Preserve all real employers, job titles, dates, education, and credentials exactly unless the source résumé clearly supports a correction.
2. Reposition the candidate around strategic relationships, consultative problem solving, cross-functional leadership, program execution, client outcomes, growth, and practical AI fluency.
3. Do not frame her as an AI engineer or entry-level candidate.
4. Use the employer's exact language naturally where supported, but do not keyword-stuff.
5. Lead with quantified outcomes already present. If an important number or fact is missing, mark it [VERIFY WITH ROCHELLE] instead of guessing.
6. Produce: (a) an ATS-ready two-page résumé, (b) a four-line executive summary, (c) a focused core-skills section, (d) rewritten accomplishment bullets, (e) a short tailored cover letter, and (f) five likely recruiter-screen questions with truthful talking points.
7. After the draft, add a recruiter audit explaining the strongest reasons to interview, remaining risks, and any claims Rochelle must verify before applying.
8. Keep the voice confident, specific, modern, and human. Avoid clichés, inflated claims, and fake technical depth.`;
}

async function copyApplicationBrief() {
  const brief = buildApplicationBrief();
  if (!brief) return;
  try {
    await navigator.clipboard.writeText(brief);
    els.studioActionStatus.textContent = "Tailoring brief copied. Paste it into ChatGPT with this portal open so we can produce and review the final résumé.";
  } catch {
    els.studioActionStatus.textContent = "Copy was blocked by the browser. Use Download recruiter brief instead.";
  }
}

function downloadApplicationBrief() {
  const brief = buildApplicationBrief();
  const job = jobForApplication();
  if (!brief || !job) return;
  const blob = new Blob([brief], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${job.company}-${job.title}-application-brief.txt`.replace(/[^a-z0-9.-]+/gi, "-");
  link.click();
  URL.revokeObjectURL(url);
  els.studioActionStatus.textContent = "Recruiter brief downloaded. Review it before using it to customize your résumé.";
}

function bindEvents() {
  let searchTimer;
  els.search.addEventListener("input", event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => updateFilter("search", event.target.value), 140);
  });
  els.tier.addEventListener("change", event => updateFilter("tier", event.target.value));
  els.lane.addEventListener("change", event => updateFilter("lane", event.target.value));
  els.work.addEventListener("change", event => updateFilter("work", event.target.value));
  els.location.addEventListener("change", event => updateFilter("location", event.target.value));
  els.salary.addEventListener("change", event => updateFilter("salary", event.target.value));
  els.company.addEventListener("change", event => updateFilter("company", event.target.value));
  els.stage.addEventListener("change", event => updateFilter("stage", event.target.value));
  els.sort.addEventListener("change", event => updateFilter("sort", event.target.value));
  els.clear.addEventListener("click", clearFilters);
  els.sourceButton.addEventListener("click", openSourceHealth);
  els.resumeUpload.addEventListener("change", event => handleResumeUpload(event.target.files?.[0]));
  els.clearResume.addEventListener("click", () => {
    state.resume = { name: "", text: "" };
    localStorage.removeItem(RESUME_STORAGE_KEY);
    els.resumeUpload.value = "";
    els.studioActionStatus.textContent = "Saved résumé removed from this browser.";
    renderApplicationStudio();
  });
  els.applicationJobSelect.addEventListener("change", event => {
    state.applicationJobId = event.target.value;
    renderApplicationStudio();
  });
  els.copyApplicationBrief.addEventListener("click", copyApplicationBrief);
  els.downloadApplicationBrief.addEventListener("click", downloadApplicationBrief);
  els.jobList.addEventListener("click", event => {
    const card = event.target.closest("[data-job-id]");
    if (!card) return;
    const job = state.jobs.find(item => item.id === card.dataset.jobId);
    if (!job) return;
    if (event.target.closest("[data-favorite]")) updateTracking(job.id, { favorite: !trackingFor(job.id).favorite });
    if (event.target.closest("[data-prepare-job]")) prepareApplication(job);
    if (event.target.closest("[data-view-job]")) openJob(job);
  });
}

async function loadData() {
  try {
    const [jobsResponse, statusResponse] = await Promise.all([fetch("data/jobs.json", { cache: "no-store" }), fetch("data/status.json", { cache: "no-store" })]);
    if (!jobsResponse.ok) throw new Error(`Jobs database returned ${jobsResponse.status}`);
    const data = await jobsResponse.json();
    const statusData = statusResponse.ok ? await statusResponse.json() : { sources: [] };
    state.generatedAt = data.generated_at || null;
    state.jobs = data.jobs || [];
    state.statuses = statusData.sources || [];
    const companies = [...new Set(state.jobs.map(job => job.company))].sort((a, b) => a.localeCompare(b));
    els.company.innerHTML = '<option value="all">All companies</option>' + companies.map(company => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join("");
    renderApplicationStudio();
    document.querySelector("#lastUpdated").textContent = data.generated_at ? `Last refreshed ${new Date(data.generated_at).toLocaleString()}` : "Awaiting first automated refresh";
    const costMode = data.metadata?.cost_mode === "free" ? "Free matching active" : "Matching active";
    document.querySelector("#refreshStatus").textContent = state.jobs.length ? `${state.jobs.length} roles ready · ${costMode}` : "Ready for first job refresh";
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
