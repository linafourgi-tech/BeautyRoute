import { useEffect, useRef } from "react";
import { Navigation } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

const PUBLIC_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

// Renders the route on a real Mapbox GL map. Uses ONLY the Mapbox PUBLIC
// token (pk.*) -- Mapbox explicitly designs that token type for browser
// exposure and lets you restrict it by URL in your Mapbox account. All
// geocoding/matrix/directions calls (which need the SECRET token) already
// happened server-side before this component ever sees data -- this
// component only draws points and a line it's given.
export default function RouteMap({ stops, start, end, geometry, conflictIds }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const mapboxglRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!PUBLIC_TOKEN || !containerRef.current) return;
    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled) return;
      const mapboxgl = mod.default;
      mapboxglRef.current = mapboxgl;
      mapboxgl.accessToken = PUBLIC_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [46.6753, 24.7136],
        zoom: 10,
      });
      mapRef.current = map;
      map.on("load", () => {
        readyRef.current = true;
        renderRoute();
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderRoute() {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl || !readyRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const points = [];

    if (start) {
      const el = markerEl("S", "#4b5563");
      markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([start.lng, start.lat]).addTo(map));
      points.push([start.lng, start.lat]);
    }

    stops.forEach((s, i) => {
      const hasConflict = conflictIds?.has(s.id);
      const el = markerEl(String(i + 1), hasConflict ? "#dc2626" : "#7a2946");
      markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
      points.push([s.lng, s.lat]);
    });

    if (end) {
      const el = markerEl("E", "#4b5563");
      markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([end.lng, end.lat]).addTo(map));
      points.push([end.lng, end.lat]);
    }

    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource("route-line")) map.removeSource("route-line");

    if (geometry) {
      map.addSource("route-line", { type: "geojson", data: { type: "Feature", geometry, properties: {} } });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route-line",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#7a2946", "line-width": 4, "line-opacity": 0.75 },
      });
    }

    if (points.length > 0) {
      const bounds = points.reduce((b, p) => b.extend(p), new mapboxgl.LngLatBounds(points[0], points[0]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 400 });
    }
  }

  useEffect(() => {
    renderRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, start, end, geometry, conflictIds]);

  if (!PUBLIC_TOKEN) {
    return (
      <div className="aspect-[16/10] rounded-xl bg-surface-2 border border-line flex items-center justify-center">
        <div className="text-center text-muted px-6">
          <Navigation size={28} className="mx-auto mb-2 text-gold" />
          <p className="text-sm">Map isn't configured yet — ask your workspace owner to set up the maps provider.</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="aspect-[16/10] rounded-xl border border-line overflow-hidden" />;
}

function markerEl(label, color) {
  const el = document.createElement("div");
  el.style.width = "26px";
  el.style.height = "26px";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.color = "#fff";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "12px";
  el.style.fontWeight = "600";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
  el.textContent = label;
  return el;
}
