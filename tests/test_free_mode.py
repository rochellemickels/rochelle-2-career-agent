import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FreeModeTests(unittest.TestCase):
    def test_scheduled_workflow_cannot_call_a_paid_model_api(self):
        workflow = (ROOT / ".github/workflows/update-jobs.yml").read_text(encoding="utf-8")
        self.assertNotIn("OPENAI_API_KEY", workflow)
        self.assertNotIn("ANTHROPIC_API_KEY", workflow)
        self.assertNotIn("use_ai", workflow)
        self.assertIn("python -m rochelle_agent.scan", workflow)

    def test_project_has_no_paid_model_dependency(self):
        project = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
        self.assertNotIn("openai", project.lower())
        self.assertNotIn("anthropic", project.lower())

    def test_profile_weights_total_one_hundred(self):
        profile = json.loads((ROOT / "config/profile.json").read_text(encoding="utf-8"))
        self.assertEqual(sum(profile["weights"].values()), 100)


if __name__ == "__main__":
    unittest.main()
