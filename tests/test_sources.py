import json
import unittest
from pathlib import Path

from rochelle_agent.sources import extract_salary


ROOT = Path(__file__).resolve().parents[1]


class SourceTests(unittest.TestCase):
    def test_extracts_annual_range(self):
        self.assertEqual(extract_salary("Base salary $110,000 - $135,000 plus bonus"), (110000, 135000))

    def test_does_not_convert_hourly_rate(self):
        self.assertEqual(extract_salary("Pay is $55 per hour"), (None, None))

    def test_priority_company_sources_are_watched(self):
        sources = json.loads((ROOT / "config/sources.json").read_text(encoding="utf-8"))["sources"]
        by_company = {source["company"]: source for source in sources}
        for company in ("Gusto", "Toast", "Dialpad", "GoDaddy", "Block"):
            self.assertIn(company, by_company)
            self.assertEqual(by_company[company]["priority"], 1)


if __name__ == "__main__":
    unittest.main()
