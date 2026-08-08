import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from rochelle_agent.models import Job  # noqa: E402
from rochelle_agent.scoring import deduplicate, score_job  # noqa: E402


class ScoringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile = json.loads((ROOT / "config/profile.json").read_text())

    def test_ideal_manager_role_and_salary_score_strongly(self):
        job = Job(
            id="test:1",
            source_type="greenhouse",
            source_slug="test",
            company="Purpose AI",
            title="Strategic Partnerships Manager",
            location="Remote - United States",
            workplace_type="Remote",
            description=(
                "Lead strategy and manage a team building AI partnerships. Work with executive "
                "stakeholders and small business customers. We value inclusion, integrity, and "
                "responsible AI. This role is eligible for an annual bonus. " * 8
            ),
            apply_url="https://example.com/jobs/1",
            salary_min=115000,
            salary_max=130000,
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertGreaterEqual(scored.score, 85)
        self.assertEqual(scored.breakdown.compensation, 20)
        self.assertEqual(scored.breakdown.work_style, 15)

    def test_strong_director_fit_is_not_discarded(self):
        job = Job(
            id="test:director",
            source_type="greenhouse",
            source_slug="test",
            company="Growth AI",
            title="Director, Strategic Partnerships",
            location="Remote - United States",
            workplace_type="Remote",
            description=(
                "Build and lead a team through strategic partnerships, executive stakeholders, "
                "cross-functional solution discovery, market expansion, and revenue growth. "
                "Guide implementation and customer outcomes for complex AI solutions. " * 6
            ),
            apply_url="https://example.com/jobs/director",
            salary_min=145000,
            salary_max=175000,
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertEqual(scored.breakdown.role_fit, 25)
        self.assertEqual(scored.breakdown.compensation, 18)
        self.assertTrue(any("Director scope aligns" in item for item in scored.strengths))

    def test_bonus_improves_a_preferred_floor_salary(self):
        plain = Job(
            id="test:plain",
            source_type="lever",
            source_slug="test",
            company="Example",
            title="Implementation Manager",
            location="Remote - United States",
            workplace_type="Remote",
            description="Lead cross-functional customer implementation.",
            apply_url="https://example.com/jobs/plain",
            salary_min=95000,
            salary_max=105000,
        ).ensure_fingerprint()
        bonus = plain.model_copy(
            update={"id": "test:bonus", "description": plain.description + " Annual bonus eligible."}
        )
        self.assertEqual(score_job(plain, self.profile).breakdown.compensation, 15)
        self.assertEqual(score_job(bonus, self.profile).breakdown.compensation, 16)

    def test_range_with_low_end_below_ideal_does_not_get_full_salary_points(self):
        job = Job(
            id="test:wide-range",
            source_type="greenhouse",
            source_slug="test",
            company="Example",
            title="Partner Program Manager",
            location="Remote - United States",
            workplace_type="Remote",
            description="Lead partner programs and customer outcomes.",
            apply_url="https://example.com/jobs/wide-range",
            salary_min=85000,
            salary_max=144000,
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertEqual(scored.breakdown.compensation, 17)
        self.assertTrue(any("below the $110K ideal floor" in gap for gap in scored.gaps))

    def test_bridge_salary_remains_visible_but_lower_priority(self):
        job = Job(
            id="test:bridge",
            source_type="lever",
            source_slug="test",
            company="Example",
            title="Business Transformation Manager",
            location="Remote - United States",
            workplace_type="Remote",
            description="Lead customer transformation and implementation.",
            apply_url="https://example.com/jobs/bridge",
            salary_min=85000,
            salary_max=95000,
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertEqual(scored.breakdown.compensation, 9)
        self.assertTrue(any("bridge range" in gap for gap in scored.gaps))

    def test_missing_salary_is_not_invented(self):
        job = Job(
            id="test:2",
            source_type="lever",
            source_slug="test",
            company="Example",
            title="Business Development Manager",
            location="Remote",
            workplace_type="Remote",
            description="Lead partnerships and market expansion.",
            apply_url="https://example.com/jobs/2",
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertIsNone(scored.salary_max)
        self.assertEqual(scored.breakdown.compensation, 6)
        self.assertTrue(any("Salary is not confirmed" in gap for gap in scored.gaps))

    def test_deduplicates_same_company_title_location(self):
        short = Job(
            id="a",
            source_type="greenhouse",
            source_slug="x",
            company="Example",
            title="Director, Partnerships",
            location="Remote",
            description="short",
            apply_url="https://example.com/a",
        )
        long = short.model_copy(update={"id": "b", "description": "a much longer description"})
        result = deduplicate([short, long])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].id, "b")

    def test_technical_ecosystem_role_is_not_a_false_positive(self):
        job = Job(
            id="test:technical",
            source_type="greenhouse",
            source_slug="test",
            company="Example",
            title="Machine Learning Manager, Feed Ecosystems",
            location="Remote - United States",
            workplace_type="Remote",
            description="Lead machine learning engineering for recommendation systems and AI models.",
            apply_url="https://example.com/jobs/technical",
            salary_min=250000,
            salary_max=350000,
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertEqual(scored.breakdown.role_fit, 1)
        self.assertLess(scored.score, 60)


if __name__ == "__main__":
    unittest.main()
