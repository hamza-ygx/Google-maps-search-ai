"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { SearchResponse } from "@/lib/types";
import { safeUrl } from "@/lib/url";
import MapHud from "./MapHud";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="empty map-missing">Loading map…</div>,
});

const EXAMPLES = [
  "cafes in Halmstad",
  "vegan restaurants in Gothenburg",
  "pharmacy open late in Malmö",
];

export default function SearchApp() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);

  const places = useMemo(() => result?.places ?? [], [result]);
  const selected = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId],
  );
  const selectedIndex = selected ? places.indexOf(selected) : -1;

  async function run(query: string) {
    const text = query.trim();
    if (text.length < 2 || loading) return;

    setLoading(true);
    setError(null);
    setSelectedId(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Search failed.");
      setResult(data as SearchResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Place Finder</h1>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            run(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Try "cafes in Halmstad"'
            maxLength={200}
            aria-label="Search for places"
          />
          <button type="submit" disabled={loading || q.trim().length < 2}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </header>

      <main className="content">
        <section className="panel" aria-live="polite">
          {error && <div className="error">{error}</div>}

          {!result && !error && !loading && (
            <div className="empty">
              <p>Ask for a type of place in a city or area.</p>
              <div className="chips">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setQ(ex);
                      run(ex);
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {result && (
            <p className="interpretation">
              {places.length} result{places.length === 1 ? "" : "s"} for{" "}
              <strong>{result.query.placeType}</strong> in{" "}
              <strong>{result.query.location}</strong>
              {result.query.qualifiers.length > 0 &&
                ` (${result.query.qualifiers.join(", ")})`}
            </p>
          )}

          <ol className="list">
            {places.map((p, i) => {
              const website = safeUrl(p.website);
              const source = safeUrl(p.source);
              return (
                <li
                  key={p.id}
                  className={p.id === selectedId ? "card card-active" : "card"}
                >
                  <button
                    type="button"
                    className="card-main"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="card-head">
                      <span className="index">{i + 1}</span>
                      <span className="name">{p.name}</span>
                      {p.rating !== null && (
                        <span className="rating">
                          ★ {p.rating.toFixed(1)}
                          {p.ratingCount !== null && (
                            <span className="count"> ({p.ratingCount})</span>
                          )}
                        </span>
                      )}
                    </div>
                    {p.address && <div className="address">{p.address}</div>}
                    {(p.hours || p.lat === null) && (
                      <div className="meta">
                        {p.hours && <span className="hours">{p.hours}</span>}
                        {p.lat === null && (
                          <span className="badge badge-muted">Not on map</span>
                        )}
                      </div>
                    )}
                    {p.tip && <div className="tip">{p.tip}</div>}
                  </button>
                  {(website || source) && (
                    <div className="card-links">
                      {website && (
                        <a href={website} target="_blank" rel="noopener noreferrer">
                          Website
                        </a>
                      )}
                      {source && (
                        <a href={source} target="_blank" rel="noopener noreferrer">
                          Source
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {result && places.length === 0 && (
            <div className="empty">No places found. Try a broader search.</div>
          )}

          {result && places.length > 0 && (
            <p className="disclaimer">
              Found by AI web search. Ratings and hours may be out of date;
              check the source.
            </p>
          )}
        </section>

        <section className="map">
          <MapView
            places={places}
            selectedId={selectedId}
            fitKey={fitKey}
            onSelect={setSelectedId}
          />
          <MapHud
            loading={loading}
            error={error}
            result={result}
            selected={selected}
            selectedIndex={selectedIndex}
            onFit={() => {
              setSelectedId(null);
              setFitKey((k) => k + 1);
            }}
          />
        </section>
      </main>
    </div>
  );
}
