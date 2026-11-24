// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Tests for the Phase 2 back end, run with:  npm test
// They use an in-memory store instead of Cosmos DB, and fake trigger inputs instead of Azure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { analyseCsv, recipeId } from "../src/lib/clean";
import { MemoryStore, setStore } from "../src/lib/store";
import { processCsv } from "../src/functions/processCsv";
import { getInsights, searchRecipes, listReviews } from "../src/functions/api";
import { storeReview, toReview } from "../src/functions/storeReview";

const csv = readFileSync(path.join(__dirname, "..", "..", "test", "All_Diets.csv"), "utf8");
const ctx = (fn: string, meta: Record<string, unknown> = {}) =>
  new InvocationContext({ invocationId: "test", functionName: fn, triggerMetadata: meta });

test("cleaning gives the Phase 1 reference numbers", () => {
  const { recipes, insights } = analyseCsv(csv);
  const q = insights.quality;
  assert.equal(q.rowsRead, 7806);
  assert.equal(q.removedDuplicates, 720);
  assert.equal(q.removedExtreme, 63);
  assert.equal(q.keptZeroProteinOrFat, 39);
  assert.equal(q.rowsUsed, 7023);
  assert.equal(recipes.length, 7023);
  const keto = insights.averages.find((a) => a.diet === "keto")!;
  assert.deepEqual([keto.protein, keto.carbs, keto.fat, keto.recipes], [99.8, 57.1, 152, 1449]);
  const vegan = insights.ratios.find((r) => r.diet === "vegan")!;
  assert.deepEqual([vegan.proteinToCarbs, vegan.carbsToFat], [0.23, 2.47]);
});

test("ids are stable, case-insensitive and Cosmos-safe", () => {
  assert.equal(recipeId("keto", "Keto Bread / Rolls?"), recipeId("keto", "  keto bread / rolls? "));
  assert.match(recipeId("keto", "a/b?c#d"), /^[0-9a-f]{24}$/);
  assert.notEqual(recipeId("keto", "x"), recipeId("paleo", "x"));
});

test("an upload stores recipes and insights once; a second upload replaces the first", async () => {
  const store = new MemoryStore();
  setStore(store);
  await processCsv(Buffer.from(csv), ctx("processCsv", { name: "All_Diets.csv" }));
  assert.equal(store.recipes.size, 7023);
  assert.equal(store.insights?.sourceBlob, "All_Diets.csv");
  assert.equal(store.insights?.quality.rowsUsed, 7023);

  // Version 2: only the keto rows.
  const lines = csv.split(/\r?\n/);
  const v2 = [lines[0], ...lines.filter((l) => l.startsWith("keto,"))].join("\n");
  await processCsv(Buffer.from(v2), ctx("processCsv", { name: "All_Diets_v2.csv" }));
  assert.equal(store.recipes.size, 1449);
  assert.ok([...store.recipes.values()].every((r) => r.diet === "keto"));
  assert.equal(store.insights?.sourceBlob, "All_Diets_v2.csv");
  assert.equal(store.insights?.averages.length, 1);
});

test("a file that is not a CSV, or has no usable rows, changes nothing", async () => {
  const store = new MemoryStore();
  setStore(store);
  await processCsv(Buffer.from(csv), ctx("processCsv", { name: "All_Diets.csv" }));
  await processCsv(Buffer.from("hello"), ctx("processCsv", { name: "notes.txt" }));
  await processCsv(Buffer.from("Diet_type,Recipe_name,Cuisine_type,Protein(g),Carbs(g),Fat(g)\nketo,,x,1,2,3\n"), ctx("processCsv", { name: "bad.csv" }));
  assert.equal(store.recipes.size, 7023);
  assert.equal(store.insights?.sourceBlob, "All_Diets.csv");
});

test("messy rows are tidied or skipped", () => {
  const messy = [
    "Diet_type,Recipe_name,Cuisine_type,Protein(g),Carbs(g),Fat(g),Extraction_day,Extraction_time",
    " Keto ,Egg Cups, American ,20,2,15,x,y",
    "keto,Egg cups,american,25,2,15,x,y",          // duplicate of the first (case-insensitive name)
    "paleo,Steak,american,,10,20,x,y",             // blank protein
    "paleo,Ribs,american,abc,10,20,x,y",           // not a number
    "vegan,Salad,mediterranean,0,12,0,x,y",        // zeros: kept and counted
    "vegan,Giant Cake,american,10,1500,40,x,y",    // extreme
  ].join("\n");
  const { recipes, insights } = analyseCsv(messy);
  assert.equal(recipes.length, 2);
  assert.deepEqual(
    [insights.quality.namesTidied, insights.quality.removedDuplicates, insights.quality.removedBlankOrNotANumber, insights.quality.removedExtreme, insights.quality.keptZeroProteinOrFat],
    [1, 1, 2, 1, 1],
  );
  assert.equal(recipes[0].diet, "keto");
  assert.equal(recipes[0].cuisine, "american");
});

test("the read API: insights, search with filter + keyword + pages, 404 before any upload", async () => {
  const store = new MemoryStore();
  setStore(store);
  const before = await getInsights(new HttpRequest({ method: "GET", url: "http://localhost/api/insights" }), ctx("insights"));
  assert.equal(before.status, 404);

  await processCsv(Buffer.from(csv), ctx("processCsv", { name: "All_Diets.csv" }));
  const ins = await getInsights(new HttpRequest({ method: "GET", url: "http://localhost/api/insights" }), ctx("insights"));
  assert.equal(ins.status, 200);

  const r = await searchRecipes(new HttpRequest({ method: "GET", url: "http://localhost/api/recipes?diet=Keto&q=CHICKEN&page=2&pageSize=5" }), ctx("recipes"));
  const body = r.jsonBody as { page: number; pageSize: number; total: number; items: { diet: string; name: string }[] };
  assert.equal(body.page, 2);
  assert.equal(body.items.length, 5);
  assert.ok(body.total > 10);
  assert.ok(body.items.every((i) => i.diet === "keto" && i.name.toLowerCase().includes("chicken")));

  const silly = await searchRecipes(new HttpRequest({ method: "GET", url: "http://localhost/api/recipes?page=-3&pageSize=9999" }), ctx("recipes"));
  const s = silly.jsonBody as { page: number; pageSize: number; total: number };
  assert.deepEqual([s.page, s.pageSize, s.total], [1, 50, 7023]);
});

test("reviews: stored from the queue once, bad ones rejected, latest first", async () => {
  const store = new MemoryStore();
  setStore(store);
  const msg = (o: object) => Buffer.from(JSON.stringify(o));
  await storeReview(msg({ recipeId: "abc", recipeName: "Egg Cups", diet: "keto", rating: 5, comment: " Great ", createdAt: "2026-11-05T10:00:00Z" }), ctx("storeReview", { messageId: "m1", deliveryCount: 1 }));
  await storeReview(msg({ recipeId: "abc", recipeName: "Egg Cups", diet: "keto", rating: 5, comment: " Great ", createdAt: "2026-11-05T10:00:00Z" }), ctx("storeReview", { messageId: "m1", deliveryCount: 2 }));
  await storeReview({ recipeId: "def", rating: 3, comment: "ok", createdAt: "2026-11-05T11:00:00Z" }, ctx("storeReview", { messageId: "m2" }));
  await storeReview(msg({ recipeId: "abc", rating: 9 }), ctx("storeReview", { messageId: "m3" }));
  await storeReview("not json", ctx("storeReview", { messageId: "m4" }));
  assert.equal(store.reviews.size, 2);
  assert.equal(store.reviews.get("m1")?.comment, "Great");
  assert.equal(toReview({ recipeId: "x", rating: 2.5 }, "m"), null);

  const res = await listReviews(new HttpRequest({ method: "GET", url: "http://localhost/api/reviews" }), ctx("reviews"));
  const list = res.jsonBody as { id: string }[];
  assert.deepEqual(list.map((r) => r.id), ["m2", "m1"]);
  const one = await listReviews(new HttpRequest({ method: "GET", url: "http://localhost/api/reviews?recipeId=abc" }), ctx("reviews"));
  assert.equal((one.jsonBody as unknown[]).length, 1);
});

test("a missing Cosmos DB data role answers 403, any other failure 500", async () => {
  const refused = new MemoryStore();
  refused.getInsights = async () => { throw Object.assign(new Error("Forbidden"), { code: 403 }); };
  setStore(refused);
  const r403 = await getInsights(new HttpRequest({ method: "GET", url: "http://localhost/api/insights" }), ctx("insights"));
  assert.equal(r403.status, 403);
  const broken = new MemoryStore();
  broken.queryRecipes = async () => { throw new Error("network down"); };
  setStore(broken);
  const r500 = await searchRecipes(new HttpRequest({ method: "GET", url: "http://localhost/api/recipes" }), ctx("recipes"));
  assert.equal(r500.status, 500);
  setStore(null);
});
