import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from rochelle_agent.models import Job, SourceStatus  # noqa: E402
from rochelle_agent.scan import run_scan  # noqa: E402


class FakeSource:
    def __init__(self, jobs):
        self.jobs = jobs

    def collect(self):
        return self.jobs, SourceStatus(
            company="Example",
            source_type="greenhouse",
            slug="example",
            status="ok",
            jobs_found=len(self.jobs),
        )


class ScanTests(unittest.TestCase):
    def test_portal_database_keeps_relevant_roles_only(self):
        relevant = Job(
            id="relevant",
            source_type="greenhouse",
            source_slug="example",
            company="Example",
            title="Director, Strategic Partnerships",
            location="Remote - United States",
            workplace_type="Remote",
            description="Lead executive partnerships and market expansion.",
            apply_url="https://example.com/relevant",
        ).ensure_fingerprint()
        unrelated = Job(
            id="unrelated",
            source_type="greenhouse",
            source_slug="example",
            company="Example",
            title="Senior Director of Product, Ads Platform",
            location="Remote - United States",
            workplace_type="Remote",
            description="Lead the product roadmap and product management organization.",
            apply_url="https://example.com/unrelated",
        ).ensure_fingerprint()
        foreign_only = Job(
            id="foreign",
            source_type="greenhouse",
            source_slug="example",
            company="Example",
            title="Director, Strategic Partnerships",
            location="Remote - United Kingdom",
            workplace_type="Remote",
            description="Lead strategic partnerships and executive relationships.",
            apply_url="https://example.com/foreign",
        ).ensure_fingerprint()

        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            sources = temp / "sources.json"
            output = temp / "jobs.json"
            status = temp / "status.json"
            sources.write_text(json.dumps({"sources": [{"company": "Example", "type": "greenhouse", "slug": "example"}]}))
            with patch("rochelle_agent.scan.build_source", return_value=FakeSource([relevant, unrelated, foreign_only])):
                result = run_scan(
                    ROOT / "config/profile.json",
                    sources,
                    output,
                    status,
                )

        self.assertEqual([job["id"] for job in result["jobs"]], ["relevant"])
        self.assertEqual(result["metadata"]["matching_method"], "transparent-rules-v1")
        self.assertEqual(result["metadata"]["cost_mode"], "free")


if __name__ == "__main__":
    unittest.main()
