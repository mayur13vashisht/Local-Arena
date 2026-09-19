import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Loader2, Gamepad2, RefreshCw, AlertTriangle, Compass, ExternalLink } from "lucide-react";

interface Arena {
  id: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string;
}

const RADIUS_OPTIONS = [
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
];

// Human-friendly labels for the OSM tags we query.
const CATEGORY_LABELS: Record<string, string> = {
  internet_cafe: "Gaming / Internet Cafe",
  amusement_arcade: "Arcade",
  video_games: "Game Store",
  gaming: "Esports Venue",
  esports: "Esports Arena",
};

// Haversine distance in kilometers.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Address not listed";
}

export function NearbyArenas() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [status, setStatus] = useState<"idle" | "locating" | "searching" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(5000);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const search = useCallback(async (lat: number, lon: number, r: number) => {
    setStatus("searching");
    setError("");
    try {
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="internet_cafe"](around:${r},${lat},${lon});
          way["amenity"="internet_cafe"](around:${r},${lat},${lon});
          node["leisure"="amusement_arcade"](around:${r},${lat},${lon});
          way["leisure"="amusement_arcade"](around:${r},${lat},${lon});
          node["shop"="video_games"](around:${r},${lat},${lon});
          way["shop"="video_games"](around:${r},${lat},${lon});
          node["sport"="gaming"](around:${r},${lat},${lon});
          node["leisure"="esports"](around:${r},${lat},${lon});
        );
        out center 60;
      `;

      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });

      if (!res.ok) throw new Error("Failed to reach the venue directory. Please try again.");

      const data = await res.json();
      const seen = new Set<string>();
      const results: Arena[] = [];

      for (const el of data.elements || []) {
        const tags = el.tags || {};
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (elLat == null || elLon == null) continue;

        const name = tags.name || tags["name:en"];
        if (!name) continue; // skip unnamed points

        const key = name.toLowerCase() + Math.round(elLat * 1000) + Math.round(elLon * 1000);
        if (seen.has(key)) continue;
        seen.add(key);

        const rawCat = tags.amenity || tags.leisure || tags.shop || tags.sport || "";
        results.push({
          id: el.id,
          name,
          category: CATEGORY_LABELS[rawCat] || "Gaming Venue",
          lat: elLat,
          lon: elLon,
          distanceKm: distanceKm(lat, lon, elLat, elLon),
          address: buildAddress(tags),
        });
      }

      results.sort((a, b) => a.distanceKm - b.distanceKm);
      setArenas(results);
      setStatus("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong while searching.");
      setStatus("error");
    }
  }, []);

  const locateAndSearch = useCallback(
    (r: number) => {
      if (!("geolocation" in navigator)) {
        setError("Your browser does not support location services.");
        setStatus("error");
        return;
      }
      setStatus("locating");
      setError("");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lon: longitude });
          search(latitude, longitude, r);
        },
        (geoErr) => {
          setStatus("error");
          setError(
            geoErr.code === geoErr.PERMISSION_DENIED
              ? "Location access was denied. Please allow location access and try again."
              : "Could not determine your location. Please try again."
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    },
    [search]
  );

  const handleRadiusChange = (value: number) => {
    setRadius(value);
    if (coords) search(coords.lat, coords.lon, value);
  };

  const isBusy = status === "locating" || status === "searching";

  return (
    <div className="w-full bg-neutral-950 min-h-screen flex flex-col items-center pt-16 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Nearby{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500 uppercase">
              Esports Arenas
            </span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl">
            Discover gaming cafes, arcades, and LAN centers around you. Grab your squad and take the battle offline.
          </p>
        </motion.div>

        {/* Controls */}
        <div className="mt-10 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                Search radius
              </label>
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRadiusChange(opt.value)}
                    disabled={isBusy}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50 ${
                      radius === opt.value
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                        : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => locateAndSearch(radius)}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-sm hover:bg-neutral-200 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
            >
              {status === "locating" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Locating…
                </>
              ) : status === "searching" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </>
              ) : coords ? (
                <>
                  <RefreshCw className="w-4 h-4" /> Search again
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" /> Find arenas near me
                </>
              )}
            </button>
          </div>
        </div>

        {/* States */}
        <div className="mt-10">
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center text-center py-20 border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/30">
              <MapPin className="w-12 h-12 text-neutral-700 mb-4" />
              <p className="text-neutral-400 font-medium">Tap &quot;Find arenas near me&quot; to get started.</p>
              <p className="text-neutral-600 text-sm mt-1">We&apos;ll ask for your location to search around you.</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center text-center py-16 border border-red-500/20 rounded-3xl bg-red-500/5">
              <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-red-400 font-semibold max-w-md">{error}</p>
              <button
                onClick={() => locateAndSearch(radius)}
                className="mt-5 px-5 py-2 rounded-lg text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {isBusy && (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-4" />
              <p className="text-neutral-400 text-sm">
                {status === "locating" ? "Getting your location…" : "Scanning for gaming venues…"}
              </p>
            </div>
          )}

          {status === "done" && arenas.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-20 border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/30">
              <Gamepad2 className="w-12 h-12 text-neutral-700 mb-4" />
              <p className="text-neutral-300 font-medium">No listed arenas found within {radius / 1000} km.</p>
              <p className="text-neutral-600 text-sm mt-1">Try widening your search radius.</p>
            </div>
          )}

          {status === "done" && arenas.length > 0 && (
            <>
              <p className="text-neutral-500 text-sm mb-5">
                Found <span className="text-cyan-400 font-semibold">{arenas.length}</span> venue
                {arenas.length > 1 ? "s" : ""} within {radius / 1000} km
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {arenas.map((arena, i) => (
                  <motion.div
                    key={arena.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                    className="group bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 hover:border-cyan-500/40 transition-colors flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-400 bg-fuchsia-400/10 border border-fuchsia-400/20 rounded-full">
                          {arena.category}
                        </span>
                        <h3 className="text-lg font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                          {arena.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                        <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-sm font-bold text-white">{arena.distanceKm.toFixed(1)}</span>
                        <span className="text-[10px] text-neutral-500">km</span>
                      </div>
                    </div>

                    <p className="text-sm text-neutral-400 mt-2 flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{arena.address}</span>
                    </p>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${arena.lat},${arena.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center justify-center gap-2 text-sm font-medium text-cyan-400 hover:text-white bg-cyan-500/10 hover:bg-cyan-600 border border-cyan-500/30 rounded-lg py-2.5 transition-colors"
                    >
                      Get directions <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </motion.div>
                ))}
              </div>
              <p className="text-neutral-700 text-xs mt-8 text-center">
                Venue data from OpenStreetMap contributors. Listings may be incomplete.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
