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
    def test_authoritative_compensation_target(self):
        self.assertEqual(PROFILE["salary"]["ideal_min"], 115000)
        self.assertEqual(PROFILE["salary"]["ideal_max"], 135000)

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

    def test_onsite_role_outside_dfw_is_hidden_from_default(self):
        scored = score_job(
            job(
                location="Salt Lake City, Utah, United States",
                workplace_type="Onsite",
            ),
            PROFILE,
        )
        self.assertFalse(scored.default_visible)
        self.assertIn("Outside the remote-US or DFW-hybrid target", scored.gaps)

    def test_dfw_hybrid_role_is_eligible_for_default(self):
        scored = score_job(
            job(
                location="Dallas, Texas, United States",
                workplace_type="Hybrid",
            ),
            PROFILE,
        )
        self.assertTrue(scored.default_visible)

    def test_director_role_is_a_visible_stretch_not_a_title_exclusion(self):
        scored = score_job(
            job(
                company="HubSpot",
                title="Director, Strategic Partnerships",
                description="Lead strategic partnerships, cross-functional programs, customer adoption, executive relationships, and market expansion for small businesses.",
            ),
            PROFILE,
        )
        self.assertTrue(scored.default_visible)
        self.assertFalse(scored.hard_flags)
        self.assertIn(
            "Director-level stretch: validate scope against transferable leadership evidence",
            scored.gaps,
        )
        self.assertEqual(scored.recommended_action, "Strong stretch review")

    def test_director_role_with_personal_quota_is_still_hard_penalized(self):
        scored = score_job(
            job(
                title="Director, Business Development",
                description="Own an individual quota, OTE, and the full sales cycle.",
            ),
            PROFILE,
        )
        self.assertFalse(scored.default_visible)
        self.assertIn("Personal quota / incentive-compensation ownership", scored.hard_flags)

    def test_priority_company_is_only_a_soft_positive_inside_the_same_score(self):
        preferred = score_job(
            job(company="HubSpot", description="Lead strategic partnerships and executive relationships."),
            PROFILE,
        )
        other = score_job(
            job(company="Example", description="Lead strategic partnerships and executive relationships."),
            PROFILE,
        )
        self.assertEqual(
            preferred.breakdown.business_context,
            other.breakdown.business_context + 2,
        )

    def test_mission_alignment_is_a_soft_positive(self):
        aligned = score_job(
            job(description="Lead client relationships supporting veterans and the military community."),
            PROFILE,
        )
        neutral = score_job(
            job(description="Lead client relationships supporting regional organizations."),
            PROFILE,
        )
        self.assertGreater(
            aligned.breakdown.business_context,
            neutral.breakdown.business_context,
        )

    def test_score_equals_visible_breakdown_total(self):
        scored = score_job(job(), PROFILE)
        self.assertEqual(scored.score, scored.breakdown.total)


if __name__ == "__main__":
    unittest.main()
