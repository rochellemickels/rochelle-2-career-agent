import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from rochelle_agent.models import Job, SourceStatus
from rochelle_agent.scan import run_scan


ROOT = Path(__file__).resolve().parents[1]


class FakeSource:
    def collect(self):
        jobs = [
            Job(
                id="fake:us",
                source_type="fake",
                source_slug="fake",
                company="Example",
                title="Implementation Program Manager",
                location="Remote - United States",
                workplace_type="Remote",
                description="Lead cross-functional implementation, onboarding, customer adoption, training, and stakeholder alignment for SMB customers.",
                apply_url="https://example.com/us",
                salary_min=110000,
                salary_max=135000,
            ).ensure_fingerprint(),
            Job(
                id="fake:ca",
                source_type="fake",
                source_slug="fake",
                company="Example",
                title="Partnerships Manager",
                location="Toronto, Ontario, Canada",
                workplace_type="Remote",
                description="Lead strategic partnerships.",
                apply_url="https://example.com/ca",
            ).ensure_fingerprint(),
        ]
        return jobs, SourceStatus(company="Example", source_type="fake", slug="fake", status="ok", jobs_found=2)


class ScanTests(unittest.TestCase):
    def test_scan_publishes_us_role_with_one_exact_score(self):
        with tempfile.TemporaryDirectory() as temp:
            temp_path = Path(temp)
            sources = temp_path / "sources.json"
            sources.write_text(json.dumps({"sources": [{"company": "Example", "type": "fake", "slug": "fake"}]}), encoding="utf-8")
            output = temp_path / "jobs.json"
            status = temp_path / "status.json"
            with patch("rochelle_agent.scan.build_source", return_value=FakeSource()):
                payload = run_scan(ROOT / "config/profile.json", sources, output, status)
            self.assertEqual(len(payload["jobs"]), 1)
            published = payload["jobs"][0]
            self.assertEqual(published["id"], "fake:us")
            self.assertEqual(published["score"], max(0, min(100, sum(published["breakdown"].values()))))
            self.assertEqual(payload["metadata"]["scoring_authority"], "src/rochelle_agent/scoring.py::score_job")


if __name__ == "__main__":
    unittest.main()
