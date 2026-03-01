#!/usr/bin/env node
/**
 * Resume Dev Server — dev.mjs
 *
 * Watches resume.yaml + src/ for changes, rebuilds HTML only (fast),
 * and serves dist/ with auto-reload via browser-sync.
 */

import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";
import browserSync from "browser-sync";
import { YAML_PATH, SRC_DIR, DIST_DIR, HTML_OUT, renderHtml } from "./render.mjs";

function rebuild() {
  try {
    const includePhone = process.env.RESUME_INCLUDE_PHONE === "1";
    const html = renderHtml({ includePhone });
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
const watcher = chokidar.watch(
  [YAML_PATH, SRC_DIR],
  {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  }
);

watcher.on("all", (event, filePath) => {
  if (filePath.includes("/fonts/")) return;
  console.log(`🔄 ${event}: ${path.relative(path.resolve(SRC_DIR, ".."), filePath)}`);
  rebuild();
});

console.log("👀 Watching for changes... (Ctrl+C to stop)");
