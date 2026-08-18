const STORAGE_KEY = "rochelle-career-tracking-v1";
const RESUME_STORAGE_KEY = "rochelle-master-resume-v1";

const APPLICATION_STAGES = [
  "Not reviewed",
  "Interested",
  "Preparing",
  "Applied",
  "Application viewed",
  "Recruiter responded",
  "Interview scheduled",
  "Interviewing",
  "Final interview",
  "Offer",
  "Passed / Closed",
];

const APPLIED_STAGES = new Set(APPLICATION_STAGES.slice(3));

const CURATED_WEEKLY_PICKS = [
  {
    id: "greenhouse:pinterest:8109351",
    reason: "Best overall fit: enablement, coaching, SMB growth, operating rhythms, and practical AI fluency without a quota-carrying sales focus.",
  },
  {
    id: "greenhouse:gitlab:8604996002",
    reason: "Strong bridge from agency and client operations into customer-success strategy, cross-functional change, and process leadership.",
  },
  {
    id: "greenhouse:dropbox:8092224",
    reason: "Excellent compensation overlap with planning, executive communication, adoption, and stakeholder coordination at the center of the role.",
  },
  {
    id: "greenhouse:stripe:8042309",
    reason: "High-value stretch role emphasizing strategic programs, change management, executive communication, and turning GTM strategy into execution.",
  },
  {
    id: "greenhouse:dropbox:8048847",
    reason: "Strong strategic-relationship fit when positioned around partner ecosystems, negotiation, adoption, and long-term growth—not direct selling.",
  },
];

const state = {
  jobs: [],
  statuses: [],
  generatedAt: null,
  tracking: loadTracking(),
  resume: loadResumeProfile(),
  applicationJobId: "",
  manualJob: null,
  weeklyPicks: [],
  weeklyRankMap: new Map(),
  jobSearchText: new Map(),
  visibleJobCount: 30,
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
  toggleManualJob: document.querySelector("#toggleManualJob"),
  manualJobForm: document.querySelector("#manualJobForm"),
  manualCompany: document.querySelector("#manualCompany"),
  manualTitle: document.querySelector("#manualTitle"),
  manualLocation: document.querySelector("#manualLocation"),
  manualUrl: document.querySelector("#manualUrl"),
  manualDescription: document.querySelector("#manualDescription"),
  useManualJob: document.querySelector("#useManualJob"),
  clearManualJob: document.querySelector("#clearManualJob"),
  resumeMatchScore: document.querySelector("#resumeMatchScore"),
  studioGuidance: document.querySelector("#studioGuidance"),
  matchedKeywords: document.querySelector("#matchedKeywords"),
  missingKeywords: document.querySelector("#missingKeywords"),
  copyApplicationBrief: document.querySelector("#copyApplicationBrief"),
  downloadApplicationBrief: document.querySelector("#downloadApplicationBrief"),
  studioActionStatus: document.querySelector("#studioActionStatus"),
  weeklyTopFiveList: document.querySelector("#weeklyTopFiveList"),
  weeklyDateLabel: document.querySelector("#weeklyDateLabel"),
  appliedList: document.querySelector("#appliedList"),
  appliedEmpty: document.querySelector("#appliedEmpty"),
  metricApplied: document.querySelector("#metricApplied"),
  pipelineApplied: document.querySelector("#pipelineApplied"),
  pipelineViewed: document.querySelector("#pipelineViewed"),
  pipelineResponded: document.querySelector("#pipelineResponded"),
  pipelineInterviews: document.querySelector("#pipelineInterviews"),
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
  const saved = state.tracking[id] || {};
  return {
    favorite: false,
    stage: saved.stage === "Passed" ? "Passed / Closed" : "Not reviewed",
    notes: "",
    contact: "",
    appliedAt: "",
    nextFollowUp: "",
    statusUpdatedAt: "",
    history: [],
    jobSnapshot: null,
    ...saved,
    stage: saved.stage === "Passed" ? "Passed / Closed" : (saved.stage || "Not reviewed"),
  };
}

function dateInputValue(value) {
  if (!value) return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function todayInputValue() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function jobSnapshot(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workplace_type: job.workplace_type,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    apply_url: job.apply_url,
    score: job.score,
  };
}

function recruiterPriorityScore(job, text = "") {
  const searchable = text || `${job.title} ${job.department} ${job.description}`.toLowerCase();
  let score = Number(job.score || 0);
  if (`${job.workplace_type} ${job.location}`.toLowerCase().includes("remote")) score += 10;
  if (overlapsIdealSalary(job)) score += 14;
  if (job.salary_min >= 110000 && job.salary_min <= 135000) score += 8;
  if (/program|project|enablement|customer success|strategic partnership|client relationship|consultant|business operations/.test(searchable)) score += 12;
  if (/stakeholder|trusted advisor|cross-functional|change management|executive communication/.test(searchable)) score += 8;
  if (/software engineer|machine learning engineer|data scientist|quota-carrying|cold calling/.test(searchable)) score -= 24;
  if (/commission only|commission-only/.test(searchable)) score -= 30;
  const location = String(job.location || "").toLowerCase();
  if (location && !location.includes("remote") && !location.includes("texas") && !location.includes("dallas") && !location.includes("grapevine")) score -= 16;
  return score;
}

function buildJobCaches() {
  state.jobSearchText = new Map(state.jobs.map(job => [
    job.id,
    `${job.title} ${job.company} ${job.department} ${job.location} ${job.description}`.toLowerCase(),
  ]));

  const byId = new Map(state.jobs.map(job => [job.id, job]));
  const selected = CURATED_WEEKLY_PICKS.map(pick => byId.get(pick.id)).filter(Boolean);
  const selectedIds = new Set(selected.map(job => job.id));
  const fallback = state.jobs
    .filter(job => !selectedIds.has(job.id))
    .map(job => ({ job, score: recruiterPriorityScore(job, state.jobSearchText.get(job.id)) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.job);

  state.weeklyPicks = [...selected, ...fallback].slice(0, 5);
  state.weeklyRankMap = new Map(state.weeklyPicks.map((job, index) => [job.id, index + 1]));
}

function weeklyTopPicks() {
  return state.weeklyPicks;
}

function weeklyPickRank(id) {
  return state.weeklyRankMap.get(id) || null;
}

function weeklyPickReason(job) {
  return CURATED_WEEKLY_PICKS.find(pick => pick.id === job.id)?.reason
    || "Current verified role with the strongest balance of transferable fit, compensation, flexibility, and realistic candidacy.";
}

function weekRangeLabel() {
  const date = state.generatedAt ? new Date(state.generatedAt) : new Date();
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const short = value => value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Week of ${short(start)}–${short(end)}, ${end.getFullYear()} · Recalculated from verified roles`;
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
    const haystack = state.jobSearchText.get(job.id) || `${job.title} ${job.company} ${job.department} ${job.location}`.toLowerCase();
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

  const pinned = state.weeklyRankMap;
  return filtered.sort((a, b) => {
    const aPinned = pinned.has(a.id);
    const bPinned = pinned.has(b.id);
    if (aPinned || bPinned) {
      if (aPinned && bPinned) return pinned.get(a.id) - pinned.get(b.id);
      return aPinned ? -1 : 1;
    }
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
  const rank = weeklyPickRank(job.id);
  return `
    <article class="job-card ${rank ? `weekly-ranked rank-${rank}` : ""}" data-job-id="${escapeHtml(job.id)}">
      <div class="score-block">
        ${rank ? `<span class="rank-flag">#${rank}</span>` : ""}
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
          ${rank ? `<span class="weekly-rank-badge rank-${rank}">Highly Recommended #${rank}</span>` : ""}
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
  const visibleJobs = jobs.slice(0, state.visibleJobCount);
  els.resultSummary.textContent = jobs.length
    ? `Showing ${visibleJobs.length} of ${jobs.length} matching roles · ${state.jobs.length} current total`
    : `0 of ${state.jobs.length} opportunities shown`;
  if (!jobs.length) {
    const template = document.querySelector("#emptyTemplate");
    els.jobList.replaceChildren(template.content.cloneNode(true));
    els.jobList.querySelector("[data-clear-filters]")?.addEventListener("click", clearFilters);
  } else {
    const remaining = jobs.length - visibleJobs.length;
    els.jobList.innerHTML = visibleJobs.map(renderCard).join("")
      + (remaining > 0 ? `
        <div class="load-more-row">
          <button class="button button-primary load-more-button" type="button" data-load-more>
            Load ${Math.min(30, remaining)} more roles
          </button>
          <span>${remaining} additional matching roles available</span>
        </div>` : "");
  }
  renderFilterChips();
  renderMetrics();
  renderWeeklyTopFive();
  renderAppliedPositions();
}
function renderMetrics() {
  document.querySelector("#metricTotal").textContent = state.jobs.length;
  document.querySelector("#metricTop").textContent = state.jobs.filter(job => job.score >= 80).length;
  document.querySelector("#metricRemote").textContent = state.jobs.filter(job => `${job.workplace_type} ${job.location}`.toLowerCase().includes("remote")).length;
  document.querySelector("#metricSalary").textContent = state.jobs.filter(overlapsIdealSalary).length;
  document.querySelector("#metricSaved").textContent = Object.values(state.tracking).filter(item => item.favorite).length;
  els.metricApplied.textContent = Object.values(state.tracking).filter(item => APPLIED_STAGES.has(item.stage === "Passed" ? "Passed / Closed" : item.stage)).length;
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
  state.visibleJobCount = 30;
  renderJobs();
}

function updateFilter(key, value) {
  state.filters[key] = value;
  state.visibleJobCount = 30;
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

function renderWeeklyTopFive() {
  if (!els.weeklyTopFiveList) return;
  const picks = weeklyTopPicks();
  els.weeklyDateLabel.textContent = weekRangeLabel();
  els.weeklyTopFiveList.innerHTML = picks.map((job, index) => {
    const rank = index + 1;
    return `
      <article class="weekly-pick rank-${rank}" data-weekly-job-id="${escapeHtml(job.id)}">
        <div class="weekly-rank-number">#${rank}</div>
        <div class="weekly-pick-body">
          <div class="weekly-company">${escapeHtml(job.company)} · ${escapeHtml(job.workplace_type)}</div>
          <h3>${escapeHtml(job.title)}</h3>
          <div class="weekly-pick-meta">
            <span>${escapeHtml(formatSalary(job))}</span>
            <span>${escapeHtml(job.location)}</span>
            <span>${job.score}/100 portal match</span>
          </div>
          <p>${escapeHtml(weeklyPickReason(job))}</p>
        </div>
        <div class="weekly-pick-actions">
          <button class="button button-primary" type="button" data-view-weekly>View role</button>
          <button class="button button-secondary" type="button" data-prepare-weekly>Prepare</button>
        </div>
      </article>`;
  }).join("");
}

function applicationProgress(tracking) {
  const progress = {
    "Applied": 1,
    "Application viewed": 2,
    "Recruiter responded": 3,
    "Interview scheduled": 4,
    "Interviewing": 4,
    "Final interview": 4,
    "Offer": 5,
  };
  return Math.max(
    progress[tracking.stage] || 0,
    ...(tracking.history || []).map(item => progress[item.stage] || 0),
  );
}

function appliedEntries() {
  return Object.entries(state.tracking)
    .map(([id, value]) => {
      const tracking = trackingFor(id);
      if (!APPLIED_STAGES.has(tracking.stage)) return null;
      const currentJob = state.jobs.find(job => job.id === id);
      const job = currentJob || tracking.jobSnapshot;
      return job ? { id, job, tracking, current: Boolean(currentJob) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => String(b.tracking.statusUpdatedAt || b.tracking.appliedAt || "").localeCompare(String(a.tracking.statusUpdatedAt || a.tracking.appliedAt || "")));
}

function renderAppliedPositions() {
  if (!els.appliedList) return;
  const entries = appliedEntries();
  const progressValues = entries.map(entry => applicationProgress(entry.tracking));
  els.pipelineApplied.textContent = entries.length;
  els.pipelineViewed.textContent = progressValues.filter(value => value >= 2).length;
  els.pipelineResponded.textContent = progressValues.filter(value => value >= 3).length;
  els.pipelineInterviews.textContent = progressValues.filter(value => value >= 4).length;
  els.appliedEmpty.hidden = entries.length > 0;

  els.appliedList.innerHTML = entries.map(({ id, job, tracking, current }) => `
    <article class="applied-card" data-application-id="${escapeHtml(id)}">
      <div class="applied-card-heading">
        <div>
          <span class="applied-company">${escapeHtml(job.company)}</span>
          <h3>${escapeHtml(job.title)}</h3>
          <p>${escapeHtml(job.location || "Location not listed")} · ${escapeHtml(formatSalary(job))}</p>
        </div>
        <span class="application-status status-${escapeHtml(tracking.stage.toLowerCase().replace(/[^a-z]+/g, "-"))}">${escapeHtml(tracking.stage)}</span>
      </div>
      <div class="progress-track" aria-label="Application progress">
        <span class="${applicationProgress(tracking) >= 1 ? "complete" : ""}">Applied</span>
        <span class="${applicationProgress(tracking) >= 2 ? "complete" : ""}">Viewed</span>
        <span class="${applicationProgress(tracking) >= 3 ? "complete" : ""}">Response</span>
        <span class="${applicationProgress(tracking) >= 4 ? "complete" : ""}">Interview</span>
        <span class="${applicationProgress(tracking) >= 5 ? "complete" : ""}">Offer</span>
      </div>
      <div class="applied-fields">
        <label><span>Status</span><select data-application-field="stage">${APPLICATION_STAGES.slice(3).map(stage => `<option ${stage === tracking.stage ? "selected" : ""}>${stage}</option>`).join("")}</select></label>
        <label><span>Date applied</span><input type="date" data-application-field="appliedAt" value="${escapeHtml(dateInputValue(tracking.appliedAt))}" /></label>
        <label><span>Next follow-up</span><input type="date" data-application-field="nextFollowUp" value="${escapeHtml(dateInputValue(tracking.nextFollowUp))}" /></label>
        <label><span>Recruiter / contact</span><input type="text" data-application-field="contact" value="${escapeHtml(tracking.contact)}" placeholder="Name or email" /></label>
        <label class="applied-notes"><span>Notes and latest update</span><textarea data-application-field="notes" placeholder="Confirmation received, recruiter response, interview time, next action…">${escapeHtml(tracking.notes)}</textarea></label>
      </div>
      <div class="applied-card-footer">
        <span>${tracking.statusUpdatedAt ? `Status updated ${escapeHtml(formatDate(tracking.statusUpdatedAt))}` : "Add your latest status update"}</span>
        <div>
          ${current ? `<button class="button button-secondary" type="button" data-view-applied>View role</button><button class="button button-secondary" type="button" data-prepare-applied>Tailor résumé</button>` : ""}
          ${job.apply_url ? `<a class="button button-primary" href="${escapeHtml(job.apply_url)}" target="_blank" rel="noreferrer">Employer portal</a>` : ""}
        </div>
      </div>
      ${current ? "" : '<p class="closed-posting-note">The role is no longer in the active feed, but your application history is preserved.</p>'}
    </article>`).join("");
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
        <label><span>Stage</span><select id="dialogStage">${APPLICATION_STAGES.map(stage => `<option ${stage === tracking.stage ? "selected" : ""}>${stage}</option>`).join("")}</select></label>
        <label><span>Date applied</span><input id="dialogAppliedAt" type="date" value="${escapeHtml(dateInputValue(tracking.appliedAt))}" /></label>
        <label><span>Recruiter / contact</span><input id="dialogContact" type="text" value="${escapeHtml(tracking.contact)}" placeholder="Name or email" /></label>
        <label><span>Next follow-up</span><input id="dialogFollowUp" type="date" value="${escapeHtml(dateInputValue(tracking.nextFollowUp))}" /></label>
        <label class="tracking-notes"><span>Notes and latest update</span><textarea id="dialogNotes" placeholder="Why this role stands out, confirmation received, recruiter response, interview details…">${escapeHtml(tracking.notes)}</textarea></label>
      </div>
      <p class="tracking-updated">${tracking.statusUpdatedAt ? `Status last updated ${escapeHtml(formatDate(tracking.statusUpdatedAt))}` : "Status updates are private to this browser."}</p>
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
  els.dialogContent.querySelector("#dialogAppliedAt").addEventListener("change", event => updateTracking(job.id, { appliedAt: event.target.value }));
  els.dialogContent.querySelector("#dialogContact").addEventListener("change", event => updateTracking(job.id, { contact: event.target.value }));
  els.dialogContent.querySelector("#dialogFollowUp").addEventListener("change", event => updateTracking(job.id, { nextFollowUp: event.target.value }));
  els.dialogContent.querySelector("#dialogNotes").addEventListener("input", event => updateTracking(job.id, { notes: event.target.value }, false));
  els.dialogContent.querySelector("#dialogNotes").addEventListener("change", () => {
    renderJobs();
    renderAppliedPositions();
  });
  els.dialogContent.querySelector("#dialogFavorite").addEventListener("click", event => {
    const favorite = !trackingFor(job.id).favorite;
    updateTracking(job.id, { favorite });
    event.currentTarget.setAttribute("aria-pressed", String(favorite));
    event.currentTarget.textContent = favorite ? "★ Saved" : "☆ Save role";
  });
  els.jobDialog.showModal();
}

function updateTracking(id, changes, rerender = true) {
  const current = trackingFor(id);
  const next = { ...current, ...changes };
  const currentJob = state.jobs.find(job => job.id === id);
  if (changes.stage && changes.stage !== current.stage) {
    next.statusUpdatedAt = new Date().toISOString();
    next.history = [...(current.history || []), { stage: changes.stage, at: next.statusUpdatedAt }];
    if (APPLIED_STAGES.has(changes.stage) && !next.appliedAt) next.appliedAt = todayInputValue();
  }
  if (currentJob && (APPLIED_STAGES.has(next.stage) || next.jobSnapshot)) next.jobSnapshot = jobSnapshot(currentJob);
  state.tracking[id] = next;
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
  if (state.manualJob) return state.manualJob;
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
  const pinned = state.weeklyRankMap;
  const jobs = [...state.jobs].sort((a, b) => {
    if (pinned.has(a.id) || pinned.has(b.id)) {
      if (pinned.has(a.id) && pinned.has(b.id)) return pinned.get(a.id) - pinned.get(b.id);
      return pinned.has(a.id) ? -1 : 1;
    }
    return b.score - a.score;
  });
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
  els.openSelectedJob.href = job.apply_url || "#";
  if (job.apply_url) {
    els.openSelectedJob.removeAttribute("aria-disabled");
    els.openSelectedJob.classList.remove("disabled-link");
  } else {
    els.openSelectedJob.setAttribute("aria-disabled", "true");
    els.openSelectedJob.classList.add("disabled-link");
  }

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

function buildManualJob() {
  const company = els.manualCompany.value.trim();
  const title = els.manualTitle.value.trim();
  const location = els.manualLocation.value.trim() || "Not specified";
  const url = els.manualUrl.value.trim();
  const description = els.manualDescription.value.trim();

  if (!company || !title || !description) {
    els.studioActionStatus.textContent = "Add at least the company, job title, and the full description before using this job.";
    return;
  }

  const now = new Date().toISOString();
  state.manualJob = {
    id: `manual:${Date.now()}`,
    source_type: "manual",
    company,
    title,
    location,
    workplace_type: location,
    description,
    apply_url: url || "",
    salary_min: null,
    salary_max: null,
    salary_currency: "USD",
    score: null,
    discovered_at: now,
    verified_at: now,
  };
  state.applicationJobId = state.manualJob.id;
  els.clearManualJob.hidden = false;
  renderJobs();
  renderApplicationStudio();
  els.studioActionStatus.textContent = "Manual job added below. Scroll down to review and build your tailored application.";
  document.querySelector("#application-studio").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearManualJobEntry() {
  state.manualJob = null;
  state.applicationJobId = "";
  els.manualCompany.value = "";
  els.manualTitle.value = "";
  els.manualLocation.value = "";
  els.manualUrl.value = "";
  els.manualDescription.value = "";
  els.clearManualJob.hidden = true;
  renderApplicationStudio();
}

function prepareApplication(job) {
  state.applicationJobId = job.id;
  if (trackingFor(job.id).stage === "Not reviewed" || trackingFor(job.id).stage === "Interested") {
    updateTracking(job.id, { stage: "Preparing" }, false);
  }
  renderJobs();
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
    els.studioActionStatus.textContent = "Tailoring brief copied. Paste it into Claude with this portal open so we can produce and review the final résumé.";
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
    state.manualJob = null;
    els.clearManualJob.hidden = true;
    state.applicationJobId = event.target.value;
    renderApplicationStudio();
  });
  els.toggleManualJob.addEventListener("click", () => {
    const isHidden = els.manualJobForm.hidden;
    els.manualJobForm.hidden = !isHidden;
    els.toggleManualJob.setAttribute("aria-expanded", String(isHidden));
    els.toggleManualJob.textContent = isHidden ? "− Add a job posting manually" : "+ Add a job posting manually";
  });
  els.useManualJob.addEventListener("click", buildManualJob);
  els.clearManualJob.addEventListener("click", clearManualJobEntry);
  els.copyApplicationBrief.addEventListener("click", copyApplicationBrief);
  els.downloadApplicationBrief.addEventListener("click", downloadApplicationBrief);
  els.weeklyTopFiveList.addEventListener("click", event => {
    const card = event.target.closest("[data-weekly-job-id]");
    if (!card) return;
    const job = state.jobs.find(item => item.id === card.dataset.weeklyJobId);
    if (!job) return;
    if (event.target.closest("[data-view-weekly]")) openJob(job);
    if (event.target.closest("[data-prepare-weekly]")) prepareApplication(job);
  });
  els.appliedList.addEventListener("change", event => {
    const card = event.target.closest("[data-application-id]");
    const field = event.target.dataset.applicationField;
    if (!card || !field) return;
    updateTracking(card.dataset.applicationId, { [field]: event.target.value });
  });
  els.appliedList.addEventListener("click", event => {
    const card = event.target.closest("[data-application-id]");
    if (!card) return;
    const job = state.jobs.find(item => item.id === card.dataset.applicationId);
    if (!job) return;
    if (event.target.closest("[data-view-applied]")) openJob(job);
    if (event.target.closest("[data-prepare-applied]")) prepareApplication(job);
  });
  els.jobList.addEventListener("click", event => {
    if (event.target.closest("[data-load-more]")) {
      state.visibleJobCount += 30;
      renderJobs();
      return;
    }
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
    state.visibleJobCount = 30;
    buildJobCaches();
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
