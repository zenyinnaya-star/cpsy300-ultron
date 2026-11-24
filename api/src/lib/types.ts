// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// The shapes of the data the back end stores and returns.

export type Recipe = {
  id: string;            // stable: the same diet + recipe name always gives the same id
  diet: string;          // also the partition key of the "recipes" container
  name: string;
  cuisine: string;
  protein: number;       // grams, whole recipe
  carbs: number;
  fat: number;
  datasetVersion?: string;
};

export type Quality = {
  rowsRead: number;
  namesTidied: number;
  removedBlankOrNotANumber: number;
  removedDuplicates: number;
  removedExtreme: number;
  keptZeroProteinOrFat: number;
  rowsUsed: number;
  rules: string[];
};

export type Insights = {
  averages: { diet: string; protein: number; carbs: number; fat: number; recipes: number }[];
  topProtein: { diet: string; recipes: { id: string; name: string; cuisine: string; protein: number }[] }[];
  topCuisines: { diet: string; cuisines: { cuisine: string; count: number }[] }[];
  ratios: { diet: string; proteinToCarbs: number; carbsToFat: number }[];
  quality: Quality;
};

// The one document in the "insights" container: the insights plus where they came from.
export type InsightsDoc = Insights & {
  id: "current";
  datasetVersion: string;
  sourceBlob: string;
  processedAt: string;
};

export type Review = {
  id: string;            // the Service Bus message ID, so a redelivered message overwrites itself
  recipeId: string;      // partition key of the "reviews" container
  recipeName: string;
  diet: string;
  rating: number;        // 1 to 5
  comment: string;
  createdAt: string;
};

export type RecipeQuery = { diet?: string; q?: string; page: number; pageSize: number };
export type RecipePage = { page: number; pageSize: number; total: number; totalPages: number; items: Recipe[] };
