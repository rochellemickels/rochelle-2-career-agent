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

    def test_ideal_role_scores_strongly(self):
        job = Job(
            id="test:1",
            source_type="greenhouse",
            source_slug="test",
            company="Purpose AI",
            title="Senior Director, Strategic Partnerships",
            location="Remote - United States",
            workplace_type="Remote",
            description=(
                "Lead strategy and manage a team building AI partnerships. Work with executive "
                "stakeholders and small business customers. We value inclusion, integrity, and "
                "responsible AI. Salary: $175,000 - $215,000. " * 8
            ),
            apply_url="https://example.com/jobs/1",
            salary_min=175000,
            salary_max=215000,
        ).ensure_fingerprint()
        scored = score_job(job, self.profile)
        self.assertGreaterEqual(scored.score, 85)
        self.assertEqual(scored.breakdown.compensation, 20)
        self.assertEqual(scored.breakdown.work_style, 15)

    def test_missing_salary_is_not_invented(self):
        job = Job(
            id="test:2",
            source_type="lever",
            source_slug="test",
            company="Example",
            title="Director, Business Development",
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
