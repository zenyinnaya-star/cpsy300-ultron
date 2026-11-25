// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import Link from "next/link";
import { submitReview } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const id = one(sp.id), name = one(sp.name), diet = one(sp.diet), error = one(sp.error), sent = one(sp.sent);

  if (!id) {
    return <main className="p-6"><p>Pick a recipe first: <Link className="underline" href="/recipes">search recipes</Link>.</p></main>;
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 p-6 text-zinc-900">
      <Link className="text-sm underline" href="/recipes">← Search recipes</Link>
      <h1 className="text-2xl font-bold">Review: {name}</h1>
      <p className="text-sm text-zinc-600">Diet: {diet}</p>

      {sent ? (
        <p className="rounded border border-green-300 bg-green-50 p-3">
          Thank you — your review is on its way. It appears on the <Link className="underline" href="/">dashboard</Link> within a minute.
        </p>
      ) : (
        <form action={submitReview} className="space-y-3">
          <input type="hidden" name="recipeId" value={id} />
          <input type="hidden" name="recipeName" value={name} />
          <input type="hidden" name="diet" value={diet} />
          <label className="flex flex-col text-sm">Rating
            <select name="rating" required defaultValue="" className="rounded border border-zinc-300 px-2 py-1">
              <option value="" disabled>Choose…</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} — {"★".repeat(n)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm">Comment (optional, up to 500 characters)
            <textarea name="comment" maxLength={500} rows={4} className="rounded border border-zinc-300 px-2 py-1" />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="rounded bg-zinc-900 px-4 py-1.5 text-white">Send review</button>
        </form>
      )}
    </main>
  );
}
