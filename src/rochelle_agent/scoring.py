from __future__ import annotations

import re
from typing import Any

from .models import Job, ScoreBreakdown, ScoredJob


def _contains(text: str, terms: list[str]) -> list[str]:
    lowered = text.lower()
    return [term for term in terms if term.lower() in lowered]


def _tier(score: int) -> str:
    if score >= 90:
        return "Exceptional Match"
    if score >= 80:
        return "Strong Match"
    if score >= 70:
        return "Good Match"
    if score >= 60:
        return "Possible Match"
    return "Low Match"


def is_us_eligible_location(job: Job, profile: dict[str, Any]) -> bool:
    location = f"{job.location} {job.workplace_type}".lower()
    has_non_us_constraint = bool(_contains(location, profile["non_us_only_keywords"]))
    has_us_or_global_scope = bool(_contains(location, profile["us_eligibility_keywords"]))
    return not has_non_us_constraint or has_us_or_global_scope


def score_job(job: Job, profile: dict[str, Any]) -> ScoredJob:
    title = re.sub(r"[^a-z0-9]+", " ", job.title.lower()).strip()
    body = f"{job.title} {job.department} {job.location} {job.description}".lower()
    strengths: list[str] = []
    gaps: list[str] = []

    excluded = _contains(title, profile["exclude_title_keywords"])
    exact = _contains(title, profile["target_titles"])
    adjacent = _contains(title, profile["adjacent_titles"])
    if excluded:
        role_fit = 1
        gaps.append(f"Title appears outside target lane: {excluded[0]}")
    elif exact:
        role_fit = 25
        strengths.append("Title directly matches a priority career lane")
    elif adjacent:
        role_fit = 19
        strengths.append("Title is adjacent to a priority career lane")
    else:
        partnership_hits = _contains(
            title,
            [
                "partnership",
                "business development",
                "go to market",
                "go-to-market",
                "customer success",
                "strategic account",
                "market development",
                "market expansion",
                "revenue growth",
                "revenue strategy",
                "revenue enablement",
                "sales enablement",
                "channel partnerships",
                "ecosystem partnerships",
            ],
        )
        senior_title = bool(
            _contains(title, ["vice president", "vp", "head", "senior director", "director", "principal"])
        )
        role_fit = min(18, 5 + len(partnership_hits) * 6 + (5 if senior_title else 0))
        if partnership_hits:
            strengths.append("Responsibilities are within Rochelle's partnerships and growth lane")
        else:
            gaps.append("Title is not an obvious match to the priority title list")

    minimum = profile["minimum_preferred_base_salary"]
    commission_risk = _contains(body, profile["commission_risk_keywords"])
    if job.salary_max is None:
        compensation = 6
        gaps.append("Salary is not confirmed in the public posting")
    elif job.salary_max >= minimum and (job.salary_min or 0) >= minimum:
        compensation = 20
        strengths.append("Published salary range meets the preferred base target")
    elif job.salary_max >= minimum:
        compensation = 16
        strengths.append("Published salary range reaches the preferred base target")
        gaps.append("Lower end of the salary range is below the preferred base target")
    elif job.salary_max >= 130_000:
        compensation = 10
        gaps.append("Published salary is below the $150K preferred base target")
    else:
        compensation = 3
        gaps.append("Published compensation is materially below the preferred target")
    if commission_risk:
        compensation = max(0, compensation - 6)
        gaps.append("Posting contains commission-heavy compensation language")

    location = f"{job.location} {job.workplace_type}".lower()
    if not is_us_eligible_location(job, profile):
        work_style = 1
        gaps.append("Location appears restricted outside the United States")
    elif "remote" in location and any(term in location for term in ["united states", "u.s.", "us ", "usa", "north america"]):
        work_style = 15
        strengths.append("U.S. remote work matches the preferred work style")
    elif "remote" in location:
        work_style = 13
        strengths.append("Remote work is indicated")
    elif "hybrid" in location and _contains(location, profile["dfw_keywords"]):
        work_style = 11
        strengths.append("DFW-area hybrid work is acceptable")
    elif "hybrid" in location:
        work_style = 6
        gaps.append("Hybrid location may require relocation or travel")
    elif _contains(location, profile["dfw_keywords"]):
        work_style = 5
        gaps.append("DFW location fits geographically, but remote/hybrid status is unclear")
    else:
        work_style = 2
        gaps.append("Work style or location does not clearly match the preference")

    value_groups = [
        name for name, terms in profile["values_keywords"].items() if _contains(body, terms)
    ]
    values = min(15, 4 + len(value_groups) * 3)
    if value_groups:
        strengths.append("Posting includes mission or values evidence")
    else:
        gaps.append("Mission and values alignment is not yet evidenced")

    leadership_hits = _contains(body, profile["leadership_keywords"])
    title_leadership = _contains(title, ["vice president", "vp", "head", "senior director", "director"])
    leadership = min(10, len(leadership_hits) * 2 + (5 if title_leadership else 1))
    if leadership >= 7:
        strengths.append("Role shows strategic leadership and cross-functional influence")
    elif leadership <= 3:
        gaps.append("Leadership scope is not clear from the posting")

    ai_hits = _contains(body, profile["ai_keywords"])
    ai_relevance = min(10, len(ai_hits) * 3)
    if ai_hits:
        strengths.append("Role includes AI, automation, or digital-transformation work")
    else:
        gaps.append("AI or future-facing strategy is not a visible part of the role")

    quality = 2
    if len(job.description) >= 700:
        quality += 1
    if job.salary_max is not None:
        quality += 1
    if job.apply_url.startswith("https://"):
        quality += 1
    quality = min(5, quality)

    breakdown = ScoreBreakdown(
        role_fit=role_fit,
        compensation=compensation,
        work_style=work_style,
        values=values,
        leadership=leadership,
        ai_relevance=ai_relevance,
        quality=quality,
    )
    total = breakdown.total
    action = "Apply now" if total >= 86 else "Review closely" if total >= 70 else "Save for later" if total >= 60 else "Low priority"
    summary = (
        f"Rule-based screening found a {total}/100 match. "
        "Review the published responsibilities and confirm any missing salary or location details before applying."
    )
    return ScoredJob(
        **job.model_dump(),
        score=total,
        tier=_tier(total),
        breakdown=breakdown,
        strengths=list(dict.fromkeys(strengths))[:4],
        gaps=list(dict.fromkeys(gaps))[:4],
        summary=summary,
        recommended_action=action,
    )


def deduplicate(jobs: list[Job]) -> list[Job]:
    selected: dict[str, Job] = {}
    for job in jobs:
        key = "|".join(
            [
                re.sub(r"\W+", "", job.company.lower()),
                re.sub(r"\W+", "", job.title.lower()),
                re.sub(r"\W+", "", job.location.lower()),
            ]
        )
        current = selected.get(key)
        if current is None or len(job.description) > len(current.description):
            selected[key] = job
    return list(selected.values())
