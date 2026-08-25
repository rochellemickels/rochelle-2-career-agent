import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AppliedDataTests(unittest.TestCase):
    def setUp(self):
        self.applications = json.loads(
            (ROOT / "docs/data/applied.json").read_text(encoding="utf-8")
        )["applications"]

    def test_contains_nine_confirmed_submissions(self):
        self.assertEqual(len(self.applications), 9)
        identities = {(item["company"], item["title"]) for item in self.applications}
        self.assertIn(
            ("Pinterest", "Lead Program Manager, Global SMB Sales Enablement"),
            identities,
        )
        self.assertIn(("DoorDash", "Manager, Ecosystem Partnerships & Business Development"), identities)

    def test_unknown_dates_are_not_invented(self):
        unknown = [item for item in self.applications if item["applied_at"] is None]
        self.assertEqual(len(unknown), 4)

    def test_filled_welbehealth_posting_is_closed_but_preserved(self):
        welbe = next(item for item in self.applications if item["company"] == "WelbeHealth")
        self.assertEqual(welbe["stage"], "passed")
        self.assertIn("posting later showed as filled", welbe["note"])


if __name__ == "__main__":
    unittest.main()
