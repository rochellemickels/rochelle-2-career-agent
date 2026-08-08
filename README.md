# Rochelle 2.0 — Career Opportunity Portal

An automated career-discovery and job-matching portal built for Rochelle Mickels' AI career transition. The system checks employer-authorized public career feeds, normalizes open roles, scores every role against Rochelle's goals, and publishes the strongest opportunities first.

## What it does

- Refreshes configured Greenhouse, Lever, and Ashby public job feeds three times per week.
- Prioritizes manager and senior-manager bridge roles in partnerships, strategic relationships, implementation, programs, complex solutions, transformation, and growth.
- Keeps Director roles in consideration and raises them when the responsibilities strongly match Rochelle's proven team leadership, executive relationships, market expansion, revenue growth, and consultative solution experience.
- Applies a transparent 100-point Rochelle Match Score.
- Uses deterministic evidence-based rules, with no paid API or model calls.
- Publishes a responsive GitHub Pages dashboard with search, career-lane, salary, location, and application filters.
- Saves favorites, application stages, and private notes only in the current browser.

## Rochelle Match Score

| Category | Points | High-score evidence |
|---|---:|---|
| Role and experience fit | 25 | Preferred manager-level bridge role, or a Director role with strong transferable-leadership evidence |
| Compensation | 20 | $110K–$135K ideal base overlap; above-target pay remains strong; disclosed bonus can add a point |
| Remote and location | 15 | U.S. remote first; DFW hybrid second |
| Core values and mission | 15 | Ethical, inclusive, mission-driven customer or community impact |
| Leadership and influence | 10 | Team leadership, strategic ownership, stakeholder alignment, and cross-functional influence |
| AI and future-facing work | 10 | AI strategy, adoption, transformation, automation, or digital innovation |
| Stability and posting quality | 5 | Clear, credible, detailed employer posting |

### Compensation priorities

1. **Strong target:** $110,000–$135,000 base.
2. **Still attractive:** Above $135,000 when role fit and expectations are appropriate.
3. **Preferred floor:** $100,000–$109,000, especially with bonus or an unusually strong growth path.
4. **Bridge range:** $85,000–$99,000; retained for exceptional fit, advancement, or bonus potential.
5. **Below $85,000:** Low compensation priority.

Commission-only and heavily individual-quota-driven roles are penalized. Salary not disclosed remains visible as an information gap rather than being invented.

## Role-level philosophy

The preferred on-ramp is an entry-manager, manager, or mid-manager role that uses Rochelle's commercial leadership and relationship skills while allowing time to learn a technology or AI company's operations. Director is not excluded: the scoring engine can award full role-fit points when a Director posting clearly matches her proven strengths. Senior Director, VP, Head, and Chief roles remain visible as higher-expectation stretch opportunities.

## Change the career criteria

Edit [`config/profile.json`](config/profile.json) to change target titles, salary bands, score keywords, and location terms. Weights must continue to total 100 points and match the allowed category maximums in `ScoreBreakdown`.

## Add or remove target companies

Edit [`config/sources.json`](config/sources.json). Supported public feed types are `greenhouse`, `lever`, and `ashby`. Source health makes incorrect or changed slugs visible.

## Run locally

Python 3.11+ is required.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
python -m unittest discover -s tests -v
python -m rochelle_agent.scan
python -m http.server 8000 --directory docs
```

Open `http://localhost:8000`.

## Automation and privacy

- `Refresh career opportunities` runs Monday, Wednesday, and Friday and can be started manually.
- No OpenAI, Anthropic, or other paid model API is called by the workflow.
- The public portal is capped at the 200 strongest relevant roles.
- Favorites, notes, and application stages remain in browser `localStorage`.
- The portal is decision support. Confirm compensation, bonus, location, requirements, and current availability with the employer before applying.
