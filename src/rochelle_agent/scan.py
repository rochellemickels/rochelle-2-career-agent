from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .agent import evaluate_batch
from .models import ScoredJob
from .scoring import apply_agent_assessment, deduplicate, score_job
from .sources import build_source


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def previous_assessments(path: Path) -> dict[tuple[str, str], ScoredJob]:
    if not path.exists():
        return {}
    try:
        data = load_json(path)
        jobs = [ScoredJob.model_validate(item) for item in data.get("jobs", [])]
        return {(job.id, job.content_fingerprint): job for job in jobs if job.ai_evaluated}
    except (ValueError, OSError, json.JSONDecodeError):
        return {}


def run_scan(
    profile_path: Path,
    sources_path: Path,
    output_path: Path,
    status_path: Path,
    use_ai: bool,
) -> dict[str, Any]:
    profile = load_json(profile_path)
    source_config = load_json(sources_path)["sources"]
    old = previous_assessments(output_path)

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
        if job.breakdown.role_fit >= 11 and job.score >= 40
    ]
    scored.sort(key=lambda job: (job.score, job.posted_at or ""), reverse=True)
    scored = scored[:300]

    reused = 0
    for index, job in enumerate(scored):
        prior = old.get((job.id, job.content_fingerprint))
        if prior:
            prior.discovered_at = job.discovered_at
            prior.posted_at = job.posted_at
            scored[index] = prior
            reused += 1

    ai_state = "disabled"
    ai_error = ""
    evaluated = 0
    if use_ai and os.environ.get("OPENAI_API_KEY"):
        candidates = [
            job
            for job in scored
            if not job.ai_evaluated
            and job.score >= profile["agent"]["minimum_baseline_score"]
            and job.breakdown.role_fit >= 10
        ]
        candidates.sort(key=lambda job: job.score, reverse=True)
        candidates = candidates[: profile["agent"]["max_jobs_per_refresh"]]
        batch_size = profile["agent"]["batch_size"]
        by_id = {job.id: job for job in scored}
        try:
            for start in range(0, len(candidates), batch_size):
                batch = candidates[start : start + batch_size]
                result = evaluate_batch(batch, profile)
                for assessment in result.assessments:
                    if assessment.job_id in by_id:
                        apply_agent_assessment(by_id[assessment.job_id], assessment)
                        evaluated += 1
            ai_state = "active"
        except Exception as exc:  # Keep the deterministic database available.
            ai_state = "fallback"
            ai_error = (
                f"{type(exc).__name__}: OpenAI evaluation was unavailable; "
                "transparent rule-based scores were retained."
            )
    elif use_ai:
        ai_state = "missing_secret"
        ai_error = "OPENAI_API_KEY was not available; rule-based scores were retained."

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
            "ai_status": ai_state,
            "ai_evaluated": evaluated,
            "ai_reused": reused,
            "ai_error": ai_error,
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
    parser.add_argument("--no-ai", action="store_true", help="Use deterministic scoring only.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = run_scan(
        args.profile,
        args.sources,
        args.output,
        args.status_output,
        use_ai=not args.no_ai,
    )
    metadata = payload["metadata"]
    print(
        f"Refreshed {metadata['total_jobs']} jobs from {metadata['sources_ok']} healthy sources; "
        f"AI status: {metadata['ai_status']}."
    )


if __name__ == "__main__":
    main()
