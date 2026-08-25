import json
import unittest
from pathlib import Path

from rochelle_agent.models import Job
from rochelle_agent.scoring import determine_location, score_job


ROOT = Path(__file__).resolve().parents[1]
PROFILE = json.loads((ROOT / "config/profile.json").read_text(encoding="utf-8"))


def job(**overrides):
    values = {
        "id": "test:1",
        "source_type": "test",
        "source_slug": "test",
        "company": "Example",
        "title": "Strategic Partnerships Manager",
        "location": "Remote - United States",
        "workplace_type": "Remote",
        "description": "Lead strategic partnerships, cross-functional implementation, customer adoption, stakeholder alignment, and market expansion for SMB customers.",
        "apply_url": "https://example.com/job",
        "salary_min": 115000,
        "salary_max": 135000,
    }
    values.update(overrides)
    return Job(**values)


class ScoringTests(unittest.TestCase):
    def test_strong_business_role_scores_high(self):
        scored = score_job(job(), PROFILE)
        self.assertGreaterEqual(scored.score, 70)
        self.assertTrue(scored.default_visible)
        self.assertEqual(scored.salary_band, "Ideal overlap")

    def test_personal_quota_is_a_hard_penalty(self):
        scored = score_job(job(description="Own an individual quota, full sales cycle, OTE, and close new logos."), PROFILE)
        self.assertLess(scored.score, PROFILE["default_view_min_score"])
        self.assertFalse(scored.default_visible)
        self.assertIn("Personal quota / incentive-compensation ownership", scored.hard_flags)

    def test_deep_technical_depth_is_a_hard_penalty(self):
        scored = score_job(job(description="Use Git, CI/CD, SQL proficiency, Kubernetes, and Python programming to deploy models."), PROFILE)
        self.assertLess(scored.score, PROFILE["default_view_min_score"])
        self.assertFalse(scored.default_visible)
        self.assertIn("Deep hands-on technical practitioner requirements", scored.hard_flags)

    def test_ontario_california_is_us(self):
        self.assertEqual(determine_location(job(location="Ontario, CA"), PROFILE), "Eligible — US")

    def test_canadian_city_is_non_us(self):
        self.assertEqual(determine_location(job(location="Toronto, Ontario, Canada"), PROFILE), "Non-US only")

    def test_score_equals_visible_breakdown_total(self):
        scored = score_job(job(), PROFILE)
        self.assertEqual(scored.score, scored.breakdown.total)


if __name__ == "__main__":
    unittest.main()
