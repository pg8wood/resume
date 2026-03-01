#!/usr/bin/env node
/**
 * verify.mjs
 * 
 * Checks the generated PDF to ensure it meets quality standards:
 * 1. File exists
 * 2. Page count <= 2
 */

import fs from "node:fs";
import yaml from "js-yaml";
import { PDF_OUT, YAML_PATH } from "./render.mjs";

function verify() {
  // 1. Validate YAML
  console.log("🔍 Validating YAML...");
  try {
    const fileContents = fs.readFileSync(YAML_PATH, "utf8");
    yaml.load(fileContents);
    console.log("✅ YAML is valid.");
  } catch (e) {
    console.error(`❌ YAML Validation failed:\n${e.message}`);
    process.exit(1);
  }

  // 2. Validate PDF
  if (!fs.existsSync(PDF_OUT)) {
    console.error(`❌ Verification failed: ${PDF_OUT} does not exist.`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(PDF_OUT);
  const pdfString = pdfBuffer.toString("binary");
  
  // PDF page count can be reliably found by counting /Type /Page (with a word boundary)
  const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 0;

  console.log(`📄 PDF Page Count: ${pageCount}`);

  if (pageCount > 2) {
    console.error(`❌ Verification failed: Resume is ${pageCount} pages (max 2 allowed). Time to trim some bullets!`);
    process.exit(1);
  }

  console.log("✅ Verification passed: Resume is within page limits.");
}

verify();
