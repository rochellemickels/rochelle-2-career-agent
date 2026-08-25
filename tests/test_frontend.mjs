import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationIdentity,
  applyCompanyCap,
  formatDate,
  matchesFilters,
  migrateLegacyTracking,
  normalizeLegacyStage,
} from "../docs/assets/app.mjs";
import {
  buildTailoringBrief,
  createDocumentDefinition,
  resumeTextFromStoredValue,
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
