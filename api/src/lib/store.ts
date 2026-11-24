// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Where the data lives. The functions only talk to the Store interface, so the tests can swap
// Cosmos DB for an in-memory copy. In Azure, CosmosStore signs in with the function app's
// managed identity (DefaultAzureCredential) — there is no key anywhere.
import { BulkOperationType, Container, CosmosClient, OperationInput, SqlParameter } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import type { InsightsDoc, Recipe, RecipePage, RecipeQuery, Review } from "./types";

export interface Store {
  upsertRecipes(recipes: Recipe[], datasetVersion: string): Promise<{ written: number; failed: number; ru: number }>;
  deleteOtherVersions(datasetVersion: string): Promise<{ deleted: number; ru: number }>;
  saveInsights(doc: InsightsDoc): Promise<void>;
  getInsights(): Promise<InsightsDoc | null>;
  queryRecipes(q: RecipeQuery): Promise<RecipePage>;
  saveReview(r: Review): Promise<void>;
  latestReviews(recipeId?: string, limit?: number): Promise<Review[]>;
}

// Cosmos DB for NoSQL. The database and the three containers are created beforehand with the
// Azure CLI: a managed identity with the data role can read and write items, but cannot create
// databases or containers.
export class CosmosStore implements Store {
  private recipes: Container;
  private insights: Container;
  private reviews: Container;

  constructor(endpoint: string, databaseName: string) {
    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const db = client.database(databaseName);
    this.recipes = db.container("recipes");   // partition key /diet
    this.insights = db.container("insights"); // partition key /id
    this.reviews = db.container("reviews");   // partition key /recipeId
  }

  async upsertRecipes(recipes: Recipe[], datasetVersion: string) {
    let written = 0, failed = 0, ru = 0;
    // Bulk mode sends many writes per request and slows itself down when Cosmos says "too many" (429).
    for (let i = 0; i < recipes.length; i += 1000) {
      const ops: OperationInput[] = recipes.slice(i, i + 1000).map((r) => ({
        operationType: BulkOperationType.Upsert,
        partitionKey: r.diet,
        resourceBody: { ...r, datasetVersion },
      }));
      const results = await this.recipes.items.executeBulkOperations(ops, { contentResponseOnWriteEnabled: false });
      for (const res of results) {
        ru += res.response?.requestCharge ?? 0;
        if (res.error || !res.response || res.response.statusCode >= 400) failed++;
        else written++;
      }
    }
    return { written, failed, ru: Math.round(ru) };
  }

  async deleteOtherVersions(datasetVersion: string) {
    const { resources, requestCharge } = await this.recipes.items
      .query<{ id: string; diet: string }>({
        query: "SELECT c.id, c.diet FROM c WHERE c.datasetVersion != @v",
        parameters: [{ name: "@v", value: datasetVersion }],
      })
      .fetchAll();
    let ru = requestCharge ?? 0, deleted = 0;
    for (let i = 0; i < resources.length; i += 1000) {
      const ops: OperationInput[] = resources.slice(i, i + 1000).map((r) => ({
        operationType: BulkOperationType.Delete, id: r.id, partitionKey: r.diet,
      }));
      const results = await this.recipes.items.executeBulkOperations(ops);
      for (const res of results) {
        ru += res.response?.requestCharge ?? 0;
        if (!res.error && res.response && res.response.statusCode < 400) deleted++;
      }
    }
    return { deleted, ru: Math.round(ru) };
  }

  async saveInsights(doc: InsightsDoc) {
    await this.insights.items.upsert(doc);
  }

  async getInsights() {
    try {
      const { resource } = await this.insights.item("current", "current").read<InsightsDoc>();
      return resource ?? null;
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 404) return null;
      throw e;
    }
  }

  async queryRecipes(q: RecipeQuery): Promise<RecipePage> {
    const where: string[] = [];
    const parameters: SqlParameter[] = [];
    if (q.diet) { where.push("c.diet = @diet"); parameters.push({ name: "@diet", value: q.diet }); }
    if (q.q) { where.push("CONTAINS(c.name, @q, true)"); parameters.push({ name: "@q", value: q.q }); } // true = ignore case
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const options = q.diet ? { partitionKey: q.diet } : {};

    const count = await this.recipes.items
      .query<number>({ query: `SELECT VALUE COUNT(1) FROM c${whereSql}`, parameters }, options)
      .fetchAll();
    const total = count.resources.reduce((a, b) => a + b, 0);

    const skip = Math.max(0, Math.floor((q.page - 1) * q.pageSize));
    const take = Math.max(1, Math.floor(q.pageSize));
    const page = await this.recipes.items
      .query<Recipe>(
        {
          // page and pageSize are whole numbers the API has already range-checked, so writing them
          // straight into the query is safe (Microsoft documents parameters for TOP, not for OFFSET/LIMIT).
          query: `SELECT c.id, c.diet, c.name, c.cuisine, c.protein, c.carbs, c.fat FROM c${whereSql} ORDER BY c.name OFFSET ${skip} LIMIT ${take}`,
          parameters,
        },
        options,
      )
      .fetchAll();

    return { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)), items: page.resources };
  }

  async saveReview(r: Review) {
    await this.reviews.items.upsert(r);
  }

  async latestReviews(recipeId?: string, limit = 10) {
    const { resources } = await this.reviews.items
      .query<Review>(
        recipeId
          ? { query: "SELECT TOP @n * FROM c WHERE c.recipeId = @id ORDER BY c.createdAt DESC", parameters: [{ name: "@n", value: limit }, { name: "@id", value: recipeId }] }
          : { query: "SELECT TOP @n * FROM c ORDER BY c.createdAt DESC", parameters: [{ name: "@n", value: limit }] },
        recipeId ? { partitionKey: recipeId } : {},
      )
      .fetchAll();
    return resources.map(({ id, recipeId, recipeName, diet, rating, comment, createdAt }) => ({ id, recipeId, recipeName, diet, rating, comment, createdAt }));
  }
}

// A plain in-memory Store with the same behaviour, used by the tests.
export class MemoryStore implements Store {
  recipes = new Map<string, Recipe>();
  insights: InsightsDoc | null = null;
  reviews = new Map<string, Review>();

  async upsertRecipes(recipes: Recipe[], datasetVersion: string) {
    for (const r of recipes) this.recipes.set(`${r.diet}|${r.id}`, { ...r, datasetVersion });
    return { written: recipes.length, failed: 0, ru: 0 };
  }
  async deleteOtherVersions(datasetVersion: string) {
    let deleted = 0;
    for (const [k, r] of this.recipes) if (r.datasetVersion !== datasetVersion) { this.recipes.delete(k); deleted++; }
    return { deleted, ru: 0 };
  }
  async saveInsights(doc: InsightsDoc) { this.insights = doc; }
  async getInsights() { return this.insights; }
  async queryRecipes(q: RecipeQuery): Promise<RecipePage> {
    const all = [...this.recipes.values()]
      .filter((r) => !q.diet || r.diet === q.diet)
      .filter((r) => !q.q || r.name.toLowerCase().includes(q.q.toLowerCase()))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const items = all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
      .map(({ id, diet, name, cuisine, protein, carbs, fat }) => ({ id, diet, name, cuisine, protein, carbs, fat }));
    return { page: q.page, pageSize: q.pageSize, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / q.pageSize)), items };
  }
  async saveReview(r: Review) { this.reviews.set(r.id, r); }
  async latestReviews(recipeId?: string, limit = 10) {
    return [...this.reviews.values()]
      .filter((r) => !recipeId || r.recipeId === recipeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

// One Store for the whole function app instance, created on first use.
let current: Store | null = null;
export function getStore(): Store {
  if (!current) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    if (!endpoint) throw new Error("The app setting COSMOS_ENDPOINT is missing.");
    current = new CosmosStore(endpoint, process.env.COSMOS_DATABASE ?? "recipesdb");
  }
  return current;
}
export function setStore(s: Store | null) { current = s; }
