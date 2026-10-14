import type { Place, SearchResponse } from "@/lib/types";

type Status = "idle" | "busy" | "ok" | "error";

const LABELS: Record<Status, string> = {
  idle: "Ready",
  busy: "Searching",
  ok: "Results",
  error: "Search failed",
};

export default function MapHud({
  loading,
  error,
  result,
  selected,
  selectedIndex,
  onFit,
}: {
  loading: boolean;
  error: string | null;
  result: SearchResponse | null;
  selected: Place | null;
  selectedIndex: number;
  onFit: () => void;
}) {
  const places = result?.places ?? [];
  const rated = places.filter((p) => p.rating !== null);
  const avg = rated.length
    ? rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length
    : null;
  const known = places.filter((p) => p.openNow !== null);
  const open = known.filter((p) => p.openNow).length;

  const status: Status = loading
    ? "busy"
    : error
      ? "error"
      : result
        ? "ok"
        : "idle";

  return (
    <>
      {loading && <div className="hud-progress" aria-hidden="true" />}
      <div className="hud" aria-label="Map summary">
        <div className="hud-panel">
          <div className="hud-head">
            <span className={`hud-dot hud-dot-${status}`} aria-hidden="true" />
            <span className="hud-label">{LABELS[status]}</span>
            {places.length > 1 && (
              <button type="button" className="hud-btn" onClick={onFit}>
                Fit all
              </button>
            )}
          </div>

          {result ? (
            <>
              <div className="hud-query">
                {result.query.placeType} <span>in</span> {result.query.location}
              </div>
              {result.query.qualifiers.length > 0 && (
                <div className="hud-qualifiers">
                  {result.query.qualifiers.join(" · ")}
                </div>
              )}
              <dl className="hud-stats">
                <div>
                  <dt>Results</dt>
                  <dd>{places.length}</dd>
                </div>
                <div>
                  <dt>Avg rating</dt>
                  <dd>{avg !== null ? `★ ${avg.toFixed(1)}` : "–"}</dd>
                </div>
                <div>
                  <dt>Open now</dt>
                  <dd>{known.length ? `${open}/${known.length}` : "–"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="hud-hint">
              {loading
                ? "Finding places and writing tips…"
                : "Search for a type of place in a city."}
            </div>
          )}

          {selected && (
            <div className="hud-selected">
              <span className="index">{selectedIndex + 1}</span>
              <span className="hud-selected-name">{selected.name}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
