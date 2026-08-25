import ast
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


if __name__ == "__main__":
    unittest.main()
