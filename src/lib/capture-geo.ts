export type CaptureGeo = {
  lat: number | null;
  lng: number | null;
  headingDeg: number | null;
};

export function emptyCaptureGeo(): CaptureGeo {
  return { lat: null, lng: null, headingDeg: null };
}

export function normalizeHeading(deg: number) {
  if (!Number.isFinite(deg)) return null;
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

export function parseGeoField(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function clampHeading(deg: number | null): number | null {
  if (deg == null || !Number.isFinite(deg)) return null;
  return normalizeHeading(deg);
}

/** Prefer fine pointer / no mobile UA → show map for manual point + heading. */
export function prefersDesktopMap() {
  if (typeof window === "undefined") return true;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const mobileUa = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobileUa || (coarse && !fine)) return false;
  return true;
}

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatHeading(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(normalizeHeading(deg)! / 45) % 8;
  return `${Math.round(normalizeHeading(deg)!)}° ${dirs[idx]}`;
}

export function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

function headingFromOrientation(e: DeviceOrientationEvent): number | null {
  const anyE = e as DeviceOrientationEvent & {
    webkitCompassHeading?: number;
  };
  if (typeof anyE.webkitCompassHeading === "number" && Number.isFinite(anyE.webkitCompassHeading)) {
    return normalizeHeading(anyE.webkitCompassHeading);
  }
  // alpha is degrees from north when absolute is true; otherwise relative
  if (typeof e.alpha === "number" && Number.isFinite(e.alpha)) {
    // Standard: 0 = north when absolute; convert to compass (camera facing ≈ alpha)
    return normalizeHeading(360 - e.alpha);
  }
  return null;
}

export async function requestOrientationPermission(): Promise<boolean> {
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  if (typeof DOE.requestPermission === "function") {
    try {
      const r = await DOE.requestPermission();
      return r === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export async function readDeviceGeo(opts?: {
  timeoutMs?: number;
}): Promise<CaptureGeo & { error?: "denied" | "unavailable" }> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const geo: CaptureGeo = emptyCaptureGeo();

  if (!navigator.geolocation) {
    return { ...geo, error: "unavailable" };
  }

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 15_000,
      });
    });
    geo.lat = pos.coords.latitude;
    geo.lng = pos.coords.longitude;
    if (typeof pos.coords.heading === "number" && Number.isFinite(pos.coords.heading) && pos.coords.heading >= 0) {
      geo.headingDeg = normalizeHeading(pos.coords.heading);
    }
  } catch (err) {
    const code = (err as GeolocationPositionError)?.code;
    return {
      ...geo,
      error: code === 1 ? "denied" : "unavailable",
    };
  }

  const ok = await requestOrientationPermission();
  if (ok && typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
    const heading = await new Promise<number | null>((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        window.removeEventListener("deviceorientationabsolute", onAbs as EventListener);
        window.removeEventListener("deviceorientation", onRel as EventListener);
        resolve(null);
      }, 2500);

      function finish(h: number | null) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("deviceorientationabsolute", onAbs as EventListener);
        window.removeEventListener("deviceorientation", onRel as EventListener);
        resolve(h);
      }

      function onAbs(e: Event) {
        const h = headingFromOrientation(e as DeviceOrientationEvent);
        if (h != null) finish(h);
      }
      function onRel(e: Event) {
        const ev = e as DeviceOrientationEvent;
        if ((ev as { absolute?: boolean }).absolute === false && typeof (ev as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading !== "number") {
          return;
        }
        const h = headingFromOrientation(ev);
        if (h != null) finish(h);
      }

      window.addEventListener("deviceorientationabsolute", onAbs as EventListener);
      window.addEventListener("deviceorientation", onRel as EventListener);
    });
    if (heading != null) geo.headingDeg = heading;
  }

  return geo;
}

export function appendGeoToForm(form: FormData, geo: CaptureGeo) {
  if (geo.lat != null) form.set("lat", String(geo.lat));
  if (geo.lng != null) form.set("lng", String(geo.lng));
  if (geo.headingDeg != null) form.set("headingDeg", String(geo.headingDeg));
}

export function latLngFromExif(exif: Record<string, unknown> | null | undefined): {
  lat: number | null;
  lng: number | null;
} {
  if (!exif) return { lat: null, lng: null };
  const lat =
    typeof exif.latitude === "number"
      ? exif.latitude
      : typeof exif.GPSLatitude === "number"
        ? exif.GPSLatitude
        : null;
  const lng =
    typeof exif.longitude === "number"
      ? exif.longitude
      : typeof exif.GPSLongitude === "number"
        ? exif.GPSLongitude
        : null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null };
  }
  return { lat, lng };
}
