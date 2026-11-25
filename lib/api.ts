// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Calls to the Phase 2 back end (the Function App). Server-side only: the browser never talks
// to the functions directly, so no cross-site (CORS) settings are needed.
import type { InsightsDoc, RecipePage, Review } from "@/lib/types";

function base(): string {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error("The environment variable API_BASE_URL is missing.");
  return url.replace(/\/+$/, "");
}

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The API answered ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export const getInsights = () => get<InsightsDoc>("/api/insights");

export function searchRecipes(p: { diet?: string; q?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (p.diet) qs.set("diet", p.diet);
  if (p.q) qs.set("q", p.q);
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", "20");
  return get<RecipePage>(`/api/recipes?${qs}`);
}

export const latestReviews = () => get<Review[]>("/api/reviews");
