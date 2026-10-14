"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Place, SearchResponse } from "@/lib/types";
import MapHud from "./MapHud";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

const EXAMPLES = [
  "cafes in Halmstad",
  "vegan restaurants in Gothenburg",
  "pharmacy open late in Malmö",
];

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const { protocol } = new URL(u);
    return protocol === "https:" || protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

function todayHours(p: Place): string | null {
  const line = p.weekdayHours[(new Date().getDay() + 6) % 7];
  if (!line) return null;
  const i = line.indexOf(": ");
  return i >= 0 ? line.slice(i + 2) : line;
}

function Status({ place }: { place: Place }) {
  if (place.openNow === null) return null;
  return (
    <span className={place.openNow ? "badge badge-open" : "badge badge-closed"}>
      {place.openNow ? "Open now" : "Closed now"}
    </span>
  );
}

function ViewportController({
  places,
  selected,
  fitKey,
}: {
  places: Place[];
  selected: Place | null;
  fitKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || places.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 64);
  }, [map, places, fitKey]);

  useEffect(() => {
    if (map && selected) map.panTo({ lat: selected.lat, lng: selected.lng });
  }, [map, selected]);

  return null;
}

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
              const hours = todayHours(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={p.id === selectedId ? "card card-active" : "card"}
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
                    <div className="address">{p.address}</div>
                    <div className="meta">
                      <Status place={p} />
                      {hours && <span className="hours">Today {hours}</span>}
                    </div>
                    {p.tip && <div className="tip">{p.tip}</div>}
                  </button>
                </li>
              );
            })}
          </ol>

          {result && places.length === 0 && (
            <div className="empty">No places found. Try a broader search.</div>
          )}
        </section>

        <section className="map">
          {MAPS_KEY ? (
            <APIProvider apiKey={MAPS_KEY}>
              <GoogleMap
                mapId={MAP_ID}
                defaultCenter={{ lat: 59.33, lng: 18.07 }}
                defaultZoom={5}
                gestureHandling="greedy"
                disableDefaultUI={false}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
              >
                <ViewportController
                  places={places}
                  selected={selected}
                  fitKey={fitKey}
                />
                {places.map((p) => (
                  <AdvancedMarker
                    key={p.id}
                    position={{ lat: p.lat, lng: p.lng }}
                    title={p.name}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <Pin
                      background={p.id === selectedId ? "#b45309" : "#1e3a5f"}
                      borderColor="#0f2238"
                      glyphColor="#ffffff"
                    />
                  </AdvancedMarker>
                ))}
                {selected && (
                  <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    pixelOffset={[0, -42]}
                    onCloseClick={() => setSelectedId(null)}
                    headerContent={<strong>{selected.name}</strong>}
                  >
                    <div className="info">
                      {selected.rating !== null && (
                        <div>★ {selected.rating.toFixed(1)}</div>
                      )}
                      {selected.tip && <p>{selected.tip}</p>}
                      <div className="info-links">
                        {safeUrl(selected.website) && (
                          <a
                            href={safeUrl(selected.website)!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Website
                          </a>
                        )}
                        {safeUrl(selected.mapsUrl) && (
                          <a
                            href={safeUrl(selected.mapsUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open in Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="empty map-missing">
              Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the map.
            </div>
          )}
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
