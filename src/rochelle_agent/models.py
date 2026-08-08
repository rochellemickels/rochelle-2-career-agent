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
    discovered_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "USD"
    salary_is_inferred: bool = False
    employment_type: str = ""
    content_fingerprint: str = ""

    def ensure_fingerprint(self) -> "Job":
        material = "|".join(
            [
                self.company.lower(),
                self.title.lower(),
                self.location.lower(),
                self.description[:8000],
                str(self.salary_min),
                str(self.salary_max),
            ]
        )
        self.content_fingerprint = sha256(material.encode("utf-8")).hexdigest()[:20]
        return self


class ScoreBreakdown(BaseModel):
    role_fit: int = Field(ge=0, le=25)
    compensation: int = Field(ge=0, le=20)
    work_style: int = Field(ge=0, le=15)
    values: int = Field(ge=0, le=15)
    leadership: int = Field(ge=0, le=10)
    ai_relevance: int = Field(ge=0, le=10)
    quality: int = Field(ge=0, le=5)

    @property
    def total(self) -> int:
        return sum(self.model_dump().values())


class ScoredJob(Job):
    score: int = Field(ge=0, le=100)
    tier: str
    breakdown: ScoreBreakdown
    strengths: list[str] = []
    gaps: list[str] = []
    summary: str = ""
    recommended_action: str = "Review closely"
    confidence: str = "rule-based"


class SourceStatus(BaseModel):
    company: str
    source_type: str
    slug: str
    status: Literal["ok", "error"]
    jobs_found: int = 0
    message: str = ""
    checked_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
