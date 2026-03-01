#!/usr/bin/env node
/**
 * Resume Compiler — build.mjs
 *
 * Reads resume.yaml → renders dist/resume.html + dist/resume.pdf
 */

import fs from "node:fs";
import { chromium } from "playwright";
import { DIST_DIR, HTML_OUT, PDF_OUT, renderHtml } from "./render.mjs";

async function main() {
  const html = renderHtml();

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(HTML_OUT, html, "utf8");
  console.log(`✅ HTML written to ${HTML_OUT}`);

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
  
  // Automatically open the PDF
  import("node:child_process").then(({ exec }) => {
    exec(`open "${PDF_OUT}"`);
  });
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
