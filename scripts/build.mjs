#!/usr/bin/env node
/**
 * Resume Compiler — build.mjs
 *
 * Public mode (default): renders dist/resume.html + dist/<year>.pdf and copies
 * a stable PDF to repo root.
 * Recruiter mode (RESUME_INCLUDE_PHONE=1): includes PHONE_NUMBER in contact
 * output and writes a private PDF in dist only.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { DIST_DIR, HTML_OUT, PDF_OUT, renderHtml } from "./render.mjs";

async function main() {
  const includePhone = process.env.RESUME_INCLUDE_PHONE === "1";
  const privatePdfOut = PDF_OUT.replace(/\.pdf$/, "-with-phone.pdf");
  const pdfOut = includePhone ? privatePdfOut : PDF_OUT;
  const ROOT_PDF_OUT = path.resolve(DIST_DIR, "..", "PatrickGatewoodResume.pdf");
  const html = renderHtml({ includePhone });

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(HTML_OUT, html, "utf8");
  console.log(`✅ HTML written to ${HTML_OUT}`);

  console.log("🖨️  Rendering PDF with Playwright...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: pdfOut,
    format: "Letter",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  console.log(`✅ PDF written to ${pdfOut}`);

  if (!includePhone) {
    fs.copyFileSync(pdfOut, ROOT_PDF_OUT);
    console.log(`✅ Stable PDF copied to ${ROOT_PDF_OUT}`);
  } else {
    console.log("🔒 Recruiter mode enabled: skipped root PDF copy for privacy.");
  }

  // Local convenience only: avoid attempting to open files in CI/non-macOS runners.
  if (!process.env.CI && process.platform === "darwin") {
    import("node:child_process").then(({ exec }) => {
      exec(`open "${pdfOut}"`);
    });
  }
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
