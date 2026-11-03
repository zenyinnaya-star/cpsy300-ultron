// CPSY 300 Team Project, Phase 1 — GIVEN CODE. Copy this file into your project exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

export function loadRows() {
  const file = path.join(process.cwd(), "data", "All_Diets.csv");
  const text = readFileSync(file, "utf8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,          // first line = column names
    skipEmptyLines: true,
  });
  return result.data;      // one object per recipe, every value a string
}
