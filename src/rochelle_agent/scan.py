from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .scoring import deduplicate, is_us_eligible_location, score_job
from .sources import build_source


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_scan(
    profile_path: Path,
    sources_path: Path,
    output_path: Path,
    status_path: Path,
) -> dict[str, Any]:
    profile = load_json(profile_path)
    source_config = load_json(sources_path)["sources"]

    jobs = []
    statuses = []
    for config in sorted(source_config, key=lambda item: item.get("priority", 99)):
        source_jobs, status = build_source(config).collect()
        jobs.extend(source_jobs)
        statuses.append(status)

    unique_jobs = deduplicate(jobs)
    all_scored = [score_job(job, profile) for job in unique_jobs]
    # The portal is a focused decision tool, not a mirror of every company job.
    # Keep roles with title-lane evidence and enough overall signal to merit review.
    scored = [
        job for job in all_scored
        if job.breakdown.role_fit >= 11
        and job.score >= 40
        and is_us_eligible_location(job, profile)
    ]
    scored.sort(key=lambda job: (job.score, job.posted_at or ""), reverse=True)
    scored = scored[:300]

    scored.sort(key=lambda job: (job.score, job.posted_at or ""), reverse=True)
    now = datetime.now(timezone.utc).isoformat()
    source_ok = sum(status.status == "ok" for status in statuses)
    source_errors = len(statuses) - source_ok
    payload = {
        "generated_at": now,
        "profile_version": profile["profile_version"],
        "is_sample": False,
        "metadata": {
            "total_jobs": len(scored),
            "sources_ok": source_ok,
            "sources_error": source_errors,
            "matching_method": "transparent-rules-v1",
            "cost_mode": "free",
        },
        "jobs": [
            {**job.model_dump(), "description": job.description[:3500]}
            for job in scored
        ],
    }
    status_payload = {
        "generated_at": now,
        "sources": [status.model_dump() for status in statuses],
    }
    write_json(output_path, payload)
    write_json(status_path, status_payload)
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh Rochelle's career opportunity database.")
    parser.add_argument("--profile", type=Path, default=Path("config/profile.json"))
    parser.add_argument("--sources", type=Path, default=Path("config/sources.json"))
    parser.add_argument("--output", type=Path, default=Path("docs/data/jobs.json"))
    parser.add_argument("--status-output", type=Path, default=Path("docs/data/status.json"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = run_scan(
        args.profile,
        args.sources,
        args.output,
        args.status_output,
    )
    metadata = payload["metadata"]
    print(
        f"Refreshed {metadata['total_jobs']} jobs from {metadata['sources_ok']} healthy sources "
        "using the free transparent matching engine."
    )


if __name__ == "__main__":
    main()
