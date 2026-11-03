// CPSY 300 Team Project, Phase 1 — GIVEN CODE. Copy this file into your project exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import Charts from "@/app/components/Charts";
import { computeInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";   // build the page on every visit

const title = process.env.DASHBOARD_TITLE ?? "Recipe insights";

export default function Home() {
  const insights = computeInsights();
  const q = insights.quality;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 bg-zinc-50 p-6 text-zinc-900">
      <header>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-zinc-600">
          {q.rowsUsed.toLocaleString()} recipes across {insights.averages.length} diets ·{" "}
          <a className="underline" href="/api/insights">insights as JSON</a>
        </p>
      </header>

      <Charts insights={insights} />

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Data quality</h2>
        <table className="w-full max-w-xl text-left text-sm">
          <tbody>
            <tr><th className="py-1 pr-4 font-medium">Rows read</th><td>{q.rowsRead.toLocaleString()}</td></tr>
            <tr><th className="py-1 pr-4 font-medium">Names tidied (spaces, capitals)</th><td>{q.namesTidied}</td></tr>
            <tr><th className="py-1 pr-4 font-medium">Removed: blank or not a number</th><td>{q.removedBlankOrNotANumber}</td></tr>
            <tr><th className="py-1 pr-4 font-medium">Removed: duplicates</th><td>{q.removedDuplicates}</td></tr>
            <tr><th className="py-1 pr-4 font-medium">Removed: extreme values</th><td>{q.removedExtreme}</td></tr>
            <tr><th className="py-1 pr-4 font-medium">Kept but flagged: 0 g protein or fat</th><td>{q.keptZeroProteinOrFat}</td></tr>
            <tr className="border-t"><th className="py-1 pr-4 font-semibold">Rows used</th><td className="font-semibold">{q.rowsUsed.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Five highest-protein recipes per diet</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {insights.topProtein.map((d) => (
            <div key={d.diet}>
              <h3 className="font-medium capitalize">{d.diet}</h3>
              <ol className="list-decimal pl-5 text-sm">
                {d.recipes.map((r) => (
                  <li key={r.name}>{r.name} — {r.protein} g</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
