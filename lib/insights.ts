// CPSY 300 Team Project, Phase 1 — GIVEN CODE. Copy this file into your project exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import { loadRows } from "@/lib/data";

// ---------------------------------------------------------------------------
// The five cleaning rules. The brief (Part A) explains each one; your report
// explains them in your own words.
// ---------------------------------------------------------------------------

// Rule 4: a single macronutrient above this, for a whole recipe, is treated as
// an error (1,000 g of carbohydrate alone is about 4,000 kcal).
export const EXTREME_LIMIT_G = 1000;

export type Recipe = {
  diet: string;
  name: string;
  cuisine: string;
  protein: number;
  carbs: number;
  fat: number;
};

export type Insights = {
  averages: { diet: string; protein: number; carbs: number; fat: number; recipes: number }[];
  topProtein: { diet: string; recipes: { name: string; cuisine: string; protein: number }[] }[];
  topCuisines: { diet: string; cuisines: { cuisine: string; count: number }[] }[];
  ratios: { diet: string; proteinToCarbs: number; carbsToFat: number }[];
  quality: {
    rowsRead: number;
    namesTidied: number;
    removedBlankOrNotANumber: number;
    removedDuplicates: number;
    removedExtreme: number;
    keptZeroProteinOrFat: number;
    rowsUsed: number;
    rules: string[];
  };
};

// Turn "  12.5 " into 12.5; anything blank, non-numeric or negative becomes null.
function toGrams(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const round = (n: number, places = 1) => Number(n.toFixed(places));

export function cleanRows() {
  const raw = loadRows();
  let namesTidied = 0;
  let removedBlankOrNotANumber = 0;
  let removedDuplicates = 0;
  let removedExtreme = 0;
  let keptZeroProteinOrFat = 0;

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

    // Rule 2: skip rows with a missing diet or name, or grams that are blank / not a number.
    const protein = toGrams(row["Protein(g)"]);
    const carbs = toGrams(row["Carbs(g)"]);
    const fat = toGrams(row["Fat(g)"]);
    if (!diet || !name || protein === null || carbs === null || fat === null) {
      removedBlankOrNotANumber++;
      continue;
    }

    // Rule 3: the same recipe twice in the same diet -> keep the first copy.
    const key = `${diet}|${name.toLowerCase()}`;
    if (seen.has(key)) {
      removedDuplicates++;
      continue;
    }
    seen.add(key);

    // Rule 4: any macronutrient above the limit -> remove the row.
    if (protein > EXTREME_LIMIT_G || carbs > EXTREME_LIMIT_G || fat > EXTREME_LIMIT_G) {
      removedExtreme++;
      continue;
    }

    // Rule 5: zeros are kept (a salad can have 0 g protein) but counted.
    if (protein === 0 || fat === 0) keptZeroProteinOrFat++;

    recipes.push({ diet, name, cuisine, protein, carbs, fat });
  }

  return {
    recipes,
    quality: {
      rowsRead: raw.length,
      namesTidied,
      removedBlankOrNotANumber,
      removedDuplicates,
      removedExtreme,
      keptZeroProteinOrFat,
      rowsUsed: recipes.length,
    },
  };
}

function computeAll(): Insights {
  const { recipes, quality } = cleanRows();

  const byDiet = new Map<string, Recipe[]>();
  for (const r of recipes) {
    const list = byDiet.get(r.diet) ?? [];
    list.push(r);
    byDiet.set(r.diet, list);
  }
  const diets = [...byDiet.keys()].sort();

  // Insight 1: average protein, carbs and fat per diet.
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

  // Insight 2: top five recipes by protein in each diet.
  const topProtein = diets.map((diet) => ({
    diet,
    recipes: [...byDiet.get(diet)!]
      .sort((a, b) => b.protein - a.protein)
      .slice(0, 5)
      .map((r) => ({ name: r.name, cuisine: r.cuisine, protein: round(r.protein) })),
  }));

  // Insight 3: most common cuisines in each diet (top five).
  const topCuisines = diets.map((diet) => {
    const counts = new Map<string, number>();
    for (const r of byDiet.get(diet)!) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
    const cuisines = [...counts.entries()]
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a, b) => b.count - a.count || a.cuisine.localeCompare(b.cuisine))
      .slice(0, 5);
    return { diet, cuisines };
  });

  // Insight 4: ratios, from the averages in insight 1 (unrounded would differ by < 0.01).
  const ratios = averages.map((a) => ({
    diet: a.diet,
    proteinToCarbs: round(a.protein / a.carbs, 2),
    carbsToFat: round(a.carbs / a.fat, 2),
  }));

  // Insight 5: data quality.
  return {
    averages,
    topProtein,
    topCuisines,
    ratios,
    quality: {
      ...quality,
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

// The CSV inside the image never changes while the app runs, so work it out once.
let cached: Insights | null = null;
export function computeInsights(): Insights {
  if (!cached) cached = computeAll();
  return cached;
}
