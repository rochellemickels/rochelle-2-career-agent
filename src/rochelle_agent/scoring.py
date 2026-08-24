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


def _resume_signal_matches(body: str, profile: dict[str, Any]) -> list[str]:
    """
    For every signal category this JOB actually emphasizes, check whether Rochelle's
    real master résumé explicitly supports it too. This mirrors exactly how the
    Application Studio's per-application keyword-coverage check works — same 24
    categories, same overlap logic — so the main job-level score is now grounded in
    her ACTUAL résumé, not a separate generic hand-authored keyword list. A job that
    emphasizes signals her résumé doesn't support gets fewer matches here, same as it
    would show a lower keyword-coverage percentage in the Studio.
    """
    resume = profile.get("master_resume_text", "").lower()
    if not resume:
        return _contains(body, profile["transferable_strength_keywords"])
    matched: list[str] = []
    for label, terms in profile.get("role_signal_categories", []):
        job_relevant = any(term.lower() in body for term in terms)
        if not job_relevant:
            continue
        resume_supports = any(term.lower() in resume for term in terms)
        if resume_supports:
            matched.append(label)
    return matched


def _score_role_fit(
    title: str,
    body: str,
    profile: dict[str, Any],
    strengths: list[str],
    gaps: list[str],
) -> int:
    excluded = _contains(title, profile["exclude_title_keywords"])
    exact = _contains(title, profile["target_titles"])
    adjacent = _contains(title, profile["adjacent_titles"])
    stretch = _contains(title, profile["stretch_titles"])
    executive_stretch = _contains(title, profile["executive_stretch_titles"])
    transferable_hits = _resume_signal_matches(body, profile)

    if excluded:
        role_fit = 1
        gaps.append(f"Title appears outside target lane: {excluded[0]}")
    elif exact:
        role_fit = 25
        strengths.append("Manager-level title directly matches the preferred career bridge")
    elif adjacent:
        role_fit = min(24, 19 + min(5, len(transferable_hits)))
        strengths.append("Title is adjacent to the preferred manager-level career lane")
    elif stretch:
        # Director is not a disqualifier. Strong evidence of Rochelle's transferable
        # leadership, relationship, solutions, and growth strengths can earn full points.
        role_fit = min(25, 17 + min(8, len(transferable_hits) * 2))
        if len(transferable_hits) >= 3:
            strengths.append("Director scope aligns with proven team, relationship, and growth leadership")
        else:
            gaps.append("Director-level stretch: confirm industry onboarding and operational ramp support")
    elif executive_stretch:
        role_fit = min(20, 12 + min(8, len(transferable_hits) * 2))
        gaps.append("Executive-level stretch: validate expectations and direct industry experience required")
    else:
        lane_hits = _contains(
            title,
            [
                "partnership",
                "business development",
                "relationship manager",
                "alliances",
                "partner success",
                "partner enablement",
                "implementation",
                "program manager",
                "project manager",
                "transformation",
                "change management",
                "customer success",
                "client solutions",
                "customer solutions",
                "go to market",
                "go-to-market",
                "growth strategy",
                "strategy and operations",
                "strategy & operations",
                "market development",
                "revenue enablement",
            ],
        )
        manager_level = bool(_contains(title, ["manager", "lead", "consultant", "advisor"]))
        role_fit = min(22, 5 + len(lane_hits) * 6 + (5 if manager_level else 0))
        if lane_hits:
            strengths.append("Responsibilities are within the relationships, solutions, implementation, or growth lane")
        else:
            gaps.append("Title is not an obvious match to the priority career lanes")

    # A title match alone isn't enough — a role can be titled "Customer Success Manager"
    # or "Solutions Consultant" and still be a poor fit if the actual day-to-day requires
    # owning a personal sales/incentive quota, or requires deep hands-on technical
    # practitioner depth (e.g., Git/DevSecOps mastery, technical support, building AI
    # models) rather than advisory-level fluency. These are hard caps, not proportional
    # subtractions — a role with genuine disqualifying content should read as a clear
    # skip, not just a slightly-lower "Strong Match." A strong title match should never
    # be able to mostly cancel out a real red flag in the body of the posting.
    sales_dominance = _contains(body, profile["sales_dominance_risk_keywords"])
    if sales_dominance:
        role_fit = min(role_fit, 8)
        gaps.append("Role may emphasize individual sales quota, or incentive/compensation-plan ownership, over strategic relationship or implementation work")

    technical_depth = _contains(body, profile.get("deep_technical_practitioner_keywords", []))
    if len(technical_depth) >= 2:
        role_fit = min(role_fit, 8)
        gaps.append("Role may require hands-on technical practitioner depth (e.g., Git/DevSecOps, technical support, AI model building) beyond advisory-level fluency")

    return role_fit


def _score_compensation(
    job: Job,
    body: str,
    profile: dict[str, Any],
    strengths: list[str],
    gaps: list[str],
) -> int:
    ideal_min = profile["ideal_base_salary_min"]
    ideal_max = profile["ideal_base_salary_max"]
    preferred_floor = profile["preferred_base_salary_floor"]
    viable_floor = profile["minimum_viable_base_salary"]
    salary_min = job.salary_min
    salary_max = job.salary_max

    if salary_max is None:
        compensation = 6
        gaps.append("Salary is not confirmed in the public posting")
    elif salary_min is not None and salary_min >= ideal_min and salary_max <= ideal_max:
        compensation = 20
        strengths.append("Published base range sits fully inside the $110K–$135K ideal target")
    elif salary_min is not None and ideal_min <= salary_min <= ideal_max:
        compensation = 20
        strengths.append("Published base range starts inside the $110K–$135K ideal target")
    elif salary_min is not None and salary_min > ideal_max:
        compensation = 18
        strengths.append("Published base range exceeds the ideal target")
    elif salary_max >= ideal_min:
        compensation = 17
        strengths.append("Published base range reaches the $110K–$135K ideal target")
        gaps.append("Lower end of the published range is below the $110K ideal floor")
    elif salary_max >= preferred_floor:
        compensation = 15
        strengths.append("Published base range reaches the $100K+ preferred floor")
        gaps.append("Published range does not reach the $110K ideal floor")
    elif salary_max >= viable_floor:
        compensation = 9
        gaps.append("Published range is in the $85K–$99K bridge range, below the preferred target")
    else:
        compensation = 3
        gaps.append("Published compensation is below the $85K viable floor")

    bonus_hits = _contains(body, profile["bonus_keywords"])
    if bonus_hits:
        compensation = min(20, compensation + 1)
        strengths.append("Posting indicates bonus or incentive compensation potential")

    commission_risk = _contains(body, profile["commission_risk_keywords"])
    if commission_risk:
        compensation = max(0, compensation - 6)
        gaps.append("Posting contains commission-heavy compensation language")
    return compensation


def score_job(job: Job, profile: dict[str, Any]) -> ScoredJob:
    title = re.sub(r"[^a-z0-9]+", " ", job.title.lower()).strip()
    body = f"{job.title} {job.department} {job.location} {job.description}".lower()
    strengths: list[str] = []
    gaps: list[str] = []

    role_fit = _score_role_fit(title, body, profile, strengths, gaps)
    compensation = _score_compensation(job, body, profile, strengths, gaps)

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
    title_leadership = _contains(title, ["manager", "lead", "director", "vice president", "vp", "head"])
    leadership = min(10, len(leadership_hits) * 2 + (3 if title_leadership else 1))
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
        "Review the responsibilities and confirm salary, bonus, onboarding, and location details before applying."
    )
    return ScoredJob(
        **job.model_dump(),
        score=total,
        tier=_tier(total),
        breakdown=breakdown,
        strengths=list(dict.fromkeys(strengths))[:5],
        gaps=list(dict.fromkeys(gaps))[:5],
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
