from __future__ import annotations

import json
import os
from typing import Any

from .models import AgentBatchAssessment, ScoredJob


AGENT_INSTRUCTIONS = """
You are Rochelle's Career Fit Analyst. Evaluate only the evidence supplied in each
job posting. Rochelle is a senior business-development and strategic-partnerships
leader with 20+ years of consultative sales, revenue growth, market expansion,
relationship leadership, and executive stakeholder experience.

Score four nuanced categories only: role fit (0-25), values (0-15), leadership
(0-10), and AI relevance (0-10). Do not change compensation or work-style scores;
the deterministic system owns those fact-sensitive categories.

High-fit work includes strategic partnerships, business development, ecosystem or
channel partnerships, revenue/growth strategy, go-to-market leadership, customer
success leadership, market expansion, AI transformation, and executive influence.
Values evidence includes ethical leadership, inclusion, support for women,
underrepresented communities, veterans, small businesses, healthcare, benefits,
or meaningful customer/community outcomes.

Never invent compensation, remote status, responsibilities, company values, or
requirements. Treat missing evidence as uncertainty. Mention both concrete strengths
and meaningful gaps. Return exactly one assessment for each supplied job_id.
""".strip()


def evaluate_batch(jobs: list[ScoredJob], profile: dict[str, Any]) -> AgentBatchAssessment:
    try:
        from agents import Agent, Runner
    except ImportError as exc:
        raise RuntimeError("Install the openai-agents package to enable AI evaluation.") from exc

    model = os.environ.get("OPENAI_MODEL") or profile["agent"]["model"]
    agent = Agent(
        name="Rochelle Career Fit Analyst",
        model=model,
        instructions=AGENT_INSTRUCTIONS,
        output_type=AgentBatchAssessment,
    )
    payload = []
    for job in jobs:
        payload.append(
            {
                "job_id": job.id,
                "company": job.company,
                "title": job.title,
                "location": job.location,
                "workplace_type": job.workplace_type,
                "department": job.department,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "description": job.description[:4000],
                "rule_based_breakdown": job.breakdown.model_dump(),
            }
        )
    prompt = (
        "Evaluate these jobs against Rochelle's profile. Keep explanations concise.\n\n"
        + json.dumps(payload, ensure_ascii=False)
    )
    result = Runner.run_sync(agent, prompt)
    output = result.final_output
    if not isinstance(output, AgentBatchAssessment):
        output = AgentBatchAssessment.model_validate(output)
    return output
