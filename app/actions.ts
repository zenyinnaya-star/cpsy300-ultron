// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

"use server";

import { redirect } from "next/navigation";
import { sendReview } from "@/lib/reviews";

// Runs on the server when the review form is submitted.
export async function submitReview(formData: FormData) {
  const recipeId = String(formData.get("recipeId") ?? "").trim();
  const recipeName = String(formData.get("recipeName") ?? "").trim().slice(0, 200);
  const diet = String(formData.get("diet") ?? "").trim().toLowerCase();
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 500);

  const back = new URLSearchParams({ id: recipeId, name: recipeName, diet });
  if (!recipeId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    back.set("error", "Choose a rating from 1 to 5.");
    redirect(`/review?${back}`);
  }

  try {
    await sendReview({ recipeId, recipeName, diet, rating, comment });
    back.set("sent", "1");
  } catch (e) {
    // Shows in the container app's log stream (Category: Application).
    console.error("submitReview: could not send to Service Bus", e);
    back.set("error", "Sorry — your review could not be sent. Please try again in a minute.");
  }
  redirect(`/review?${back}`); // outside the try: redirect() works by throwing
}
