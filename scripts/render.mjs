/**
 * Shared resume rendering logic — used by both build.mjs and dev.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Paths ──────────────────────────────────────────────
export const YAML_PATH = path.join(ROOT, "resume.yaml");
export const TEMPLATE_PATH = path.join(ROOT, "src", "template.html");
export const STYLES_PATH = path.join(ROOT, "src", "styles.css");
export const DIST_DIR = path.join(ROOT, "dist");
export const HTML_OUT = path.join(DIST_DIR, "resume.html");
const currentYear = new Date().getFullYear();
export const PDF_OUT = path.join(DIST_DIR, `PatrickGatewoodResume-${currentYear}.pdf`);
export const SRC_DIR = path.join(ROOT, "src");

// ── Font Awesome icon loader ──────────────────────────
const FA_DIR = path.join(ROOT, "node_modules", "@fortawesome", "fontawesome-free", "svgs");

function loadIcon(name, size = 14, category = "solid", yOffset = 0) {
  const file = path.join(FA_DIR, category, `${name}.svg`);
  if (!fs.existsSync(file)) return "";
  const transform = yOffset ? ` transform: translateY(${yOffset}px);` : "";
  return fs.readFileSync(file, "utf8")
    .replace("<svg", `<svg width="${size}" height="${size}" style="fill: currentColor;${transform}"`);
}

// ── YAML Field Mapping (adjust here if schema changes) ─
const FIELD = {
  name: (d) => d.name ?? "Your Name",
  contact: (d) => d.contact ?? {},
  experience: (d) => d.work_experience ?? [],
  education: (d) => d.education ?? [],
  skills: (d) => d.skills ?? {},
};

// ── Link icons ─────────────────────────────────────────
const LINK_ICON_MAP = {
  website:  { name: "house",    category: "solid",  yOffset: -0.225 },
  github:   { name: "github",   category: "brands", yOffset: 0 },
  linkedin: { name: "linkedin", category: "brands", yOffset: 0 },
  email:    { name: "envelope", category: "solid",  yOffset: 0.5 },
  phone:    { name: "phone",    category: "solid",  yOffset: 0 },
};

// ── Section icons ──────────────────────────────────────
const SECTION_ICONS = {
  experience: loadIcon("briefcase", 18),
  education: loadIcon("graduation-cap", 18),
  skills: loadIcon("wrench", 18),
};

// ── Helpers ────────────────────────────────────────────
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function inlineFonts(css) {
  return css.replace(/url\(['"]?([^'")]+\.ttf)['"]?\)/g, (match, fontPath) => {
    const absPath = path.join(ROOT, "src", fontPath);
    if (fs.existsSync(absPath)) {
      const data = fs.readFileSync(absPath).toString("base64");
      return `url('data:font/truetype;base64,${data}')`;
    }
    return match;
  });
}

function formatPhoneNumber(num) {
  if (!num) return "";
  const cleaned = num.replace(/\D/g, "");
  const digits = (cleaned.length === 11 && cleaned.startsWith("1")) ? cleaned.substring(1) : cleaned;
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return num;
}

function buildLinks(contact) {
  return Object.entries(contact)
    .map(([key, val]) => {
      const mapping = LINK_ICON_MAP[key] ?? { name: "link", category: "solid", yOffset: 0 };
      const icon = loadIcon(mapping.name, 13, mapping.category, mapping.yOffset ?? 0);
      const label = escapeHtml(val.label ?? key);
      const url = escapeHtml(val.url ?? "#");
      return `<span class="link-item">${icon}<a href="${url}">${label}</a></span>`;
    })
    .join("");
}

function buildExperience(jobs) {
  return jobs
    .map((job) => {
      let html = `<div class="job">`;
      html += `<div class="job-header">`;
      html += `<span class="job-company-title"><strong>${escapeHtml(job.company)}</strong>`;
      if (job.title) {
        html += `<span class="separator">|</span><span class="title">${escapeHtml(job.title)}</span>`;
      }
      html += `</span>`;
      html += `<span class="job-dates">${escapeHtml(job.dates)}</span>`;
      html += `</div>`;

      if (job.progression && Array.isArray(job.progression)) {
        html += `<div class="job-progression">`;
        job.progression.forEach((p, i) => {
          if (i > 0) html += `  `;
          html += `<span class="prog-item"><span class="prog-year">${escapeHtml(String(p.year))}</span> <span class="prog-dot">·</span> ${escapeHtml(p.title)}</span>`;
        });
        html += `</div>`;
      }

      if (job.highlights && Array.isArray(job.highlights)) {
        html += `<ul class="job-bullets">`;
        job.highlights.forEach((h) => {
          html += `<li>${escapeHtml(h.trim())}</li>`;
        });
        html += `</ul>`;
      }

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
      return `
        <div class="education-item">
          <div class="education-institution"><strong>${escapeHtml(s.institution)}</strong></div>
          <div class="education-degree-year">${escapeHtml(s.degree)} <span class="separator">|</span> ${escapeHtml(String(s.year ?? ""))}</div>
        </div>`.trim();
    })
    .join("");
}

function buildSkills(skillsObj) {
  const labels = {
    mobile_development: "Mobile Development",
    architecture_and_build_systems: "Architecture & Build Systems",
    agentic_engineering: "Agentic AI & Engineering",
    tools: "Tools & Infrastructure",
  };
  return Object.entries(skillsObj)
    .map(([key, items]) => {
      const label = labels[key] ?? key;
      return `<div class="skills-group"><span class="skills-group-label">${escapeHtml(label)}:</span> <span class="skills-list">${items.map(escapeHtml).join(" · ")}</span></div>`;
    })
    .join("");
}

// ── Main render function ──────────────────────────────
export function renderHtml(options = {}) {
  const { includePhone = false, phoneNumber = process.env.PHONE_NUMBER } = options;
  const data = yaml.load(fs.readFileSync(YAML_PATH, "utf8"));
  let template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const rawStyles = fs.readFileSync(STYLES_PATH, "utf8");
  const styles = inlineFonts(rawStyles);

  const name = FIELD.name(data);
  const contact = FIELD.contact(data);

  if (includePhone) {
    if (!phoneNumber) {
      throw new Error("RESUME_INCLUDE_PHONE is enabled, but PHONE_NUMBER is not set.");
    }
    contact.phone = {
      label: formatPhoneNumber(phoneNumber),
      url: `tel:${phoneNumber}`,
    };
  }

  const experience = FIELD.experience(data);
  const education = FIELD.education(data);
  const skills = FIELD.skills(data);

  return template
    .replace("{{styles}}", styles)
    .replace(/\{\{name\}\}/g, escapeHtml(name))
    .replace("{{links}}", buildLinks(contact))
    .replace("{{icon-experience}}", SECTION_ICONS.experience)
    .replace("{{icon-education}}", SECTION_ICONS.education)
    .replace("{{icon-skills}}", SECTION_ICONS.skills)
    .replace("{{experience}}", buildExperience(experience))
    .replace("{{education}}", buildEducation(education))
    .replace("{{skills}}", buildSkills(skills));
}
