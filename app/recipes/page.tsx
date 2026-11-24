// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import Link from "next/link";
import { searchRecipes } from "@/lib/api";

export const dynamic = "force-dynamic";

const DIETS = ["dash", "keto", "mediterranean", "paleo", "vegan"];

export default async function Recipes({ searchParams }: PageProps<"/recipes">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const diet = one(sp.diet);
  const q = one(sp.q);
  const page = Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1);

  const result = await searchRecipes({ diet, q, page });
  const link = (p: number) => `/recipes?${new URLSearchParams({ diet, q, page: String(p) })}`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6 text-zinc-900">
      <Link className="text-sm underline" href="/">← Dashboard</Link>
      <h1 className="text-2xl font-bold">Search recipes</h1>

      {/* A plain GET form: the search is in the address, so it can be bookmarked and shared. */}
      <form className="flex flex-wrap items-end gap-3" action="/recipes">
        <label className="flex flex-col text-sm">Diet
          <select name="diet" defaultValue={diet} className="rounded border border-zinc-300 px-2 py-1">
            <option value="">All diets</option>
            {DIETS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm">Keyword in the name
          <input name="q" defaultValue={q} maxLength={50} className="rounded border border-zinc-300 px-2 py-1" />
        </label>
        <button className="rounded bg-zinc-900 px-4 py-1.5 text-white">Search</button>
      </form>

      {!result || result.items.length === 0 ? (
        <p>No recipes match.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-600">{result.total.toLocaleString()} recipes · page {result.page} of {result.totalPages}</p>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="py-1">Recipe</th><th>Diet</th><th>Cuisine</th><th className="text-right">Protein</th><th className="text-right">Carbs</th><th className="text-right">Fat</th><th></th></tr></thead>
            <tbody>
              {result.items.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="py-1 pr-2">{r.name}</td><td>{r.diet}</td><td>{r.cuisine}</td>
                  <td className="text-right">{r.protein} g</td><td className="text-right">{r.carbs} g</td><td className="text-right">{r.fat} g</td>
                  <td className="pl-3"><Link className="underline" href={`/review?${new URLSearchParams({ id: r.id, name: r.name, diet: r.diet })}`}>Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <nav className="flex gap-4">
            {result.page > 1 && <Link className="underline" href={link(result.page - 1)}>← Previous</Link>}
            {result.page < result.totalPages && <Link className="underline" href={link(result.page + 1)}>Next →</Link>}
          </nav>
        </>
      )}
    </main>
  );
}
