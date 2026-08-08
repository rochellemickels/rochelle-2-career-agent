import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from rochelle_agent.sources import (  # noqa: E402
    AshbySource,
    GreenhouseSource,
    LeverSource,
    clean_text,
    extract_salary,
    infer_workplace,
)


class SourceHelpersTests(unittest.TestCase):
    def test_extracts_annual_salary_range(self):
        self.assertEqual(extract_salary("Base salary $150,000 - $205,000 annually"), (150000, 205000))
        self.assertEqual(extract_salary("Expected range: $165k to $220k"), (165000, 220000))

    def test_does_not_convert_hourly_rate(self):
        self.assertEqual(extract_salary("This contract pays $75/hour"), (None, None))

    def test_cleans_html(self):
        self.assertEqual(clean_text("<p>Lead &amp; grow</p>"), "Lead & grow")

    def test_infers_remote(self):
        self.assertEqual(infer_workplace("Remote - US"), "Remote")

    @patch("rochelle_agent.sources._get_json")
    def test_greenhouse_normalization(self, get_json):
        get_json.return_value = {
            "jobs": [{
                "id": 101,
                "title": "Director, Strategic Partnerships",
                "location": {"name": "Remote - United States"},
                "absolute_url": "https://example.com/101",
                "updated_at": "2026-08-07T12:00:00Z",
                "departments": [{"name": "Partnerships"}],
                "content": "<p>Base salary $160,000 - $190,000</p>",
            }]
        }
        jobs = GreenhouseSource("Example", "example").fetch()
        self.assertEqual(jobs[0].salary_max, 190000)
        self.assertEqual(jobs[0].workplace_type, "Remote")

    @patch("rochelle_agent.sources._get_json")
    def test_lever_normalization(self, get_json):
        get_json.return_value = [{
            "id": "abc",
            "text": "VP, Business Development",
            "categories": {"location": "Remote", "department": "Growth"},
            "workplaceType": "remote",
            "descriptionPlain": "Lead market expansion.",
            "hostedUrl": "https://example.com/abc",
            "createdAt": 1786104000000,
            "salaryRange": {"min": 180000, "max": 240000},
        }]
        jobs = LeverSource("Example", "example").fetch()
        self.assertEqual(jobs[0].department, "Growth")
        self.assertEqual(jobs[0].salary_min, 180000)

    @patch("rochelle_agent.sources._get_json")
    def test_ashby_normalization(self, get_json):
        get_json.return_value = {"jobs": [{
            "id": "xyz",
            "title": "Head of Partnerships",
            "location": "Dallas, TX",
            "workplaceType": "Hybrid",
            "descriptionPlain": "AI ecosystem leadership",
            "jobUrl": "https://example.com/xyz",
            "publishedAt": "2026-08-07T12:00:00Z",
            "compensationTierSummary": "$170k–$210k",
        }]}
        jobs = AshbySource("Example", "example").fetch()
        self.assertEqual(jobs[0].workplace_type, "Hybrid")
        self.assertEqual(jobs[0].salary_max, 210000)


if __name__ == "__main__":
    unittest.main()
