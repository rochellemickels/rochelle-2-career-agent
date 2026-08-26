import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationIdentity,
  applyCompanyCap,
  formatDate,
  matchesFilters,
  mergeApplicationDetails,
  migrateLegacyTracking,
  normalizeLegacyStage,
} from "../docs/assets/app.mjs";
import {
  buildTailoringBrief,
  cleanJobDescription,
  createDocumentDefinition,
  estimateAnthropicCost,
  extractPostingFields,
  generateTailoredDocuments,
  loadJobPostingFromUrl,
  resumeTextFromStoredValue,
  unsupportedQuantifiedClaims,
  validateCoverLetterText,
  validateResumeText,
} from "../docs/assets/studio.mjs";

const base = {
  title: "Implementation Program Manager",
  company: "Example",
  description: "Lead onboarding and cross-functional customer adoption.",
  default_visible: true,
  hard_flags: [],
  career_lane: "Program & Project Management",
  workplace_type: "Remote",
  location_eligibility: "Eligible — US",
  salary_band: "Ideal overlap",
};

test("all filters genuinely combine", () => {
  const filters = {
    search: "onboarding",
    fit: "recommended",
    company: "Example",
    lane: "Program & Project Management",
    work: "Remote",
    location: "Eligible — US",
    salary: "Ideal overlap",
    stage: "active",
  };
  assert.equal(matchesFilters(base, filters, "saved"), true);
  assert.equal(matchesFilters({ ...base, company: "Other" }, filters, "saved"), false);
  assert.equal(matchesFilters(base, filters, "skipped"), false);
});

test("text search covers title, company, and description", () => {
  const filters = { search: "customer adoption", fit: "all", company: "", lane: "", work: "", location: "", salary: "", stage: "all" };
  assert.equal(matchesFilters(base, filters, ""), true);
});

test("default list caps each company at three", () => {
  const jobs = Array.from({ length: 6 }, (_, index) => ({ ...base, id: index, company: index < 5 ? "A" : "B" }));
  assert.equal(applyCompanyCap(jobs, "", 3).filter((job) => job.company === "A").length, 3);
  assert.equal(applyCompanyCap(jobs.filter((job) => job.company === "A"), "A", 3).length, 5);
});

test("application identity matches the same role despite case and spacing", () => {
  assert.equal(
    applicationIdentity({ company: " Pinterest ", title: "Lead  Program Manager" }),
    applicationIdentity({ company: "pinterest", title: "lead program manager" }),
  );
});

test("editable application details override seeded or scanned fields", () => {
  const result = mergeApplicationDetails(
    { company: "Original", title: "Original Role", apply_url: "https://old.example", note: "Old note", rating: 2 },
    { applicationDetails: { company: "Updated", title: "New Direction", applyUrl: "https://new.example", note: "Follow up Friday", rating: 5 } },
  );
  assert.equal(result.company, "Updated");
  assert.equal(result.title, "New Direction");
  assert.equal(result.apply_url, "https://new.example");
  assert.equal(result.applicationNote, "Follow up Friday");
  assert.equal(result.rating, 5);
});

test("date-only application records preserve the stated calendar date", () => {
  assert.equal(formatDate("2026-08-21"), "August 21, 2026");
});

test("legacy stages map to the new application pipeline", () => {
  assert.equal(normalizeLegacyStage("Skip - Not a good fit"), "skipped");
  assert.equal(normalizeLegacyStage("Passed / Closed"), "passed");
  assert.equal(normalizeLegacyStage("Application Viewed"), "viewed");
  assert.equal(normalizeLegacyStage("Employer Responded"), "responded");
});

test("legacy migration preserves application evidence but newer tracking wins", () => {
  const legacy = {
    old: { stage: "Applied", appliedAt: "2026-08-20", notes: "Referral", jobSnapshot: { company: "Example", title: "Role" } },
    changed: { stage: "Applied", appliedAt: "2026-08-21" },
    skipped: { stage: "Skip - Not a good fit", appliedAt: "" },
  };
  const result = migrateLegacyTracking({ changed: { stage: "interview", appliedAt: "2026-08-21" } }, legacy);
  assert.equal(result.old.stage, "applied");
  assert.equal(result.old.confirmedApplied, true);
  assert.equal(result.old.jobSnapshot.title, "Role");
  assert.equal(result.changed.stage, "interview");
  assert.equal(result.skipped.confirmedApplied, false);
});

test("legacy master resume storage is read without publishing it", () => {
  assert.equal(resumeTextFromStoredValue(JSON.stringify({ name: "resume.docx", text: "Approved résumé facts" })), "Approved résumé facts");
});

test("tailoring brief includes full job evidence, resume, and locked voice rules", () => {
  const brief = buildTailoringBrief({
    company: "Pinterest",
    title: "Lead Program Manager",
    description: "Lead enablement programs.",
    score: 78,
    strengths: ["Cross-functional leadership"],
    gaps: ["Global scope"],
  }, "AO Globe Life approved evidence", { name: "Rochelle Magpantay", headline: "Leader", tagline: "Adoption", contact: "Dallas" });
  assert.match(brief, /Lead enablement programs/);
  assert.match(brief, /AO Globe Life approved evidence/);
  assert.match(brief, /Never use she, her, or hers/);
  assert.match(brief, /EARLIER LEADERSHIP & BUSINESS DEVELOPMENT EXPERIENCE/);
});

test("job descriptions are clean text in the copyable brief", () => {
  assert.equal(cleanJobDescription('<div><p>Lead &amp; coach.</p><ul><li>Build programs</li></ul></div>'), "Lead & coach.\n\n- Build programs");
});

test("outside posting extraction reads title metadata, end-of-post salary, and application URL", () => {
  const posting = `Manager, Strategic Initiatives
Remote — US
Full-Time

Lead executive-sponsored strategic initiatives.

The Perks
Medical, dental, and vision coverage.

Estimated Pay Range
$150,000 - $160,000 USD

Apply for this job: https://company.example/jobs/8105790`;
  const fields = extractPostingFields(posting);
  assert.equal(fields.location.value, "Remote — US");
  assert.equal(fields.workStyle.value, "Remote");
  assert.equal(fields.salary.low, 150000);
  assert.equal(fields.salary.high, 160000);
  assert.equal(fields.applicationUrl.value, "https://company.example/jobs/8105790");
  assert.match(fields.salary.evidence, /\$150,000 - \$160,000 USD/);
  assert.equal(fields.salary.confidence, "High confidence");
});

test("pasted posting auto-detects opening company and title without correction fields", () => {
  const fields = extractPostingFields(`NTT DATA
AI Consultant - Products
Remote — US or Dallas, TX

Lead client adoption programs.

Salary Range
$115,000 - $135,000 USD`);
  assert.equal(fields.company.value, "NTT DATA");
  assert.equal(fields.title.value, "AI Consultant - Products");
  assert.equal(fields.location.value, "Remote — US or Dallas, TX");
  assert.equal(fields.workStyle.value, "Remote");
  assert.equal(fields.salary.low, 115000);
  assert.equal(fields.salary.high, 135000);
});

test("Greenhouse URL import loads structured job details in one request", async () => {
  let requestedUrl = "";
  const fakeFetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({
        title: "Manager, Strategic Initiatives",
        content: "<p>Lead executive programs.</p><p>Estimated Pay Range</p><p>$150,000 - $160,000 USD</p>",
        location: { name: "Remote — US" },
        absolute_url: "https://job-boards.greenhouse.io/trace3/jobs/8105790",
      }),
    };
  };
  const job = await loadJobPostingFromUrl("https://job-boards.greenhouse.io/trace3/jobs/8105790", fakeFetch);
  assert.equal(requestedUrl, "https://boards-api.greenhouse.io/v1/boards/trace3/jobs/8105790");
  assert.equal(job.company, "Trace3");
  assert.equal(job.title, "Manager, Strategic Initiatives");
  assert.equal(job.location, "Remote — US");
  assert.match(job.description, /Lead executive programs/);
});

test("blocked URL import asks only for the full description", async () => {
  await assert.rejects(
    loadJobPostingFromUrl("https://careers.example.com/jobs/role", async () => { throw new Error("CORS"); }),
    /Paste the full job description instead/,
  );
});

test("Not listed fields include an explicit quoted absence check", () => {
  const fields = extractPostingFields("Role overview\nLead cross-functional initiatives.\nBenefits\nMedical coverage.");
  assert.equal(fields.location.value, "Not listed");
  assert.match(fields.location.evidence, /Checked the entire supplied posting/);
  assert.match(fields.location.evidence, /“[^”]+”/);
  assert.equal(fields.applicationUrl.value, "Not listed");
  assert.match(fields.applicationUrl.evidence, /Apply or application section/);
});

test("tailoring brief reports extraction confidence and exact evidence", () => {
  const brief = buildTailoringBrief({
    company: "Trace3",
    title: "Manager, Strategic Initiatives",
    description: "Remote — US\nEstimated Pay Range\n$150,000 - $160,000 USD",
    apply_url: "https://company.example/job",
    score: "—",
  }, "Approved résumé facts");
  assert.match(brief, /FIELD EXTRACTION VERIFICATION/);
  assert.match(brief, /Published salary: High confidence/);
  assert.match(brief, /Exact compensation line/);
});

test("resume and cover letter validation enforce the locked voice", () => {
  const sections = [
    "EXECUTIVE PROFILE\nBuilt programs.",
    "CORE STRENGTHS\nTrust | Adoption",
    "PROFESSIONAL EXPERIENCE\nAO Globe Life",
    "EARLIER LEADERSHIP & BUSINESS DEVELOPMENT EXPERIENCE\nVerizon",
    "EDUCATION & PROFESSIONAL DEVELOPMENT\nB.S.",
  ].join("\n");
  assert.deepEqual(validateResumeText(sections, { title: "Program Manager" }), []);
  assert.ok(validateResumeText(`${sections}\nPRACTICAL AI USE\nI use AI.`, { title: "Program Manager" }).length >= 2);
  assert.ok(validateCoverLetterText("She is a perfect fit.").length >= 2);
});

test("Word definition uses the locked margins and header styling", () => {
  class Item { constructor(options) { this.options = options; } }
  const fakeDocx = {
    AlignmentType: { CENTER: "center" },
    BorderStyle: { SINGLE: "single" },
    Document: Item,
    Paragraph: Item,
    TextRun: Item,
  };
  const doc = createDocumentDefinition(fakeDocx, "cover", "Dear Hiring Manager,\n\nI build durable programs.", {
    name: "Rochelle Magpantay", headline: "LEADER", tagline: "Adoption", contact: "Dallas",
  });
  assert.deepEqual(doc.options.sections[0].properties.page.margin, { top: 835, bottom: 792, left: 979, right: 979 });
  assert.equal(doc.options.sections[0].children[0].options.children[0].options.color, "17365D");
  assert.equal(doc.options.sections[0].children[0].options.children[0].options.size, 44);
});

test("unsupported quantified claims are flagged against the master resume", () => {
  assert.deepEqual(
    unsupportedQuantifiedClaims("Managed 5,000+ accounts and improved adoption 17%.", "Managed 5,000+ accounts."),
    ["17%"],
  );
});

test("Claude cost estimate uses current Sonnet 5 token rates", () => {
  assert.equal(estimateAnthropicCost({ input_tokens: 5000, output_tokens: 3000 }), 0.04);
});

test("customization makes exactly one structured Claude request", async () => {
  let calls = 0;
  let request;
  const fakeFetch = async (url, options) => {
    calls += 1;
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        model: "claude-sonnet-5",
        usage: { input_tokens: 2000, output_tokens: 2500 },
        content: [{ type: "text", text: JSON.stringify({ resume: "EXECUTIVE PROFILE\nTruthful draft", cover_letter: "Dear Hiring Manager,\n\nI build durable programs." }) }],
      }),
    };
  };
  const result = await generateTailoredDocuments({
    apiKey: "unit-test-key",
    job: { ...base, id: "role-1", score: 90, strengths: [], gaps: [] },
    masterResumeText: "Approved resume facts",
    profile: { name: "Rochelle Magpantay", headline: "LEADER", tagline: "Adoption", contact: "Dallas" },
  }, fakeFetch);
  assert.equal(calls, 1);
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.options.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(request.options.headers["x-api-key"], "unit-test-key");
  assert.equal(request.body.model, "claude-sonnet-5");
  assert.equal(request.body.max_tokens, 6500);
  assert.equal(request.body.output_config.format.type, "json_schema");
  assert.equal(result.coverLetter, "Dear Hiring Manager,\n\nI build durable programs.");
});

test("missing API key fails before any network request", async () => {
  let calls = 0;
  await assert.rejects(
    generateTailoredDocuments({ apiKey: "", job: base, masterResumeText: "facts", profile: {} }, async () => { calls += 1; }),
    /API key/,
  );
  assert.equal(calls, 0);
});
