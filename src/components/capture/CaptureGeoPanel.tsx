"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/labels";
import {
  type CaptureGeo,
  emptyCaptureGeo,
  formatCoords,
  formatHeading,
  normalizeHeading,
  prefersDesktopMap,
  readDeviceGeo,
} from "@/lib/capture-geo";
import { useI18n } from "@/components/I18nProvider";

type Props = {
  value: CaptureGeo;
  onChange: (next: CaptureGeo) => void;
  className?: string;
};

const HK_DEFAULT: [number, number] = [22.3027, 114.1772];

export function CaptureGeoPanel({ value, onChange, className }: Props) {
  const { t } = useI18n();
  const [useMap, setUseMap] = useState(true);
  const [sensing, setSensing] = useState(false);
  const [sensorError, setSensorError] = useState("");

  useEffect(() => {
    setUseMap(prefersDesktopMap());
  }, []);

  async function sense(forceMapFallback = false) {
    setSensing(true);
    setSensorError("");
    const geo = await readDeviceGeo();
    setSensing(false);
    if (geo.error === "denied") {
      setSensorError(t("capture.geoDenied"));
      if (forceMapFallback || prefersDesktopMap()) setUseMap(true);
      return;
    }
    if (geo.error === "unavailable" && geo.lat == null) {
      setSensorError(t("capture.geoUnavailable"));
      setUseMap(true);
      return;
    }
    onChange({
      lat: geo.lat,
      lng: geo.lng,
      headingDeg: geo.headingDeg ?? value.headingDeg,
    });
    if (!prefersDesktopMap() && geo.lat != null) setUseMap(false);
  }

  useEffect(() => {
    void sense();
    // Prefill once on mount for photo mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPoint = value.lat != null && value.lng != null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--axon-ink)]">{t("capture.geoTitle")}</h3>
          <p className="text-xs text-slate-500">{t("capture.geoHint")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={sensing}
            onClick={() => void sense(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            {sensing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t("capture.geoUsePhone")}
          </button>
          <button
            type="button"
            onClick={() => setUseMap(true)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium",
              useMap
                ? "bg-[var(--axon-brand)] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            <MapPin size={12} />
            {t("capture.geoSetOnMap")}
          </button>
        </div>
      </div>

      {sensorError && <p className="text-xs text-amber-700">{sensorError}</p>}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-slate-600 ring-1 ring-slate-200">
          <MapPin size={12} />
          {hasPoint
            ? formatCoords(value.lat!, value.lng!)
            : t("capture.geoNoPoint")}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-slate-600 ring-1 ring-slate-200">
          <Compass size={12} />
          {value.headingDeg != null
            ? formatHeading(value.headingDeg)
            : t("capture.geoNoHeading")}
        </span>
      </div>

      {useMap ? (
        <GeoMapEditor value={value} onChange={onChange} />
      ) : (
        <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-600">
          <p>{t("capture.geoPhoneReady")}</p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-[var(--axon-blue)]"
            onClick={() => setUseMap(true)}
          >
            {t("capture.geoSetOnMap")}
          </button>
        </div>
      )}

      {useMap && (
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <Navigation size={12} />
          <span className="shrink-0">{t("capture.geoHeading")}</span>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={Math.round(value.headingDeg ?? 0)}
            onChange={(e) =>
              onChange({
                ...value,
                headingDeg: normalizeHeading(Number(e.target.value)),
              })
            }
            className="min-w-0 flex-1"
          />
          <span className="w-14 tabular-nums text-right">
            {Math.round(value.headingDeg ?? 0)}°
          </span>
        </label>
      )}
    </div>
  );
}

function GeoMapEditor({
  value,
  onChange,
}: {
  value: CaptureGeo;
  onChange: (next: CaptureGeo) => void;
}) {
  const { t } = useI18n();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const center = useMemo<[number, number]>(() => {
    if (value.lat != null && value.lng != null) return [value.lat, value.lng];
    return HK_DEFAULT;
  }, [value.lat, value.lng]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    // Fix default marker icons under Next bundling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, value.lat != null ? 18 : 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    map.on("click", (e) => {
      const cur = valueRef.current;
      onChangeRef.current({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        headingDeg: cur.headingDeg ?? 0,
      });
    });

    mapRef.current = map;
    drawOverlay(map, valueRef.current);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      lineRef.current = null;
    };
    // init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    drawOverlay(map, value);
    if (value.lat != null && value.lng != null) {
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 17), { animate: true });
    }
  }, [value]);

  function drawOverlay(map: L.Map, geo: CaptureGeo) {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (lineRef.current) {
      lineRef.current.remove();
      lineRef.current = null;
    }
    if (geo.lat == null || geo.lng == null) return;

    markerRef.current = L.marker([geo.lat, geo.lng], { draggable: true })
      .addTo(map)
      .on("dragend", () => {
        const p = markerRef.current?.getLatLng();
        if (!p) return;
        onChangeRef.current({
          lat: p.lat,
          lng: p.lng,
          headingDeg: valueRef.current.headingDeg ?? 0,
        });
      });

    const heading = geo.headingDeg ?? 0;
    const end = projectHeading(geo.lat, geo.lng, heading, 35);
    lineRef.current = L.polyline(
      [
        [geo.lat, geo.lng],
        [end.lat, end.lng],
      ],
      { color: "#f77f00", weight: 4, opacity: 0.95 },
    ).addTo(map);
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-[var(--axon-line)]">
      <div ref={mapEl} className="h-[260px] w-full bg-slate-100 md:h-[320px]" />
      <p className="bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{t("capture.geoMapHint")}</p>
    </div>
  );
}

/** Rough meters → lat/lng offset for direction arrow on map. */
function projectHeading(lat: number, lng: number, headingDeg: number, meters: number) {
  const rad = (normalizeHeading(headingDeg)! * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng = (meters * Math.sin(rad)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

export { emptyCaptureGeo };
