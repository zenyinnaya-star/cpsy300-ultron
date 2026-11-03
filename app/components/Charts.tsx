"use client";

// CPSY 300 Team Project, Phase 1 — GIVEN CODE. Copy this file into your project exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Insights } from "@/lib/insights";

const COLORS = { protein: "#2563eb", carbs: "#f59e0b", fat: "#10b981", ratio: "#7c3aed", cuisine: "#0891b2" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="h-80">{children}</div>
    </section>
  );
}

export default function Charts({ insights }: { insights: Insights }) {
  const diets = insights.topCuisines.map((d) => d.diet);
  const [diet, setDiet] = useState(diets[0]);
  const cuisines = insights.topCuisines.find((d) => d.diet === diet)?.cuisines ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Chart 1: insight 1 */}
      <Card title="Average grams per recipe, by diet">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={insights.averages}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="diet" />
            <YAxis label={{ value: "grams", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="protein" name="Protein (g)" fill={COLORS.protein} />
            <Bar dataKey="carbs" name="Carbs (g)" fill={COLORS.carbs} />
            <Bar dataKey="fat" name="Fat (g)" fill={COLORS.fat} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Chart 2: insight 4 */}
      <Card title="Protein ÷ carbohydrates, by diet">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={insights.ratios}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="diet" />
            <YAxis label={{ value: "ratio", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Bar dataKey="proteinToCarbs" name="Protein ÷ carbs" fill={COLORS.ratio} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Chart 3: insight 3 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Most common cuisines for</h2>
          <select
            className="rounded border border-zinc-300 px-2 py-1"
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
          >
            {diets.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cuisines} layout="vertical" margin={{ left: 40, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: "number of recipes", position: "insideBottom", offset: -2 }} />
              <YAxis type="category" dataKey="cuisine" width={110} />
              <Tooltip />
              <Bar dataKey="count" name="Recipes" fill={COLORS.cuisine} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
