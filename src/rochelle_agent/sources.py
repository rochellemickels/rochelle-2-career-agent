from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.request import Request, urlopen

from .models import Job, SourceStatus

USER_AGENT = "RochelleCareerPortal/2.0 (+https://github.com/rochellemickels/rochelle-2-career-agent)"
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return SPACE_RE.sub(" ", html.unescape(TAG_RE.sub(" ", value))).strip()


def _money_value(raw: str) -> int:
    value = raw.lower().replace("$", "").replace(",", "").strip()
    multiplier = 1000 if value.endswith("k") else 1
    return int(float(value.rstrip("k")) * multiplier)


def extract_salary(text: str) -> tuple[int | None, int | None]:
    if re.search(r"\$\s*\d+(?:\.\d+)?\s*(?:/|per\s+)\s*(?:hour|hr)", text, re.I):
        return None, None
    pattern = re.compile(
        r"\$\s*(\d{2,3}(?:,\d{3})|\d{2,3}(?:\.\d+)?\s*k)\s*(?:-|–|—|to)\s*"
        r"\$?\s*(\d{2,3}(?:,\d{3})|\d{2,3}(?:\.\d+)?\s*k)",
        re.I,
    )
    match = pattern.search(text)
    if match:
        low, high = _money_value(match.group(1)), _money_value(match.group(2))
        if 40_000 <= low <= high <= 1_000_000:
            return low, high
    return None, None


def infer_workplace(location: str, supplied: str | None = None) -> str:
    combined = f"{location} {supplied or ''}".casefold()
    if "remote" in combined:
        return "Remote"
    if "hybrid" in combined:
        return "Hybrid"
    return (supplied or "Onsite / not specified").title()


def _get_json(url: str, timeout: int = 30) -> Any:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


@dataclass
class BaseSource:
    company: str
    slug: str
    source_type: str

    def fetch(self) -> list[Job]:
        raise NotImplementedError

    def collect(self) -> tuple[list[Job], SourceStatus]:
        try:
            jobs = [job.ensure_fingerprint() for job in self.fetch()]
            return jobs, SourceStatus(
                company=self.company,
                source_type=self.source_type,
                slug=self.slug,
                status="ok",
                jobs_found=len(jobs),
                message="Public career feed refreshed.",
            )
        except Exception as exc:  # One broken employer must not stop the whole refresh.
            return [], SourceStatus(
                company=self.company,
                source_type=self.source_type,
                slug=self.slug,
                status="error",
                message=f"{type(exc).__name__}: {str(exc)[:180]}",
            )


class GreenhouseSource(BaseSource):
    def __init__(self, company: str, slug: str):
        super().__init__(company, slug, "greenhouse")

    def fetch(self) -> list[Job]:
        data = _get_json(f"https://boards-api.greenhouse.io/v1/boards/{self.slug}/jobs?content=true")
        jobs: list[Job] = []
        for raw in data.get("jobs", []):
            description = clean_text(raw.get("content"))
            salary_min, salary_max = extract_salary(description)
            location = (raw.get("location") or {}).get("name") or "Location not listed"
            departments = raw.get("departments") or []
            apply_url = raw.get("absolute_url") or raw.get("url")
            if not apply_url:
                continue
            jobs.append(Job(
                id=f"greenhouse:{self.slug}:{raw['id']}",
                source_type="greenhouse",
                source_slug=self.slug,
                company=self.company,
                title=raw.get("title") or "Untitled role",
                location=location,
                workplace_type=infer_workplace(location),
                description=description,
                department=", ".join(item.get("name", "") for item in departments if item.get("name")),
                apply_url=apply_url,
                posted_at=raw.get("updated_at"),
                salary_min=salary_min,
                salary_max=salary_max,
            ))
        return jobs


class LeverSource(BaseSource):
    def __init__(self, company: str, slug: str):
        super().__init__(company, slug, "lever")

    def fetch(self) -> list[Job]:
        data = _get_json(f"https://api.lever.co/v0/postings/{self.slug}?mode=json")
        jobs: list[Job] = []
        for raw in data:
            categories = raw.get("categories") or {}
            description = clean_text(" ".join(filter(None, [
                raw.get("descriptionPlain"), raw.get("additionalPlain"), raw.get("description")
            ])))
            salary_min, salary_max = extract_salary(description)
            salary_range = raw.get("salaryRange") or {}
            if salary_range.get("min") and salary_range.get("max"):
                salary_min, salary_max = int(salary_range["min"]), int(salary_range["max"])
            location = categories.get("location") or ", ".join(categories.get("allLocations") or []) or "Location not listed"
            created = raw.get("createdAt")
            posted_at = datetime.fromtimestamp(created / 1000, tz=timezone.utc).isoformat() if isinstance(created, (int, float)) else None
            apply_url = raw.get("hostedUrl") or raw.get("applyUrl")
            if not apply_url:
                continue
            jobs.append(Job(
                id=f"lever:{self.slug}:{raw['id']}",
                source_type="lever",
                source_slug=self.slug,
                company=self.company,
                title=raw.get("text") or "Untitled role",
                location=location,
                workplace_type=infer_workplace(location, raw.get("workplaceType")),
                description=description,
                department=categories.get("department") or categories.get("team") or "",
                apply_url=apply_url,
                posted_at=posted_at,
                salary_min=salary_min,
                salary_max=salary_max,
                employment_type=categories.get("commitment") or "",
            ))
        return jobs


class AshbySource(BaseSource):
    def __init__(self, company: str, slug: str):
        super().__init__(company, slug, "ashby")

    def fetch(self) -> list[Job]:
        data = _get_json(f"https://api.ashbyhq.com/posting-api/job-board/{self.slug}?includeCompensation=true")
        jobs: list[Job] = []
        for raw in data.get("jobs", []):
            description = clean_text(raw.get("descriptionPlain") or raw.get("descriptionHtml"))
            compensation = raw.get("compensation") or raw.get("compensationTierSummary") or ""
            if isinstance(compensation, dict):
                compensation = json.dumps(compensation)
            salary_min, salary_max = extract_salary(f"{compensation} {description}")
            location = raw.get("location") or "Location not listed"
            apply_url = raw.get("applyUrl") or raw.get("jobUrl")
            if not apply_url:
                continue
            jobs.append(Job(
                id=f"ashby:{self.slug}:{raw.get('id') or apply_url}",
                source_type="ashby",
                source_slug=self.slug,
                company=self.company,
                title=raw.get("title") or "Untitled role",
                location=location,
                workplace_type=infer_workplace(location, raw.get("workplaceType")),
                description=description,
                department=raw.get("department") or raw.get("team") or "",
                apply_url=apply_url,
                posted_at=raw.get("publishedAt"),
                salary_min=salary_min,
                salary_max=salary_max,
                employment_type=raw.get("employmentType") or "",
            ))
        return jobs


def build_source(config: dict[str, Any]) -> BaseSource:
    source_type = config["type"].casefold()
    source_class = {"greenhouse": GreenhouseSource, "lever": LeverSource, "ashby": AshbySource}.get(source_type)
    if source_class is None:
        raise ValueError(f"Unsupported source type: {source_type}")
    return source_class(config["company"], config["slug"])
