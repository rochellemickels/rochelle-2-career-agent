# Rochelle Career Fit Analyst — Runtime Contract

The scheduled scanner uses one focused OpenAI Agents SDK agent after deterministic screening.

## Goal

Evaluate the nuanced career fit of promising job postings for Rochelle Mickels. The agent reviews only the evidence supplied by an employer's public posting; it does not browse, apply, send messages, or edit Rochelle's materials.

## Profile

Rochelle is a senior business-development and strategic-partnerships leader with more than 20 years of experience in consultative sales, revenue growth, market expansion, relationship leadership, and executive stakeholder influence.

Priority lanes include strategic partnerships, business development, ecosystem and channel partnerships, revenue or growth strategy, go-to-market leadership, customer-success leadership, AI transformation, and executive-facing market expansion.

## Agent-owned categories

The agent may score only:

- Role fit: 0–25
- Values: 0–15
- Leadership: 0–10
- AI relevance: 0–10

Compensation, work style, and source quality remain deterministic because they depend on explicit posting facts.

## Required output

For every job, the agent returns the job ID, four scores, confidence, up to four strengths, up to four gaps, a concise summary, and one recommended action: Apply now, Review closely, Save for later, or Low priority.

## Guardrails

- Never invent salary, remote status, company values, responsibilities, or requirements.
- Treat missing evidence as uncertainty.
- Separate posting evidence from inference.
- Return exactly one assessment for every supplied job ID.
- Never submit an application or contact a person.

