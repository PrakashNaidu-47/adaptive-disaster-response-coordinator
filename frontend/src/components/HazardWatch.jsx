import React, { useEffect, useMemo, useRef, useState } from "react";

const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

const USGS_SIGNIFICANT_DAY_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
const EONET_EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";
const REFRESH_MS = 5 * 60 * 1000;

let leafletLoader;

const loadLeaflet = async () => {
  if (window.L) return window.L;
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return leafletLoader;
};

const hazardColors = {
  Earthquake: "#f28b30",
  Flood: "#2c7be5",
  Tornado: "#d64545",
  Hurricane: "#6f3cc3",
  Wildfire: "#e26e2c",
  "Severe Storm": "#5a5f8a",
  "Winter Storm": "#2f9ab5",
  Tsunami: "#0f8b7e",
  Volcano: "#b5512f",
  Landslide: "#8a6d3b",
  Alert: "#5b6b65",
};

const formatTimestamp = (value) => {
  if (!value) return "Unknown time";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown time";
  }
};

const buildEarthquakeItems = (features = []) =>
  features.map((feature) => {
    const [longitude, latitude] = feature.geometry?.coordinates || [];
    const magnitude = feature.properties?.mag;
    return {
      id: feature.id,
      type: "Earthquake",
      source: "USGS",
      title: feature.properties?.title || "Earthquake",
      location: feature.properties?.place || "Unknown location",
      time: feature.properties?.time,
      magnitude,
      severity: magnitude ? `M ${magnitude.toFixed(1)}` : "Unknown",
      url: feature.properties?.url,
      latitude,
      longitude,
    };
  });

const mapEonetCategory = (category = "") => {
  const normalized = category.toLowerCase();
  if (normalized.includes("severe")) return "Severe Storm";
  if (normalized.includes("flood")) return "Flood";
  if (normalized.includes("volcano")) return "Volcano";
  if (normalized.includes("wildfire")) return "Wildfire";
  if (normalized.includes("landslide")) return "Landslide";
  return null;
};

const buildEonetItems = (events = []) =>
  events
    .map((event) => {
      const categories = event.categories || [];
      const categoryTitle = categories[0]?.title || "Event";
      const type = mapEonetCategory(categoryTitle) || "Alert";
      const geometry = event.geometry || [];
      const latest = geometry[geometry.length - 1] || {};
      const coordinates = latest.coordinates || [];
      if (coordinates.length < 2) return null;
      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      const sources = event.sources || [];
      const link = sources[0]?.url;

      return {
        id: `eonet-${event.id}`,
        type,
        source: "NASA EONET",
        title: event.title || categoryTitle,
        location: categoryTitle,
        time: latest.date,
        severity: "Advisory",
        url: link,
        latitude,
        longitude,
      };
    })
    .filter(Boolean);

const HazardWatch = ({ onHazardSelect }) => {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const markerLookupRef = useRef(new Map());
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const hazardCounts = useMemo(() => {
    return hazards.reduce((acc, hazard) => {
      acc.total += 1;
      acc[hazard.type] = (acc[hazard.type] || 0) + 1;
      return acc;
    }, { total: 0 });
  }, [hazards]);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        if (!isMounted || !mapRef.current || leafletMapRef.current) return;

        const map = L.map(mapRef.current, { zoomControl: true }).setView([20, 0], 2);
        leafletMapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
      } catch {
        if (isMounted) {
          setError("Hazard map could not be loaded.");
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchHazards = async () => {
      setLoading(true);
      setError("");
      try {
        const [earthquakeRes, eonetRes] = await Promise.all([
          fetch(USGS_SIGNIFICANT_DAY_URL),
          fetch(
            `${EONET_EVENTS_URL}?status=open&category=severeStorms,floods,volcanoes,wildfires,landslides&limit=60`
          ),
        ]);
        if (!earthquakeRes.ok) throw new Error("USGS feed unavailable");
        if (!eonetRes.ok) throw new Error("NASA EONET feed unavailable");

        const earthquakeJson = await earthquakeRes.json();
        const eonetJson = await eonetRes.json();

        const quakeItems = buildEarthquakeItems(earthquakeJson.features || []);
        const eonetItems = buildEonetItems(eonetJson.events || []);
        const merged = [...eonetItems, ...quakeItems]
          .sort((a, b) => (b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0))
          .slice(0, 75);

        if (!isMounted) return;
        setHazards(merged);
        setLastUpdated(Date.now());
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Unable to load hazard feeds.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHazards();
    const interval = setInterval(fetchHazards, REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!layerGroupRef.current || !leafletMapRef.current || !window.L) return;

    const L = window.L;
    layerGroupRef.current.clearLayers();
    markerLookupRef.current.clear();

    const bounds = L.latLngBounds([]);

    hazards.forEach((hazard) => {
      const color = hazardColors[hazard.type] || hazardColors.Alert;
      if (hazard.geometry) {
        try {
          const geoJson = L.geoJSON(hazard.geometry, {
            style: {
              color,
              weight: 1,
              opacity: 0.6,
              fillOpacity: 0.12,
            },
          }).addTo(layerGroupRef.current);
          geoJson.getBounds().isValid() && bounds.extend(geoJson.getBounds());
        } catch {
          // Ignore invalid geometry
        }
      }

      if (Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude)) {
        const radius = hazard.type === "Earthquake"
          ? Math.min(12, Math.max(6, 3 + (hazard.magnitude || 3)))
          : 6;
        const marker = L.circleMarker([hazard.latitude, hazard.longitude], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 1,
        }).addTo(layerGroupRef.current);
        marker.bindPopup(
          `<strong>${hazard.title}</strong><br/>${hazard.location}<br/>${hazard.severity}`
        );
        markerLookupRef.current.set(hazard.id, marker);
        bounds.extend([hazard.latitude, hazard.longitude]);
      }
    });

    if (hazards.length && bounds.isValid()) {
      leafletMapRef.current.fitBounds(bounds.pad(0.2));
    }
  }, [hazards]);

  const handleFocus = (hazard) => {
    const canFocus = Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude);
    if (canFocus && leafletMapRef.current) {
      leafletMapRef.current.flyTo([hazard.latitude, hazard.longitude], 6, { duration: 0.8 });
      const marker = markerLookupRef.current.get(hazard.id);
      if (marker) marker.openPopup();
    }
    if (typeof onHazardSelect === "function") {
      onHazardSelect(hazard);
    }
  };

  return (
    <section className="hazard-grid">
      <article className="panel hazard-map-panel">
        <div className="panel-header">
          <div>
            <h2>Live Hazard Map</h2>
            <p className="hero-copy">
              Global USGS earthquakes plus NASA EONET severe storms, floods, wildfires, and volcanoes.
            </p>
          </div>
          <div className="hazard-summary">
            <span className="status-label">Live Hazards</span>
            <strong>{hazardCounts.total}</strong>
            <span className="context-note">Updated {formatTimestamp(lastUpdated)}</span>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div ref={mapRef} className="hazard-map" />
      </article>

      <article className="panel hazard-list-panel">
        <div className="panel-header">
          <div>
            <h2>Severe Hazard Feed</h2>
            <p className="hero-copy">Click an entry to focus the map on that hazard.</p>
          </div>
          <div className="hazard-meta">
            <span className="status-label">Sources</span>
            <strong>USGS + NASA EONET</strong>
          </div>
        </div>
        {loading ? <p className="loading-hint">Refreshing live hazards...</p> : null}
        <div className="hazard-list">
          {hazards.map((hazard) => {
            const canFocus = Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude);
            return (
              <button
                type="button"
                key={hazard.id}
                className="hazard-row"
                onClick={() => handleFocus(hazard)}
                disabled={!canFocus}
              >
              <div className="hazard-row-header">
                <span className="hazard-type" style={{ background: hazardColors[hazard.type] }}>
                  {hazard.type}
                </span>
                <strong>{hazard.title}</strong>
              </div>
              <span className="context-note">{hazard.location}</span>
              <div className="hazard-row-meta">
                <span>{hazard.severity}</span>
                <span>{formatTimestamp(hazard.time)}</span>
              </div>
              </button>
            );
          })}
          {!loading && !hazards.length && !error ? (
            <p className="context-note">No active severe hazards found right now.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
};

export default HazardWatch;
