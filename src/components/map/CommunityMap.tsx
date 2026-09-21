'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Shared Leaflet map for the whole app.
//
// Deliberately generic over its markers rather than knowing about players:
// the planned showcase-stops map renders through this same component instead
// of adding a second map stack.
//
// MUST be loaded via next/dynamic with { ssr: false } — Leaflet touches
// `window` at import time, so a server render throws.
//
// Tiles come from OpenStreetMap: no API key, and attribution is required (and
// rendered below the map by the caller). OSM's tile policy targets low-volume
// use, which fits a single-municipality community; if usage grows, swap the
// URL for a keyed free tier such as MapTiler.

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Primary label under the pin. Rendered as text — never as markup. */
  label: string;
  /** Secondary line, e.g. how old the position is. */
  sublabel?: string;
  /** Two-letter fallback shown when there is no avatar. */
  initials: string;
  avatarUrl?: string | null;
  /** Greyed and faded — used for stale positions. */
  muted?: boolean;
  onSelect?: () => void;
}

const FREDERIKSSUND: [number, number] = [55.8397, 12.0686];
const DEFAULT_ZOOM = 13;

// Trainer names and notes are user-supplied and go into an HTML string for the
// divIcon, so they must be escaped. Without this, a trainer name containing
// markup would execute in every other member's browser.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildIcon(marker: MapMarker): L.DivIcon {
  const ring = marker.muted ? '#9CA3AF' : '#2BBFAA';
  const opacity = marker.muted ? '0.55' : '1';
  const inner = marker.avatarUrl
    ? `<img src="${escapeHtml(marker.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : `<span style="color:#fff;font-size:12px;font-weight:600">${escapeHtml(marker.initials)}</span>`;

  const sublabel = marker.sublabel
    ? `<div style="margin-top:2px;background:#fff;border-radius:5px;padding:1px 5px;font-size:10px;color:#6B7280;white-space:nowrap">${escapeHtml(marker.sublabel)}</div>`
    : '';

  return L.divIcon({
    className: 'pogo-map-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity}">
      <div style="width:36px;height:36px;border-radius:50%;background:${ring};border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;overflow:hidden">${inner}</div>
      <div style="margin-top:3px;background:#fff;border-radius:5px;padding:1px 5px;font-size:10px;font-weight:600;color:#111827;white-space:nowrap">${escapeHtml(marker.label)}</div>
      ${sublabel}
    </div>`,
    iconSize: [36, 56],
    iconAnchor: [18, 18],
  });
}

// Keeps every marker in view as they come and go. Runs inside MapContainer so
// it can reach the map instance.
//
// Two things this has to get right, both of which were wrong first time:
//
// 1. Leaflet caches its container size at init. The map is dynamically imported
//    into a container whose height comes from a Tailwind class, so the first
//    measurement can happen before layout settles — fitBounds then computes a
//    zoom for the wrong viewport and parks every pin off-screen. invalidateSize()
//    on mount and on any container resize fixes it (and covers the preview →
//    fullscreen transition, which changes the container size dramatically).
// 2. Fitting must key off the marker *positions*, not the marker array. The
//    caller rebuilds that array every 30s so the "set 6 min siden" labels stay
//    honest; re-fitting on that would yank the map out from under anyone who
//    had panned it.
function FitBounds({ markers, focus }: { markers: MapMarker[]; focus: [number, number] | null }) {
  const map = useMap();
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      setSizeTick(tick => tick + 1);
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  // Only the identity and position of each pin, so label ticks don't re-fit.
  const positionsKey = markers
    .map(marker => `${marker.id}:${marker.lat},${marker.lng}`)
    .join('|');

  useEffect(() => {
    map.invalidateSize();

    if (focus) {
      map.setView(focus, 15);
      return;
    }

    const points = positionsKey
      ? positionsKey.split('|').map(entry => {
          const [, coords] = entry.split(':');
          const [lat, lng] = coords.split(',').map(Number);
          return [lat, lng] as [number, number];
        })
      : [];

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
  }, [map, positionsKey, focus, sizeTick]);

  return null;
}

export interface CommunityMapProps {
  markers: MapMarker[];
  /** Pans here when set — used by "centrer på mig". */
  focus?: [number, number] | null;
  /** Tailwind height class; the map needs an explicit height to render at all. */
  className?: string;
  interactive?: boolean;
}

export default function CommunityMap({
  markers,
  focus = null,
  className = 'h-64',
  interactive = true,
}: CommunityMapProps) {
  const center = useMemo<[number, number]>(
    () => (markers.length > 0 ? [markers[0].lat, markers[0].lng] : FREDERIKSSUND),
    [markers]
  );

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        // Attribution is rendered by the caller so it matches the app's type
        // scale instead of Leaflet's default control styling.
        attributionControl={false}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <FitBounds markers={markers} focus={focus} />
        {markers.map(marker => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={buildIcon(marker)}
            eventHandlers={marker.onSelect ? { click: marker.onSelect } : undefined}
          />
        ))}
      </MapContainer>
    </div>
  );
}
