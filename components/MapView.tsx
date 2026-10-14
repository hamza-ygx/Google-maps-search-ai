"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Place } from "@/lib/types";
import { safeUrl } from "@/lib/url";

type Mapped = Place & { lat: number; lng: number };

const isMapped = (p: Place): p is Mapped => p.lat !== null && p.lng !== null;

function pinIcon(index: number, active: boolean): L.DivIcon {
  return L.divIcon({
    className: active ? "pin pin-active" : "pin",
    html: String(index + 1),
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function popupContent(p: Place): HTMLElement {
  const root = document.createElement("div");
  root.className = "info";

  const title = document.createElement("strong");
  title.textContent = p.name;
  root.append(title);

  if (p.rating !== null) {
    const rating = document.createElement("div");
    rating.textContent = `★ ${p.rating.toFixed(1)}`;
    root.append(rating);
  }

  if (p.tip) {
    const tip = document.createElement("p");
    tip.textContent = p.tip;
    root.append(tip);
  }

  const links = document.createElement("div");
  links.className = "info-links";
  for (const [label, url] of [
    ["Website", safeUrl(p.website)],
    ["Source", safeUrl(p.source)],
  ] as const) {
    if (!url) continue;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    links.append(a);
  }
  if (links.childElementCount) root.append(links);

  return root;
}

export default function MapView({
  places,
  selectedId,
  fitKey,
  onSelect,
}: {
  places: Place[];
  selectedId: string | null;
  fitKey: number;
  onSelect: (id: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);

  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!hostRef.current) return;
    const map = L.map(hostRef.current, { zoomControl: false }).setView(
      [59.33, 18.07],
      5,
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    places.forEach((p, i) => {
      if (!isMapped(p)) return;
      const marker = L.marker([p.lat, p.lng], {
        icon: pinIcon(i, false),
        title: p.name,
        keyboard: true,
      })
        .on("click", () => onSelectRef.current(p.id))
        .addTo(layer);
      markersRef.current.set(p.id, marker);
    });
  }, [places]);

  useEffect(() => {
    const map = mapRef.current;
    const points = places
      .filter(isMapped)
      .map((p): L.LatLngTuple => [p.lat, p.lng]);
    if (!map || points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [64, 64] });
  }, [places, fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    places.forEach((p, i) => {
      const marker = markersRef.current.get(p.id);
      if (!marker) return;
      const active = p.id === selectedId;
      marker.setIcon(pinIcon(i, active));
      marker.setZIndexOffset(active ? 1000 : 0);
    });

    const selected = places.find((p) => p.id === selectedId);
    if (!selected || !isMapped(selected)) {
      map.closePopup();
      return;
    }

    const host = hostRef.current;
    const hud = host?.parentElement?.querySelector(".hud");
    const top =
      host && hud
        ? hud.getBoundingClientRect().bottom -
          host.getBoundingClientRect().top +
          12
        : 12;

    const id = selected.id;
    const popup = L.popup({
      offset: [0, -10],
      maxWidth: 260,
      autoPanPaddingTopLeft: [12, top],
      autoPanPaddingBottomRight: [12, 12],
    })
      .setLatLng([selected.lat, selected.lng])
      .setContent(popupContent(selected))
      .on("remove", () => {
        if (selectedRef.current === id) onSelectRef.current(null);
      });
    popup.openOn(map);
  }, [places, selectedId]);

  return <div ref={hostRef} className="leaflet-host" />;
}
