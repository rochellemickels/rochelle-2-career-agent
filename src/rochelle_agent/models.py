from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, Field


class Job(BaseModel):
    id: str
    source_type: str
    source_slug: str
    company: str
    title: str
    location: str = "Location not listed"
    workplace_type: str = "Not specified"
    description: str = ""
    department: str = ""
    apply_url: str
    posted_at: str | None = None
    discovered_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    verified_at: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "USD"
    employment_type: str = ""
    content_fingerprint: str = ""

    def ensure_fingerprint(self) -> "Job":
        material = "|".join(
            [
                self.company.casefold(),
                self.title.casefold(),
                self.location.casefold(),
                self.description[:8000],
                str(self.salary_min),
                str(self.salary_max),
            ]
        )
        self.content_fingerprint = sha256(material.encode("utf-8")).hexdigest()[:20]
        return self


class ScoreBreakdown(BaseModel):
    role_alignment: int = Field(ge=0, le=30)
    resume_evidence: int = Field(ge=0, le=24)
    people_leadership: int = Field(ge=0, le=14)
    work_style: int = Field(ge=0, le=12)
    compensation: int = Field(ge=0, le=10)
    business_context: int = Field(ge=0, le=10)
    hard_penalty: int = Field(ge=-100, le=0)

    @property
    def total(self) -> int:
        return max(0, min(100, sum(self.model_dump().values())))


class ScoredJob(Job):
    score: int = Field(ge=0, le=100)
    breakdown: ScoreBreakdown
    career_lane: str
    location_eligibility: str
    salary_band: str
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    hard_flags: list[str] = Field(default_factory=list)
    default_visible: bool = False
    summary: str = ""
    recommended_action: str = "Review"


class SourceStatus(BaseModel):
    company: str
    source_type: str
    slug: str
    status: Literal["ok", "error"]
    jobs_found: int = 0
    message: str = ""
    checked_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
