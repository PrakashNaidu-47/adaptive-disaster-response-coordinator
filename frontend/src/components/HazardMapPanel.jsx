import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { formatTimestamp, hazardColors } from "../hooks/useHazardFeed";

const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

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

const HazardMapPanel = forwardRef(({ hazards, error, lastUpdated }, ref) => {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const markerLookupRef = useRef(new Map());
  const [mapError, setMapError] = useState("");

  const hazardCounts = useMemo(() => {
    return hazards.reduce(
      (acc, hazard) => {
        acc.total += 1;
        acc[hazard.type] = (acc[hazard.type] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [hazards]);

  useImperativeHandle(ref, () => ({
    focusHazard: (hazard) => {
      if (!leafletMapRef.current) return;
      if (!Number.isFinite(hazard.latitude) || !Number.isFinite(hazard.longitude)) return;
      leafletMapRef.current.flyTo([hazard.latitude, hazard.longitude], 6, { duration: 0.8 });
      const marker = markerLookupRef.current.get(hazard.id);
      if (marker) marker.openPopup();
    },
  }));

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
          setMapError("Hazard map could not be loaded.");
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
    if (!layerGroupRef.current || !leafletMapRef.current || !window.L) return;

    const L = window.L;
    layerGroupRef.current.clearLayers();
    markerLookupRef.current.clear();

    const bounds = L.latLngBounds([]);

    hazards.forEach((hazard) => {
      if (!Number.isFinite(hazard.latitude) || !Number.isFinite(hazard.longitude)) return;
      const color = hazardColors[hazard.type] || hazardColors.Alert;
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
    });

    if (hazards.length && bounds.isValid()) {
      leafletMapRef.current.fitBounds(bounds.pad(0.2));
    }
  }, [hazards]);

  return (
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
      {mapError ? <p className="error">{mapError}</p> : null}
      <div ref={mapRef} className="hazard-map" />
    </article>
  );
});

HazardMapPanel.displayName = "HazardMapPanel";

export default HazardMapPanel;
