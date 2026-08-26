import ast
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "src/rochelle_agent"


class ArchitectureTests(unittest.TestCase):
    def test_only_one_scoring_module_exists(self):
        self.assertTrue((PACKAGE / "scoring.py").exists())
        self.assertFalse((PACKAGE / "scorer.py").exists())

    def test_scan_imports_live_scoring_module(self):
        tree = ast.parse((PACKAGE / "scan.py").read_text(encoding="utf-8"))
        modules = [node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]
        self.assertIn("scoring", modules)
        self.assertNotIn("scorer", modules)

    def test_frontend_contains_no_score_formula(self):
        app = (ROOT / "docs/assets/app.mjs").read_text(encoding="utf-8")
        self.assertNotIn("calculateScore", app)
        self.assertNotIn("rankScore", app)

    def test_no_anthropic_secret_is_committed(self):
        secret_pattern = re.compile(r"sk-ant-[A-Za-z0-9_-]{10,}")
        checked_suffixes = {".py", ".mjs", ".js", ".html", ".json", ".yml", ".yaml", ".md"}
        for path in ROOT.rglob("*"):
            if path.is_file() and path.suffix in checked_suffixes and ".git" not in path.parts:
                self.assertIsNone(secret_pattern.search(path.read_text(encoding="utf-8", errors="ignore")), path)

    def test_manual_application_editor_and_decagon_seed_exist(self):
        html = (ROOT / "docs/index.html").read_text(encoding="utf-8")
        for field_id in ("manualCompany", "manualTitle", "manualAppliedAt", "manualNote", "manualApplyUrl", "manualRating", "manualStage"):
            self.assertIn(f'id="{field_id}"', html)
        applied = json.loads((ROOT / "docs/data/applied.json").read_text(encoding="utf-8"))["applications"]
        decagon = next(item for item in applied if item["id"] == "applied:decagon:agent-strategy-manager")
        self.assertEqual(decagon["applied_at"], "2026-08-25")
        self.assertEqual(decagon["rating"], 4)
        self.assertIn("jobs.ashbyhq.com/decagon/", decagon["apply_url"])


if __name__ == "__main__":
    unittest.main()
