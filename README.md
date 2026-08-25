# Rochelle 2.0 AI Career Portal

The portal scans public Greenhouse, Lever, and Ashby job feeds, evaluates each role against Rochelle's verified résumé evidence and career targets, and publishes a fast static dashboard through GitHub Pages.

## Non-negotiable architecture

- `src/rochelle_agent/scan.py` imports only `src/rochelle_agent/scoring.py`.
- There is no `scorer.py`.
- `scoring.py::score_job` computes the one displayed 0–100 score exactly once per job.
- The scanner sorts only by that same displayed score. The frontend preserves backend order and contains no second score or ranking formula.
- `.github/workflows/refresh-and-publish.yml` is the only refresh/deployment workflow. A run tests, scans, scores, validates, commits the exact JSON, and publishes that same workspace.

## Scoring profile

`config/profile.json` contains:

- target career lanes;
- salary target of $110K–$135K base and viable floor of $85K;
- verified résumé evidence for program leadership, cross-functional leadership, business operations, learning and development, partnerships, SMB consulting, and implementation;
- hard penalties for personal-quota/incentive-compensation ownership and deep hands-on technical requirements;
- explicit US/DFW eligibility rules, including a protected `Ontario, CA` case and Canadian-city exclusions.

## Portal behavior

- Recommended roles are hidden when hard-penalty flags are present.
- Default browsing shows no more than three roles from one company; choosing a company reveals its full scored list.
- All filter controls are evaluated by one exported `matchesFilters` predicate and tested in combination.
- Skipped and Passed/Closed roles are hidden from active browsing by default but recoverable with the stage filter.
- Positions Applied shows only roles with a recorded application date and an active application stage. Closed applications are optional; skipped roles never enter that tracker.
- Application tracking remains private in the browser's local storage and is not committed to the public repository.
- JSON requests use a timestamp query and `cache: no-store` to avoid stale Pages data.

## Refreshing

Open **Refresh jobs** in the portal, choose **Run workflow**, and confirm. GitHub requires that confirmation so no write credential is exposed in a public static site. After confirmation, the single workflow completes the entire scan → score → commit → publish cycle. The portal reads the public workflow status and shows running, completed, or failed state.

## Local verification

```bash
python -m pip install -e .
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/test_frontend.mjs
python -m compileall -q src tests
node --check docs/assets/app.mjs
```
