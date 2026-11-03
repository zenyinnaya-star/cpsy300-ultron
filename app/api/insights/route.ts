// CPSY 300 Team Project, Phase 1 — GIVEN CODE. Copy this file into your project exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

import { computeInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(computeInsights());
}
