import assert from "node:assert/strict";
import test from "node:test";

import { applyCompanyCap, matchesFilters } from "../docs/assets/app.mjs";

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
