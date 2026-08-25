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
