#!/usr/bin/env node
/**
 * Resume Dev Server — dev.mjs
 *
 * Watches resume.yaml + src/ for changes, rebuilds HTML only (fast),
 * and serves dist/ with auto-reload via browser-sync.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import chokidar from "chokidar";
import browserSync from "browser-sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Paths ──────────────────────────────────────────────
const YAML_PATH = path.join(ROOT, "resume.yaml");
const TEMPLATE_PATH = path.join(ROOT, "src", "template.html");
const STYLES_PATH = path.join(ROOT, "src", "styles.css");
const DIST_DIR = path.join(ROOT, "dist");
const HTML_OUT = path.join(DIST_DIR, "resume.html");

// ── Reuse build logic from build.mjs ──────────────────
const FIELD = {
  name: (d) => d.name ?? "Your Name",
  contact: (d) => d.contact ?? {},
  experience: (d) => d.work_experience ?? [],
  education: (d) => d.education ?? [],
  skills: (d) => d.skills ?? {},
};

const LINK_ICONS = {
  website: "🏠",
  github: "💻",
  linkedin: "🔗",
  email: "✉️",
  phone: "📞",
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function rebuild() {
  try {
    const data = yaml.load(fs.readFileSync(YAML_PATH, "utf8"));
    let template = fs.readFileSync(TEMPLATE_PATH, "utf8");
    const rawStyles = fs.readFileSync(STYLES_PATH, "utf8");
    const styles = inlineFonts(rawStyles);

    const name = FIELD.name(data);
    const contact = FIELD.contact(data);
    const experience = FIELD.experience(data);
    const education = FIELD.education(data);
    const skills = FIELD.skills(data);

    let html = template
      .replace("{{styles}}", styles)
      .replace(/\{\{name\}\}/g, escapeHtml(name))
      .replace("{{links}}", buildLinks(contact))
      .replace("{{experience}}", buildExperience(experience))
      .replace("{{education}}", buildEducation(education))
      .replace("{{skills}}", buildSkills(skills));

    fs.mkdirSync(DIST_DIR, { recursive: true });
    fs.writeFileSync(HTML_OUT, html, "utf8");
    console.log(`✅ HTML rebuilt at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error(`❌ Build error: ${err.message}`);
  }
}

// ── Initial build ─────────────────────────────────────
rebuild();

// ── Start browser-sync ────────────────────────────────
const bs = browserSync.create();
bs.init({
  server: DIST_DIR,
  files: [path.join(DIST_DIR, "**/*")],
  startPath: "/resume.html",
  open: true,
  notify: false,
  ui: false,
});

// ── Watch source files ────────────────────────────────
const SRC_DIR = path.join(ROOT, "src");
const watcher = chokidar.watch(
  [YAML_PATH, SRC_DIR],
  {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  }
);

watcher.on("all", (event, filePath) => {
  // Skip font files — only rebuild on yaml/html/css changes
  if (filePath.includes("/fonts/")) return;
  console.log(`🔄 ${event}: ${path.relative(ROOT, filePath)}`);
  rebuild();
});

console.log("👀 Watching for changes... (Ctrl+C to stop)");
