"""The only scoring and ranking authority for the portal.

Every displayed score is created by ``score_job``. The scanner sorts only by that
integer score, and the frontend preserves backend order. There is no second rank.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

from .models import Job, ScoreBreakdown, ScoredJob


def _text(*values: str) -> str:
    return " ".join(value for value in values if value).casefold()


def _hits(text: str, phrases: Iterable[str]) -> list[str]:
    return [phrase for phrase in phrases if phrase.casefold() in text]


def _regex_hits(text: str, patterns: Iterable[str]) -> list[str]:
    return [pattern for pattern in patterns if re.search(pattern, text, re.IGNORECASE)]


def determine_location(job: Job, profile: dict[str, Any]) -> str:
    location = job.location.casefold().strip()
    workplace = job.workplace_type.casefold().strip()
    combined = f"{location} {workplace}"

    # Ontario, California is a US city; never classify it by the province name alone.
    if re.search(r"\bontario\s*,\s*ca\b", combined):
        return "Eligible — US"

    us_markers = profile["location_rules"]["us_markers"]
    non_us_patterns = profile["location_rules"]["non_us_patterns"]
    has_us = bool(_hits(combined, us_markers))
    has_non_us = bool(_regex_hits(combined, non_us_patterns))

    if has_non_us and not has_us:
        return "Non-US only"
    if _hits(combined, profile["location_rules"]["dfw_markers"]):
        return "Eligible — DFW"
    if has_us:
        return "Eligible — US"
    if "remote" in combined:
        return "Needs location review"
    return "Needs location review"


def salary_band(job: Job, profile: dict[str, Any]) -> str:
    low, high = job.salary_min, job.salary_max
    if low is None and high is None:
        return "Not listed"
    low = low or high or 0
    high = high or low
    floor = profile["salary"]["viable_floor"]
    ideal_low = profile["salary"]["ideal_min"]
    ideal_high = profile["salary"]["ideal_max"]
    if high < floor:
        return "Below viable floor"
    if low <= ideal_high and high >= ideal_low:
        return "Ideal overlap"
    if high < ideal_low:
        return "Viable — below target"
    if low > ideal_high:
        return "Above target"
    return "Viable"


def _career_lane(title: str, description: str, profile: dict[str, Any]) -> tuple[str, int, list[str]]:
    title_text = title.casefold()
    full_text = f"{title_text} {description.casefold()}"
    best_lane = "Adjacent / review"
    best_points = 0
    best_hits: list[str] = []
    for lane, rules in profile["career_lanes"].items():
        title_hits = _hits(title_text, rules["title_terms"])
        description_hits = _hits(full_text, rules["description_terms"])
        # One clear target phrase in the title is strong evidence; description
        # signals then confirm that the responsibilities match the title.
        title_points = 0 if not title_hits else 22 if len(title_hits) == 1 else 24
        points = title_points + min(6, len(description_hits) * 2)
        if points > best_points:
            best_lane = lane
            best_points = points
            best_hits = [*title_hits, *description_hits]
    return best_lane, min(30, best_points), best_hits


def _resume_evidence_score(text: str, profile: dict[str, Any]) -> tuple[int, list[str]]:
    resume = profile["master_resume_text"].casefold()
    points = 0
    matched: list[str] = []
    for category in profile["resume_evidence"]:
        resume_proof = _hits(resume, category["resume_terms"])
        job_need = _hits(text, category["job_signals"])
        if resume_proof and job_need:
            points += category["points"]
            matched.append(category["label"])
    return min(24, points), matched


def score_job(job: Job, profile: dict[str, Any]) -> ScoredJob:
    """Compute the portal's one and only 0–100 score for a job."""
    title = job.title.casefold()
    text = _text(job.title, job.description, job.department, job.location)
    location = determine_location(job, profile)
    band = salary_band(job, profile)
    workplace_text = _text(job.workplace_type, job.location)
    is_remote = "remote" in workplace_text
    is_dfw_hybrid = location == "Eligible — DFW" and "hybrid" in workplace_text
    preferred_work_style = (
        is_remote and location in {"Eligible — US", "Eligible — DFW"}
    ) or is_dfw_hybrid

    lane, role_points, lane_hits = _career_lane(title, job.description, profile)
    evidence_points, evidence_matches = _resume_evidence_score(text, profile)

    people_hits = _hits(text, profile["people_leadership_signals"])
    people_points = min(14, len(set(people_hits)) * 2)

    if is_dfw_hybrid:
        work_points = 12
    elif is_remote and location in {"Eligible — US", "Eligible — DFW"}:
        work_points = 12
    elif location == "Needs location review" and "remote" in text:
        work_points = 7
    elif location.startswith("Eligible"):
        work_points = 4
    else:
        work_points = 0

    compensation_points = {
        "Ideal overlap": 10,
        "Above target": 7,
        "Viable": 7,
        "Viable — below target": 5,
        "Not listed": 4,
        "Below viable floor": 0,
    }[band]

    context_hits = _hits(text, profile["business_context_signals"])
    context_points = min(10, len(set(context_hits)) * 2)

    hard_flags: list[str] = []
    penalty = 0
    if _regex_hits(text, profile["hard_penalties"]["personal_quota_patterns"]):
        hard_flags.append("Personal quota / incentive-compensation ownership")
        penalty -= 65
    if _regex_hits(text, profile["hard_penalties"]["deep_technical_patterns"]):
        hard_flags.append("Deep hands-on technical practitioner requirements")
        penalty -= 70
    if _hits(title, profile["hard_penalties"]["excluded_title_terms"]):
        hard_flags.append("Role family is outside Rochelle's target path")
        penalty -= 70
    if location == "Non-US only":
        hard_flags.append("Non-US-only location")
        penalty = -100
    penalty = max(-100, penalty)

    breakdown = ScoreBreakdown(
        role_alignment=role_points,
        resume_evidence=evidence_points,
        people_leadership=people_points,
        work_style=work_points,
        compensation=compensation_points,
        business_context=context_points,
        hard_penalty=penalty,
    )
    score = breakdown.total

    strengths: list[str] = []
    if lane_hits:
        strengths.append(f"Strong {lane.lower()} language")
    strengths.extend(f"Resume evidence: {item}" for item in evidence_matches[:4])
    if work_points >= 10:
        strengths.append("Preferred remote or DFW-hybrid work style")
    if band == "Ideal overlap":
        strengths.append("Published compensation overlaps the ideal base range")
    if people_points >= 8:
        strengths.append("Values cross-functional influence and people-first leadership")

    gaps: list[str] = []
    if band == "Not listed":
        gaps.append("Base salary is not listed")
    if location == "Needs location review":
        gaps.append("US eligibility needs verification")
    if not preferred_work_style and location != "Non-US only":
        gaps.append("Outside the remote-US or DFW-hybrid target")
    gaps.extend(hard_flags)

    default_visible = (
        score >= profile["default_view_min_score"]
        and not hard_flags
        and preferred_work_style
    )
    action = "Apply early" if score >= 82 else "Strong review" if score >= 70 else "Review carefully"
    if not default_visible:
        action = "Hidden from default view"

    summary_bits = [f"Best aligned with {lane.lower()} work."]
    if evidence_matches:
        summary_bits.append("Supported by " + ", ".join(evidence_matches[:3]).lower() + ".")
    if hard_flags:
        summary_bits.append("Hard penalty: " + "; ".join(hard_flags) + ".")

    return ScoredJob(
        **job.model_dump(),
        score=score,
        breakdown=breakdown,
        career_lane=lane,
        location_eligibility=location,
        salary_band=band,
        strengths=strengths[:6],
        gaps=gaps[:5],
        hard_flags=hard_flags,
        default_visible=default_visible,
        summary=" ".join(summary_bits),
        recommended_action=action,
    )


def deduplicate(jobs: list[Job]) -> list[Job]:
    unique: dict[str, Job] = {}
    fingerprints: set[str] = set()
    for job in jobs:
        if job.id in unique or job.content_fingerprint in fingerprints:
            continue
        unique[job.id] = job
        fingerprints.add(job.content_fingerprint)
    return list(unique.values())
