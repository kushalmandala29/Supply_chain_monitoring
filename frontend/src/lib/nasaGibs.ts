// Mirrors agents/vision/main.py's _snapshot_url and etl/tasks/satellite.py's
// _ambient_snapshot_url -- built client-side too so a picture appears for
// every resolved location, not just the queries the Vision Agent happened to
// be routed to handle (its prompt only adds "vision" for storm/imagery-
// sounding intents; a plain facility/route click never routes there).
const GIBS_SNAPSHOT_URL = "https://wvs.earthdata.nasa.gov/api/v1/snapshot";
const GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
const HALF_DEGREES = 3;
const WIDTH = 640;
const HEIGHT = 640;

/** Free, keyless NASA GIBS true-color snapshot centered on a resolved
 * location -- a single directly-loadable JPEG, no tile math needed. */
export function gibsSnapshotUrl(lat: number, lon: number): string {
  // GIBS's daily composite has ~1 day publication latency; "today" is
  // usually not yet available.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const south = Math.max(lat - HALF_DEGREES, -90);
  const north = Math.min(lat + HALF_DEGREES, 90);
  const west = Math.max(lon - HALF_DEGREES, -180);
  const east = Math.min(lon + HALF_DEGREES, 180);
  return `${GIBS_SNAPSHOT_URL}?REQUEST=GetSnapshot&LAYERS=${GIBS_LAYER}&CRS=EPSG:4326`
    + `&TIME=${yesterday}&BBOX=${south},${west},${north},${east}`
    + `&FORMAT=image/jpeg&WIDTH=${WIDTH}&HEIGHT=${HEIGHT}`;
}
