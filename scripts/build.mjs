#!/usr/bin/env node
/**
 * Resume Compiler — build.mjs
 *
 * Reads resume.yaml → renders dist/resume.html + dist/resume.pdf
 *
 * ── YAML FIELD MAPPING ──────────────────────────────────
 * Adjust these paths if your YAML schema changes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Paths ──────────────────────────────────────────────
const YAML_PATH = path.join(ROOT, "resume.yaml");
const TEMPLATE_PATH = path.join(ROOT, "src", "template.html");
const STYLES_PATH = path.join(ROOT, "src", "styles.css");
const FONTS_DIR = path.join(ROOT, "src", "fonts", "Spectral-2");
const DIST_DIR = path.join(ROOT, "dist");
const HTML_OUT = path.join(DIST_DIR, "resume.html");
const PDF_OUT = path.join(DIST_DIR, "resume.pdf");

// ── YAML Field Mapping (adjust here if schema changes) ─
const FIELD = {
  name: (d) => d.name ?? "Your Name",
  contact: (d) => d.contact ?? {},
  experience: (d) => d.work_experience ?? [],
  education: (d) => d.education ?? [],
  skills: (d) => d.skills ?? {},
};

// ── Link icons (unicode placeholders) ──────────────────
const LINK_ICONS = {
  website: "�",
  github: "💻",
  linkedin: "🔗",
  email: "✉️",
  phone: "📞",
};

// ── Helpers ────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert font file paths in CSS url() to base64 data URIs for portability */
function inlineFonts(css) {
  return css.replace(/url\(['"]?([^'")]+\.ttf)['"]?\)/g, (match, fontPath) => {
    const absPath = path.join(ROOT, "src", fontPath);
    if (fs.existsSync(absPath)) {
      const data = fs.readFileSync(absPath).toString("base64");
      return `url('data:font/truetype;base64,${data}')`;
    }
    return match;
  });
}

function buildLinks(contact) {
  return Object.entries(contact)
    .map(([key, val]) => {
      const icon = LINK_ICONS[key] ?? "🔗";
      const label = escapeHtml(val.label ?? key);
      const url = escapeHtml(val.url ?? "#");
      return `<span class="link-item"><span class="link-icon">${icon}</span><a href="${url}">${label}</a></span>`;
    })
    .join("");
}

function buildExperience(jobs) {
  return jobs
    .map((job) => {
      let html = `<div class="job">`;
      html += `<div class="job-header">`;

      // Company | Title format (matching Pages reference)
      html += `<span class="job-company-title"><strong>${escapeHtml(job.company)}</strong>`;
      if (job.title) {
        html += `<span class="separator">|</span><span class="title">${escapeHtml(job.title)}</span>`;
      }
      html += `</span>`;
      html += `<span class="job-dates">${escapeHtml(job.dates)}</span>`;
      html += `</div>`;

      // Progression (multiple titles over time, e.g. WillowTree)
      if (job.progression && Array.isArray(job.progression)) {
        html += `<div class="job-progression">`;
        job.progression.forEach((p, i) => {
          if (i > 0) html += `  `;
          html += `<span class="prog-item"><span class="prog-year">${escapeHtml(String(p.year))}</span> <span class="prog-dot">·</span> ${escapeHtml(p.title)}</span>`;
        });
        html += `</div>`;
      }

      // Direct highlights (Square, Robot Hand)
      if (job.highlights && Array.isArray(job.highlights)) {
        html += `<ul class="job-bullets">`;
        job.highlights.forEach((h) => {
          html += `<li>${escapeHtml(h.trim())}</li>`;
        });
        html += `</ul>`;
      }

      // Project-based highlights (WillowTree)
      if (job.projects && Array.isArray(job.projects)) {
        job.projects.forEach((proj) => {
          html += `<div class="job-project">`;
          html += `<div class="job-project-name">${escapeHtml(proj.name)}</div>`;
          if (proj.highlights && Array.isArray(proj.highlights)) {
            html += `<ul class="job-bullets">`;
            proj.highlights.forEach((h) => {
              html += `<li>${escapeHtml(h.trim())}</li>`;
            });
            html += `</ul>`;
          }
          html += `</div>`;
        });
      }

      // Additional clients
      if (job.additional_clients && Array.isArray(job.additional_clients)) {
        html += `<div class="additional-clients"><strong>Additional clients:</strong> ${job.additional_clients.map(escapeHtml).join(", ")}</div>`;
      }

      html += `</div>`;
      return html;
    })
    .join("");
}

function buildEducation(schools) {
  return schools
    .map((s) => {
      return `<div class="education-item"><div class="education-details"><span><strong>${escapeHtml(s.institution)}</strong> — ${escapeHtml(s.degree)}</span><span class="education-year">${escapeHtml(String(s.year ?? ""))}</span></div></div>`;
    })
    .join("");
}

function buildSkills(skillsObj) {
  const labels = {
    mobile_development: "Mobile Development",
    tools: "Tools & Infrastructure",
  };
  return Object.entries(skillsObj)
    .map(([key, items]) => {
      const label = labels[key] ?? key;
      return `<div class="skills-group"><span class="skills-group-label">${escapeHtml(label)}:</span> <span class="skills-list">${items.map(escapeHtml).join(" · ")}</span></div>`;
    })
    .join("");
}

// ── Main ──────────────────────────────────────────────
async function main() {
  // 1. Read inputs
  const data = yaml.load(fs.readFileSync(YAML_PATH, "utf8"));
  let template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const rawStyles = fs.readFileSync(STYLES_PATH, "utf8");

  // 2. Inline font files as base64 data URIs
  const styles = inlineFonts(rawStyles);

  // 3. Build sections
  const name = FIELD.name(data);
  const contact = FIELD.contact(data);
  const experience = FIELD.experience(data);
  const education = FIELD.education(data);
  const skills = FIELD.skills(data);

  const linksHtml = buildLinks(contact);
  const expHtml = buildExperience(experience);
  const eduHtml = buildEducation(education);
  const skillsHtml = buildSkills(skills);

  // 4. Inject into template
  let html = template
    .replace("{{styles}}", styles)
    .replace(/\{\{name\}\}/g, escapeHtml(name))
    .replace("{{links}}", linksHtml)
    .replace("{{experience}}", expHtml)
    .replace("{{education}}", eduHtml)
    .replace("{{skills}}", skillsHtml);

  // 5. Write HTML
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(HTML_OUT, html, "utf8");
  console.log(`✅ HTML written to ${HTML_OUT}`);

  // 6. Render PDF with Playwright
  console.log("🖨️  Rendering PDF with Playwright...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: PDF_OUT,
    format: "Letter",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  console.log(`✅ PDF written to ${PDF_OUT}`);
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
