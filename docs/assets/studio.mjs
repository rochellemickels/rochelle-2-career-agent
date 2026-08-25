const MASTER_RESUME_KEY = "rochelle-master-resume-v1";
const STUDIO_DRAFTS_KEY = "rochelle-application-studio-v1";
const DOCX_MODULE_URL = "./vendor/docx.mjs";

export const DEFAULT_DOCUMENT_PROFILE = {
  name: "Rochelle Magpantay",
  headline: "PARTNERSHIPS, GROWTH & IMPLEMENTATION LEADER",
  tagline: "Change Adoption | Cross-Functional Enablement | Practical AI Fluency",
  contact: "",
};

const RESUME_SECTIONS = [
  "EXECUTIVE PROFILE",
  "CORE STRENGTHS",
  "PROFESSIONAL EXPERIENCE",
  "EARLIER LEADERSHIP & BUSINESS DEVELOPMENT EXPERIENCE",
  "EDUCATION & PROFESSIONAL DEVELOPMENT",
];
const FORBIDDEN_GENERIC = ["i am thrilled", "perfect fit", "proven track record"];
const THIRD_PERSON = /\b(?:she|her|hers)\b/i;

function safeJson(value, fallback) {
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

export function resumeTextFromStoredValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const parsed = safeJson(value, null);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") return String(parsed.text || parsed.resumeText || parsed.content || "");
    return value;
  }
  return String(value.text || value.resumeText || value.content || "");
}

export function loadMasterResumeText() {
  if (typeof localStorage === "undefined") return "";
  return resumeTextFromStoredValue(localStorage.getItem(MASTER_RESUME_KEY));
}

export function saveMasterResumeText(text) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(MASTER_RESUME_KEY, JSON.stringify({
    name: "Rochelle_Magpantay_Master_Resume",
    text: String(text || "").trim(),
    updatedAt: new Date().toISOString(),
  }));
}

export function loadStudioDrafts() {
  if (typeof localStorage === "undefined") return { profile: { ...DEFAULT_DOCUMENT_PROFILE }, jobs: {} };
  const saved = safeJson(localStorage.getItem(STUDIO_DRAFTS_KEY), {});
  return {
    profile: { ...DEFAULT_DOCUMENT_PROFILE, ...(saved.profile || {}) },
    jobs: saved.jobs && typeof saved.jobs === "object" ? saved.jobs : {},
  };
}

export function saveStudioDrafts(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STUDIO_DRAFTS_KEY, JSON.stringify(value));
}

function list(values) {
  return (values || []).length ? values.map((item) => `- ${item}`).join("\n") : "- None identified by the portal.";
}

export function cleanJobDescription(value) {
  return String(value || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*li(?:\s[^>]*)?>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isAiFocusedJob(job) {
  return /\b(?:ai|artificial intelligence|generative ai)\b/i.test(`${job?.title || ""} ${job?.career_lane || ""}`);
}

export function buildTailoringBrief(job, masterResumeText, profile = DEFAULT_DOCUMENT_PROFILE) {
  if (!job) return "";
  const aiException = isAiFocusedJob(job)
    ? "This role is explicitly AI-focused, so a brief standalone practical-AI section is permitted only if it strengthens the application and uses facts from the master résumé."
    : "Do not create a standalone AI, Practical AI Use, or Continuing Education section. Fold AI coursework and practical use into one paragraph inside EDUCATION & PROFESSIONAL DEVELOPMENT, immediately after the degree line.";
  return `APPLICATION TAILORING BRIEF — ROCHELLE MAGPANTAY

ROLE
Company: ${job.company || "Not listed"}
Title: ${job.title || "Not listed"}
Location: ${job.location || "Not listed"}
Work style: ${job.workplace_type || "Not listed"}
Career lane: ${job.career_lane || "Not listed"}
Published salary: ${job.salary_min || job.salary_max ? `${job.salary_min || "?"}–${job.salary_max || "?"} ${job.salary_currency || "USD"}` : "Not listed"}
Application URL: ${job.apply_url || "Not listed"}
Portal score: ${job.score ?? "Not listed"} — use this displayed backend score only; do not recalculate fit.

PORTAL EVIDENCE TO EMPHASIZE
${list(job.strengths)}

HONEST GAPS OR QUESTIONS
${list(job.gaps)}

FULL JOB DESCRIPTION
${cleanJobDescription(job.description) || "The full description was unavailable. Do not infer missing requirements."}

MASTER RÉSUMÉ — ONLY APPROVED FACT SOURCE
${String(masterResumeText || "").trim() || "[MISSING — stop and ask Rochelle to provide the master résumé before writing.]"}

WRITING ASSIGNMENT
Create two truthful drafts tailored to this exact role: (1) a two-page résumé and (2) an engaging cover letter. Use only facts, employers, dates, metrics, education, tools, and accomplishments contained in the master résumé above. Never invent or upgrade a title, tool, metric, date, scope, credential, or achievement. Leave a genuine gap unaddressed rather than fabricate evidence.

VOICE — LOCKED
- Never use she, her, or hers.
- Résumé: omit the subject pronoun. Use direct accomplishment language such as “Pioneered…” rather than “I pioneered…”
- Cover letter: use first person throughout.
- Avoid “I am thrilled,” “perfect fit,” and “proven track record.”
- Frame the AO Globe Life Veterans Division as work Rochelle was asked to take on because it was harder: an underdeveloped market with no existing playbook. Lead with grit and determination, not metrics.
- Weave in, only where relevant, Rochelle's own framing: “relentless drive on new challenges”; “builds things that outlast me” through succession-minded leadership; “earns trust with both large-organization clients and my own team”; “builds missions people want to join”; and “my superpower is simplifying complex or overwhelming concepts so people get curious instead of defensive.” Translate that framing into pronoun-free résumé language and first-person cover-letter language.
- Keep the positioning at senior AI adoption and client solutions, strategic partnerships, implementation, enablement, and business transformation—not AI engineering.

RÉSUMÉ STRUCTURE — LOCKED
Use these exact uppercase headings in this exact order:
${RESUME_SECTIONS.map((heading) => `- ${heading}`).join("\n")}
${aiException}

COVER LETTER — LOCKED
- Plain, engaging first-person paragraphs.
- Make Rochelle's personality and soft-skill advantage concrete rather than generic.
- End exactly with:
Best Regards,
Rochelle Magpantay

DOCUMENT HEADER — BOTH DOCUMENTS
Name: ${profile.name || DEFAULT_DOCUMENT_PROFILE.name}
Headline: ${profile.headline || DEFAULT_DOCUMENT_PROFILE.headline}
Tagline: ${profile.tagline || DEFAULT_DOCUMENT_PROFILE.tagline}
Contact line: ${profile.contact || "[Use the contact line exactly as it appears in the master résumé.]"}

RETURN FORMAT
Return the résumé first, beginning with EXECUTIVE PROFILE. Return the cover-letter body separately, beginning with its salutation. Do not repeat the document header; the portal applies it consistently.`;
}

export function validateResumeText(text, job) {
  const errors = [];
  const value = String(text || "").trim();
  if (!value) return ["Paste the finished résumé text first."];
  if (THIRD_PERSON.test(value)) errors.push("Remove third-person pronouns (she/her/hers). This résumé is written without a subject pronoun.");
  if (/\bI\b/.test(value)) errors.push("Remove first-person “I” from the résumé; begin bullets with action verbs.");
  const positions = RESUME_SECTIONS.map((heading) => value.indexOf(heading));
  RESUME_SECTIONS.forEach((heading, index) => {
    if (positions[index] < 0) errors.push(`Add the required section heading: ${heading}.`);
  });
  if (positions.every((position) => position >= 0) && positions.some((position, index) => index && position < positions[index - 1])) {
    errors.push("Put the résumé sections in the locked order shown above.");
  }
  if (!isAiFocusedJob(job) && /^(?:PRACTICAL AI(?: USE)?|AI(?: FLUENCY| SKILLS| EXPERIENCE)|CONTINUING EDUCATION)$/im.test(value)) {
    errors.push("Remove the standalone AI/continuing-education section and fold that content into EDUCATION & PROFESSIONAL DEVELOPMENT.");
  }
  return errors;
}

export function validateCoverLetterText(text) {
  const errors = [];
  const value = String(text || "").trim();
  if (!value) return ["Paste the finished cover-letter text first."];
  if (THIRD_PERSON.test(value)) errors.push("Remove third-person pronouns (she/her/hers) and use first person throughout.");
  FORBIDDEN_GENERIC.forEach((phrase) => {
    if (value.toLocaleLowerCase().includes(phrase)) errors.push(`Replace the generic phrase “${phrase}.”`);
  });
  return errors;
}

function cleanCoverBody(text) {
  return String(text || "")
    .replace(/\n\s*(?:best(?:\s+regards)?|kind regards|warm regards|sincerely),?\s*\n[\s\S]*$/i, "")
    .trim();
}

function splitBlocks(text) {
  return String(text || "").replace(/\r/g, "").split(/\n/).map((line) => line.trimEnd());
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function formattedHtml(type, text, profile) {
  const lines = splitBlocks(type === "cover" ? cleanCoverBody(text) : text);
  const body = lines.map((line) => {
    const clean = line.trim();
    if (!clean) return '<p style="margin:0 0 8pt">&nbsp;</p>';
    if (RESUME_SECTIONS.includes(clean) || (/^[A-Z][A-Z &/]+$/.test(clean) && clean.length < 70)) {
      return `<h2 style="font-family:Aptos,sans-serif;color:#2E74B5;font-size:11pt;font-weight:700;border-bottom:1px solid #D9D9D9;margin:10pt 0 5pt">${escapeHtml(clean)}</h2>`;
    }
    if (/^[•*-]\s+/.test(clean)) return `<p style="font-family:Aptos,sans-serif;font-size:10.5pt;margin:0 0 3pt 18pt;text-indent:-9pt">• ${escapeHtml(clean.replace(/^[•*-]\s+/, ""))}</p>`;
    return `<p style="font-family:Aptos,sans-serif;font-size:${type === "cover" ? "11" : "10.5"}pt;margin:0 0 6pt">${escapeHtml(clean)}</p>`;
  }).join("");
  const signoff = type === "cover" ? '<p style="font-family:Aptos,sans-serif;font-size:11pt;margin-top:14pt">Best Regards,<br>Rochelle Magpantay</p>' : "";
  return `<div style="font-family:Aptos,sans-serif;color:#000"><div style="text-align:center"><div style="color:#17365D;font-size:22pt;font-weight:700">${escapeHtml(profile.name)}</div><div style="font-weight:700">${escapeHtml(profile.headline)}</div><div style="font-weight:700">${escapeHtml(profile.tagline)}</div><div style="color:#666;font-size:9pt">${escapeHtml(profile.contact)}</div><div style="border-bottom:2px solid #17365D;margin:4pt 0 9pt"></div></div>${body}${signoff}</div>`;
}

async function copyRichHtml(html, plainText) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    })]);
  } else {
    await navigator.clipboard.writeText(plainText);
  }
}

export async function copyForGoogleDocs(type, text, profile) {
  const body = type === "cover" ? `${cleanCoverBody(text)}\n\nBest Regards,\nRochelle Magpantay` : text;
  await copyRichHtml(formattedHtml(type, text, profile), `${profile.name}\n${profile.headline}\n${profile.tagline}\n${profile.contact}\n\n${body}`);
}

function filenamePart(value) {
  return String(value || "document").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function bodyParagraphs(docx, type, text) {
  const { AlignmentType, BorderStyle, Paragraph, TextRun } = docx;
  const lines = splitBlocks(type === "cover" ? cleanCoverBody(text) : text);
  const paragraphs = [];
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      return;
    }
    const isSection = RESUME_SECTIONS.includes(line) || (/^[A-Z][A-Z &/]+$/.test(line) && line.length < 70);
    const isBullet = /^[•*-]\s+/.test(line);
    const isRoleLine = type === "resume" && !isSection && !isBullet && line.length < 120 && (line.includes("|") || /\b(?:19|20)\d{2}\b/.test(line));
    paragraphs.push(new Paragraph({
      spacing: isSection ? { before: 170, after: 75 } : { after: type === "cover" ? 150 : 55, line: type === "cover" ? 276 : 245 },
      indent: isBullet ? { left: 300, hanging: 150 } : undefined,
      border: isSection ? { bottom: { color: "D9D9D9", style: BorderStyle.SINGLE, size: 5, space: 2 } } : undefined,
      children: [new TextRun({
        text: isBullet ? `• ${line.replace(/^[•*-]\s+/, "")}` : line,
        font: "Aptos",
        size: isSection ? 22 : (type === "cover" ? 22 : 21),
        bold: isSection || isRoleLine,
        color: isSection ? "2E74B5" : "000000",
      })],
    }));
  });
  if (type === "cover") {
    paragraphs.push(new Paragraph({ spacing: { before: 180 }, children: [new TextRun({ text: "Best Regards,", font: "Aptos", size: 22 })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Rochelle Magpantay", font: "Aptos", size: 22 })] }));
  }
  return paragraphs;
}

export function createDocumentDefinition(docx, type, text, profile) {
  const { AlignmentType, BorderStyle, Document, Paragraph, TextRun } = docx;
  const header = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 25 }, children: [new TextRun({ text: profile.name, font: "Aptos", size: 44, bold: true, color: "17365D" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: profile.headline, font: "Aptos", size: 22, bold: true, color: "000000" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: profile.tagline, font: "Aptos", size: 21, bold: true, color: "000000" })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 130 },
      border: { bottom: { color: "17365D", style: BorderStyle.SINGLE, size: 14, space: 5 } },
      children: [new TextRun({ text: profile.contact, font: "Aptos", size: 18, color: "666666" })],
    }),
  ];
  return new Document({
    styles: { default: { document: { run: { font: "Aptos", size: type === "cover" ? 22 : 21 }, paragraph: { spacing: { line: type === "cover" ? 276 : 245 } } } } },
    sections: [{
      properties: { page: { margin: { top: 835, bottom: 792, left: 979, right: 979 } } },
      children: [...header, ...bodyParagraphs(docx, type, text)],
    }],
  });
}

export async function downloadDocx(type, text, profile, job) {
  const docx = await import(DOCX_MODULE_URL);
  const document = createDocumentDefinition(docx, type, text, profile);
  const blob = await docx.Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const anchor = documentGlobal().createElement("a");
  anchor.href = url;
  anchor.download = `Rochelle-Magpantay-${filenamePart(job?.company)}-${filenamePart(job?.title)}-${type === "cover" ? "Cover-Letter" : "Resume"}.docx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function documentGlobal() {
  return document;
}
