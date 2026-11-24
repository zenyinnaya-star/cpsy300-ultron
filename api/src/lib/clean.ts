// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Reading, cleaning and analysing a recipes CSV. The same five rules as the Phase 1 reference
// solution, now run ONCE per upload inside the blob-triggered function.
import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { Insights, Quality, Recipe } from "./types";

export const EXTREME_LIMIT_G = 1000;

const round = (n: number, places = 1) => Number(n.toFixed(places));

// Same diet + same recipe name (trimmed, lower-case) -> same id, on every upload.
// A hash, because recipe names contain characters Cosmos DB does not allow in ids (/ \ ? #).
export function recipeId(diet: string, name: string): string {
  return createHash("sha1").update(`${diet}|${name.trim().toLowerCase()}`).digest("hex").slice(0, 24);
}

// "  12.5 " -> 12.5; blank, not a number, or negative -> null.
function toGrams(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return result.data;
}

export function cleanRows(raw: Record<string, string>[]): { recipes: Recipe[]; quality: Quality } {
  let namesTidied = 0, removedBlankOrNotANumber = 0, removedDuplicates = 0, removedExtreme = 0, keptZeroProteinOrFat = 0;
  const seen = new Set<string>();
  const recipes: Recipe[] = [];

  for (const row of raw) {
    // Rule 1: trim spaces and lower-case the diet and cuisine names.
    const dietRaw = row["Diet_type"] ?? "";
    const cuisineRaw = row["Cuisine_type"] ?? "";
    const diet = dietRaw.trim().toLowerCase();
    const cuisine = cuisineRaw.trim().toLowerCase();
    const name = (row["Recipe_name"] ?? "").trim();
    if (diet !== dietRaw || cuisine !== cuisineRaw) namesTidied++;

    // Rule 2: a missing diet or name, or grams that are blank / not a number / negative -> remove.
    const protein = toGrams(row["Protein(g)"]);
    const carbs = toGrams(row["Carbs(g)"]);
    const fat = toGrams(row["Fat(g)"]);
    if (!diet || !name || protein === null || carbs === null || fat === null) {
      removedBlankOrNotANumber++;
      continue;
    }

    // Rule 3: the same recipe twice in the same diet -> keep the first copy.
    const id = recipeId(diet, name);
    if (seen.has(id)) { removedDuplicates++; continue; }
    seen.add(id);

    // Rule 4: any macronutrient above the limit -> remove as an error.
    if (protein > EXTREME_LIMIT_G || carbs > EXTREME_LIMIT_G || fat > EXTREME_LIMIT_G) { removedExtreme++; continue; }

    // Rule 5: zeros are kept (a salad can have 0 g protein) but counted.
    if (protein === 0 || fat === 0) keptZeroProteinOrFat++;

    recipes.push({ id, diet, name, cuisine, protein, carbs, fat });
  }

  return {
    recipes,
    quality: {
      rowsRead: raw.length, namesTidied, removedBlankOrNotANumber, removedDuplicates, removedExtreme,
      keptZeroProteinOrFat, rowsUsed: recipes.length,
      rules: [
        "Diet and cuisine names: spaces trimmed, lower-cased.",
        "Rows with a missing diet or name, or blank / non-number / negative grams: removed.",
        "Same recipe name twice in the same diet: first copy kept, later copies removed.",
        `Any macronutrient above ${EXTREME_LIMIT_G} g for the whole recipe: row removed as an error.`,
        "0 g protein or 0 g fat: kept (it can be true) and counted.",
      ],
    },
  };
}

export function computeInsights(recipes: Recipe[], quality: Quality): Insights {
  const byDiet = new Map<string, Recipe[]>();
  for (const r of recipes) {
    const list = byDiet.get(r.diet) ?? [];
    list.push(r);
    byDiet.set(r.diet, list);
  }
  const diets = [...byDiet.keys()].sort();

  const averages = diets.map((diet) => {
    const list = byDiet.get(diet)!;
    const sum = (f: (r: Recipe) => number) => list.reduce((t, r) => t + f(r), 0);
    return {
      diet,
      protein: round(sum((r) => r.protein) / list.length),
      carbs: round(sum((r) => r.carbs) / list.length),
      fat: round(sum((r) => r.fat) / list.length),
      recipes: list.length,
    };
  });

  const topProtein = diets.map((diet) => ({
    diet,
    recipes: [...byDiet.get(diet)!]
      .sort((a, b) => b.protein - a.protein)
      .slice(0, 5)
      .map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine, protein: round(r.protein) })),
  }));

  const topCuisines = diets.map((diet) => {
    const counts = new Map<string, number>();
    for (const r of byDiet.get(diet)!) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
    const cuisines = [...counts.entries()]
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a, b) => b.count - a.count || a.cuisine.localeCompare(b.cuisine))
      .slice(0, 5);
    return { diet, cuisines };
  });

  const ratios = averages.map((a) => ({
    diet: a.diet,
    proteinToCarbs: round(a.protein / a.carbs, 2),
    carbsToFat: round(a.carbs / a.fat, 2),
  }));

  return { averages, topProtein, topCuisines, ratios, quality };
}

// Everything the blob trigger needs, in one call.
export function analyseCsv(text: string) {
  const { recipes, quality } = cleanRows(parseCsv(text));
  return { recipes, insights: computeInsights(recipes, quality) };
}
