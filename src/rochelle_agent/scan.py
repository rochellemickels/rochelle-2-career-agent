from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# This is the only live scoring import. There is intentionally no scorer.py.
from .scoring import deduplicate, score_job
from .sources import build_source


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def previous_jobs(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        data = load_json(path)
    except (OSError, json.JSONDecodeError):
        return {}
    return {str(job["id"]): job for job in data.get("jobs", []) if job.get("id")}


def run_scan(profile_path: Path, sources_path: Path, output_path: Path, status_path: Path) -> dict[str, Any]:
    profile = load_json(profile_path)
    source_configs = load_json(sources_path)["sources"]
    old_jobs = previous_jobs(output_path)
    now = datetime.now(timezone.utc).isoformat()

    raw_jobs = []
    statuses = []
    for config in sorted(source_configs, key=lambda item: item.get("priority", 99)):
        jobs, status = build_source(config).collect()
        raw_jobs.extend(jobs)
        statuses.append(status)

    unique_jobs = deduplicate(raw_jobs)
    for job in unique_jobs:
        old = old_jobs.get(job.id, {})
        job.discovered_at = old.get("discovered_at") or old.get("posted_at") or now
        job.verified_at = now

    # One score, computed once. Sorting uses only the same displayed integer score.
    scored = [score_job(job, profile) for job in unique_jobs]
    scored.sort(key=lambda job: job.score, reverse=True)

    # Clearly non-US-only postings are excluded from the published US search universe.
    published = [job for job in scored if job.location_eligibility != "Non-US only"][:1000]
    payload = {
        "generated_at": now,
        "profile_version": profile["profile_version"],
        "metadata": {
            "product": "Rochelle 2.0 AI Career Portal",
            "roles_scanned": len(scored),
            "roles_published": len(published),
            "default_matches": sum(job.default_visible for job in published),
            "sources_ok": sum(status.status == "ok" for status in statuses),
            "sources_error": sum(status.status == "error" for status in statuses),
            "scoring_authority": "src/rochelle_agent/scoring.py::score_job",
            "sort_rule": "displayed score descending; backend order preserved for ties",
        },
        "jobs": [{**job.model_dump(), "description": job.description[:5000]} for job in published],
    }
    status_payload = {
        "generated_at": now,
        "state": "complete",
        "message": "Scan, score, commit, and publish workflow completed.",
        "sources": [status.model_dump() for status in statuses],
    }
    write_json(output_path, payload)
    write_json(status_path, status_payload)
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh Rochelle 2.0 AI Career Portal.")
    parser.add_argument("--profile", type=Path, default=Path("config/profile.json"))
    parser.add_argument("--sources", type=Path, default=Path("config/sources.json"))
    parser.add_argument("--output", type=Path, default=Path("docs/data/jobs.json"))
    parser.add_argument("--status-output", type=Path, default=Path("docs/data/status.json"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = run_scan(args.profile, args.sources, args.output, args.status_output)
    meta = payload["metadata"]
    print(f"Published {meta['roles_published']} US-eligible roles; {meta['default_matches']} default matches.")


if __name__ == "__main__":
    main()
