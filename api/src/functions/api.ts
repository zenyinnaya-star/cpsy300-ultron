// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// The read API the dashboard calls. Anonymous: anyone may read the insights and search recipes.
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getStore } from "../lib/store";

const json = (status: number, body: unknown): HttpResponseInit => ({ status, jsonBody: body });

// Runs one request and turns a failure into a clear answer, the same way as recipes.ts in
// Week 6 Day 2: 403 when Cosmos DB refuses this identity (no data role yet), 500 for anything
// else. The real reason is written to the log either way.
async function answer(context: InvocationContext, work: () => Promise<HttpResponseInit>): Promise<HttpResponseInit> {
  try {
    return await work();
  } catch (e: unknown) {
    context.error(e);
    if ((e as { code?: number }).code === 403) {
      return json(403, { error: "Cosmos DB refused: this identity has no data role yet" });
    }
    return json(500, { error: "The API failed: read the function's log for the reason" });
  }
}

// GET /api/insights — the precomputed insights: one point read, about 1 RU.
export async function getInsights(_req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return answer(context, async () => {
    const doc = await getStore().getInsights();
    if (!doc) return json(404, { error: "No data yet. Upload a CSV to the uploads container." });
    context.log(`insights served datasetVersion=${doc.datasetVersion}`);
    return json(200, doc);
  });
}

// Reads a whole-number query parameter, or the fallback when it is missing or nonsense.
function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (value === null || value.trim() === "" || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// GET /api/recipes?diet=keto&q=chicken&page=2&pageSize=20
export async function searchRecipes(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return answer(context, async () => {
    const diet = (req.query.get("diet") ?? "").trim().toLowerCase().slice(0, 40);
    const q = (req.query.get("q") ?? "").trim().slice(0, 50);
    const page = intParam(req.query.get("page"), 1, 1, 10000);
    const pageSize = intParam(req.query.get("pageSize"), 20, 1, 50);
    const result = await getStore().queryRecipes({ diet: diet || undefined, q: q || undefined, page, pageSize });
    return json(200, result);
  });
}

// GET /api/reviews?recipeId=… — the latest reviews (ten), for one recipe or for all.
export async function listReviews(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return answer(context, async () => {
    const recipeId = (req.query.get("recipeId") ?? "").trim().slice(0, 64);
    return json(200, await getStore().latestReviews(recipeId || undefined, 10));
  });
}

app.http("insights", { methods: ["GET"], authLevel: "anonymous", route: "insights", handler: getInsights });
app.http("recipes", { methods: ["GET"], authLevel: "anonymous", route: "recipes", handler: searchRecipes });
app.http("reviews", { methods: ["GET"], authLevel: "anonymous", route: "reviews", handler: listReviews });
