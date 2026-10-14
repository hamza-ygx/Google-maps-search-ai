import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";
import { parseQuery } from "@/lib/parse";
import { searchPlaces } from "@/lib/places";
import { allow } from "@/lib/ratelimit";
import { writeTips } from "@/lib/tips";
import type { SearchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) {
    return fail(429, "Too many searches. Try again in a few minutes.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request body.");
  }

  const raw = (body as { q?: unknown } | null)?.q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length < 2 || q.length > 200) {
    return fail(400, "Enter a search between 2 and 200 characters.");
  }

  try {
    const parsed = await parseQuery(q);
    if (!parsed) {
      return fail(
        422,
        'Could not tell what or where to search. Try "cafes in Halmstad".',
      );
    }

    const candidates = await searchPlaces(parsed);
    const tips = await writeTips(candidates, q);

    const result: SearchResponse = {
      query: parsed,
      places: candidates.map((c) => ({ ...c.place, tip: tips[c.place.id] ?? "" })),
    };
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message);
    console.error("Search failed", err);
    return fail(500, "Something went wrong. Try again.");
  }
}
